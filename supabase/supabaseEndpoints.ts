// All endpoint request/response types for supabase.ts
import { SessionState, StudyProgress, ProgressStats } from './studySession/types'
import { Rating, FSRSProgress, FSRSState, FSRSStateType } from './fsrs/types'

export interface UserStats {
  totalCards: number;
  totalSeries: number;
  streak: number;
  accuracy: number;
  weeklyData: Array<{ day: string; cards: number }>;
  difficultyData: Array<{ difficulty: string; count: number }>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  joinDate: string;
  lastLogin: string;
  isActive: boolean;
}

// Define missing interfaces for DB objects
export interface Vocabulary {
  id: string;
  word: string;
  definition: string;
  createdAt: string;
  // Add other fields as needed
}

export interface Series {
  id: string;
  publicId: string;
  titleEn: string;
  titleKr: string;
  author: string;
  description: string;
  genre: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  coverImage: string;
  totalChapters: number;
  totalCards: number;
  avgRating: number;
  totalLearners: number;
  status: "ongoing" | "completed";
  createdAt: string;
  isTrending: boolean;
  isNew: boolean;
}

export interface Chapter {
  id: string;
  publicId: string;
  seriesId: string;
  chapterNumber: number;
  titleEn: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  cardCount: number;
  isUnlocked: boolean;
}

export interface Deck {
  id: string;
  name: string;
  userId: string;
  chapterId: string;
  createdAt: string;
  // Add other fields as needed
}

export interface Card {
   id: string;
   korean: string;
   english: string;
   importanceScore: number;
   studyProgress: FSRSProgress | null;
}

//import { Card as _Card, State as _State} from 'ts-fsrs'
export declare enum _State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3
}

interface _Card {
  due: string;
  stability: number;
  difficulty: number;
  /**
   * @deprecated This field will be removed in version 6.0.0
   */
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: _State;
  last_review?: string;
}

export interface StudyCard {
  id: string;
  korean: string;
  english: string;
  pronunciation?: string;
  exampleSentence?: string;
  createdAt: string; // ISO string
  successRate: number; // (0-100)
  importanceScore: number;
  card: _Card | null;
}

// Add StudySessionDTO type for the new backend DTO (if not already imported)
export interface StudySessionDTO {
  id: string;
  userId: string;
  deckPublicId: string;
  isComplete: boolean;
  //TODO get rid of any type
  stats: any; // Use the correct ProgressStats type if available
  reviewHistory: any[];
  cardRatings: { [cardId: string]: any[] };
  createdAt: string;
  lastActive: string;
  cards: StudyCard[];
  currentCard: StudyCard | null;
}

// Auth endpoints
export interface GetSessionRequest {
  authorization: string;
}
export interface GetSessionResponse {
  user: { id: string; email?: string };
}

// Chapter endpoints
export interface CheckChapterRequest {
  seriesName: string;
  chapterNumber: string;
}
export interface CheckChapterResponse {
  chapter: {
    id: string;
    seriesName: string;
    chapterNumber: string;
    createdAt: string;
  } | null;
}

export interface GetChapterWordsRequest {
  id: string;
}
export interface GetChapterWordsResponse {
  words: Array<{
    korean: string;
    english: string;
    importanceScore: number;
    context?: string;
    frequency?: number;
  }>;
}

export interface CreateChapterRequest {
  seriesName: string;
  chapterNumber: string;
  words: Array<{
    korean: string;
    english: string;
    importanceScore: number;
  }>;
}
export interface CreateChapterResponse {
  chapter: {
    id: string;
    seriesName: string;
    chapterNumber: string;
    createdAt: string;
  };
  wordMappings: Array<{ word: { korean: string; english: string; importanceScore: number }, wordId: string }>;
}

// Vocabulary endpoints
export interface GetVocabularyResponse {
  vocabulary: Vocabulary[];
}
export interface SearchVocabularyRequest {
  query: unknown;
}
export interface SearchVocabularyResponse {
  vocabulary: Vocabulary[];
}
export interface FilterVocabularyBySeriesRequest {
  seriesName: string;
}
export interface FilterVocabularyBySeriesResponse {
  vocabulary: Vocabulary[];
}
export interface FilterVocabularyByChapterRequest {
  seriesName: string;
  chapterNumber: string;
}
export interface FilterVocabularyByChapterResponse {
  vocabulary: Vocabulary[];
}

// Analytics endpoints
export interface GetRetentionResponse {
  retention: Array<{ date: string; retention: number }>;
}
export interface GetStudyPatternsResponse {
  patterns: Array<{ date: string; sessions: number; avgDuration: number }>;
}
export interface GetDifficultyAnalysisResponse {
  analysis: Array<{ grade: number; count: number }>;
}
export interface GetPerformanceStatsResponse {
  stats: { mastered: number; reviewing: number; learning: number; new: number; due: number };
}

// Series endpoints
export interface CreateSeriesRequest {
  name: string;
}
export interface SeriesByIdRequest {
  seriesId: string;
}
export interface SeriesBySlugRequest {
  seriesSlug: string;
}
export interface SingleSeriesResponse {
  series: Series;
}
export interface ArraySeriesResponse {
  series: Array<Series>;
}
export interface ListChaptersRequest {
  seriesId: string;
}
export interface ListChaptersResponse {
  chapters: Array<Chapter>;
}

// Card endpoints
export interface ChapterByIdRequest {
  chapterSlug: string;
  userId?: string;
}
export interface SingleChapterResponse {
  chapter: Chapter,
  studyCards: StudyCard[],
}

export interface AddCardRequest {
  chapterId: string;
  word: string;
  definition: string;
  romanization?: string;
  example?: string;
}
export interface AddCardResponse {
  newWord: Vocabulary;
}

export interface DeleteCardRequest {
  cardId: string;
}
export interface DeleteCardResponse {
  success: boolean;
}
export interface ListCardsRequest {
  chapterId: string;
  userId: string;
}
export interface ListCardsResponse {
  cards: Array<StudyCard>;
  deckExists: boolean;
}

// User endpoints
export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  displayName: string;
}
export interface SignupResponse {
  user: unknown;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}
export interface LoginRequest {
  credentials: LoginCredentials;
}
export interface LoginResponse {
  user: User;
}
export interface SessionResponse {
  user: User;
}
export interface UserProgressRequest {
  userId: string;
}
export interface UserProgressResponse {
  progress: StudyProgress[];
}
export interface ResetUserRequest {
  userId: string;
}
export interface ResetUserResponse {
  success: boolean;
}

// Deck endpoints
export interface ListDecksRequest {
  genre?: string;
  difficulty?: string;
  trending?: boolean;
  new?: boolean;
  status?: string;
}
export interface ListDecksResponse {
  decks: Deck[];
}
export interface FeatureDeckRequest {
  deckId: string;
  badge: string;
}
export interface FeatureDeckResponse {
  deck: Deck;
}
export interface PreviewDeckRequest {
  deckId: string;
}
export interface PreviewDeckResponse {
  deck: Deck;
  cards: Card[];
}
export interface CreateDeckRequest {
  seriesName: string;
  chapterNumber: string;
  userId: string;
  name?: string;
  maxLength?: number;
}
export interface CreateDeckResponse {
  deck: Deck;
  cards: Card[];
}

// Dev endpoints
export interface DevSeedResponse {
  success: boolean;
  message: string;
}
export interface DevResetResponse {
  success: boolean;
  message: string;
}
export interface DevExportResponse {
  success: boolean;
  data: unknown;
}
export interface DevWatchResponse {
  success: boolean;
  message: string;
}

// Study Session endpoints
export interface StartStudySessionRequest {
  userId: string;
  publicId: string;
}
export interface StartStudySessionResponse {
  session: StudySessionDTO; // Use the correct StudySessionDTO type if available
}
export interface GradeCardRequest {
  sessionId: string;
  cardId: string;
  rating: Rating;
}
// New frontend-friendly response for grade card
export interface GradeCardResponse {
  sessionId: string;
  nextCard: StudyCard | null;
  stats: ProgressStats;
}
export interface EndStudySessionRequest {
  sessionId: string;
}
export interface EndStudySessionResponse {
  success: boolean;
}

// User Profile endpoints
export interface UserProfile {
  userId: string;
  streak: number;
  avatar?: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}
export interface GetUserProfileRequest {
  userId: string;
}
export interface GetUserProfileResponse {
  profile: UserProfile;
}
export interface UpdateUserProfileRequest {
  userId: string;
  streak?: number;
  avatar?: string;
  displayName?: string;
}
export interface UpdateUserProfileResponse {
  profile: UserProfile;
}

// Bulk Deck Stats endpoint
export interface DeckStats {
  deckId: string;
  publicId: string;
  chapterNumber: string;
  totalCards: number;
  dueCards: number;
  progress: number; // percent complete
  lastStudied: string | null;
  nextReview: string | null;
  seriesImage: string | null;
  seriesName: string;
  seriesSlug: string;
  seriesKoreanName: string;
  difficulty: string;
}
export interface GetBulkDeckStatsRequest {
  userId: string;
}
export interface GetBulkDeckStatsResponse {
  stats: DeckStats[];
}

// User Activity endpoint
export interface UserActivity {
  date: string;
  type: string;
  details?: any;
}
export interface GetUserActivityRequest {
  userId: string;
}
export interface GetUserActivityResponse {
  activity: UserActivity[];
}

// User Stats endpoint
export interface GetUserStatsRequest {
  userId: string;
}
export interface GetUserStatsResponse {
  stats: UserStats;
}

// User Library endpoint
export interface GetUserLibraryRequest {
  userId: string;
}
export interface GetUserLibraryResponse {
  series: Series[];
}

// Username Availability endpoint
export interface CheckUsernameRequest {
  username: string;
}
export interface CheckUsernameResponse {
  available: boolean;
}

// User Preferences endpoint
export interface UserPreferences {
  // Define your preferences fields here, e.g.:
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  dailyGoal: number;
  autoPlay: boolean;
  darkMode: boolean;
  studyPreferences: {
    sessionType: 'new' | 'review' | 'mixed';
    maxCards: number;
    autoAdvance: boolean;
    showDifficulty: boolean;
    enableSounds: boolean;
  };
  // Add more as needed
}
export interface GetUserPreferencesRequest {
  userId: string;
}
export interface GetUserPreferencesResponse {
  preferences: UserPreferences;
}

// User Progress endpoint
export interface SeriesProgress {
  seriesId: string;
  totalChapters: number;
  completedChapters: number;
  progressPercent: number;
  lastStudied?: string;
  // Add more as needed
}
export interface UserChapterProgress {
  chapterId: string;
  totalCards: number;
  reviewedCards: number;
  progressPercent: number;
  lastStudied?: string;
  // Add more as needed
}
export interface GetUserProgressRequest {
  userId: string;
}
export interface GetUserProgressResponse {
  seriesData: Record<string, SeriesProgress>;
  chapterData: Record<string, UserChapterProgress>;
}

export interface StudyChapterProgress {
  seriesId: string;
  chapterId: string;
  cardsStudied: number;
  totalCards: number;
  accuracy: number;
  timeSpent: number; // in minutes
  lastStudied: string;
  streak: number;
  isCompleted: boolean;
}
// User Progress Update endpoint
export interface UpdateUserProgressRequest {
  userId: string;
  chapterId: string;
  updatedProgress: StudyChapterProgress;
}
export interface UpdateUserProgressResponse {
  seriesData: Record<string, SeriesProgress>;
  chapterData: Record<string, StudyChapterProgress>;
}

// Series Search endpoint
export interface SearchSeriesQueryRequest {
  q: string;
}

export interface GetChapterCardsRequest {
  userId: string;
  seriesSlug: string;
  chapterNumber: string;
}

export interface GetChapterCardsResponse {
  cards: StudyCard[]
}
// Endpoint mapping type
export type SupabaseEndpointMap =
  | { path: "/auth/session"; req: GetSessionRequest; res: GetSessionResponse }
  | { path: "/supabase/chapters/check"; req: CheckChapterRequest; res: CheckChapterResponse }
  | { path: "/supabase/chapters/:id/words"; req: GetChapterWordsRequest; res: GetChapterWordsResponse }
  | { path: "/supabase/chapters"; req: CreateChapterRequest; res: CreateChapterResponse }
  | { path: "/supabase/vocabulary"; req: {}; res: GetVocabularyResponse }
  | { path: "/supabase/vocabulary/search"; req: SearchVocabularyRequest; res: SearchVocabularyResponse }
  | { path: "/supabase/vocabulary/filter/series/:seriesName"; req: FilterVocabularyBySeriesRequest; res: FilterVocabularyBySeriesResponse }
  | { path: "/supabase/vocabulary/filter/chapter/:seriesName/:chapterNumber"; req: FilterVocabularyByChapterRequest; res: FilterVocabularyByChapterResponse }
  | { path: "/supabase/analytics/retention"; req: {}; res: GetRetentionResponse }
  | { path: "/supabase/analytics/patterns"; req: {}; res: GetStudyPatternsResponse }
  | { path: "/supabase/analytics/difficulty"; req: {}; res: GetDifficultyAnalysisResponse }
  | { path: "/supabase/analytics/performance"; req: {}; res: GetPerformanceStatsResponse }
  | { path: "/supabase/series"; req: {}; res: ArraySeriesResponse }
  | { path: "/supabase/series"; req: CreateSeriesRequest; res: SingleSeriesResponse }
  | { path: "/supabase/series/search"; req: SearchSeriesQueryRequest; res: ArraySeriesResponse }
  | { path: "/supabase/series/featured"; req: {}; res: ArraySeriesResponse }
  | { path: "/supabase/series/trending"; req: {}; res: ArraySeriesResponse }
  | { path: "/supabase/series:seriesId"; req: SeriesByIdRequest; res: SingleSeriesResponse }
  | { path: "/supabase/series/:seriesId/chapters"; req: ListChaptersRequest; res: ListChaptersResponse }
  | { path: "/supabase/chapters/:chapterId"; req: ChapterByIdRequest; res: SingleChapterResponse }
  | { path: "/supabase/cards/:cardId"; req: DeleteCardRequest; res: DeleteCardResponse }
  | { path: "/supabase/chapters/:chapterId/cards"; req: ListCardsRequest; res: ListCardsResponse }
  | { path: "/supabase/users/:userId/progress"; req: UserProgressRequest; res: UserProgressResponse }
  | { path: "/supabase/users/:userId/reset"; req: ResetUserRequest; res: ResetUserResponse }
  | { path: "/supabase/decks"; req: ListDecksRequest; res: ListDecksResponse }
  | { path: "/supabase/decks/:deckId/feature"; req: FeatureDeckRequest; res: FeatureDeckResponse }
  | { path: "/supabase/decks/:deckId/preview"; req: PreviewDeckRequest; res: PreviewDeckResponse }
  | { path: "/supabase/decks"; req: CreateDeckRequest; res: CreateDeckResponse }
  | { path: "/study/session/start"; req: StartStudySessionRequest; res: StartStudySessionResponse }
  | { path: "/study/session/grade"; req: GradeCardRequest; res: GradeCardResponse }
  | { path: "/study/session/end"; req: EndStudySessionRequest; res: EndStudySessionResponse }
  | { path: "/supabase/auth/signup"; req: SignupRequest; res: SignupResponse }
  | { path: "/supabase/auth/login"; req: LoginRequest; res: LoginResponse }
  | { path: "/supabase/auth/logout"; req: {}; res: {} }
  | { path: "/supabase/auth/me"; req: {}; res: SessionResponse }
  | { path: "/supabase/auth/check-username/:username"; req: CheckUsernameRequest; res: CheckUsernameResponse }
  | { path: "/users/:userId/profile"; req: GetUserProfileRequest; res: GetUserProfileResponse }
  | { path: "/users/:userId/profile/update"; req: UpdateUserProfileRequest; res: UpdateUserProfileResponse }
  | { path: "/decks/stats"; req: GetBulkDeckStatsRequest; res: GetBulkDeckStatsResponse }
  | { path: "/users/:userId/activity"; req: GetUserActivityRequest; res: GetUserActivityResponse }
  | { path: "/users/:userId/stats"; req: GetUserStatsRequest; res: GetUserStatsResponse }
  | { path: "/users/:userId/library"; req: GetUserLibraryRequest; res: GetUserLibraryResponse }
  | { path: "/user/:userId/progress"; req: GetUserProgressRequest; res: GetUserProgressResponse }
  | { path: "/supabase/user/preferences"; req: GetUserPreferencesRequest; res: GetUserPreferencesResponse }; 

