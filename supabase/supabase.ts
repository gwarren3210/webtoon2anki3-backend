import { api, APIError, Header, Query } from "encore.dev/api";
import { authHandler } from "./auth";
import { getAuthData } from "~encore/auth";
import { supabase } from "./client";

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
  auth: true,
}, async ({ seriesName, chapterNumber }) => {
  // Get authenticated user (if needed)
  const user = getAuthData();
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
  auth: true,
}, async ({ id }) => {
  const user = getAuthData();
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
  auth: true,
}, async ({ seriesName, chapterNumber, words }) => {
  const user = getAuthData();
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
  auth: true,
}, async () => {
  const user = getAuthData();
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
  auth: true,
}, async ({ query }) => {
  const user = getAuthData();
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
  auth: true,
}, async ({ seriesName }) => {
  const user = getAuthData();
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
  auth: true,
}, async ({ seriesName, chapterNumber }) => {
  const user = getAuthData();
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
  auth: true,
}, async () => {
  const user = getAuthData();
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
  auth: true,
}, async () => {
  const user = getAuthData();
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
  auth: true,
}, async () => {
  const user = getAuthData();
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
  auth: true,
}, async () => {
  const user = getAuthData();
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