import { api, APIError, ErrCode } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import log from "encore.dev/log";
import { v4 as uuidv4 } from "uuid";
import { MalSeries } from "./types";
import { secret } from "encore.dev/config";

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

const db = new SQLDatabase("mal-service", {
  migrations: "./migrations",
});

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
        resultsWithStatus.push({
          malId,
          title: node.title,
          imageUrl: node.main_picture?.large || node.main_picture?.medium || undefined,
          inserted: false
        });
        skippedCount++;
      } else {
        const metadata = node;
        const uuid = uuidv4();
        await insertSeries(uuid, metadata, type);
        resultsWithStatus.push({
          malId,
          title: node.title,
          imageUrl: node.main_picture?.large || node.main_picture?.medium || undefined,
          inserted: true,
          uuid
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
  const url = `https://api.myanimelist.net/v2/${endpoint}?q=${encodeURIComponent(title)}&limit=10`;
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
  const row = await db.queryRow<{ id: string }>`SELECT id FROM mal_series WHERE mal_id = ${malId}`;
  return !!row;
}

/**
 * Insert a new series into the database.
 * @param uuid - System-generated UUID
 * @param metadata - MAL metadata object
 * @param type - 'anime' or 'manga'
 */
async function insertSeries(uuid: string, metadata: any, type: "anime" | "manga"): Promise<void> {
  // Map metadata to DB columns
  await db.exec`
    INSERT INTO mal_series (
      id, mal_id, type, title, alternative_titles, main_picture, start_date, end_date, synopsis, mean, rank, popularity, num_list_users, num_scoring_users, nsfw, created_at, updated_at, media_type, status, genres, my_list_status, num_episodes, num_volumes, num_chapters, start_season, broadcast, source, average_episode_duration, rating, pictures, background, related_anime, related_manga, recommendations, studios, statistics, authors, serialization
    ) VALUES (
      ${uuid},
      ${metadata.id},
      ${type},
      ${metadata.title},
      ${JSON.stringify(metadata.alternative_titles)},
      ${metadata.main_picture?.large || metadata.main_picture?.medium || null},
      ${metadata.start_date},
      ${metadata.end_date},
      ${metadata.synopsis},
      ${metadata.mean},
      ${metadata.rank},
      ${metadata.popularity},
      ${metadata.num_list_users},
      ${metadata.num_scoring_users},
      ${metadata.nsfw},
      ${metadata.created_at},
      ${metadata.updated_at},
      ${metadata.media_type},
      ${metadata.status},
      ${JSON.stringify(metadata.genres)},
      ${JSON.stringify(metadata.my_list_status)},
      ${metadata.num_episodes},
      ${metadata.num_volumes},
      ${metadata.num_chapters},
      ${JSON.stringify(metadata.start_season)},
      ${JSON.stringify(metadata.broadcast)},
      ${metadata.source},
      ${metadata.average_episode_duration},
      ${metadata.rating},
      ${JSON.stringify(metadata.pictures)},
      ${metadata.background},
      ${JSON.stringify(metadata.related_anime)},
      ${JSON.stringify(metadata.related_manga)},
      ${JSON.stringify(metadata.recommendations)},
      ${JSON.stringify(metadata.studios)},
      ${JSON.stringify(metadata.statistics)},
      ${JSON.stringify(metadata.authors)},
      ${JSON.stringify(metadata.serialization)}
    )
  `;
} 