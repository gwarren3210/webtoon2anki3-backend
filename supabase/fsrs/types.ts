/**
 * FSRS (Free Spaced Repetition Scheduler) Core Types
 * 
 * This file defines the core data structures used for the FSRS implementation,
 * aligning with the `ts-fsrs` library and our database schema.
 */
export enum FSRSState {
  New = "New",
  Learning = "Learning",
  Review = "Review",
  Relearning = "Relearning",
}

// { Rating } from 'ts-fsrs'
export enum Rating {
  Manual = 0,
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4
}


/**
 * FSRS-based study progress for a single vocabulary item.
 * This corresponds to a "card" in FSRS terms and will be stored in the database.
 */
export interface FSRSProgress {
  id: string;
  userId: string;
  vocabularyId: string;
  
  // Core FSRS fields, mapping to the `Card` type in `ts-fsrs`
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: FSRSState;
  last_review?: Date;
  learning_steps: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Log of a single FSRS review event.
 * This can be stored for analytics, debugging, or for use with the FSRS optimizer.
 */
export interface FSRSReviewLog {
  id: string;
  progressId: string; // Foreign key to FSRSProgress
  userId: string;
  
  // FSRS Log Fields from `ts-fsrs`
  rating: Rating;
  state: FSRSState;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  review: Date;
  learning_steps: number;
}

/**
 * Default parameters for the FSRS algorithm.
 * These can be customized per user or globally in the future.
 */
export const defaultFSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
};

export type FSRSParameters = typeof defaultFSRSParameters; 