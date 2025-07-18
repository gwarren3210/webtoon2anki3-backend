import { api, APIError, Header, Query } from "encore.dev/api";
import { authHandler } from "./auth";
import { supabase, supabaseAdmin } from "./client";
import {
  startStudySession,
  gradeCard as gradeCardLogic,
  endStudySession,
} from "./studySession/index";
import { reviveSessionState } from "./studySession/utils";
import log from "encore.dev/log";
import { Card } from './supabaseEndpoints'
import type {
  SignupRequest, SignupResponse,
  StartStudySessionRequest, StartStudySessionResponse,
  GradeCardRequest, GradeCardResponse,
  EndStudySessionRequest, EndStudySessionResponse,
  ArraySeriesResponse, SingleSeriesResponse,
  ListChaptersRequest, ListChaptersResponse,
  ListCardsRequest, ListCardsResponse,
  SeriesByIdRequest, StudyCard,
  ChapterByIdRequest, SingleChapterResponse,
  // Add new types
  GetUserStatsRequest, GetUserStatsResponse, GetUserLibraryRequest, GetUserLibraryResponse,
  CheckUsernameRequest, CheckUsernameResponse,
  GetUserPreferencesRequest, GetUserPreferencesResponse, UserPreferences,
  GetUserProgressRequest, GetUserProgressResponse, SeriesProgress, UserChapterProgress,
  SearchSeriesQueryRequest, 
  UpdateUserProgressRequest, UpdateUserProgressResponse,
} from "./supabaseEndpoints";
/* import type {
  GetSessionRequest, GetSessionResponse,
  CheckChapterRequest, CheckChapterResponse,
  GetChapterWordsRequest, GetChapterWordsResponse,
  CreateChapterRequest, CreateChapterResponse,
  GetVocabularyResponse, SearchVocabularyRequest, SearchVocabularyResponse,
  FilterVocabularyBySeriesRequest, FilterVocabularyBySeriesResponse,
  FilterVocabularyByChapterRequest, FilterVocabularyByChapterResponse,
  GetRetentionResponse, GetStudyPatternsResponse, GetDifficultyAnalysisResponse, GetPerformanceStatsResponse,
  UserProgressRequest, UserProgressResponse, ResetUserRequest, ResetUserResponse, ListDecksRequest, ListDecksResponse,
  FeatureDeckRequest, FeatureDeckResponse, PreviewDeckRequest, PreviewDeckResponse, CreateDeckRequest, CreateDeckResponse,
  GetUserProfileRequest, GetUserProfileResponse, UpdateUserProfileRequest, UpdateUserProfileResponse,
  GetBulkDeckStatsRequest, GetBulkDeckStatsResponse, GetUserActivityRequest, GetUserActivityResponse,
  CreateSeriesRequest, UserActivity, DeckStats, 

} from "./supabaseEndpoints"; */
import {
  parsePublicId,
  getSeriesBySlug,
  getChapterByNumber,
  getChaptersBySeries,
  getDeckByChapter,
  getDecksByChapters,
  getChapterWords as getChapterWordsHelper,
  getUserProgress as getUserProgressHelper,
  createMissingProgressRecords,
  selectStudyWords,
  convertToStudyCard,
  convertChapterWordsToStudyCards,
  convertToSeries,
  convertToChapter,
  getCardsWithProgressForChapter,
  createInitialFSRSProgress,
  toFSRSProgress,
} from './studySession/utils';
import { FSRSProgress, FSRSState } from './fsrs/types';

/* export interface FSRSProgress {
  id: string;logic options+
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

// Chapter endpoints
/* export const checkChapter = api<CheckChapterRequest, CheckChapterResponse>({
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
}); */

// --- Get Chapter Words endpoint ---
/* export const getChapterWords = api<GetChapterWordsRequest, GetChapterWordsResponse>({
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
 */
// --- Create Chapter endpoint ---
/* export const createChapter = api<CreateChapterRequest, CreateChapterResponse>({
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
}); */

// --- Vocabulary endpoints ---
/* export const getVocabulary = api<{}, GetVocabularyResponse>({
  method: "GET",
  path: "/supabase/vocabulary",
  expose: true,
}, async () => {
  const { data, error } = await supabase.from('words').select('*').order('created_at', { ascending: false });
  if (error) {
    throw APIError.internal("failed to fetch vocabulary").withDetails({ error: error.message });
  }
  return { vocabulary: data || [] };
}); */

/* export const searchVocabulary = api<SearchVocabularyRequest, SearchVocabularyResponse>({
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
}); */

/* export const filterVocabularyBySeries = api<FilterVocabularyBySeriesRequest, FilterVocabularyBySeriesResponse>({
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
}); */

/* export const filterVocabularyByChapter = api<FilterVocabularyByChapterRequest, FilterVocabularyByChapterResponse>({
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
}); */

// --- Analytics endpoints ---
/* export const getRetention = api<{}, GetRetentionResponse>({
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
}); */

/* export const getStudyPatterns = api<{}, GetStudyPatternsResponse>({
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
}); */

/* export const getDifficultyAnalysis = api<{}, GetDifficultyAnalysisResponse>({
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
}); */

/* export const getPerformanceStats = api<{}, GetPerformanceStatsResponse>({
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
}); */

// --- Series endpoints ---
export const listSeries = api<{}, ArraySeriesResponse>({
  method: "GET",
  path: "/supabase/series",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('series')
    .select('id, name, created_at, picture, synopsis, popularity, genres, authors, korean_name, slug')
    .order('created_at', { ascending: false });
  if (error) {
    throw APIError.internal("failed to list series").withDetails({ error: error.message });
  }
  return { series: (data || []).map(convertToSeries) };
});

/* export const createSeries = api<CreateSeriesRequest, SingleSeriesResponse>({
  method: "POST",
  path: "/supabase/series",
  expose: true,
}, async ({ name }) => {
  const { data, error } = await supabase
    .from('series')
    .insert({ name })
    .select('*')
    .single();
  if (error) {
    throw APIError.internal("failed to create series").withDetails({ error: error.message });
  }
  if (!data) {
    throw APIError.internal("failed to create series. Check RLS policies.");
  }
  return { series: { 
      id: data.id, 
      titleEn: data.name,
      titleKr: data.korean_name,
      author: data.authors,
      description: data.synopsis,
      genre: data.genres,
      difficulty: "intermediate",
      coverImage: data.picture,
      totalChapters: 99,
      totalCards: 99,
      avgRating: 5,
      totalLearners: 99,
      status: "ongoing",
      createdAt: data.created_at,
      isTrending: false,
      isNew: false,
  } };
}); */

export const searchSeries = api<SearchSeriesQueryRequest, ArraySeriesResponse>({
  method: "GET",
  path: "/supabase/series/search",
  expose: true,
}, async ({ q }) => {
  const { data, error } = await supabase
    .from('series')
    .select('id, name, created_at')
    .ilike('name', `%${q}%`)
    .order('created_at', { ascending: false });
  if (error) {
    throw APIError.internal("failed to search series").withDetails({ error: error.message });
  }
  return { series: (data || []).map((s: any) => ({ 
    id: s.id, 
    publicId: s.slug,
    titleEn: s.name,
    titleKr: s.korean_name,
    author: s.authors,
    description: s.synopsis,
    genre: s.genres,
    difficulty: "intermediate",
    coverImage: s.picture,
    totalChapters: 99,
    totalCards: 99,
    avgRating: 5,
    totalLearners: 99,
    status: "ongoing",
    createdAt: s.created_at,
    isTrending: false,
    isNew: false, 
  })) };
});

export const getSeriesById = api<SeriesByIdRequest, SingleSeriesResponse>({
  method: "GET",
  path: "/supabase/series/:seriesId",
  expose: true,
}, async ({ seriesId }) => {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('id', seriesId)
    .maybeSingle();
  if (error || !data) {
    throw APIError.notFound("Series not found").withDetails({ error: error?.message });
  }
  // Map DB fields to SingleSeriesResponse shape
  return { series: convertToSeries(data) };
});

// WARN not implemented in db
export const getFeaturedSeries = api<{}, ArraySeriesResponse>({
  method: "GET",
  path: "/supabase/series/featured",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('series')
    .select('*');
  if (error || !data) {
    throw APIError.internal("failed to fetch series").withDetails({ error: error?.message });
  }
  // Shuffle and take up to 5
  const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 5);
  return {
    series: shuffled.map(s => ({
      id: s.id,
      publicId: s.slug,
      titleEn: s.name,
      titleKr: s.korean_name,
      author: s.authors,
      description: s.synopsis,
      genre: s.genres,
      difficulty: s.difficulty || "intermediate",
      coverImage: s.picture,
      totalChapters: s.total_chapters || 0,
      totalCards: s.total_cards || 0,
      avgRating: s.avg_rating || 0,
      totalLearners: s.total_learners || 0,
      status: s.status || "ongoing",
      createdAt: s.created_at,
      isTrending: !!s.is_trending,
      isNew: !!s.is_new,
    }))
  };
});

// WARN not implemented in db
export const getTrendingSeries = api<{}, ArraySeriesResponse>({
  method: "GET",
  path: "/supabase/series/trending",
  expose: true,
}, async () => {
  const { data, error } = await supabase
    .from('series')
    .select('*');
  if (error || !data) {
    throw APIError.internal("failed to fetch series").withDetails({ error: error?.message });
  }
  // Shuffle and take up to 5
  const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 5);
  return {
    series: shuffled.map(s => ({
      id: s.id,
      publicId: s.slug,
      titleEn: s.name,
      titleKr: s.korean_name,
      author: s.authors,
      description: s.synopsis,
      genre: s.genres,
      difficulty: s.difficulty || "intermediate",
      coverImage: s.picture,
      totalChapters: s.total_chapters || 0,
      totalCards: s.total_cards || 0,
      avgRating: s.avg_rating || 0,
      totalLearners: s.total_learners || 0,
      status: s.status || "ongoing",
      createdAt: s.created_at,
      isTrending: !!s.is_trending,
      isNew: !!s.is_new,
    }))
  };
});

// --- Chapter: List endpoints ---
export const listChapters = api<ListChaptersRequest, ListChaptersResponse>({
  method: "GET",
  path: "/supabase/series/:seriesId/chapters",
  expose: true,
}, async ({ seriesId }) => {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, series_id, chapter_number, difficulty, created_at, slug')
    .eq('series_id', seriesId)
    .order('chapter_number', { ascending: true });
  if (error) {
    throw APIError.internal("failed to list chapters").withDetails({ error: error.message });
  }
  // TODO figure out unlocking behavior
  return { chapters: (data || []).map(convertToChapter) };
});

export const getChapterBySlug = api<ChapterByIdRequest, SingleChapterResponse>({
  method: "GET",
  path: "/supabase/chapters/:chapterSlug",
  expose: true,
}, async ({ chapterSlug }) => {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('slug', chapterSlug)
    .maybeSingle();
  if (error || !data) {
    throw APIError.notFound("Chapter not found").withDetails({ error: error?.message });
  }
  // Map DB fields to SingleChapterResponse shape
  return {
    chapter: convertToChapter(data)
  };
});


// --- Card endpoints ---

export const listCards = api<ListCardsRequest, ListCardsResponse>({
  method: "GET",
  path: "/supabase/chapters/:chapterId/cards",
  expose: true,
}, async ({ chapterId, userId }) => {
  // Check if deck exists for this user/chapter
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .maybeSingle();
  
  // Always return cards with progress (new or existing)
  const cards = await getCardsWithProgressForChapter(userId, chapterId);
  const studyCards = cards.map(cardToStudyCard);
  return { cards: studyCards, deckExists: !!deck };
});

// --- User endpoints ---
/* export const userProgress = api<UserProgressRequest, UserProgressResponse>({
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
}); */

/* export const resetUser = api<ResetUserRequest, ResetUserResponse>({
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
}); */

// --- Deck endpoints ---
/* export const listDecks = api<ListDecksRequest, ListDecksResponse>({
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
 */
/* export const featureDeck = api<FeatureDeckRequest, FeatureDeckResponse>({
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
}); */

// TODO add similar endpoint to view all cards in deck
/* export const previewDeck = api<PreviewDeckRequest, PreviewDeckResponse>({
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
}); */

import { supabaseUrl } from "./client";

// --- Create Deck endpoint (refactored for deck_words join table) ---
/* export const createDeck = api<CreateDeckRequest, CreateDeckResponse>({
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

  // Create fsrs_progress records for all words in the deck for this user if not already present
  const wordIds = selectedWords.map((w: any) => w.id);
  if (wordIds.length > 0) {
    // Find existing progress records for this user and these words
    const { data: existingProgress, error: progressError } = await supabase
      .from('fsrs_progress')
      .select('vocabulary_id')
      .eq('user_id', userId)
      .in('vocabulary_id', wordIds);
    if (progressError) {
      throw APIError.internal('Failed to check existing progress records').withDetails({ error: progressError.message });
    }
    const existingWordIds = new Set((existingProgress || []).map((p: any) => p.vocabulary_id));
    const missingWordIds = wordIds.filter((id: string) => !existingWordIds.has(id));
    if (missingWordIds.length > 0) {
      const now = new Date().toISOString();
      const newProgressRecords = missingWordIds.map((vocabulary_id: string) => ({
        user_id: userId,
        vocabulary_id,
        due: now,
        stability: 0,
        difficulty: 0,
        state: 0, // FSRSState.New
      }));
      const { error: insertError } = await supabase
        .from('fsrs_progress')
        .insert(newProgressRecords);
      if (insertError) {
        throw APIError.internal('Failed to create new progress records').withDetails({ error: insertError.message });
      }
    }
  }

  return { deck, cards: selectedWords };
}); */

// =============================
// FSRS Study Session Endpoints
// =============================

const STUDY_SESSION_LIMITS = {
  MAX_NEW_WORDS: 20,
  MAX_TOTAL_WORDS: 50,
} as const;

function cardToStudyCard(card: Card): StudyCard {
  const { studyProgress } = card;
  // Helper functions for difficulty, learningState, etc.
  const getLearningState = (state: FSRSState): 'new' | 'learning' | 'review' | 'mastered' => {
    switch (state) {
      case FSRSState.New: return 'new';
      case FSRSState.Learning: return 'learning';
      case FSRSState.Review: return 'review';
      case FSRSState.Relearning: return 'mastered';
      default: return 'new';
    }
  };
  const getDifficulty = (difficulty: number): 'easy' | 'medium' | 'hard' => {
    if (difficulty <= 0.3) return 'easy';
    if (difficulty <= 0.7) return 'medium';
    return 'hard';
  };
  const calculateSuccessRate = (progress: FSRSProgress): number => {
    if (!progress || progress.reps === 0) return 0;
    return Math.round(((progress.reps - progress.lapses) / progress.reps) * 100);
  };
  // All date fields are Date objects in backend logic; convert to ISO string for API
  return {
    id: card.id,
    korean: card.korean,
    english: card.english,
    pronunciation: '', // Add if available
    exampleSentence: '', // Add if available
    difficulty: getDifficulty(studyProgress.difficulty),
    learningState: getLearningState(studyProgress.state),
    nextReviewDate: studyProgress.due?.toISOString(),
    createdAt: studyProgress.createdAt.toISOString(),
    successRate: calculateSuccessRate(studyProgress),
    importanceScore: card.importanceScore,
  };
}

export const startStudySessionApi = api<StartStudySessionRequest, StartStudySessionResponse>({
  method: "POST",
  path: "/study/session/start",
  expose: true,
}, async ({ userId, publicId }) => {
  try {
    log.info("[startStudySessionApi] Public Id received", { publicId });
    const parsedId = parsePublicId(publicId);
    log.info("[startStudySessionApi] Parsed publicId", { parsedId });
    
    // Check/create deck for chapter type sessions
    if (parsedId.type === 'chapter') {
      log.info("[startStudySessionApi] Session type is chapter", { seriesSlug: parsedId.seriesSlug, chapterNumber: parsedId.chapterNumber });
      const series = await getSeriesBySlug(parsedId.seriesSlug);
      log.info("[startStudySessionApi] Series fetched", { series });
      const chapter = await getChapterByNumber(series.id, parsedId.chapterNumber);
      log.info("[startStudySessionApi] Chapter fetched", { chapter });
      
      // Check if deck exists for this user/chapter
      const { data: existingDeck, error: deckError } = await supabase
        .from('decks')
        .select('id')
        .eq('user_id', userId)
        .eq('chapter_id', chapter.id)
        .maybeSingle();
      log.info("[startStudySessionApi] Deck existence checked", { existingDeck, deckError });
      
      // Create deck if it doesn't exist
      if (!existingDeck && !deckError) {
        log.info("[startStudySessionApi] Creating new deck for user/chapter", { userId, chapterId: chapter.id });
        const { data: newDeck, error: createError } = await supabase
          .from('decks')
          .insert({
            name: `${series.slug} Chapter ${parsedId.chapterNumber}`,
            user_id: userId,
            chapter_id: chapter.id,
          })
          .select('id')
          .single();
        log.info("[startStudySessionApi] Deck creation result", { newDeck, createError });
        if (createError || !newDeck) {
          log.warn('[startStudySessionApi] Failed to create deck for user/chapter', { userId, chapterId: chapter.id, error: createError?.message });
        }
      }
    }
    
    let chapterWords;
    let progressMap;
    let vocabWithProgress;
    if (parsedId.type === 'all') {
      log.info("[startStudySessionApi] Session type is 'all'");
      const { data: progressData, error: progressError } = await supabase
        .from('fsrs_progress')
        .select('*')
        .eq('user_id', userId);
      log.info("[startStudySessionApi] Progress data fetched", { progressData, progressError });
      if (progressError || !progressData || progressData.length === 0) {
        log.error('[startStudySessionApi] No study progress found for this user', { progressError });
        throw APIError.notFound('No study progress found for this user');
      }
      const wordIds = progressData.map((p: any) => p.vocabulary_id);
      log.info("[startStudySessionApi] Word IDs from progress", { wordIds });
      // Fetch word data for these vocabulary IDs
      const { data: words, error: wordsError } = await supabase
        .from('words')
        .select('id, word, definition')
        .in('id', wordIds);
      log.info("[startStudySessionApi] Words fetched for user", { words, wordsError });
      if (wordsError || !words || words.length === 0) {
        log.error('[startStudySessionApi] No words found for this user', { wordsError });
        throw APIError.notFound('No words found for this user');
      }
      // Build chapterWords array (minimal fields)
      chapterWords = wordIds.map((id: string) => {
        const word = words.find((w: any) => w.id === id);
        return {
          word_id: id,
          importance_score: 0,
          words: word || { id, word: '', definition: '' },
        };
      });
      log.info("[startStudySessionApi] Built chapterWords array", { chapterWords });
      progressMap = new Map((progressData || []).map(p => [p.vocabulary_id, p]));
      log.info("[startStudySessionApi] Built progressMap", { progressMapSize: progressMap.size });
    } else if (parsedId.type === 'chapter') {
      log.info("[startStudySessionApi] Session type is 'chapter'");
      const series = await getSeriesBySlug(parsedId.seriesSlug);
      log.info("[startStudySessionApi] Series fetched", { series });
      const chapter = await getChapterByNumber(series.id, parsedId.chapterNumber);
      log.info("[startStudySessionApi] Chapter fetched", { chapter });
      chapterWords = await getChapterWordsHelper([chapter.id]);
      log.info("[startStudySessionApi] Chapter words fetched", { chapterWords });
      if (!Array.isArray(chapterWords)) {
        log.error('[startStudySessionApi] chapterWords is not an array', { chapterWords });
        throw APIError.internal('Failed to load chapter words');
      }
      const wordIds = chapterWords.map(cw => cw.word_id);
      log.info("[startStudySessionApi] Word IDs from chapterWords", { wordIds });
      const progressData = await getUserProgressHelper(userId, wordIds);
      log.info("[startStudySessionApi] Progress data fetched for chapter", { progressData });
      progressMap = new Map((progressData || []).map(p => [p.vocabularyId, p]));
      log.info("[startStudySessionApi] Built progressMap for chapter", { progressMapSize: progressMap.size });
      await createMissingProgressRecords(userId, chapterWords, progressMap);
      log.info("[startStudySessionApi] Ensured missing progress records");
    } else if (parsedId.type === 'series') {
      log.info("[startStudySessionApi] Session type is 'series'");
      const series = await getSeriesBySlug(parsedId.seriesSlug);
      log.info("[startStudySessionApi] Series fetched", { series });
      const chapters = await getChaptersBySeries(series.id);
      log.info("[startStudySessionApi] Chapters fetched for series", { chapters });
      const chapterIds = chapters.map(c => c.id);
      log.info("[startStudySessionApi] Chapter IDs for series", { chapterIds });
      chapterWords = await getChapterWordsHelper(chapterIds);
      log.info("[startStudySessionApi] Chapter words fetched for series", { chapterWords });
      if (!Array.isArray(chapterWords)) {
        log.error('[startStudySessionApi] chapterWords is not an array (series)', { chapterWords });
        throw APIError.internal('Failed to load chapter words for series');
      }
      const wordIds = chapterWords.map(cw => cw.word_id);
      log.info("[startStudySessionApi] Word IDs from chapterWords (series)", { wordIds });
      const progressData = await getUserProgressHelper(userId, wordIds);
      log.info("[startStudySessionApi] Progress data fetched for series", { progressData });
      progressMap = new Map((progressData || []).map(p => [p.vocabularyId, p]));
      log.info("[startStudySessionApi] Built progressMap for series", { progressMapSize: progressMap.size });
      await createMissingProgressRecords(userId, chapterWords, progressMap);
      log.info("[startStudySessionApi] Ensured missing progress records for series");
    } else {
      log.error('[startStudySessionApi] Invalid session type', { parsedId });
      throw APIError.invalidArgument("Invalid session type");
    }
    log.info("[startStudySessionApi] Selecting study words", { chapterWordsLength: chapterWords.length, progressMapSize: progressMap.size });
    const selectedWords = selectStudyWords(
      chapterWords,
      progressMap,
      STUDY_SESSION_LIMITS.MAX_NEW_WORDS,
      STUDY_SESSION_LIMITS.MAX_TOTAL_WORDS
    );
    log.info("[startStudySessionApi] Selected study words", { selectedWords });
    const cards: Card[] = selectedWords.map(cw => {
      let progress = progressMap.get(cw.word_id);
      if (!progress) {
        progress = createInitialFSRSProgress(userId, cw.word_id);
      } else {
        progress = toFSRSProgress(progress);
      }
      return {
        id: cw.words.id,
        korean: cw.words.word,
        english: cw.words.definition,
        importanceScore: cw.importance_score || 0,
        studyProgress: progress,
      };
    });
    log.info("[startStudySessionApi] Built cards", { cards });
    const sessionState = await startStudySession(userId, publicId, cards);
    log.info("[startStudySessionApi] Session created", { sessionState, userId });
    // Convert to StudyCard[] for API response
    const studyCards = cards.map(cardToStudyCard);
    // Build frontend-friendly DTO
    log.info("[startStudySessionApi] sessionState.currentCard", { currentCard: sessionState.currentCard });
    log.info("[startStudySessionApi] sessionState.queues keys", { queueKeys: Object.keys(sessionState.queues) });
    for (const [key, value] of Object.entries(sessionState.queues)) {
      log.info(`[startStudySessionApi] queue '${key}' length`, { length: Array.isArray(value) ? value.length : 'not array', sample: Array.isArray(value) && value.length > 0 ? value[0] : undefined });
    }
    log.info("[startStudySessionApi] sessionState.allCards", { allCardsCount: sessionState.allCards?.length, sample: sessionState.allCards?.[0] });
    if (!sessionState.currentCard) {
      log.warn("[startStudySessionApi] currentCard is null!", { queueKeys: Object.keys(sessionState.queues), queues: sessionState.queues });
    }
    const sessionDto = {
      id: sessionState.id,
      userId: sessionState.userId,
      deckPublicId: sessionState.deckPublicId,
      isComplete: sessionState.isComplete,
      stats: sessionState.stats,
      reviewHistory: sessionState.reviewHistory,
      cardRatings: sessionState.cardRatings,
      createdAt: sessionState.createdAt.toISOString(),
      lastActive: sessionState.lastActive.toISOString(),
      cards: studyCards,
      currentCard: sessionState.currentCard ? cardToStudyCard(sessionState.currentCard) : null,
      // Add any other fields the frontend needs
    };
    return { session: sessionDto };
  } catch (error: any) {
    log.error('[startStudySessionApi] Study session creation failed', {
      userId,
      publicId,
      error: error.message,
      stack: error.stack,
    });
    if (error instanceof APIError) {
      throw error;
    }
    throw APIError.internal("Failed to start study session").withDetails({ originalError: error.message });
  }
});


/**
 * Grades the current card and updates session state and database.
 * @route POST /study/session/grade
 * @body { sessionId: string, rating: Rating }
 * @returns { sessionState: SessionState }
 */
export const gradeCardApi = api<GradeCardRequest, GradeCardResponse>({
    method: "POST",
    path: "/study/session/grade",
    expose: true,
}, async ({ sessionId, rating }) => {
    //const { Rating } = await import('ts-fsrs');
    //const fsrsRating = rating as typeof Rating[keyof typeof Rating];

    // This function now returns all the data we need to persist
    const { newState, updatedProgress, reviewLog } = await gradeCardLogic(sessionId, rating);

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
        log.error("Failed to persist FSRS progress", { error: progressError.message });
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
        log.error("Failed to persist FSRS review log", { error: logError.message});
    }
    
    // Convert next card to StudyCard for frontend
    //TODO make the return field proper
    const nextCard = newState.currentCard ? cardToStudyCard(newState.currentCard) : null;
    // Build frontend-friendly DTO
    const dto = {
      sessionId: newState.id,
      nextCard,
      stats: newState.stats,
      // Add any other fields the frontend needs
    };
    return dto;
});

/**
 * Quits the session and cleans up.
 * @route POST /study/session/end
 * @body { sessionId: string }
 * @returns { success: boolean }
 */
export const endStudySessionApi = api<EndStudySessionRequest, EndStudySessionResponse>({
  method: "POST",
  path: "/study/session/end",
  expose: true,
}, async ({ sessionId }) => {
  endStudySession(sessionId);
  return { success: true };
});


/**
 * Registers a new user securely via Supabase Admin API.
 * @route POST /supabase/auth/signup
 * @body { username: string, email?: string, password?: string, guest?: boolean, avatar?: string }
 * @returns { user: User }
 */
// TODO change from admin to anon
export const signup = api<SignupRequest, SignupResponse>({
  method: "POST",
  path: "/supabase/auth/signup",
  expose: true,
}, async ({ email, username, password, displayName }) => {
  log.info(username + '@gmail.com')
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    log.error("Supabase Auth createUser failed", { error });
    throw APIError.internal("failed to create user").withDetails({ error: error.message });
  }

  const userId = data?.user?.id;
  if(!userId) throw APIError.internal("No user id found")
  // Insert into user_profiles
  log.info("User authed, creating profile")
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: userId,
      display_name: displayName ?? username,
      username,
      avatar: null,
      streak: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (profileError) {
    throw APIError.internal("failed to create user profile").withDetails({ error: profileError.message });
  }
  // Compose the full User object
  const user = {
    id: userId,
    username,
    email,
    displayName: displayName ?? username,
    joinDate: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    isActive: true,
    avatar: null,
  };
  return { user };
});

/**
 * Logs in a user and issues a secure HTTP-only cookie.
 * @route POST /supabase/auth/login
 * @body { email: string, password: string }
 * @returns { user: User }
 */
export const login = api.raw({
  method: "POST",
  path: "/supabase/auth/login",
  expose: true,
}, async (req, res) => {
  log.info("Login attempt started");
  let body = "";
  for await (const chunk of req) body += chunk;
  const { email, password } = JSON.parse(body);
  log.info("Login request received", { email });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    log.warn("Login failed", { email, error });
    res.statusCode = 401;
    res.end(JSON.stringify({ error: error?.message || "Invalid credentials" }));
    return;
  }

  // Fetch user profile from user_profiles table
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    log.error("User profile not found after successful auth", { userId: data.user.id, profileError });
  }

  // Compose the full User object
  const user = {
    id: data.user.id,
    username: data.user.email?.split('@')[0] ?? "",
    email: data.user.email ?? "",
    displayName: profile?.display_name ?? "",
    joinDate: profile?.created_at ?? "",
    lastLogin: profile?.updated_at ?? "",
    isActive: true, // or use a field from profile if you have one
    avatar: profile?.avatar ?? null,
    streak: profile?.streak ?? 0,
    // ...add any other fields you want to expose
  };

  log.info("Login successful", { userId: user.id, email: user.email });
  res.setHeader('Set-Cookie', `sb-access-token=${data.session.access_token}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=604800`);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ user }));
});

/**
 * Logs out a user by clearing the session cookie.
 * @route POST /supabase/auth/logout
 * @body { userId: string }
 * @returns { success: boolean }
 */
export const logout = api.raw({
  method: "POST",
  path: "/supabase/auth/logout",
  expose: true,
}, async (_req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: error?.message || "Failed to sign out" }));
    return;
  }
  res.setHeader('Set-Cookie', 'sb-access-token=; HttpOnly; Path=/; SameSite=None; Secure;  Max-Age=0');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true }));
});

/**
 * Gets the current authenticated user from the session cookie.
 * @route GET /supabase/auth/me
 * @returns { user: User }
 */
export const authMe = api.raw({
  method: "GET",
  path: "/supabase/auth/me",
  expose: true,
}, async (req, res) => {
  const cookie = req.headers['cookie'] || '';
  log.info("[auth/me] Incoming cookie header", { cookie });
  const match = cookie.match(/sb-access-token=([^;]+)/);
  const token = match ? match[1] : null;
  log.info("[auth/me] Extracted token", { token });
  if (!token) {
    log.info("[auth/me] No token found, returning 401");
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "No session" }));
    return;
  }
  const { data, error } = await supabase.auth.getUser(token);
  log.info("[auth/me] Supabase getUser result", { data, error });
  if (error || !data.user) {
    log.info("[auth/me] Invalid session or error from Supabase", { error });
    res.statusCode = 401;
    res.end(JSON.stringify({ error: error?.message || "Invalid session" }));
    return;
  }

  // Fetch user profile from user_profiles table
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "User profile not found" }));
    return;
  }

  // Compose the full User object
  const user = {
    id: data.user.id,
    username: data.user.email?.split('@')[0] ?? "",
    email: data.user.email ?? "",
    displayName: profile.display_name ?? "",
    joinDate: profile.created_at ?? "",
    lastLogin: profile.updated_at ?? "",
    isActive: true, // or use a field from profile if you have one
    avatar: profile.avatar ?? null,
    streak: profile.streak ?? 0,
    // ...add any other fields you want to expose
  };

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ user }));
});

/**
 * Checks if a username is available (not taken).
 * @route GET /supabase/auth/check-username/:username
 * @returns { available: boolean }
 */
export const checkUsernameAvailability = api<CheckUsernameRequest, CheckUsernameResponse>({
  method: "GET",
  path: "/supabase/auth/check-username/:username",
  expose: true,
}, async ({ username }) => {
  // Check if username or display_name exists in user_profiles
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('username', username);
  if (error) {
    throw APIError.internal("Failed to check username availability").withDetails({ error: error.message });
  }
  const available = !data || data.length === 0;
  return { available };
});

// --- User Profile Endpoints ---
/* export const getUserProfile = api<GetUserProfileRequest, GetUserProfileResponse>({
  method: "GET",
  path: "/users/:userId/profile",
  expose: true,
}, async ({ userId }) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    throw APIError.notFound("User profile not found").withDetails({ error: error?.message });
  }
  return { profile: {
    userId: data.user_id,
    streak: data.streak,
    avatar: data.avatar,
    displayName: data.display_name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }};
}); */

/* export const updateUserProfile = api<UpdateUserProfileRequest, UpdateUserProfileResponse>({
  method: "POST",
  path: "/users/:userId/profile/update",
  expose: true,
}, async ({ userId, streak, avatar, displayName }) => {
  const updates: any = { updated_at: new Date().toISOString() };
  if (streak !== undefined) updates.streak = streak;
  if (avatar !== undefined) updates.avatar = avatar;
  if (displayName !== undefined) updates.display_name = displayName;
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    throw APIError.internal("Failed to update user profile").withDetails({ error: error?.message });
  }
  return { profile: {
    userId: data.user_id,
    streak: data.streak,
    avatar: data.avatar,
    displayName: data.display_name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }};
}); */

// --- Bulk Deck Stats Endpoint ---
/* export const getBulkDeckStats = api<GetBulkDeckStatsRequest, GetBulkDeckStatsResponse>({
  method: "GET",
  path: "/decks/stats",
  expose: true,
}, async ({ userId }) => {
  // Get all decks for user
  const { data: decks, error: decksError } = await supabase
    .from('decks')
    .select('id, chapter_id')
    .eq('user_id', userId);
  if (decksError) throw APIError.internal("Failed to fetch decks").withDetails({ error: decksError.message });
  if (!decks || decks.length === 0) return { stats: [] };

  // Get chapter and series info for images and metadata
  const chapterIds = decks.map((d: any) => d.chapter_id).filter(Boolean);
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('id, series_id, difficulty, chapter_number')
    .in('id', chapterIds);
  if (chaptersError) throw APIError.internal("Failed to fetch chapters").withDetails({ error: chaptersError.message });
  const seriesIds = chapters.map((c: any) => c.series_id).filter(Boolean);
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, picture, name, korean_name, slug')
    .in('id', seriesIds);
  if (seriesError) throw APIError.internal("Failed to fetch series").withDetails({ error: seriesError.message });

  // Get deck stats from fsrs_progress
  const deckStats: DeckStats[] = [];
  for (const deck of decks) {
    // Get all word IDs for this deck
    const { data: deckWords, error: deckWordsError } = await supabase
      .from('chapter_words')
      .select('word_id')
      .eq('chapter_id', deck.chapter_id);
    if (deckWordsError) continue;
    const wordIds = deckWords.map((w: any) => w.word_id);
    if (!wordIds.length) continue;
    // Get progress for these words for this user
    const { data: progress, error: progressError } = await supabase
      .from('fsrs_progress')
      .select('state, due, last_review')
      .eq('user_id', userId)
      .in('vocabulary_id', wordIds);
    if (progressError) continue;
    const totalCards = wordIds.length;
    const dueCards = (progress || []).filter((p: any) => p.due && new Date(p.due) <= new Date()).length;
    const learned = (progress || []).filter((p: any) => p.state !== 0).length;
    const progressPct = totalCards ? Math.round((learned / totalCards) * 100) : 0;
    const lastStudied = (progress || []).reduce((latest: string | null, p: any) => {
      if (!p.last_review) return latest;
      return !latest || new Date(p.last_review) > new Date(latest) ? p.last_review : latest;
    }, null);
    const nextReview = (progress || []).reduce((earliest: string | null, p: any) => {
      if (!p.due) return earliest;
      return !earliest || new Date(p.due) < new Date(earliest) ? p.due : earliest;
    }, null);
    // Find series image and metadata
    const chapter = chapters.find((c: any) => c.id === deck.chapter_id);
    const seriesObj = chapter && series.find((s: any) => s.id === chapter.series_id);
    const publicId = `series:${seriesObj?.name || ''}:chapter:${chapter?.chapter_number || ''}`;
    const chapterNumber = chapter?.chapter_number;
    const seriesSlug = seriesObj?.slug;
    deckStats.push({
      publicId,
      chapterNumber,
      deckId: deck.id,
      totalCards,
      dueCards,
      progress: progressPct,
      lastStudied,
      nextReview,
      seriesImage: seriesObj ? seriesObj.picture : null,
      seriesName: seriesObj ? seriesObj.name : '',
      seriesSlug,
      seriesKoreanName: seriesObj ? seriesObj.korean_name : '',
      difficulty: chapter ? chapter.difficulty || '' : '',
    });
  }
  return { stats: deckStats };
}); */

// --- User Activity Endpoint ---
/* export const getUserActivity = api<GetUserActivityRequest, GetUserActivityResponse>({
  method: "GET",
  path: "/users/:userId/activity",
  expose: true,
}, async ({ userId }) => {
  // Example: fetch recent review logs
  const { data, error } = await supabase
    .from('fsrs_review_logs')
    .select('review, rating, state, due, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw APIError.internal("Failed to fetch user activity").withDetails({ error: error.message });
  const activity: UserActivity[] = (data || []).map((row: any) => ({
    date: row.created_at,
    type: 'review',
    details: {
      review: row.review,
      rating: row.rating,
      state: row.state,
      due: row.due,
    }
  }));
  return { activity };
});  */

// --- User Stats Endpoint ---
export const getUserStats = api<GetUserStatsRequest, GetUserStatsResponse>({
  method: "GET",
  path: "/users/:userId/stats",
  expose: true,
}, async ({ userId }) => {
  // totalCards: count of fsrs_progress for user
  const { data: progress, error: progressError } = await supabase
    .from('fsrs_progress')
    .select('vocabulary_id, difficulty')
    .eq('user_id', userId);
  if (progressError) throw APIError.internal('Failed to fetch user progress').withDetails({ error: progressError.message });
  const totalCards = progress ? progress.length : 0;

  // totalSeries: count of unique series from progress
  let totalSeries = 0;
  if (progress && progress.length > 0) {
    // Get all word IDs
    const wordIds = progress.map((p: any) => p.vocabulary_id);
    // Get chapter_ids for these words
    const { data: chapterWords, error: chapterWordsError } = await supabase
      .from('chapter_words')
      .select('chapter_id, word_id')
      .in('word_id', wordIds);
    if (!chapterWordsError && chapterWords && chapterWords.length > 0) {
      const chapterIds = Array.from(new Set(chapterWords.map((cw: any) => cw.chapter_id)));
      // Get series_ids for these chapters
      const { data: chapters, error: chaptersError } = await supabase
        .from('chapters')
        .select('series_id, id')
        .in('id', chapterIds);
      if (!chaptersError && chapters && chapters.length > 0) {
        const seriesIds = Array.from(new Set(chapters.map((c: any) => c.series_id)));
        totalSeries = seriesIds.length;
      }
    }
  }

  // streak: from user_profiles
  let streak = 0;
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('streak')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profileError && profile && profile.streak) streak = profile.streak;

  // accuracy: correct / total from fsrs_review_logs.rating (assuming 3,4,5 = correct)
  let accuracy = 0;
  const { data: logs, error: logsError } = await supabase
    .from('fsrs_review_logs')
    .select('rating')
    .eq('user_id', userId);
  if (!logsError && logs && logs.length > 0) {
    const correct = logs.filter((l: any) => l.rating >= 3).length;
    accuracy = Math.round((correct / logs.length) * 100);
  }

  // weeklyData: cards reviewed per day for last 7 days
  let weeklyData: Array<{ day: string; cards: number }> = [];
  if (logs && logs.length > 0) {
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const dayStr = day.toISOString().slice(0, 10);
      const count = logs.filter((l: any) => {
        const logDay = l.created_at ? l.created_at.slice(0, 10) : null;
        return logDay === dayStr;
      }).length;
      weeklyData.push({ day: dayStr, cards: count });
    }
  }

  // difficultyData: count by difficulty from fsrs_progress (or words if not present)
  let difficultyData: Array<{ difficulty: string; count: number }> = [];
  if (progress && progress.length > 0) {
    const diffMap: Record<string, number> = {};
    for (const p of progress) {
      const diff = p.difficulty || 'medium'; // fallback
      diffMap[diff] = (diffMap[diff] || 0) + 1;
    }
    difficultyData = Object.entries(diffMap).map(([difficulty, count]) => ({ difficulty, count }));
  }

  // Recommend: ensure fsrs_progress.difficulty is a string (easy/medium/hard) or add it if missing
  // Recommend: ensure fsrs_review_logs.rating exists and is numeric (1-5)

  return {
    stats: {
      totalCards,
      totalSeries,
      streak,
      accuracy,
      weeklyData,
      difficultyData,
    },
  };
});

// --- User Library Endpoint ---
export const getUserLibrary = api<GetUserLibraryRequest, GetUserLibraryResponse>({
  method: "GET",
  path: "/users/:userId/library",
  expose: true,
}, async ({ userId }) => {
  // Find all series the user has progress in
  const { data: progress, error: progressError } = await supabase
    .from('fsrs_progress')
    .select('vocabulary_id')
    .eq('user_id', userId);
  if (progressError) throw APIError.internal('Failed to fetch user progress').withDetails({ error: progressError.message });
  const wordIds = progress ? progress.map((p: any) => p.vocabulary_id) : [];
  if (wordIds.length === 0) return { series: [] };
  // Get chapter_ids for these words
  const { data: chapterWords, error: chapterWordsError } = await supabase
    .from('chapter_words')
    .select('chapter_id, word_id')
    .in('word_id', wordIds);
  if (chapterWordsError || !chapterWords || chapterWords.length === 0) return { series: [] };
  const chapterIds = Array.from(new Set(chapterWords.map((cw: any) => cw.chapter_id)));
  // Get series_ids for these chapters
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('series_id, id')
    .in('id', chapterIds);
  if (chaptersError || !chapters || chapters.length === 0) return { series: [] };
  const seriesIds = Array.from(new Set(chapters.map((c: any) => c.series_id)));
  // Get series details
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('*')
    .in('id', seriesIds);
  if (seriesError || !series) return { series: [] };
  // Map to Series[] type
  return { series: series.map(convertToSeries) };
}); 

export const getUserPreferences = api<GetUserPreferencesRequest, GetUserPreferencesResponse>({
  method: "GET",
  path: "/supabase/user/preferences",
  expose: true,
}, async () => {
  // TODO: Replace with actual user preferences logic (e.g., fetch from user_profiles.preferences JSON column)
  // For now, return hardcoded/default preferences
  const preferences: UserPreferences = {
    language: "en",
    theme: "system",
    notifications: false,
    dailyGoal: 50,
    autoPlay: true,
    darkMode: true,
    studyPreferences: {
      sessionType: 'mixed',
      maxCards: 50,
      autoAdvance: true,
      showDifficulty: false,
      enableSounds: false,
    },
  };
  return { preferences };
}); 

export const updateUserProgress = api<UpdateUserProgressRequest, UpdateUserProgressResponse>({
  method: "PUT",
  path: "/user/progress/:chapterId",
  expose: true,
}, async ({ userId, chapterId, updatedProgress }) => {
  // Upsert user_chapter_progress
  await supabase
    .from('user_chapter_progress')
    .upsert({
      user_id: userId,
      series_id: updatedProgress.seriesId,
      chapter_id: chapterId,
      cards_studied: updatedProgress.cardsStudied,
      total_cards: updatedProgress.totalCards,
      accuracy: updatedProgress.accuracy,
      time_spent: updatedProgress.timeSpent,
      last_studied: updatedProgress.lastStudied,
      streak: updatedProgress.streak,
      is_completed: updatedProgress.isCompleted,
      updated_at: new Date().toISOString(),
    });

  // Aggregate all chapter progress for this user/series
  const { data: allChapters, error: aggError } = await supabase
    .from('user_chapter_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', updatedProgress.seriesId);
  if (aggError) {
    throw APIError.internal('Failed to aggregate series progress').withDetails({ error: aggError.message });
  }
  // Calculate aggregates
  const chaptersCompleted = allChapters.filter((c: any) => c.is_completed).length;
  const totalChapters = allChapters.length;
  const cardsStudied = allChapters.reduce((sum: number, c: any) => sum + (c.cards_studied || 0), 0);
  const totalCards = allChapters.reduce((sum: number, c: any) => sum + (c.total_cards || 0), 0);
  const currentStreak = Math.max(...allChapters.map((c: any) => c.streak || 0), 0);
  const lastStudied = allChapters.reduce((latest: string|null, c: any) => {
    if (!c.last_studied) return latest;
    return !latest || new Date(c.last_studied) > new Date(latest) ? c.last_studied : latest;
  }, null);
  const averageAccuracy = allChapters.length > 0 ? allChapters.reduce((sum: number, c: any) => sum + (c.accuracy || 0), 0) / allChapters.length : 0;
  const totalTimeSpent = allChapters.reduce((sum: number, c: any) => sum + (c.time_spent || 0), 0);

  // Upsert user_series_progress
  await supabase
    .from('user_series_progress')
    .upsert({
      user_id: userId,
      series_id: updatedProgress.seriesId,
      chapters_completed: chaptersCompleted,
      total_chapters: totalChapters,
      cards_studied: cardsStudied,
      total_cards: totalCards,
      current_streak: currentStreak,
      last_studied: lastStudied,
      average_accuracy: averageAccuracy,
      total_time_spent: totalTimeSpent,
      updated_at: new Date().toISOString(),
    });

  // Re-fetch and return updated progress data
  const { seriesData, chapterData } = (await (exports.getUserProgress as any)({ userId })).value;
  return { seriesData, chapterData };
}); 

export const getUserProgress = api<GetUserProgressRequest, GetUserProgressResponse>({
  method: "GET",
  path: "/user/progress",
  expose: true,
}, async ({ userId }) => {
  // Fetch all chapter progress for the user
  const { data: chapters, error: chaptersError } = await supabase
    .from('user_chapter_progress')
    .select('*')
    .eq('user_id', userId);
  if (chaptersError) throw APIError.internal('Failed to fetch chapter progress').withDetails({ error: chaptersError.message });

  // Build chapterData: Record<string, StudyProgress>
  const chapterData: Record<string, any> = {};
  for (const c of chapters || []) {
    chapterData[c.chapter_id] = {
      seriesId: c.series_id,
      chapterId: c.chapter_id,
      cardsStudied: c.cards_studied,
      totalCards: c.total_cards,
      accuracy: c.accuracy,
      timeSpent: c.time_spent,
      lastStudied: c.last_studied,
      streak: c.streak,
      isCompleted: c.is_completed,
    };
  }

  // Fetch all series progress for the user
  const { data: series, error: seriesError } = await supabase
    .from('user_series_progress')
    .select('*')
    .eq('user_id', userId);
  if (seriesError) throw APIError.internal('Failed to fetch series progress').withDetails({ error: seriesError.message });

  // Build seriesData: Record<string, SeriesProgress>
  const seriesData: Record<string, any> = {};
  for (const s of series || []) {
    seriesData[s.series_id] = {
      seriesId: s.series_id,
      chaptersCompleted: s.chapters_completed,
      totalChapters: s.total_chapters,
      cardsStudied: s.cards_studied,
      totalCards: s.total_cards,
      currentStreak: s.current_streak,
      lastStudied: s.last_studied,
      averageAccuracy: s.average_accuracy,
      totalTimeSpent: s.total_time_spent,
    };
  }

  return { seriesData, chapterData };
}); 