import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { MalSeries } from "./types";
import { secret } from "encore.dev/config";
import { supabase } from "../supabase/client";

interface AddSeriesParams {
  title: string;
  type: "anime" | "manga";
}

interface MalSearchResult {
  malId: number;
  title: string;
  imageUrl?: string;
  inserted?: boolean;
  alreadyPresent?: boolean;
  uuid?: string;
}

interface AddSeriesResponse {
  status: "inserted" | "multiple_found" | "not_found" | "skipped" | "multiple_inserted";
  message: string;
  malId?: number;
  uuid?: string;
  matches?: MalSearchResult[];
}

interface SearchMalParams {
  title: string;
  type: "anime" | "manga";
}

interface SearchMalResponse {
  results: any[];
  count: number;
}

const malClientIdSecret = secret("MAL_CLIENT_ID");

function getMalClientId(): string {
  // Use process.env in test, secret() otherwise
  if (process.env.NODE_ENV === "test") {
    return process.env.MAL_CLIENT_ID || "";
  }
  return malClientIdSecret();
}

export const addSeries = api<AddSeriesParams, AddSeriesResponse>(
  { expose: true, method: "POST", path: "/add-series" },
  async (params): Promise<AddSeriesResponse> => {
    const { title, type } = params;
    log.info("MAL addSeries called", { title, type });
    const searchResults = await searchMalByTitle(title, type);
    if (searchResults.length === 0) {
      log.info("No MAL results found", { title, type });
      return {
        status: "not_found",
        message: `No ${type} found for title: ${title}`,
      };
    }
    const resultsWithStatus: MalSearchResult[] = [];
    let insertedCount = 0;
    let skippedCount = 0;
    // Upsert all series at once
    const upsertResults = await upsertMalSeries(searchResults);
    
    // Map results back to the original format
    for (let i = 0; i < searchResults.length; i++) {
      const node = searchResults[i];
      const upsertResult = upsertResults[i];
      const { id, main_picture, ...rest } = node;
      
      resultsWithStatus.push({
        malId: node.id,
        imageUrl: node.main_picture?.large || node.main_picture?.medium || undefined,
        ...rest,
        inserted: upsertResult.inserted,
        uuid: upsertResult.id
      });
      
      if (upsertResult.inserted) {
        insertedCount++;
      } else {
        skippedCount++;
      }
    }
    log.info("MAL addSeries completed", { title, type, inserted: insertedCount, skipped: skippedCount });
    return {
      status: insertedCount > 0 ? "inserted" : "skipped",
      message: `Processed ${searchResults.length} ${type} for title: ${title}. Inserted: ${insertedCount}, Skipped: ${skippedCount}`,
      matches: resultsWithStatus,
    };
  }
);

export const searchMal = api<SearchMalParams, SearchMalResponse>(
  { expose: true, method: "GET", path: "/search" },
  async (params): Promise<SearchMalResponse> => {
    const { title, type } = params;
    log.info("MAL search called", { title, type });
    
    const results = await searchMalByTitle(title, type);
    const upsertResults = await upsertMalSeries(results);
    const insertedCount = upsertResults.filter(r => r.inserted).length;
    const skippedCount = upsertResults.filter(r => !r.inserted).length;
    
    log.info("MAL search upsert completed", { title, type, inserted: insertedCount, skipped: skippedCount });
    
    // Map results to include insertion status
    const mappedResults = results.map((node, index) => ({
      ...node,
      inserted: upsertResults[index].inserted,
      uuid: upsertResults[index].id
    }));
    
    return {
      results: mappedResults,
      count: results.length,
    };
  }
);

/**
 * Search MAL for a series by title.
 * Returns all matches as an array of MalSearchResult.
 */
async function searchMalByTitle(title: string, type: "anime" | "manga"): Promise<any[]> {
  const endpoint = type === "anime" ? "anime" : "manga";
  const clientId = getMalClientId();
  if (!clientId) throw APIError.internal("MAL_CLIENT_ID not set in environment");
  const fields = [
    "id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_list_users,num_scoring_users,nsfw,created_at,updated_at,media_type,status,genres,my_list_status,num_episodes,num_volumes,num_chapters,start_season,broadcast,source,average_episode_duration,rating,pictures,background,related_anime,related_manga,recommendations,studios,statistics,authors{first_name,last_name},serialization{name}"
  ];
  const url = `https://api.myanimelist.net/v2/${endpoint}?q=${encodeURIComponent(title)}&limit=10&fields=${fields}`;
  const resp = await fetch(url, {
    headers: { "X-MAL-CLIENT-ID": clientId },
  });
  if (!resp.ok) {
    log.error("MAL search API error", { status: resp.status, title, type });
    throw APIError.unavailable("MAL API unavailable");
  }
  const data = (await resp.json()) as { data?: { node: any }[] };
  if (!data.data || data.data.length === 0) {
    return [];
  }
  return data.data.map(entry => entry.node).filter(node=>node.media_type==="manhwa");
}

/**
 * Check if a series with the given MAL ID already exists in the database.
 * @param malId - MAL series ID
 * @returns true if exists, false otherwise
 */
async function checkSeriesExists(malId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('mal_series')
    .select('id')
    .eq('mal_id', malId)
    .maybeSingle();

  if (error) {
    log.error("failed to check series existence in supabase", { malId, error: error.message });
    throw APIError.internal("failed to check series existence").withDetails({ supabaseError: error });
  }
  return !!data;
}

/**
 * Upsert multiple series into the database.
 * @param metadataArray - Array of MAL metadata objects
 * @returns Array of upserted series records with insertion status.
 */
async function upsertMalSeries(metadataArray: any[]): Promise<Array<{ id: string; inserted: boolean }>> {
  const entries = metadataArray.map(mapMalToDB);
  const { data, error } = await supabase.from('mal_series')
    .upsert(entries, { 
      onConflict: 'mal_id',
      ignoreDuplicates: false 
    })
    .select('id, mal_id')

  if (error) {
    log.error("failed to upsert series into supabase", { error: error.message });
    throw APIError.internal("failed to upsert series").withDetails({ supabaseError: error });
  }
  
  // Map back to original metadata to determine insertion status
  return data.map(dbRecord => {
    const originalMetadata = metadataArray.find(m => m.id === dbRecord.mal_id);
    const wasInserted = !originalMetadata?.updated_at || originalMetadata.updated_at === originalMetadata.created_at;
    return { id: dbRecord.id, inserted: wasInserted };
  });
}

function mapMalToDB(metadata: any) {
  return {
    mal_id: metadata.id,
    type: metadata.media_type,
    title: metadata.title,
    alternative_titles: metadata.alternative_titles,
    main_picture: metadata.main_picture?.large || metadata.main_picture?.medium,
    start_date: metadata.start_date,
    end_date: metadata.end_date,
    synopsis: metadata.synopsis,
    mean: metadata.mean,
    rank: metadata.rank,
    popularity: metadata.popularity,
    num_list_users: metadata.num_list_users,
    num_scoring_users: metadata.num_scoring_users,
    nsfw: metadata.nsfw,
    created_at: metadata.created_at,
    updated_at: metadata.updated_at,
    media_type: metadata.media_type,
    status: metadata.status,
    genres: metadata.genres,
    my_list_status: metadata.my_list_status,
    num_episodes: metadata.num_episodes,
    num_volumes: metadata.num_volumes,
    num_chapters: metadata.num_chapters,
    start_season: metadata.start_season,
    broadcast: metadata.broadcast,
    source: metadata.source,
    average_episode_duration: metadata.average_episode_duration,
    rating: metadata.rating,
    pictures: metadata.pictures,
    background: metadata.background,
    related_anime: metadata.related_anime,
    related_manga: metadata.related_manga,
    recommendations: metadata.recommendations,
    studios: metadata.studios,
    statistics: metadata.statistics,
    authors: metadata.authors,
    serialization: metadata.serialization
  }
} 