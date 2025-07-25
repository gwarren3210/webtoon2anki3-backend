import { SessionState, SessionQueues } from "./types";
import { supabase } from "../client";
import { APIError } from "encore.dev/api";
import { FSRSState, FSRSProgress } from "../fsrs/types";
import log from "encore.dev/log";
import { Chapter, Series, Card, StudyCard, _State } from "../supabaseEndpoints";

// Define the type for progress data from database
/* interface FSRSProgressData {
  id: string;
  user_id: string;
  vocabulary_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: FSRSState;
  last_review?: string;
  learning_steps: number;
  created_at: string;
  updated_at: string;
} */

/**
 * Converts database series data to Series API format.
 * @param series - Database series data
 * @returns Series object with proper API format
 */
export function convertToSeries(series: any): Series {
  log.info('[convertToSeries] Called', { series });
  return {
    id: series.id,
    publicId: series.slug,
    titleEn: series.name,
    titleKr: series.korean_name,
    author: series.authors,
    description: series.synopsis,
    genre: series.genres,
    difficulty: series.difficulty || "intermediate",
    coverImage: series.picture,
    totalChapters: series.total_chapters || 99,
    totalCards: series.total_cards || 99,
    avgRating: series.avg_rating || 5,
    totalLearners: series.total_learners || 99,
    status: series.status || "ongoing",
    // API expects string, not Date
    createdAt: new Date(series.created_at).toISOString(),
    isTrending: series.is_trending || false,
    isNew: series.is_new || false,
  };
}

/**
 * Converts database chapter data to Chapter API format.
 * @param chapter - Database chapter data
 * @returns Chapter object with proper API format
 */
export function convertToChapter(chapter: any): Chapter {
  log.info('[convertToChapter] Called', { chapter });
  return {
    id: chapter.id,
    publicId: chapter.slug,
    seriesId: chapter.series_id,
    chapterNumber: chapter.chapter_number,
    titleEn: chapter.title || "",
    difficulty: chapter.difficulty || "intermediate",
    cardCount: chapter.card_count || 0,
    isUnlocked: true,
  };
}


/**
 * Parses a public_id string and returns its type and components.
 * @param publicId - The public_id string to parse
 * @returns An object describing the type and components of the public_id
 * @throws APIError if the format is invalid
 */
export function parsePublicId(publicId: string):
  | { type: 'all' }
  | { type: 'chapter'; seriesSlug: string; chapterNumber: string }
  | { type: 'series'; seriesSlug: string }
{
  log.info('[parsePublicId] Called', { publicId });
  if (publicId === 'series:all:chapter:undefined') {
    log.info('[parsePublicId] Detected type all');
    return { type: 'all' };
  }
  const chapterMatch = publicId.match(/^series:([^:]+):chapter:(.+)$/);
  if (chapterMatch) {
    log.info('[parsePublicId] Detected type chapter', { seriesSlug: chapterMatch[1], chapterNumber: chapterMatch[2] });
    return { type: 'chapter', seriesSlug: chapterMatch[1], chapterNumber: chapterMatch[2] };
  }
  const seriesMatch = publicId.match(/^series:([^:]+):all$/);
  if (seriesMatch) {
    log.info('[parsePublicId] Detected type series', { seriesSlug: seriesMatch[1] });
    return { type: 'series', seriesSlug: seriesMatch[1] };
  }
  log.error('[parsePublicId] Invalid public_id format', { publicId });
  throw APIError.invalidArgument('Invalid public_id format');
}

/**
 * Fetches a series by its slug.
 */
export async function getSeriesBySlug(slug: string): Promise<{ id: string; slug: string }> {
  log.info('[getSeriesBySlug] Called', { slug });
  const { data: series, error } = await supabase
    .from('series')
    .select('id, slug')
    .eq('slug', slug)
    .single();
  log.info('[getSeriesBySlug] DB result', { series, error });
  if (error || !series) {
    log.error('[getSeriesBySlug] Not found', { slug, error });
    throw APIError.notFound(`Series '${slug}' not found`);
  }
  return series;
}

/**
 * Fetches a chapter by series ID and chapter number.
 */
export async function getChapterByNumber(seriesId: string, chapterNumber: string): Promise<{ id: string; series_id: string; chapter_number: string }> {
  log.info('[getChapterByNumber] Called', { seriesId, chapterNumber });
  const { data: chapter, error } = await supabase
    .from('chapters')
    .select('id, series_id, chapter_number')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single();
  log.info('[getChapterByNumber] DB result', { chapter, error });
  if (error || !chapter) {
    log.error('[getChapterByNumber] Not found', { seriesId, chapterNumber, error });
    throw APIError.notFound(`Chapter '${chapterNumber}' not found`).withDetails(error);
  }
  return chapter;
}

/**
 * Fetches all chapters for a given series ID.
 */
export async function getChaptersBySeries(seriesId: string): Promise<Array<{ id: string; series_id: string; number: string }>> {
  log.info('[getChaptersBySeries] Called', { seriesId });
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('id, series_id, number')
    .eq('series_id', seriesId);
  log.info('[getChaptersBySeries] DB result', { chapters, error });
  if (error || !chapters || chapters.length === 0) {
    log.error('[getChaptersBySeries] No chapters found', { seriesId, error });
    throw APIError.notFound('No chapters found for this series');
  }
  return chapters;
}

/**
 * Fetches a deck by user ID, chapter ID, and public ID.
 */
export async function getDeckByChapter(userId: string, chapterId: string, publicId: string): Promise<{ id: string; user_id: string; chapter_id: string; public_id: string }> {
  log.info('[getDeckByChapter] Called', { userId, chapterId, publicId });
  const { data: deck, error } = await supabase
    .from('decks')
    .select('id, user_id, chapter_id, public_id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .eq('public_id', publicId)
    .single();
  log.info('[getDeckByChapter] DB result', { deck, error });
  if (error || !deck) {
    log.error('[getDeckByChapter] Not found', { userId, chapterId, publicId, error });
    throw APIError.notFound('Deck not found for this chapter');
  }
  return deck;
}

/**
 * Fetches all decks for a user and a list of chapter IDs.
 */
export async function getDecksByChapters(userId: string, chapterIds: string[]): Promise<Array<{ id: string; user_id: string; chapter_id: string; public_id: string }>> {
  log.info('[getDecksByChapters] Called', { userId, chapterIds });
  const { data: decks, error } = await supabase
    .from('decks')
    .select('id, user_id, chapter_id, public_id')
    .eq('user_id', userId)
    .in('chapter_id', chapterIds);
  log.info('[getDecksByChapters] DB result', { decks, error });
  if (error || !decks || decks.length === 0) {
    log.error('[getDecksByChapters] No decks found', { userId, chapterIds, error });
    throw APIError.notFound('No decks found for these chapters');
  }
  return decks;
}

/**
 * Fetches all words for one or more chapter IDs.
 */
export async function getChapterWords(chapterIds: string[]): Promise<any[]> {
  log.info('[getChapterWords] Called', { chapterIds });
  const { data: chapterWords, error } = await supabase
    .from('chapter_words')
    .select('word_id, importance_score, words!inner(id, word, definition)')
    .in('chapter_id', chapterIds);
  log.info('[getChapterWords] DB result', { chapterWords, error });
  if (error) {
    log.error('[getChapterWords] DB error', { error });
    throw APIError.internal('Failed to get chapter words for session').withDetails({ error: error.message });
  }
  if (!chapterWords || chapterWords.length === 0) {
    log.error('[getChapterWords] No words found', { chapterIds });
    throw APIError.notFound("No words found for this deck's chapter.");
  }
  return chapterWords;
}

/**
 * Fetches FSRS progress records for a user and a list of vocabulary IDs.
 */
export async function getUserProgress(userId: string, wordIds: string[]): Promise<FSRSProgress[]> {
  log.info('[getUserProgress] Called', { userId, wordIds });
  const { data: progressData, error } = await supabase
    .from('fsrs_progress')
    .select('*')
    .eq('user_id', userId)
    .in('vocabulary_id', wordIds);
  log.info('[getUserProgress] DB result', { progressData, error });
  if (error) {
    log.error('[getUserProgress] DB error', { error });
    throw APIError.internal('Failed to get user progress').withDetails({ error: error.message });
  }
  return (progressData || []).map(toFSRSProgress);
}

// Helper to convert FSRSProgressData (DB) to FSRSProgress (runtime)
export function toFSRSProgress(data: any): FSRSProgress {
  const due = data.due ? new Date(data.due) : new Date();
  const createdAt = data.created_at ? new Date(data.created_at) : new Date();
  const updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();
  const last_review = data.last_review ? new Date(data.last_review) : undefined;

  if (isNaN(due.getTime())) throw new Error("Invalid due date in FSRSProgress");
  if (isNaN(createdAt.getTime())) throw new Error("Invalid createdAt in FSRSProgress");
  if (isNaN(updatedAt.getTime())) throw new Error("Invalid updatedAt in FSRSProgress");
  if (last_review && isNaN(last_review.getTime())) throw new Error("Invalid last_review in FSRSProgress");

  return {
    id: data.id,
    userId: data.user_id,
    vocabularyId: data.vocabulary_id,
    due,
    stability: data.stability,
    difficulty: data.difficulty,
    elapsed_days: data.elapsed_days,
    scheduled_days: data.scheduled_days,
    reps: data.reps,
    lapses: data.lapses,
    state: data.state,
    last_review,
    learning_steps: data.learning_steps,
    createdAt,
    updatedAt,
  };
}

export interface StudyCardDb {
  id: string,
  korean: string,
  english: string,
  importance_score: number,
  created_at: string,
  due: string,
  stability: number,
  difficulty: number,
  elapsed_days: number,
  scheduled_days: number,
  reps: number,
  lapses: number,
  state: number,
  last_review: string,
  learning_steps: number
}

export function dbToStudyCard(dbCard: StudyCardDb): StudyCard {
  return {
    id: dbCard.id,
    korean: dbCard.korean,
    english: dbCard.english,
    pronunciation: undefined,
    exampleSentence: undefined,
    createdAt: dbCard.created_at,
    successRate: Math.round((dbCard.reps - dbCard.lapses) / dbCard.reps * 100),
    importanceScore: dbCard.importance_score,
    // last_review returned but unused
    card: {
      due: dbCard.due,
      stability: dbCard.stability,
      difficulty: dbCard.difficulty,
      elapsed_days: dbCard.elapsed_days,
      scheduled_days: dbCard.scheduled_days,
      learning_steps: dbCard.learning_steps,
      reps: dbCard.reps,
      lapses: dbCard.lapses,
      state: dbCard.state as _State,
    },
  };
} 