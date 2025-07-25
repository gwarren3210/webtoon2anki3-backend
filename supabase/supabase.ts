import { api, APIError, Header, Query } from "encore.dev/api";
import { authHandler } from "./auth";
import { supabase, supabaseAdmin } from "./client";
import log from "encore.dev/log";
import type {
  SignupRequest, SignupResponse,
  ArraySeriesResponse, SingleSeriesResponse,
  ListChaptersRequest, ListChaptersResponse,
  SeriesByIdRequest, SeriesBySlugRequest,
  GetUserStatsRequest, GetUserStatsResponse, GetUserLibraryRequest, GetUserLibraryResponse,
  CheckUsernameRequest, CheckUsernameResponse,
  GetUserPreferencesRequest, GetUserPreferencesResponse, UserPreferences,
  GetUserProgressRequest, GetUserProgressResponse, SeriesProgress, UserChapterProgress,
  SearchSeriesQueryRequest, 
  UpdateUserProgressRequest, UpdateUserProgressResponse,
  GetChapterCardsRequest, GetChapterCardsResponse,
  StudyCard, GetChapterSeriesAndChapterNumberRequest, GetChapterSeriesAndChapterNumberResponse,
  PostCardStatesRequest, PostCardStatesResponse,
  PostLogsRequest, PostLogsResponse,
} from "./supabaseEndpoints";
import {
  convertToSeries,
  convertToChapter,
} from './studySession/utils';
import { supabaseUrl } from "./client";



// ===================
// API Definitions
// ===================

// Chapter endpoints


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
  path: "/supabase/series/id/:seriesId",
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


export const getSeriesBySlugApi = api<SeriesBySlugRequest, SingleSeriesResponse>({
  method: "GET",
  path: "/supabase/series/slug/:seriesSlug",
  expose: true,
}, async ({ seriesSlug }) => {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('slug', seriesSlug)
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

export const getChapterSeriesAndChapterNumber = api<GetChapterSeriesAndChapterNumberRequest, GetChapterSeriesAndChapterNumberResponse>({
  method: "GET",
  path: "/supabase/:seriesSlug/:chapterNumber",
  expose: true,
}, async ({ seriesSlug, chapterNumber }) => {
  const slug = `series:${seriesSlug}:chapter:${chapterNumber}`
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    throw APIError.internal('Failed to fetch chapter series and chapter number').withDetails({ error: error.message });
  }
  return { chapter: data };
});

/**
 * Encore API endpoint to get words for a chapter for a user using the
 * 'get_chapter_words' RPC.
 *
 * @param {GetChapterCardsRequest} req - The request object.
 * @returns {Promise<GetChapterCardsResponse>} The words data for the chapter.
 */
export const getChapterCards = api<GetChapterCardsRequest, GetChapterCardsResponse>({
  method: "GET",
  path: "/supabase/:seriesSlug/:chapterNumber/cards",
  expose: true,
}, async ({ chapterNumber, seriesSlug, userId }) => {
  const { data: cards, error } = await supabase
    .rpc('get_chapter_cards', {
      p_user_id: userId,
      p_series_slug: seriesSlug,
      p_chapter_number: chapterNumber,
  });
  log.info('getChapterCards data', cards);
  if (error) {
    throw APIError.internal('Failed to fetch chapter words').withDetails({ error: error.message });
  }
  return { cards };
});

// POST /supabase/cards
export const postCardStates = api<PostCardStatesRequest, PostCardStatesResponse>({
  method: "POST",
  path: "/supabase/cards",
  expose: true,
  auth: true,
}, async ({ userId, cards }) => {
  // Upsert each card's state for the user
  let updatedCount = 0;
  for (const card of cards) {
    if(!card.card){
      log.error("Progress card missing for card: ", card)
      continue;
    }
    const { error } = await supabase
      .from('fsrs_progress')
      .upsert({
        user_id: userId,
        vocabulary_id: card.id,
        // ...other card state fields (difficulty, due, etc.)
        // Map your Card/StudyCard fields to DB columns here
        due: card.card.due,
        stability: card.card.stability,
        difficulty: card.card.difficulty,
        elapsed_days: card.card.elapsed_days,
        scheduled_days: card.card.scheduled_days,
        learning_steps: card.card.learning_steps,
        reps: card.card.reps,
        lapses: card.card.lapses,
        state: card.card.state,
        last_review: card.card.last_review,
        updated_at: new Date().toISOString(),
      });
    if (!error) updatedCount++;
    // Optionally: log or collect errors for reporting
  }
  return { success: true, updatedCount };
});

// POST /supabase/logs
export const postLogs = api<PostLogsRequest, PostLogsResponse>({
  method: "POST",
  path: "/supabase/logs",
  expose: true,
  auth: true,
}, async ({ userId, logs }) => {
  // Insert all logs for the user
  if (!logs.length) return { success: true, insertedCount: 0 };
  const insertData = logs.map(log => ({
    user_id: userId,
    card_id: log.cardId,
    rating: log.rating,
    state: log.state,
    due: log.due,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: log.review,
    created_at: new Date().toISOString(),
  }));
  const { error, count } = await supabase
    .from('fsrs_review_logs')
    .insert(insertData, { count: "exact" });
  if (error) {
    throw APIError.internal("Failed to insert logs").withDetails({ error: error.message });
  }
  return { success: true, insertedCount: count ?? logs.length };
});

