import { api, APIError, Header, Query } from "encore.dev/api";
import { authHandler } from "./auth";
import { getAuthData } from "~encore/auth";
import { supabase } from "./client";
import {
  startStudySession,
  gradeCard as gradeCardLogic,
  endStudySession,
} from "./studySession/index";
import { VocabularyWithProgress } from "./studySession/types";
import { FSRSProgress } from './fsrs/index'
import { Rating } from './fsrs/types';

/* export interface FSRSProgress {
  id: string;
  userId: string;
  vocabularyId: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: Date;
  learning_steps: number;
  createdAt: Date;
  updatedAt: Date;
} */

// ===================
// API Definitions
// ===================

// Auth endpoints
interface GetSessionRequest {
  authorization: Header<"Authorization">;
}
interface GetSessionResponse {
  user: { id: string; email?: string };
}

export const getSession = api<GetSessionRequest, GetSessionResponse>({
  method: "GET",
  path: "/auth/session",
  expose: true,
}, async ({ authorization }) => {
  const { userId, email } = await authHandler({ authorization });
  return { user: { id: userId, email } };
});

// Chapter endpoints
interface CheckChapterRequest {
  seriesName: string;
  chapterNumber: string;
}
interface CheckChapterResponse {
  chapter: {
    id: string;
    seriesName: string;
    chapterNumber: string;
    createdAt: string;
  } | null;
}

export const checkChapter = api<CheckChapterRequest, CheckChapterResponse>({
  method: "POST",
  path: "/supabase/chapters/check",
  expose: true,
}, async ({ seriesName, chapterNumber }) => {
  const { data, error } = await supabase
    .from('chapters')
    .select(`
      id,
      chapter_number,
      created_at,
      series!inner(name)
    `)
    .eq('series.name', seriesName)
    .eq('chapter_number', chapterNumber)
    .maybeSingle();

  if (error) {
    throw APIError.internal("failed to check chapter").withDetails({ error: error.message });
  }
  if (!data) {
    return { chapter: null };
  }
  return {
    chapter: {
      id: data.id,
      seriesName: (data.series as any).name,
      chapterNumber: data.chapter_number,
      createdAt: data.created_at,
    },
  };
});

// --- Get Chapter Words endpoint ---
interface GetChapterWordsRequest {
  id: string; // path param
}
interface GetChapterWordsResponse {
  words: Array<{
    korean: string;
    english: string;
    importanceScore: number;
    context?: string;
    frequency?: number;
  }>;
}

export const getChapterWords = api<GetChapterWordsRequest, GetChapterWordsResponse>({
  method: "GET",
  path: "/supabase/chapters/:id/words",
  expose: true,
}, async ({ id }) => {
  const { data, error } = await supabase
    .from('chapter_words')
    .select(`
      frequency,
      context,
      importance_score,
      words!inner(
        word,
        definition
      )
    `)
    .eq('chapter_id', id)
    .order('importance_score', { ascending: false });

  if (error) {
    throw APIError.internal("failed to load chapter words").withDetails({ error: error.message });
  }

  const words = data?.map(item => ({
    korean: (item.words as any).word,
    english: (item.words as any).definition,
    importanceScore: item.importance_score || 0,
    context: item.context,
    frequency: item.frequency
  })) || [];

  return { words };
});

// --- Create Chapter endpoint ---
interface CreateChapterRequest {
  seriesName: string;
  chapterNumber: string;
  words: Array<{
    korean: string;
    english: string;
    importanceScore: number;
  }>;
}
interface CreateChapterResponse {
  chapter: {
    id: string;
    seriesName: string;
    chapterNumber: string;
    createdAt: string;
  };
  wordMappings: Array<{ word: { korean: string; english: string; importanceScore: number }, wordId: string }>;
}

export const createChapter = api<CreateChapterRequest, CreateChapterResponse>({
  method: "POST",
  path: "/supabase/chapters",
  expose: true,
}, async ({ seriesName, chapterNumber, words }) => {
  // First, get or create series
  let { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('name', seriesName)
    .maybeSingle();
  if (seriesError) {
    throw APIError.internal("failed to check series").withDetails({ error: seriesError.message });
  }
  if (!series) {
    const { data: newSeries, error: createSeriesError } = await supabase
      .from('series')
      .insert({ name: seriesName })
      .select('id')
      .single();
    if (createSeriesError) {
      throw APIError.internal("failed to create series").withDetails({ error: createSeriesError.message });
    }
    if (!newSeries) {
      throw APIError.internal("Failed to create series, check RLS policy.");
    }
    series = newSeries;
  }
  // Create chapter
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .insert({
      series_id: series.id,
      chapter_number: chapterNumber
    })
    .select('id, created_at')
    .single();
  if (chapterError) {
    throw APIError.internal("failed to create chapter").withDetails({ error: chapterError.message });
  }
  if (!chapter) {
    throw APIError.internal("Failed to create chapter, check RLS policy.");
  }
  // Save words and collect their DB IDs
  const wordMappings: { word: { korean: string; english: string; importanceScore: number }, wordId: string }[] = [];
  if (words.length > 0) {
    for (const word of words) {
      const { data: existingWord, error: wordCheckError } = await supabase
        .from('words')
        .select('id')
        .eq('word', word.korean)
        .eq('definition', word.english)
        .maybeSingle();
      if (wordCheckError) {
        continue; // Skip this word
      }
      let wordId: string;
      if (existingWord) {
        wordId = existingWord.id;
      } else {
        const { data: newWord, error: createWordError } = await supabase
          .from('words')
          .insert({
            word: word.korean,
            definition: word.english
          })
          .select('id')
          .single();
        if (createWordError) {
          continue; // Skip this word
        }
        if (!newWord) {
          continue; // Or throw, but this is safer in a loop
        }
        wordId = newWord.id;
      }
      // Link word to chapter
      const { error: linkError } = await supabase
        .from('chapter_words')
        .insert({
          chapter_id: chapter.id,
          word_id: wordId,
          importance_score: word.importanceScore,
          context: word.korean
        });
      wordMappings.push({ word, wordId });
    }
  }
  return {
    chapter: {
      id: chapter.id,
      seriesName,
      chapterNumber,
      createdAt: chapter.created_at
    },
    wordMappings
  };
});

// --- Vocabulary endpoints ---
interface GetVocabularyResponse {
  vocabulary: Array<any>;
}
export const getVocabulary = api<{}, GetVocabularyResponse>({
  method: "GET",
  path: "/supabase/vocabulary",
  expose: true,
}, async () => {
  const { data, error } = await supabase.from('words').select('*').order('created_at', { ascending: false });
  if (error) {
    throw APIError.internal("failed to fetch vocabulary").withDetails({ error: error.message });
  }
  return { vocabulary: data || [] };
});

interface SearchVocabularyRequest {
  query: Query<string>;
}
interface SearchVocabularyResponse {
  vocabulary: Array<any>;
}
export const searchVocabulary = api<SearchVocabularyRequest, SearchVocabularyResponse>({
  method: "GET",
  path: "/supabase/vocabulary/search",
  expose: true,
}, async ({ query }) => {
  let supaQuery = supabase
    .from('words')
    .select('*')
    .or(`word.ilike.%${query}%,definition.ilike.%${query}%`)
    .order('created_at', { ascending: false });
  const { data, error } = await supaQuery;
  if (error) {
    throw APIError.internal("failed to search vocabulary").withDetails({ error: error.message });
  }
  return { vocabulary: data || [] };
});

interface FilterVocabularyBySeriesRequest {
  seriesName: string;
}
interface FilterVocabularyBySeriesResponse {
  vocabulary: Array<any>;
}
export const filterVocabularyBySeries = api<FilterVocabularyBySeriesRequest, FilterVocabularyBySeriesResponse>({
  method: "GET",
  path: "/supabase/vocabulary/filter/series/:seriesName",
  expose: true,
}, async ({ seriesName }) => {
  const { data, error } = await supabase
    .from('chapter_words')
    .select(`words(*), chapter_id, chapters!inner(series_id), chapters!inner(series!inner(name))`)
    .eq('chapters.series.name', seriesName);
  if (error) {
    throw APIError.internal("failed to filter vocabulary by series").withDetails({ error: error.message });
  }
  const words = (data || []).map((cw: any) => cw.words).filter(Boolean);
  const unique = Array.from(new Map(words.map((w: any) => [w.id, w])).values());
  return { vocabulary: unique };
});

interface FilterVocabularyByChapterRequest {
  seriesName: string;
  chapterNumber: string;
}
interface FilterVocabularyByChapterResponse {
  vocabulary: Array<any>;
}
export const filterVocabularyByChapter = api<FilterVocabularyByChapterRequest, FilterVocabularyByChapterResponse>({
  method: "GET",
  path: "/supabase/vocabulary/filter/chapter/:seriesName/:chapterNumber",
  expose: true,
}, async ({ seriesName, chapterNumber }) => {
  const { data, error } = await supabase
    .from('chapter_words')
    .select(`words(*), chapter_id, chapters!inner(chapter_number, series!inner(name))`)
    .eq('chapters.series.name', seriesName)
    .eq('chapters.chapter_number', chapterNumber);
  if (error) {
    throw APIError.internal("failed to filter vocabulary by chapter").withDetails({ error: error.message });
  }
  const words = (data || []).map((cw: any) => cw.words).filter(Boolean);
  const unique = Array.from(new Map(words.map((w: any) => [w.id, w])).values());
  return { vocabulary: unique };
});

// --- Analytics endpoints ---
interface GetRetentionResponse {
  retention: Array<{ date: string; retention: number }>;
}
export const getRetention = api<{}, GetRetentionResponse>({
  method: "GET",
  path: "/supabase/analytics/retention",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('study_history')
    .select('created_at, word_id')
    .order('created_at', { ascending: true });
  if (error) {
    throw APIError.internal("failed to fetch study history for retention").withDetails({ error: error.message });
  }
  const byDate: Record<string, Set<string>> = {};
  (data || []).forEach((row: any) => {
    const date = new Date(row.created_at).toISOString().slice(0, 10);
    if (!byDate[date]) byDate[date] = new Set();
    byDate[date].add(row.word_id);
  });
  const retention = Object.entries(byDate).map(([date, set]) => ({ date, retention: set.size }));
  return { retention };
});

interface GetStudyPatternsResponse {
  patterns: Array<{ date: string; sessions: number; avgDuration: number }>;
}
export const getStudyPatterns = api<{}, GetStudyPatternsResponse>({
  method: "GET",
  path: "/supabase/analytics/patterns",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('created_at, session_duration')
    .order('created_at', { ascending: true });
  if (error) {
    throw APIError.internal("failed to fetch study sessions").withDetails({ error: error.message });
  }
  const byDate: Record<string, { count: number; totalDuration: number }> = {};
  (data || []).forEach((row: any) => {
    const date = new Date(row.created_at).toISOString().slice(0, 10);
    if (!byDate[date]) byDate[date] = { count: 0, totalDuration: 0 };
    byDate[date].count++;
    byDate[date].totalDuration += row.session_duration || 0;
  });
  const patterns = Object.entries(byDate).map(([date, { count, totalDuration }]) => ({
    date,
    sessions: count,
    avgDuration: count ? Math.round(totalDuration / count) : 0,
  }));
  return { patterns };
});

interface GetDifficultyAnalysisResponse {
  analysis: Array<{ grade: number; count: number }>;
}
export const getDifficultyAnalysis = api<{}, GetDifficultyAnalysisResponse>({
  method: "GET",
  path: "/supabase/analytics/difficulty",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('study_history')
    .select('grade');
  if (error) {
    throw APIError.internal("failed to fetch study history for difficulty analysis").withDetails({ error: error.message });
  }
  const gradeCounts: Record<number, number> = {};
  (data || []).forEach((row: any) => {
    gradeCounts[row.grade] = (gradeCounts[row.grade] || 0) + 1;
  });
  const analysis = Object.entries(gradeCounts).map(([grade, count]) => ({ grade: Number(grade), count }));
  return { analysis };
});

interface GetPerformanceStatsResponse {
  stats: { mastered: number; reviewing: number; learning: number; new: number; due: number };
}
export const getPerformanceStats = api<{}, GetPerformanceStatsResponse>({
  method: "GET",
  path: "/supabase/analytics/performance",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('study_progress')
    .select('state, due_date');
  if (error) {
    throw APIError.internal("failed to fetch study progress for performance stats").withDetails({ error: error.message });
  }
  const now = new Date();
  let mastered = 0, reviewing = 0, learning = 0, newCount = 0, due = 0;
  (data || []).forEach((row: any) => {
    switch (row.state) {
      case "mastered": mastered++; break;
      case "reviewing": reviewing++; break;
      case "learning": learning++; break;
      case "new": newCount++; break;
    }
    if (row.due_date && new Date(row.due_date) <= now) due++;
  });
  return { stats: { mastered, reviewing, learning, new: newCount, due } };
});

// --- Series endpoints ---
interface ListSeriesResponse {
  series: Array<{ id: string; name: string; createdAt: string }>;
}
export const listSeries = api<{}, ListSeriesResponse>({
  method: "GET",
  path: "/supabase/series",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('series')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    throw APIError.internal("failed to list series").withDetails({ error: error.message });
  }
  return { series: (data || []).map((s: any) => ({ id: s.id, name: s.name, createdAt: s.created_at })) };
});

interface CreateSeriesRequest {
  name: string;
}
interface CreateSeriesResponse {
  series: { id: string; name: string; createdAt: string };
}
export const createSeries = api<CreateSeriesRequest, CreateSeriesResponse>({
  method: "POST",
  path: "/supabase/series",
  expose: true,
}, async ({ name }) => {
  const { data, error } = await supabase
    .from('series')
    .insert({ name })
    .select('id, name, created_at')
    .single();
  if (error) {
    throw APIError.internal("failed to create series").withDetails({ error: error.message });
  }
  if (!data) {
    throw APIError.internal("failed to create series. Check RLS policies.");
  }
  return { series: { id: data.id, name: data.name, createdAt: data.created_at } };
});

interface SearchSeriesRequest {
  query: Query<string>;
}
interface SearchSeriesResponse {
  series: Array<{ id: string; name: string; createdAt: string }>;
}
export const searchSeries = api<SearchSeriesRequest, SearchSeriesResponse>({
  method: "GET",
  path: "/supabase/series/search",
  expose: true,
}, async ({ query }) => {
  const { data, error } = await supabase
    .from('series')
    .select('id, name, created_at')
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false });
  if (error) {
    throw APIError.internal("failed to search series").withDetails({ error: error.message });
  }
  return { series: (data || []).map((s: any) => ({ id: s.id, name: s.name, createdAt: s.created_at })) };
});

// --- Chapter: List, Lock, Unlock endpoints ---
interface ListChaptersRequest {
  seriesId: string;
}
interface ListChaptersResponse {
  chapters: Array<{
    id: string;
    seriesId: string;
    number: number;
    title?: string;
    sourceFile?: string;
    private?: boolean;
    difficulty?: string;
    unlocked: boolean;
    createdAt: string;
  }>;
}
export const listChapters = api<ListChaptersRequest, ListChaptersResponse>({
  method: "GET",
  path: "/supabase/series/:seriesId/chapters",
  expose: true,
}, async ({ seriesId }) => {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, series_id, chapter_number, difficulty, created_at')
    .eq('series_id', seriesId)
    .order('chapter_number', { ascending: true });
  if (error) {
    throw APIError.internal("failed to list chapters").withDetails({ error: error.message });
  }
  return {
    chapters: (data || []).map((c: any) => ({
      id: c.id,
      seriesId: c.series_id,
      number: c.chapter_number,
      title: c.title,
      sourceFile: c.source_file,
      private: c.private,
      difficulty: c.difficulty,
      unlocked: c.unlocked,
      createdAt: c.created_at,
    })),
  };
});

interface LockUnlockChapterRequest {
  seriesId: string;
  chapterNumber: string;
}
interface LockUnlockChapterResponse {
  chapter: { id: string; locked: boolean };
}
export const lockChapter = api<LockUnlockChapterRequest, LockUnlockChapterResponse>({
  method: "POST",
  path: "/supabase/series/:seriesId/chapters/:chapterNumber/lock",
  expose: true,
}, async ({ seriesId, chapterNumber }) => {
  const { data, error } = await supabase
    .from('chapters')
    .update({ unlocked: false })
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .select('id')
    .single();
  if (error) {
    throw APIError.internal("failed to lock chapter").withDetails({ error: error.message });
  }
  if (!data) {
    throw APIError.notFound("Chapter not found or failed to lock.");
  }
  return { chapter: { id: data.id, locked: true } };
});

export const unlockChapter = api<LockUnlockChapterRequest, LockUnlockChapterResponse>({
  method: "POST",
  path: "/supabase/series/:seriesId/chapters/:chapterNumber/unlock",
  expose: true,
}, async ({ seriesId, chapterNumber }) => {
  const { data, error } = await supabase
    .from('chapters')
    .update({ unlocked: true })
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .select('id')
    .single();
  if (error) {
    throw APIError.internal("failed to unlock chapter").withDetails({ error: error.message });
  }
  if (!data) {
    throw APIError.notFound("Chapter not found or failed to unlock.");
  }
  return { chapter: { id: data.id, locked: false } };
});

// --- Card endpoints ---
interface AddCardRequest {
  chapterId: string;
  word: string;
  definition: string;
  romanization?: string;
  example?: string;
}
interface AddCardResponse {
  newWord: any;
}
export const addCard = api<AddCardRequest, AddCardResponse>({
  method: "POST",
  path: "/supabase/chapters/:chapterId/cards",
  expose: true,
}, async ({ chapterId, word, definition, romanization, example }) => {
  // Step 1: Find or create the word in the 'words' table.
  let { data: wordData, error: wordError } = await supabase
    .from('words')
    .select('id')
    .eq('word', word)
    .eq('definition', definition)
    .maybeSingle();

  if (wordError) {
      throw APIError.internal("Failed to check for existing word.").withDetails({ error: wordError.message });
  }

  let wordId: string;

  if (wordData) {
    wordId = wordData.id;
  } else {
    const { data: newWord, error: createWordError } = await supabase
      .from('words')
      .insert({ word, definition })
      .select('id')
      .single();

    if (createWordError) {
      throw APIError.internal("Failed to create new word.").withDetails({ error: createWordError.message });
    }
    if (!newWord) {
        throw APIError.internal("Failed to create new word, check RLS policy.");
    }
    wordId = newWord.id;
  }

  // Step 2: Link the word to the chapter in 'chapter_words'.
  const { error: linkError } = await supabase
    .from('chapter_words')
    .insert({
      chapter_id: chapterId,
      word_id: wordId,
      importance_score: 0, // Default importance score
    });

  if (linkError) {
    // This can fail if the link already exists (e.g., due to a unique constraint).
    // For now, we'll treat that as an error.
    throw APIError.internal("Failed to link word to chapter. It may already exist in this chapter.").withDetails({ error: linkError.message });
  }

  // Step 3: Return the created/found word.
  const { data: finalWord, error: finalWordError } = await supabase
  .from('words')
  .select('*')
  .eq('id', wordId)
  .single();

  if (finalWordError || !finalWord) {
      throw APIError.internal("Could not retrieve the created/found word.");
  }

  return { newWord: finalWord };
});

interface EditCardRequest {
  cardId: string;
  word?: string;
  definition?: string;
  romanization?: string;
  example?: string;
}
interface EditCardResponse {
  card: any;
}
// TODO: 
export const editCard = api<EditCardRequest, EditCardResponse>({
  method: "PATCH",
  path: "/supabase/cards/:cardId",
  expose: true,
}, async ({ cardId, word, definition }) => {
  console.log({ cardId, word, definition });
  const { data: updatedWord, error: updateError } = await supabase
    .from('words')
    .update({ word, definition })
    .eq('id', cardId)
    .select()
  if (updateError) {
    throw APIError.internal("failed to update card").withDetails({ error: updateError.message });
  }
  if (!updatedWord) {
      throw APIError.notFound("Card not found or failed to update.");
  }
  return { card: updatedWord };
});

interface DeleteCardRequest {
  cardId: string;
}
interface DeleteCardResponse {
  success: boolean;
}
// TODO: 
export const deleteCard = api<DeleteCardRequest, DeleteCardResponse>({
  method: "DELETE",
  path: "/supabase/cards/:cardId",
  expose: true,
}, async ({ cardId }) => {
  // Remove the link from chapter_words
  const { error } = await supabase
    .from('words')
    .delete()
    .eq('id', cardId);
  if (error) {
    throw APIError.internal("failed to delete card").withDetails({ error: error.message });
  }
  return { success: true };
});

interface ListCardsRequest {
  chapterId: string;
}
interface ListCardsResponse {
  cards: Array<any>;
}
export const listCards = api<ListCardsRequest, ListCardsResponse>({
  method: "GET",
  path: "/supabase/chapters/:chapterId/cards",
  expose: true,
}, async ({ chapterId }) => {
  const { data, error } = await supabase
    .from('chapter_words')
    .select(`
      words (
        id,
        word,
        definition,
        created_at
      )
    `)
    .eq('chapter_id', chapterId);

  if (error) {
    throw APIError.internal("failed to list cards for chapter").withDetails({ error: error.message });
  }

  const cards = (data || []).map(item => item.words).filter(Boolean);
  return { cards };
});

// --- User endpoints ---
interface CreateUserRequest {
  username: string;
  guest?: boolean;
  email?: string;
  password?: string;
  avatar?: string;
}
interface CreateUserResponse {
  user: any;
}
export const createUser = api<CreateUserRequest, CreateUserResponse>({
  method: "POST",
  path: "/supabase/users",
  expose: true,
}, async ({ username, guest, email, password, avatar }) => {
  const { data, error } = await supabase
    .from('users')
    .insert({ username, guest, email, password, avatar })
    .select('*')
    .single();
  if (error) {
    throw APIError.internal("failed to create user").withDetails({ error: error.message });
  }
  if (!data) {
      throw APIError.internal("Failed to create user, check RLS policy.");
  }
  return { user: data };
});

interface LoginUserRequest {
  username: string;
}
interface LoginUserResponse {
  user: any;
}
export const loginUser = api<LoginUserRequest, LoginUserResponse>({
  method: "POST",
  path: "/supabase/users/login",
  expose: true,
}, async ({ username }) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error || !data) {
    throw APIError.internal("failed to login user").withDetails({ error: error?.message });
  }
  return { user: data };
});

interface UserProgressRequest {
  userId: string;
}
interface UserProgressResponse {
  progress: any;
}
export const userProgress = api<UserProgressRequest, UserProgressResponse>({
  method: "GET",
  path: "/supabase/users/:userId/progress",
  expose: true,
}, async ({ userId }) => {
  // Example: fetch study history, streak, most studied series
  const { data, error } = await supabase
    .from('study_history')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    throw APIError.internal("failed to get user progress").withDetails({ error: error.message });
  }
  // TODO: Aggregate streak, most studied series, etc.
  return { progress: data };
});

interface ResetUserRequest {
  userId: string;
}
interface ResetUserResponse {
  success: boolean;
}
export const resetUser = api<ResetUserRequest, ResetUserResponse>({
  method: "POST",
  path: "/supabase/users/:userId/reset",
  expose: true,
}, async ({ userId }) => {
  // Example: delete study history for user
  const { error } = await supabase
    .from('study_history')
    .delete()
    .eq('user_id', userId);
  if (error) {
    throw APIError.internal("failed to reset user").withDetails({ error: error.message });
  }
  return { success: true };
});

// --- Deck endpoints ---
interface ListDecksRequest {
  genre?: string;
  difficulty?: string;
  trending?: boolean;
  new?: boolean;
  status?: string;
}
interface ListDecksResponse {
  decks: Array<any>;
}
export const listDecks = api<ListDecksRequest, ListDecksResponse>({
  method: "GET",
  path: "/supabase/decks",
  expose: true,
}, async ({ genre, difficulty, trending, new: isNew, status }) => {
  //let query = supabase.from('decks').select('*');
  // TODO: Implement trending/new logic if needed
  const { data, error } = await supabase
      .from('decks')
      .select('*');
  if (error) {
    throw APIError.internal("failed to list decks").withDetails({ error: error.message });
  }
  return { decks: data || [] };
});

interface FeatureDeckRequest {
  deckId: string;
  badge: string;
}
interface FeatureDeckResponse {
  deck: any;
}
export const featureDeck = api<FeatureDeckRequest, FeatureDeckResponse>({
  method: "POST",
  path: "/supabase/decks/:deckId/feature",
  expose: true,
}, async ({ deckId, badge }) => {
  // Assume 'featured' is a string[] column
  const { data, error } = await supabase
    .from('decks')
    .update({ featured: [badge] })
    .eq('id', deckId)
    .select('*')
    .single();
  if (error) {
    throw APIError.internal("failed to feature deck").withDetails({ error: error.message });
  }
  if (!data) {
      throw APIError.notFound("Deck not found or failed to feature.");
  }
  return { deck: data };
});

interface PreviewDeckRequest {
  deckId: string;
}
interface PreviewDeckResponse {
  deck: any;
  cards: Array<any>;
}
export const previewDeck = api<PreviewDeckRequest, PreviewDeckResponse>({
  method: "GET",
  path: "/supabase/decks/:deckId/preview",
  expose: true,
}, async ({ deckId }) => {
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .maybeSingle();
  if (deckError || !deck) {
    throw APIError.internal("failed to get deck").withDetails({ error: deckError?.message });
  }
  // Fetch cards from deck_words + words
  const { data: cards, error: cardsError } = await supabase
    .from('deck_words')
    .select('*, word:words(*)')
    .eq('deck_id', deckId);
  if (cardsError) {
    throw APIError.internal("failed to get deck cards").withDetails({ error: cardsError.message });
  }
  return { deck, cards: cards || [] };
});

// --- DeckWords SRS fields ---
interface DeckWordSRSFields {
  state: string; // StudyState
  interval: number;
  eFactor: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  totalReviews: number;
  nextReviewDate: string; // ISO date
  lastReviewedDate?: string; // ISO date
  firstSeenDate: string; // ISO date
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

import { supabaseUrl } from "./client";

// --- Create Deck endpoint (refactored for deck_words join table) ---
interface CreateDeckRequest {
  seriesName: string;
  chapterNumber: string;
  userId: string;
  name?: string;
  maxLength?: number;
}
interface CreateDeckResponse {
  deck: any;
  cards: Array<any>; // Each card is a row from words table
}
export const createDeck = api<CreateDeckRequest, CreateDeckResponse>({
  method: "POST",
  path: "/supabase/decks",
  expose: true,
}, async ({ seriesName, chapterNumber, userId, name, maxLength }) => {
  // Find the chapter
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('name', seriesName)
    .maybeSingle();
  if (seriesError || !series) {
    throw APIError.notFound("Series not found: ")
      .withDetails({ error: seriesError?.message || null })
      .withDetails({error: supabaseUrl()});
  }
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id')
    .eq('chapter_number', chapterNumber)
    .eq('series_id', series.id)
    .maybeSingle();
  if (chapterError || !chapter) {
    throw APIError.notFound("Chapter not found");
  }
  // Get words for the chapter, order by importance_score
  const { data: chapterWords, error: wordsError } = await supabase
    .from('chapter_words')
    .select('word_id, importance_score, words!inner(*)') // Also fetch the word data
    .eq('chapter_id', chapter.id)
    .order('importance_score', { ascending: false });
  if (wordsError) {
    throw APIError.internal("Failed to get chapter words").withDetails({ error: wordsError.message });
  }

  const allWords = chapterWords?.map(cw => (cw as any).words) || [];
  let selectedWords = allWords;
  if (maxLength && maxLength > 0) {
    selectedWords = selectedWords.slice(0, maxLength);
  }

  // Create the deck
  const deckName = name || `${seriesName} Chapter ${chapterNumber}`;
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .insert({
      name: deckName,
      user_id: userId,
      chapter_id: chapter.id
    })
    .select('*')
    .single();
  if (deckError || !deck) {
    throw APIError.internal("Failed to create deck").withDetails({ error: deckError?.message });
  }

  // NOTE: This function no longer creates SRS progress records.
  // FSRS progress will be created on-the-fly when a study session starts.
  // We also no longer populate the `deck_words` join table as it's part of the legacy SM-2 system.

  return { deck, cards: selectedWords };
});

// --- Dev endpoints ---
interface DevSeedResponse {
  success: boolean;
  message: string;
}
export const devSeed = api<{}, DevSeedResponse>({
  method: "POST",
  path: "/supabase/dev/seed",
  expose: true,
}, async () => {
  // TODO: Implement real seeding logic
  return { success: true, message: "Database seeded with test data (stub)." };
});

interface DevResetResponse {
  success: boolean;
  message: string;
}
export const devReset = api<{}, DevResetResponse>({
  method: "POST",
  path: "/supabase/dev/reset",
  expose: true,
}, async () => {
  // TODO: Implement real reset logic
  return { success: true, message: "Database reset and reseeded (stub)." };
});

interface DevExportResponse {
  success: boolean;
  data: any;
}
export const devExport = api<{}, DevExportResponse>({
  method: "GET",
  path: "/supabase/dev/export",
  expose: true,
}, async () => {
  // TODO: Implement real export logic
  return { success: true, data: {} };
});

interface DevWatchResponse {
  success: boolean;
  message: string;
}
export const devWatch = api<{}, DevWatchResponse>({
  method: "POST",
  path: "/supabase/dev/watch",
  expose: true,
}, async () => {
  // TODO: Implement real watch logic
  return { success: true, message: "Watch started (stub)." };
});

// =============================
// FSRS Study Session Endpoints
// =============================

/**
 * Starts a new study session for a user and deck.
 * @route POST /study/session/start
 * @body { userId: string, deckId: string }
 * @returns { sessionState: SessionState }
 */
export const startStudySessionApi = api<{ userId: string; deckId: string }, { sessionState: any }>({
    method: "POST",
    path: "/study/session/start",
    expose: true,
}, async ({ userId, deckId }) => {
    // 1. Find the chapter associated with the deck
    const { data: deck, error: deckError } = await supabase.from('decks').select('chapter_id').eq('id', deckId).single();
    if (deckError || !deck) {
        throw APIError.notFound("Deck not found.");
    }
    const chapterId = deck.chapter_id;

    // 2. Get all word IDs and word data from that chapter
    const { data: chapterWords, error: wordsError } = await supabase
        .from('chapter_words')
        .select('word_id, importance_score, words!inner(id, word, definition)')
        .eq('chapter_id', chapterId);

    if (wordsError) throw APIError.internal("Failed to get chapter words for session").withDetails({ error: wordsError.message });
    if (!chapterWords) throw APIError.notFound("No words found for this deck's chapter.");

    const wordIds = chapterWords.map(cw => cw.word_id);
    
    // 3. Fetch existing FSRS progress for these words for the user
    const { data: progressData, error: progressError } = await supabase
        .from('fsrs_progress')
        .select('*')
        .eq('user_id', userId)
        .in('vocabulary_id', wordIds);
        
    if (progressError) throw APIError.internal("Failed to get user progress").withDetails({ error: progressError.message });
    
    // 4. For any words the user hasn't seen, create a new progress record in the database
    const progressMap = new Map((progressData || []).map(p => [p.vocabulary_id, p]));
    const vocabWithProgress: VocabularyWithProgress[] = [];
    const wordsWithoutProgress = chapterWords.filter(cw => !progressMap.has(cw.word_id));

    if (wordsWithoutProgress.length > 0) {
        const newProgressRecords = wordsWithoutProgress.map(cw => ({
            user_id: userId,
            vocabulary_id: cw.word_id,
            due: new Date().toISOString(),
            stability: 0,
            difficulty: 0,
            state: 0, // FSRSState.New
        }));

        const { data: insertedProgress, error: insertError } = await supabase
            .from('fsrs_progress')
            .insert(newProgressRecords)
            .select();

        if (insertError) throw APIError.internal("Failed to create new progress records").withDetails({ error: insertError.message });

        // Add the newly created progress records to our map
        (insertedProgress || []).forEach(p => progressMap.set(p.vocabulary_id, p));
    }
    
    // 5. Build the final array of vocabulary with their progress
    for (const cw of chapterWords) {
        const progress = progressMap.get(cw.word_id);
        if (progress) { // Should always be true now
            vocabWithProgress.push({
                vocabulary: {
                    id: (cw.words as any).id,
                    korean: (cw.words as any).word,
                    english: (cw.words as any).definition,
                    importanceScore: cw.importance_score || 0,
                },
                studyProgress: {
                    ...progress,
                    due: new Date(progress.due),
                    last_review: progress.last_review ? new Date(progress.last_review) : undefined,
                } as FSRSProgress,
                isDue: new Date(progress.due) <= new Date(),
                daysUntilReview: Math.max(0, (new Date(progress.due).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
            });
        }
    }
    
    // 6. Start the session with the fully populated data
    const sessionState = startStudySession(userId, deckId, vocabWithProgress);
    return { sessionState };
});


/**
 * Grades the current card and updates session state and database.
 * @route POST /study/session/grade
 * @body { sessionId: string, rating: Rating }
 * @returns { sessionState: SessionState }
 */
export const gradeCardApi = api<{ sessionId: string; rating: Rating }, { sessionState: any }>({
    method: "POST",
    path: "/study/session/grade",
    expose: true,
}, async ({ sessionId, rating }) => {
    //const { Rating } = await import('ts-fsrs');
    //const fsrsRating = rating as typeof Rating[keyof typeof Rating];

    // This function now returns all the data we need to persist
    const { newState, updatedProgress, reviewLog } = gradeCardLogic(sessionId, rating);

    // Persist FSRSProgress to the database
    const { error: progressError } = await supabase
        .from('fsrs_progress')
        .update({
            due: updatedProgress.due,
            stability: updatedProgress.stability,
            difficulty: updatedProgress.difficulty,
            elapsed_days: updatedProgress.elapsed_days,
            scheduled_days: updatedProgress.scheduled_days,
            reps: updatedProgress.reps,
            lapses: updatedProgress.lapses,
            state: updatedProgress.state,
            last_review: updatedProgress.last_review,
            learning_steps: updatedProgress.learning_steps
        })
        .eq('id', updatedProgress.id);
        
    if (progressError) {
        // Log error but don't fail the request, as the session state is updated in memory.
        console.error("Failed to persist FSRS progress", progressError.message);
    }
    
    // Persist FSRSReviewLog to the database
    const { error: logError } = await supabase
        .from('fsrs_review_logs')
        .insert({
            progress_id: reviewLog.progressId,
            user_id: newState.userId, // get userId from the session state
            rating: reviewLog.rating,
            state: reviewLog.state,
            due: reviewLog.due,
            stability: reviewLog.stability,
            difficulty: reviewLog.difficulty,
            elapsed_days: reviewLog.elapsed_days,
            last_elapsed_days: reviewLog.last_elapsed_days,
            scheduled_days: reviewLog.scheduled_days,
            review: reviewLog.review,
            learning_steps: reviewLog.learning_steps
        });

    if (logError) {
        console.error("Failed to persist FSRS review log", logError.message);
    }
    
    return { sessionState: newState };
});

/**
 * Quits the session and cleans up.
 * @route POST /study/session/end
 * @body { sessionId: string }
 * @returns { success: boolean }
 */
export const endStudySessionApi = api<{ sessionId: string }, { success: boolean }>({
  method: "POST",
  path: "/study/session/end",
  expose: true,
}, async ({ sessionId }) => {
  endStudySession(sessionId);
  return { success: true };
}); 