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
    for (const node of searchResults) {
      const malId = node.id;
      const exists = await checkSeriesExists(malId);
      if (exists) {
        const { id, main_picture, ...rest } = node;
        resultsWithStatus.push({
          malId,
          imageUrl: node.main_picture?.large || node.main_picture?.medium || undefined,
          ...rest,
          inserted: false,
        });
        skippedCount++;
      } else {
        const metadata = node;
        const newSeries = await insertSeries(metadata, type);
        const { id, main_picture, ...rest } = node;
        resultsWithStatus.push({
          malId,
          imageUrl: node.main_picture?.large || node.main_picture?.medium || undefined,
          ...rest,          inserted: true,
          uuid: newSeries.id
        });
        insertedCount++;
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
  const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(title)}&limit=10`;
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
  return data.data.map(entry => entry.node);
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
 * Insert a new series into the database.
 * @param metadata - MAL metadata object
 * @param type - 'anime' or 'manga'
 * @returns The newly inserted series record.
 */
async function insertSeries(metadata: any, type: "anime" | "manga"): Promise<{ id: string }> {
  const { data, error } = await supabase.from('mal_series').insert({
    mal_id: metadata.id,
    type: type,
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
  }).select('id').single();

  if (error) {
    log.error("failed to insert series into supabase", { malId: metadata.id, error: error.message });
    throw APIError.internal("failed to insert series").withDetails({ supabaseError: error });
  }
  return data;
} 