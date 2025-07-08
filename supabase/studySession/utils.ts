import { SessionState, VocabularyWithProgress } from "./types";
import { supabase } from "../client";
import { APIError } from "encore.dev/api";
import { FSRSState } from "../fsrs/types";

/**
 * Converts string date fields in a SessionState to Date objects.
 * @param state SessionState with possible string dates
 * @returns SessionState with all date fields as Date objects
 */
export function reviveSessionState(state: SessionState): SessionState {
  return {
    ...state,
    createdAt: new Date(state.createdAt),
    lastActive: new Date(state.lastActive),
    // Add more fields here if SessionState adds more dates in the future
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
  if (publicId === 'all') {
    return { type: 'all' };
  }
  const chapterMatch = publicId.match(/^series:([^:]+):chapter:(.+)$/);
  if (chapterMatch) {
    return { type: 'chapter', seriesSlug: chapterMatch[1], chapterNumber: chapterMatch[2] };
  }
  const seriesMatch = publicId.match(/^series:([^:]+):all$/);
  if (seriesMatch) {
    return { type: 'series', seriesSlug: seriesMatch[1] };
  }
  throw APIError.invalidArgument('Invalid public_id format');
}

/**
 * Fetches a series by its slug.
 */
export async function getSeriesBySlug(slug: string): Promise<{ id: string; slug: string }> {
  const { data: series, error } = await supabase
    .from('series')
    .select('id, slug')
    .eq('slug', slug)
    .single();
  if (error || !series) {
    throw APIError.notFound(`Series '${slug}' not found`);
  }
  return series;
}

/**
 * Fetches a chapter by series ID and chapter number.
 */
export async function getChapterByNumber(seriesId: string, chapterNumber: string): Promise<{ id: string; series_id: string; number: string }> {
  const { data: chapter, error } = await supabase
    .from('chapters')
    .select('id, series_id, number')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single();
  if (error || !chapter) {
    throw APIError.notFound(`Chapter '${chapterNumber}' not found`);
  }
  return chapter;
}

/**
 * Fetches all chapters for a given series ID.
 */
export async function getChaptersBySeries(seriesId: string): Promise<Array<{ id: string; series_id: string; number: string }>> {
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('id, series_id, number')
    .eq('series_id', seriesId);
  if (error || !chapters || chapters.length === 0) {
    throw APIError.notFound('No chapters found for this series');
  }
  return chapters;
}

/**
 * Fetches a deck by user ID, chapter ID, and public ID.
 */
export async function getDeckByChapter(userId: string, chapterId: string, publicId: string): Promise<{ id: string; user_id: string; chapter_id: string; public_id: string }> {
  const { data: deck, error } = await supabase
    .from('decks')
    .select('id, user_id, chapter_id, public_id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .eq('public_id', publicId)
    .single();
  if (error || !deck) {
    throw APIError.notFound('Deck not found for this chapter');
  }
  return deck;
}

/**
 * Fetches all decks for a user and a list of chapter IDs.
 */
export async function getDecksByChapters(userId: string, chapterIds: string[]): Promise<Array<{ id: string; user_id: string; chapter_id: string; public_id: string }>> {
  const { data: decks, error } = await supabase
    .from('decks')
    .select('id, user_id, chapter_id, public_id')
    .eq('user_id', userId)
    .in('chapter_id', chapterIds);
  if (error || !decks || decks.length === 0) {
    throw APIError.notFound('No decks found for these chapters');
  }
  return decks;
}

/**
 * Fetches all words for one or more chapter IDs.
 */
export async function getChapterWords(chapterIds: string[]): Promise<any[]> {
  const { data: chapterWords, error } = await supabase
    .from('chapter_words')
    .select('word_id, importance_score, words!inner(id, word, definition)')
    .in('chapter_id', chapterIds);
  if (error) {
    throw APIError.internal('Failed to get chapter words for session').withDetails({ error: error.message });
  }
  if (!chapterWords || chapterWords.length === 0) {
    throw APIError.notFound("No words found for this deck's chapter.");
  }
  return chapterWords;
}

/**
 * Fetches FSRS progress records for a user and a list of vocabulary IDs.
 */
export async function getUserProgress(userId: string, wordIds: string[]): Promise<any[]> {
  const { data: progressData, error } = await supabase
    .from('fsrs_progress')
    .select('*')
    .eq('user_id', userId)
    .in('vocabulary_id', wordIds);
  if (error) {
    throw APIError.internal('Failed to get user progress').withDetails({ error: error.message });
  }
  return progressData || [];
}

/**
 * Inserts missing FSRS progress records for new words for a user.
 */
export async function createMissingProgressRecords(userId: string, chapterWords: any[], progressMap: Map<string, any>): Promise<void> {
  const wordsWithoutProgress = chapterWords.filter(cw => !progressMap.has(cw.word_id));
  if (wordsWithoutProgress.length === 0) return;
  const newProgressRecords = wordsWithoutProgress.map(cw => ({
    user_id: userId,
    vocabulary_id: cw.word_id,
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    state: 0, // FSRSState.New
  }));
  const { data: insertedProgress, error } = await supabase
    .from('fsrs_progress')
    .insert(newProgressRecords)
    .select();
  if (error) {
    throw APIError.internal('Failed to create new progress records').withDetails({ error: error.message });
  }
  (insertedProgress || []).forEach((p: any) => progressMap.set(p.vocabulary_id, p));
}

/**
 * Selects and orders words for a study session, prioritizing non-new cards.
 */
export function selectStudyWords(
  chapterWords: any[],
  progressMap: Map<string, any>,
  maxNewWords: number,
  maxTotalWords: number
): any[] {
  const newWords = chapterWords.filter(cw => {
    const progress = progressMap.get(cw.word_id);
    return progress && progress.state === FSRSState.New;
  }).slice(0, maxNewWords);
  const nonNewWords = chapterWords.filter(cw => {
    const progress = progressMap.get(cw.word_id);
    return progress && progress.state !== FSRSState.New;
  }).sort((a, b) => {
    const progressA = progressMap.get(a.word_id);
    const progressB = progressMap.get(b.word_id);
    return new Date(progressA.due).getTime() - new Date(progressB.due).getTime();
  });
  return [...nonNewWords, ...newWords].slice(0, maxTotalWords);
}

/**
 * Builds the final array of vocabulary with their progress for a study session.
 */
export function buildVocabularyWithProgress(selectedWords: any[], progressMap: Map<string, any>): VocabularyWithProgress[] {
  const now = new Date();
  return selectedWords.map(cw => {
    const progress = progressMap.get(cw.word_id);
    const dueDate = new Date(progress.due);
    return {
      vocabulary: {
        id: cw.words.id,
        korean: cw.words.word,
        english: cw.words.definition,
        importanceScore: cw.importance_score || 0,
      },
      studyProgress: {
        ...progress,
        due: dueDate,
        last_review: progress.last_review ? new Date(progress.last_review) : undefined,
      },
      isDue: dueDate <= now,
      daysUntilReview: Math.max(0, (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
    };
  });
} 