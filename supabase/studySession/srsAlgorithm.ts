/**
 * SM-2 Spaced Repetition Algorithm Implementation
 * 
 * This file implements the core SM-2 algorithm for spaced repetition learning.
 * Based on the SuperMemo 2 algorithm by Piotr Wozniak.
 */

import { SRSGrade, StudyState, StudyProgress } from './types';

/**
 * Configuration constants for the SM-2 algorithm
 */
const SRS_CONFIG = {
  /** Initial e-factor for new cards */
  INITIAL_E_FACTOR: 2.5,
  /** Minimum e-factor */
  MIN_E_FACTOR: 1.3,
  /** Maximum e-factor */
  MAX_E_FACTOR: 2.5,
  /** Initial interval for learning cards (in days) */
  LEARNING_INTERVALS: [1, 6], // 1 day, then 6 days
  /** Minimum interval for review cards (in days) */
  MIN_REVIEW_INTERVAL: 1,
  /** Maximum interval for review cards (in days) */
  MAX_REVIEW_INTERVAL: 36500, // ~100 years
  /** Number of learning steps before graduating to review */
  LEARNING_STEPS: 2,
} as const;

/**
 * Error types for SRS algorithm
 */
export class SRSError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SRSError';
  }
}

/**
 * Input validation for SRS algorithm parameters
 */
function validateInputs(
  grade: SRSGrade,
  currentProgress: StudyProgress,
  responseTime?: number
): void {
  // Validate grade
  if (grade < SRSGrade.BLACKOUT || grade > SRSGrade.PERFECT) {
    throw new SRSError(
      `Invalid grade: ${grade}. Must be between ${SRSGrade.BLACKOUT} and ${SRSGrade.PERFECT}`,
      'INVALID_GRADE'
    );
  }

  // Validate current progress
  if (!currentProgress) {
    throw new SRSError('Current progress is required', 'MISSING_PROGRESS');
  }

  if (currentProgress.eFactor < SRS_CONFIG.MIN_E_FACTOR || currentProgress.eFactor > SRS_CONFIG.MAX_E_FACTOR) {
    throw new SRSError(
      `Invalid e-factor: ${currentProgress.eFactor}. Must be between ${SRS_CONFIG.MIN_E_FACTOR} and ${SRS_CONFIG.MAX_E_FACTOR}`,
      'INVALID_E_FACTOR'
    );
  }

  if (currentProgress.interval < 0) {
    throw new SRSError(
      `Invalid interval: ${currentProgress.interval}. Must be non-negative`,
      'INVALID_INTERVAL'
    );
  }

  // Validate response time if provided
  if (responseTime !== undefined && responseTime < 0) {
    throw new SRSError(
      `Invalid response time: ${responseTime}. Must be non-negative`,
      'INVALID_RESPONSE_TIME'
    );
  }
}

/**
 * Updates the e-factor based on the grade received
 * 
 * @param currentEFactor - Current e-factor value
 * @param grade - Grade received (0-5)
 * @returns New e-factor value
 */
export function updateEfactor(currentEFactor: number, grade: SRSGrade): number {
  // Validate inputs
  if (currentEFactor < SRS_CONFIG.MIN_E_FACTOR || currentEFactor > SRS_CONFIG.MAX_E_FACTOR) {
    throw new SRSError(
      `Invalid current e-factor: ${currentEFactor}`,
      'INVALID_E_FACTOR'
    );
  }

  if (grade < SRSGrade.BLACKOUT || grade > SRSGrade.PERFECT) {
    throw new SRSError(
      `Invalid grade: ${grade}`,
      'INVALID_GRADE'
    );
  }

  // SM-2 e-factor update formula
  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  // where q is the grade (0-5) and EF is the current e-factor
  
  const q = grade;
  const ef = currentEFactor;
  
  // Calculate the adjustment factor
  const adjustment = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  
  // Calculate new e-factor
  let newEFactor = ef + adjustment;
  
  // Ensure e-factor stays within bounds
  newEFactor = Math.max(SRS_CONFIG.MIN_E_FACTOR, Math.min(SRS_CONFIG.MAX_E_FACTOR, newEFactor));
  
  // Round to 2 decimal places for consistency
  return Math.round(newEFactor * 100) / 100;
}

/**
 * Calculates the next interval based on current state and grade
 * 
 * @param currentProgress - Current study progress
 * @param grade - Grade received (0-5)
 * @returns New interval in days
 */
export function calculateInterval(currentProgress: StudyProgress, grade: SRSGrade): number {
  // Validate inputs
  if (!currentProgress) {
    throw new SRSError('Current progress is required', 'MISSING_PROGRESS');
  }

  if (grade < SRSGrade.BLACKOUT || grade > SRSGrade.PERFECT) {
    throw new SRSError(
      `Invalid grade: ${grade}`,
      'INVALID_GRADE'
    );
  }

  const { state, interval, consecutiveCorrect } = currentProgress;

  // Handle different states
  switch (state) {
    case StudyState.NEW:
      // New cards start with learning intervals
      return SRS_CONFIG.LEARNING_INTERVALS[0]; // 1 day

    case StudyState.LEARNING:
      // Learning cards follow the learning sequence
      if (grade >= SRSGrade.GOOD) {
        // Correct answer - move to next learning step or graduate
        if (consecutiveCorrect >= SRS_CONFIG.LEARNING_STEPS) {
          // Graduate to reviewing state
          return Math.round(interval * currentProgress.eFactor);
        } else {
          // Move to next learning step
          const stepIndex = Math.min(consecutiveCorrect, SRS_CONFIG.LEARNING_INTERVALS.length - 1);
          return SRS_CONFIG.LEARNING_INTERVALS[stepIndex];
        }
      } else {
        // Incorrect answer - reset to first learning step
        return SRS_CONFIG.LEARNING_INTERVALS[0];
      }

    case StudyState.REVIEWING:
      // Review cards use the SM-2 interval formula
      if (grade >= SRSGrade.GOOD) {
        // Correct answer - increase interval
        const newInterval = Math.round(interval * currentProgress.eFactor);
        return Math.min(newInterval, SRS_CONFIG.MAX_REVIEW_INTERVAL);
      } else {
        // Incorrect answer - reset to learning state interval
        return SRS_CONFIG.LEARNING_INTERVALS[0];
      }

    case StudyState.MASTERED:
      // Mastered cards don't need review, but if they're reviewed and failed
      if (grade < SRSGrade.GOOD) {
        // Reset to learning state
        return SRS_CONFIG.LEARNING_INTERVALS[0];
      } else {
        // Keep mastered status
        return SRS_CONFIG.MAX_REVIEW_INTERVAL;
      }

    default:
      throw new SRSError(
        `Invalid study state: ${state}`,
        'INVALID_STATE'
      );
  }
}

/**
 * Calculates the next review date based on the interval
 * 
 * @param interval - Interval in days
 * @returns Next review date
 */
export function calculateNextReview(interval: number): Date {
  // Validate interval
  if (interval < 0) {
    throw new SRSError(
      `Invalid interval: ${interval}. Must be non-negative`,
      'INVALID_INTERVAL'
    );
  }

  // Calculate next review date in UTC
  const now = new Date();
  const nextReview = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + interval,
    0, 0, 0, 0
  ));
  
  return nextReview;
}

/**
 * Determines the new study state based on current state and grade
 * 
 * @param currentState - Current study state
 * @param grade - Grade received (0-5)
 * @param consecutiveCorrect - Number of consecutive correct answers
 * @returns New study state
 */
function determineNewState(
  currentState: StudyState,
  grade: SRSGrade,
  consecutiveCorrect: number
): StudyState {
  switch (currentState) {
    case StudyState.NEW:
      // New cards become learning cards on first review
      return StudyState.LEARNING;

    case StudyState.LEARNING:
      if (grade >= SRSGrade.GOOD) {
        // Check if ready to graduate to reviewing
        if (consecutiveCorrect >= SRS_CONFIG.LEARNING_STEPS) {
          return StudyState.REVIEWING;
        }
        // Stay in learning
        return StudyState.LEARNING;
      } else {
        // Incorrect answer - stay in learning
        return StudyState.LEARNING;
      }

    case StudyState.REVIEWING:
      if (grade >= SRSGrade.GOOD) {
        // Check if ready to graduate to mastered
        if (consecutiveCorrect >= 10 && currentState === StudyState.REVIEWING) {
          return StudyState.MASTERED;
        }
        // Stay in reviewing
        return StudyState.REVIEWING;
      } else {
        // Incorrect answer - back to learning
        return StudyState.LEARNING;
      }

    case StudyState.MASTERED:
      if (grade < SRSGrade.GOOD) {
        // Failed review - back to learning
        return StudyState.LEARNING;
      } else {
        // Stay mastered
        return StudyState.MASTERED;
      }

    default:
      throw new SRSError(
        `Invalid study state: ${currentState}`,
        'INVALID_STATE'
      );
  }
}

/**
 * Main entry point for the SM-2 algorithm
 * Processes a grade and updates study progress accordingly
 * 
 * @param grade - Grade received (0-5)
 * @param currentProgress - Current study progress
 * @param responseTime - Time taken to answer in seconds (optional)
 * @returns Updated study progress
 */
export function processGrade(
  grade: SRSGrade,
  currentProgress: StudyProgress,
  responseTime?: number
): StudyProgress {
  // Validate all inputs
  validateInputs(grade, currentProgress, responseTime);

  // Create a copy of current progress to avoid mutations
  const updatedProgress: StudyProgress = { ...currentProgress };

  // Update consecutive counters
  if (grade >= SRSGrade.GOOD) {
    updatedProgress.consecutiveCorrect = currentProgress.consecutiveCorrect + 1;
    updatedProgress.consecutiveIncorrect = 0;
  } else {
    updatedProgress.consecutiveCorrect = 0;
    updatedProgress.consecutiveIncorrect = currentProgress.consecutiveIncorrect + 1;
  }

  // Update e-factor
  updatedProgress.eFactor = updateEfactor(currentProgress.eFactor, grade);

  // Calculate new interval
  const newInterval = calculateInterval(currentProgress, grade);
  updatedProgress.interval = newInterval;

  // Determine new state
  const newState = determineNewState(
    currentProgress.state,
    grade,
    updatedProgress.consecutiveCorrect
  );
  updatedProgress.state = newState;

  // Calculate next review date
  updatedProgress.nextReviewDate = calculateNextReview(newInterval);

  // Update last reviewed date
  updatedProgress.lastReviewedDate = new Date();

  // Increment total reviews
  updatedProgress.totalReviews = currentProgress.totalReviews + 1;

  // Update the updatedAt timestamp
  updatedProgress.updatedAt = new Date();

  return updatedProgress;
}

/**
 * Creates initial study progress for a new vocabulary item
 * 
 * @param vocabularyId - ID of the vocabulary item
 * @param userId - ID of the user
 * @returns Initial study progress
 */
export function createInitialProgress(vocabularyId: string, userId: string): StudyProgress {
  const now = new Date();
  
  return {
    id: '', // Will be set by database
    vocabularyId,
    userId,
    state: StudyState.NEW,
    interval: 0,
    eFactor: SRS_CONFIG.INITIAL_E_FACTOR,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    totalReviews: 0,
    nextReviewDate: now, // Available immediately
    lastReviewedDate: undefined,
    firstSeenDate: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Checks if a card is due for review
 * 
 * @param progress - Study progress to check
 * @returns True if card is due for review
 */
export function isCardDue(progress: StudyProgress): boolean {
  if (!progress) {
    throw new SRSError('Progress is required', 'MISSING_PROGRESS');
  }

  const now = new Date();
  return progress.nextReviewDate <= now;
}

/**
 * Calculates days until next review (negative if overdue)
 * 
 * @param progress - Study progress to check
 * @returns Days until next review
 */
export function daysUntilReview(progress: StudyProgress): number {
  if (!progress) {
    throw new SRSError('Progress is required', 'MISSING_PROGRESS');
  }

  const now = new Date();
  const timeDiff = progress.nextReviewDate.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  return daysDiff;
} 