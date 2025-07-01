/**
 * SRS (Spaced Repetition System) Data Types
 * 
 * This file defines the core data structures for the spaced repetition system,
 * including study progress tracking, session management, and study history.
 */

import {
  FSRSProgress,
  FSRSState,
  FSRSRating,
  FSRSReviewLog,
  FSRSParameters
} from '../fsrs';
import { FSRSState as _FSRSState } from '../fsrs/types';

/**
 * Represents the current state of a vocabulary item in the SRS system
 */
export enum StudyState {
  /** New card that hasn't been studied yet */
  NEW = 'new',
  /** Card in the learning phase (first few reviews) */
  LEARNING = 'learning',
  /** Card in the review phase (regular spaced repetition) */
  REVIEWING = 'reviewing',
  /** Card that has been mastered (no longer needs review) */
  MASTERED = 'mastered'
}

/**
 * Represents the study progress for a single vocabulary item
 */
export interface StudyProgress {
  /** Unique identifier for the study progress record */
  id: string;
  /** Reference to the vocabulary item */
  vocabularyId: string;
  /** Reference to the user */
  userId: string;
  /** Current state of the card in the SRS system */
  state: StudyState;
  /** Current interval in days until next review */
  interval: number;
  /** E-factor (easiness factor) for the card */
  eFactor: number;
  /** Number of consecutive correct answers */
  consecutiveCorrect: number;
  /** Number of consecutive incorrect answers */
  consecutiveIncorrect: number;
  /** Total number of reviews for this card */
  totalReviews: number;
  /** Date when the card is next due for review */
  nextReviewDate: Date;
  /** Date when the card was last reviewed */
  lastReviewedDate?: Date;
  /** Date when the card was first introduced */
  firstSeenDate: Date;
  /** Date when the card was created */
  createdAt: Date;
  /** Date when the card was last updated */
  updatedAt: Date;
}

/**
 * Represents a study session
 */
export interface StudySession {
  /** Unique identifier for the study session */
  id: string;
  /** Reference to the user */
  userId: string;
  /** Start time of the study session */
  startTime: Date;
  /** End time of the study session (null if session is active) */
  endTime?: Date;
  /** Duration of the session in seconds */
  duration?: number;
  /** Number of cards studied in this session */
  cardsStudied: number;
  /** Number of correct answers in this session */
  correctAnswers: number;
  /** Number of incorrect answers in this session */
  incorrectAnswers: number;
  /** Session type (new cards, reviews, mixed) */
  sessionType: 'new' | 'review' | 'mixed';
  /** Whether the session is currently active */
  isActive: boolean;
  /** Date when the session was created */
  createdAt: Date;
  /** Date when the session was last updated */
  updatedAt: Date;
}

/**
 * Represents a single study event/answer in the study history
 * TODO: This should be adapted or replaced by FSRSReviewLog
 */
export interface StudyHistory {
  /** Unique identifier for the study history record */
  id: string;
  /** Reference to the study progress record */
  studyProgressId: string;
  /** Reference to the study session */
  studySessionId: string;
  /** Reference to the vocabulary item */
  vocabularyId: string;
  /** Reference to the user */
  userId: string;
  /** Grade given for this review (0-5) */
  grade: number; // To be mapped from FSRSRating
  /** Time taken to answer in seconds */
  responseTime?: number;
  /** Previous interval before this review */
  previousInterval: number;
  /** New interval after this review */
  newInterval: number;
  /** Previous e-factor before this review */
  previousEFactor: number;
  /** New e-factor after this review */
  newEFactor: number;
  /** Previous state before this review */
  previousState: StudyState;
  /** New state after this review */
  newState: StudyState;
  /** Date when this review was performed */
  reviewedAt: Date;
  /** Date when the record was created */
  createdAt: Date;
}

/**
 * Represents study statistics for a user
 * TODO: This needs to be updated to work with FSRS data
 */
export interface StudyStats {
  /** Total number of cards studied */
  totalCardsStudied: number;
  /** Total number of correct answers */
  totalCorrectAnswers: number;
  /** Total number of incorrect answers */
  totalIncorrectAnswers: number;
  /** Overall accuracy percentage */
  accuracyPercentage: number;
  /** Current study streak in days */
  currentStreak: number;
  /** Longest study streak in days */
  longestStreak: number;
  /** Total study time in seconds */
  totalStudyTime: number;
  /** Average study time per session in seconds */
  averageSessionTime: number;
  /** Number of cards in each state */
  cardsByState: {
    new: number;
    learning: number;
    reviewing: number;
    mastered: number;
  };
  /** Number of cards due for review today */
  cardsDueToday: number;
  /** Number of new cards available */
  newCardsAvailable: number;
}

/**
 * Represents a study session configuration
 */
export interface StudySessionConfig {
  /** Maximum number of new cards per session */
  maxNewCards: number;
  /** Maximum number of review cards per session */
  maxReviewCards: number;
  /** Whether to include new cards in this session */
  includeNewCards: boolean;
  /** Whether to include review cards in this session */
  includeReviewCards: boolean;
  /** Whether to include learning cards in this session */
  includeLearningCards: boolean;
  /** Maximum session duration in minutes */
  maxSessionDuration?: number;
  /** Whether to shuffle cards */
  shuffleCards: boolean;
  /** Whether to show answer immediately */
  showAnswerImmediately: boolean;
}

/**
 * Represents a vocabulary item with study progress
 */
export interface VocabularyWithProgress {
  /** Vocabulary item information */
  vocabulary: {
    id: string;
    korean: string;
    english: string;
    importanceScore: number;
    context?: string;
    imageUrl?: string;
    seriesName?: string;
    chapterNumber?: string;
  };
  /** Study progress for this vocabulary item */
  studyProgress?: FSRSProgress;
  /** Whether this card is due for review */
  isDue: boolean;
  /** Days until next review (negative if overdue) */
  daysUntilReview: number;
}

// Card: Study card for a session
export interface Card {
  id: string;
  korean: string;
  english: string;
  importanceScore: number;
  studyProgress: FSRSProgress;
}

// Queues for session state, keyed by FSRSState
export type SessionQueues = {
  [key in _FSRSState]: Card[];
};

// Progress stats for session
export interface ProgressStats {
  reviewed: number;
  grades: number[];
  // ...add more as needed
}

// SessionState: In-memory session object
export interface SessionState {
  sessionId: string;
  userId: string;
  deckId: string;
  // cards: Card[]; // Deprecated: use queues instead
  queues: SessionQueues;
  progress: ProgressStats;
  currentCard: Card | null;
  createdAt: Date;
  lastActive: Date;
} 