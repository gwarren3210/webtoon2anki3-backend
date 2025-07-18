import { SessionState, VocabularyWithProgress } from "./types";
import { supabase } from "../client";
import { APIError } from "encore.dev/api";
import { FSRSState, FSRSProgress } from "../fsrs/types";
import log from "encore.dev/log";

// Define the type for progress data from database
interface FSRSProgressData {
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
}

// Define StudyCard interface for the conversion
interface StudyCard {
  id: string;
  korean: string;
  english: string;
  pronunciation: string;
  exampleSentence: string;
  difficulty: 'easy' | 'medium' | 'hard';
  learningState: 'new' | 'learning' | 'review' | 'mastered';
  nextReviewDate: string;
  createdAt: string;
  successRate: number;
  importanceScore: number;
}

/**
 * Converts database vocabulary and progress data to StudyCard format.
 * @param vocabulary - The vocabulary data from database
 * @param progress - Optional progress data from database
 * @returns StudyCard object with proper types
 */
export function convertToStudyCard(vocabulary: any, progress?: FSRSProgress): StudyCard {
  // Map FSRS state to learningState
  const getLearningState = (state: string): 'new' | 'learning' | 'review' | 'mastered' => {
    switch (state) {
      case 'New': return 'new';
      case 'Learning': return 'learning';
      case 'Review': return 'review';
      case 'Relearning': return 'mastered';
      default: return 'new';
    }
  };
  
  // Map difficulty to allowed values
  const getDifficulty = (difficulty: number): 'easy' | 'medium' | 'hard' => {
    if (difficulty <= 0.3) return 'easy';
    if (difficulty <= 0.7) return 'medium';
    return 'hard';
  };

  // Calculate success rate from progress data
  const calculateSuccessRate = (progress?: FSRSProgress): number => {
    if (!progress || progress.reps === 0) return 0;
    return Math.round(((progress.reps - progress.lapses) / progress.reps) * 100);
  };

  return {
    id: vocabulary.id,
    korean: vocabulary.korean,
    english: vocabulary.english,
    pronunciation: vocabulary.pronunciation || '',
    exampleSentence: vocabulary.example_sentence || '',
    difficulty: progress ? getDifficulty(progress.difficulty) : 'medium',
    learningState: progress ? getLearningState(progress.state) : 'new',
    nextReviewDate: progress?.due ? new Date(progress.due).toISOString() : new Date().toISOString(),
    createdAt: progress?.createdAt ? new Date(progress.createdAt).toISOString() : new Date().toISOString(),
    successRate: calculateSuccessRate(progress),
    importanceScore: vocabulary.importanceScore || 0,
  };
}

/**
 * Converts chapter words to StudyCards without progress data (for when deck doesn't exist).
 * @param chapterWords - Array of chapter words from database
 * @returns Array of StudyCard objects with default values
 */
export function convertChapterWordsToStudyCards(chapterWords: any[]): StudyCard[] {
  return chapterWords.map(cw => convertToStudyCard(cw.words, undefined));
}

/**
 * Converts database series data to Series API format.
 * @param series - Database series data
 * @returns Series object with proper API format
 */
export function convertToSeries(series: any) {
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
    createdAt: series.created_at,
    isTrending: series.is_trending || false,
    isNew: series.is_new || false,
  };
}

/**
 * Converts database chapter data to Chapter API format.
 * @param chapter - Database chapter data
 * @returns Chapter object with proper API format
 */
export function convertToChapter(chapter: any) {
  return {
    id: chapter.id,
    publicId: chapter.slug,
    seriesId: chapter.series_id,
    chapterNumber: chapter.chapter_number,
    titleEn: chapter.title || "",
    difficulty: chapter.difficulty || "intermediate",
    cardCount: chapter.card_count || 0,
    isUnlocked: !!chapter.unlocked,
  };
}

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
  if (publicId === 'series:all:chapter:undefined') {
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
export async function getChapterByNumber(seriesId: string, chapterNumber: string): Promise<{ id: string; series_id: string; chapter_number: string }> {
  const { data: chapter, error } = await supabase
    .from('chapters')
    .select('id, series_id, chapter_number')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single();
  if (error || !chapter) {
    throw APIError.notFound(`Chapter '${chapterNumber}' not found`).withDetails(error);
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
export async function getUserProgress(userId: string, wordIds: string[]): Promise<FSRSProgressData[]> {
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
export async function createMissingProgressRecords(userId: string, chapterWords: any[], progressMap: Map<string, FSRSProgressData>): Promise<FSRSProgressData[]> {
  const wordsWithoutProgress = chapterWords.filter(cw => !progressMap.has(cw.word_id));
  if (wordsWithoutProgress.length === 0) return [];
  const newProgressRecords = wordsWithoutProgress.map(cw => ({
    user_id: userId,
    vocabulary_id: cw.word_id,
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    state: FSRSState.New,
  }));
  const { data: insertedProgress, error } = await supabase
    .from('fsrs_progress')
    .insert(newProgressRecords)
    .select();
  if (error) {
    throw APIError.internal('Failed to create new progress records').withDetails({ error: error.message });
  }
  (insertedProgress || []).forEach((p: FSRSProgressData) => progressMap.set(p.vocabulary_id, p));

  return insertedProgress || [];
}

/**
 * Selects and orders words for a study session, prioritizing non-new cards.
 */
export function selectStudyWords(
  chapterWords: any[],
  progressMap: Map<string, FSRSProgressData>,
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
    if (!progressA || !progressB) return 0;
    return new Date(progressA.due).getTime() - new Date(progressB.due).getTime();
  });
  return [...nonNewWords, ...newWords].slice(0, maxTotalWords);
}

/**
 * Builds the final array of vocabulary with their progress for a study session.
 */
export function buildVocabularyWithProgress(selectedWords: any[], progressMap: Map<string, FSRSProgressData>): VocabularyWithProgress[] {
  const now = new Date();
  return selectedWords.map(cw => {
    const progress = progressMap.get(cw.word_id);
    if (!progress) {
      log.error("[buildVocabularyWithProgress] No Progress Found")
      throw new Error(`No progress found for word ${cw.word_id}`);
    }
    const dueDate = new Date(progress.due);
    return {
      vocabulary: {
        id: cw.words.id,
        korean: cw.words.word,
        english: cw.words.definition,
        importanceScore: cw.importance_score || 0,
      },
      studyProgress: {
        id: progress.id,
        userId: progress.user_id,
        vocabularyId: progress.vocabulary_id,
        due: dueDate,
        stability: progress.stability,
        difficulty: progress.difficulty,
        elapsed_days: progress.elapsed_days,
        scheduled_days: progress.scheduled_days,
        reps: progress.reps,
        lapses: progress.lapses,
        state: progress.state,
        last_review: progress.last_review ? new Date(progress.last_review) : undefined,
        learning_steps: progress.learning_steps,
        createdAt: new Date(progress.created_at),
        updatedAt: new Date(progress.updated_at),
      },
      isDue: dueDate <= now,
      daysUntilReview: Math.max(0, (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
    };
  });
} 