// All endpoint request/response types for supabase.ts
import { SessionState, VocabularyWithProgress, StudyProgress, ProgressStats } from './studySession/types'
import { Rating, FSRSProgress } from './fsrs/types'

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
  name: string;
  createdAt: string;
  picture: string;
  synopsis: string;
  popularity: number
  genres: JSON[];
  authors: JSON[];
  koreanName: string;
}

export interface Deck {
  id: string;
  name: string;
  userId: string;
  chapterId: string;
  createdAt: string;
  // Add other fields as needed
}

interface Card {
   id: string;
   korean: string;
   english: string;
   importanceScore: number;
   studyProgress: FSRSProgress;
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
export interface ListSeriesResponse {
  series: Array<{ id: string; name: string; createdAt: string }>;
}
export interface CreateSeriesRequest {
  name: string;
}
export interface CreateSeriesResponse {
  series: { id: string; name: string; createdAt: string };
}
export interface SearchSeriesRequest {
  query: unknown;
}
export interface SearchSeriesResponse {
  series: Array<{ id: string; name: string; createdAt: string }>;
}
export interface ListChaptersRequest {
  seriesId: string;
}
export interface ListChaptersResponse {
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
export interface LockUnlockChapterRequest {
  seriesId: string;
  chapterNumber: string;
}
export interface LockUnlockChapterResponse {
  chapter: { id: string; locked: boolean };
}

// Card endpoints
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
export interface EditCardRequest {
  cardId: string;
  word?: string;
  definition?: string;
  romanization?: string;
  example?: string;
}
export interface EditCardResponse {
  card: Card;
}
export interface DeleteCardRequest {
  cardId: string;
}
export interface DeleteCardResponse {
  success: boolean;
}
export interface ListCardsRequest {
  chapterId: string;
}
export interface ListCardsResponse {
  cards: {
   id: any;
   word: any;
   definition: any;
   created_at: any;
  }[][];
}

// User endpoints
export interface SignupRequest {
  email: string;
  password: string;
}
export interface SignupResponse {
  user: unknown;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  user: any;
}
export interface LogoutRequest {
  userId: string;
}
export interface LogoutResponse {
  success: boolean;
}
export interface SessionRequest {
  authorization: string;
}
export interface SessionResponse {
  user: { id: string; email?: string };
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
  deckId: string;
}
export interface StartStudySessionResponse {
  sessionState: SessionState;
}
export interface GradeCardRequest {
  sessionId: string;
  rating: Rating;
}
export interface GradeCardResponse {
  sessionState: SessionState;
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
  totalCards: number;
  dueCards: number;
  progress: number; // percent complete
  lastStudied: string | null;
  nextReview: string | null;
  seriesImage: string | null;
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
  | { path: "/supabase/series"; req: {}; res: ListSeriesResponse }
  | { path: "/supabase/series"; req: CreateSeriesRequest; res: CreateSeriesResponse }
  | { path: "/supabase/series/search"; req: SearchSeriesRequest; res: SearchSeriesResponse }
  | { path: "/supabase/series/:seriesId/chapters"; req: ListChaptersRequest; res: ListChaptersResponse }
  | { path: "/supabase/series/:seriesId/chapters/:chapterNumber/lock"; req: LockUnlockChapterRequest; res: LockUnlockChapterResponse }
  | { path: "/supabase/series/:seriesId/chapters/:chapterNumber/unlock"; req: LockUnlockChapterRequest; res: LockUnlockChapterResponse }
  | { path: "/supabase/chapters/:chapterId/cards"; req: AddCardRequest; res: AddCardResponse }
  | { path: "/supabase/cards/:cardId"; req: EditCardRequest; res: EditCardResponse }
  | { path: "/supabase/cards/:cardId"; req: DeleteCardRequest; res: DeleteCardResponse }
  | { path: "/supabase/chapters/:chapterId/cards"; req: ListCardsRequest; res: ListCardsResponse }
  | { path: "/supabase/users/:userId/progress"; req: UserProgressRequest; res: UserProgressResponse }
  | { path: "/supabase/users/:userId/reset"; req: ResetUserRequest; res: ResetUserResponse }
  | { path: "/supabase/decks"; req: ListDecksRequest; res: ListDecksResponse }
  | { path: "/supabase/decks/:deckId/feature"; req: FeatureDeckRequest; res: FeatureDeckResponse }
  | { path: "/supabase/decks/:deckId/preview"; req: PreviewDeckRequest; res: PreviewDeckResponse }
  | { path: "/supabase/decks"; req: CreateDeckRequest; res: CreateDeckResponse }
  | { path: "/supabase/dev/seed"; req: {}; res: DevSeedResponse }
  | { path: "/supabase/dev/reset"; req: {}; res: DevResetResponse }
  | { path: "/supabase/dev/export"; req: {}; res: DevExportResponse }
  | { path: "/supabase/dev/watch"; req: {}; res: DevWatchResponse }
  | { path: "/study/session/start"; req: StartStudySessionRequest; res: StartStudySessionResponse }
  | { path: "/study/session/grade"; req: GradeCardRequest; res: GradeCardResponse }
  | { path: "/study/session/end"; req: EndStudySessionRequest; res: EndStudySessionResponse }
  | { path: "/supabase/auth/signup"; req: SignupRequest; res: SignupResponse }
  | { path: "/supabase/auth/login"; req: LoginRequest; res: LoginResponse }
  | { path: "/supabase/auth/logout"; req: LogoutRequest; res: LogoutResponse }
  | { path: "/supabase/auth/session"; req: SessionRequest; res: SessionResponse }
  | { path: "/users/:userId/profile"; req: GetUserProfileRequest; res: GetUserProfileResponse }
  | { path: "/users/:userId/profile/update"; req: UpdateUserProfileRequest; res: UpdateUserProfileResponse }
  | { path: "/decks/stats"; req: GetBulkDeckStatsRequest; res: GetBulkDeckStatsResponse }
  | { path: "/users/:userId/activity"; req: GetUserActivityRequest; res: GetUserActivityResponse }; 