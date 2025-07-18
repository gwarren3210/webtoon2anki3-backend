import { SessionState, SessionQueues } from "./types";
import { supabase } from "../client";
import { APIError } from "encore.dev/api";
import { FSRSState, FSRSProgress } from "../fsrs/types";
import log from "encore.dev/log";
import { Card } from './types';
import { Chapter, Series } from "../supabaseEndpoints";

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
  log.info('[convertToStudyCard] Called', { vocabulary, progress });
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

  const result = {
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
  log.info('[convertToStudyCard] Returning', { result });
  return result;
}

/**
 * Converts chapter words to StudyCards without progress data (for when deck doesn't exist).
 * @param chapterWords - Array of chapter words from database
 * @returns Array of StudyCard objects with default values
 */
export function convertChapterWordsToStudyCards(chapterWords: any[]): StudyCard[] {
  log.info('[convertChapterWordsToStudyCards] Called', { chapterWordsLength: chapterWords.length });
  const result = chapterWords.map(cw => convertToStudyCard(cw.words, undefined));
  log.info('[convertChapterWordsToStudyCards] Returning', { resultLength: result.length });
  return result;
}

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
 * Converts string date fields in a SessionState to Date objects.
 * @param state SessionState with possible string dates
 * @returns SessionState with all date fields as Date objects
 */
export function reviveSessionState(state: SessionState): SessionState {
  log.info('[reviveSessionState] Called', { state });
  const REQUIRED_QUEUE_KEYS = ['New', 'Learning', 'Review', 'Relearning', 'Mistakes'] as const;
  // Revive top-level date fields
  const revived = {
    ...state,
    createdAt: new Date(state.createdAt),
    lastActive: new Date(state.lastActive),
    // Revive allCards
    allCards: state.allCards?.map(card => ({
      ...card,
      studyProgress: card.studyProgress ? reviveFSRSProgress(card.studyProgress) : card.studyProgress,
    })),
    // Revive queues (object of arrays of cards)

    // In reviveSessionState, replace the queues assignment with:
    queues: Object.fromEntries(
      REQUIRED_QUEUE_KEYS.map(key => [
        key,
        Array.isArray(state.queues?.[key as keyof typeof state.queues])
          ? state.queues[key].map(card => ({
              ...card,
              studyProgress: card.studyProgress ? reviveFSRSProgress(card.studyProgress) : card.studyProgress,
            }))
          : [],
      ])
    ) as SessionQueues,
    // Revive currentCard
    currentCard: state.currentCard
      ? { ...state.currentCard, studyProgress: state.currentCard.studyProgress ? reviveFSRSProgress(state.currentCard.studyProgress) : state.currentCard.studyProgress }
      : state.currentCard,
  };
  log.info('[reviveSessionState] Returning', { revived });
  return revived;
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

/**
 * Inserts missing FSRS progress records for new words for a user.
 */
export async function createMissingProgressRecords(userId: string, chapterWords: any[], progressMap: Map<string, FSRSProgress>): Promise<FSRSProgress[]> {
  log.info('[createMissingProgressRecords] Called', { userId, chapterWordsLength: chapterWords.length, progressMapSize: progressMap.size });
  const wordsWithoutProgress = chapterWords.filter(cw => !progressMap.has(cw.word_id));
  log.info('[createMissingProgressRecords] Words without progress', { count: wordsWithoutProgress.length });
  if (wordsWithoutProgress.length === 0) return [];
  const newProgressRecords = wordsWithoutProgress.map(cw => ({
    userId: userId,
    vocabularyId: cw.word_id,
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    state: FSRSState.New,
  }));
  const { data: insertedProgress, error } = await supabase
    .from('fsrs_progress')
    .insert(newProgressRecords)
    .select();
  log.info('[createMissingProgressRecords] Inserted progress', { insertedProgress, error });
  if (error) {
    log.error('[createMissingProgressRecords] DB error', { error });
    throw APIError.internal('Failed to create new progress records').withDetails({ error: error.message });
  }
  (insertedProgress || []).forEach((p: FSRSProgress) => progressMap.set(p.vocabularyId, p));

  return insertedProgress || [];
}

/**
 * Selects and orders words for a study session, prioritizing non-new cards.
 */
export function selectStudyWords(
  chapterWords: any[],
  progressMap: Map<string, FSRSProgress>,
  maxNewWords: number,
  maxTotalWords: number
): any[] {
  log.info('[selectStudyWords] Called', { chapterWordsLength: chapterWords.length, progressMapSize: progressMap.size, maxNewWords, maxTotalWords });
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
    if (!progressA || !progressB || !progressA.due || !progressB.due) return 0;
    return new Date(progressA.due).getTime() - new Date(progressB.due).getTime();
  });
  log.info('[selectStudyWords] newWords/nonNewWords', { newWordsLength: newWords.length, nonNewWordsLength: nonNewWords.length });
  const result = [...nonNewWords, ...newWords].slice(0, maxTotalWords);
  log.info('[selectStudyWords] Returning', { resultLength: result.length });
  return result;
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

// Helper to create a fresh FSRSProgress for a new card
// TODO find optimal initial state
export function createInitialFSRSProgress(userId: string, vocabularyId: string): FSRSProgress {
  const now = new Date();
  return {
    id: `new-${vocabularyId}`,
    userId,
    vocabularyId,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: FSRSState.New,
    learning_steps: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// Main helper to get all cards for a chapter with progress for a user
export async function getCardsWithProgressForChapter(userId: string, chapterId: string): Promise<Card[]> {
  // 1. Get all words for the chapter
  const chapterWords = await getChapterWords([chapterId]);
  const wordIds = chapterWords.map(cw => cw.word_id);

  // 2. Get all progress for these words for the user
  const { data: progressData, error: progressError } = await supabase
    .from('fsrs_progress')
    .select('*')
    .eq('user_id', userId)
    .in('vocabulary_id', wordIds);

  if (progressError) throw APIError.internal('Failed to fetch progress').withDetails({ error: progressError.message });
  const progress = progressData.map(toFSRSProgress)

  // 3. Build a map for quick lookup
  const progressMap = new Map(progress.map((p: FSRSProgress) => [p.vocabularyId, p]));

  // 4. Build Card[]
  return chapterWords.map(cw => {
    let progress = progressMap.get(cw.word_id);
    if (!progress) {
      progress = createInitialFSRSProgress(userId, cw.word_id);
    }
    return {
      id: cw.words.id,
      korean: cw.words.word,
      english: cw.words.definition,
      importanceScore: cw.importance_score || 0,
      studyProgress: progress,
    };
  });
} 

function reviveFSRSProgress(progress: any): FSRSProgress {
  // Map numeric state to string enum if needed
  let state = progress.state;
  if (typeof state === 'number') {
    // Map 0,1,2,3 to 'New','Learning','Review','Relearning'
    state = ['New', 'Learning', 'Review', 'Relearning'][state] as FSRSState;
  }
  return {
    ...progress,
    state,
    due: progress.due ? new Date(progress.due) : new Date(),
    last_review: progress.last_review ? new Date(progress.last_review) : undefined,
    createdAt: progress.createdAt ? new Date(progress.createdAt) : new Date(),
    updatedAt: progress.updatedAt ? new Date(progress.updatedAt) : new Date(),
  };
} 