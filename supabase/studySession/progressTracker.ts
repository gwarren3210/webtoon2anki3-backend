/**
 * Progress Tracker for SRS System
 * 
 * This file implements progress tracking and statistics functionality for the
 * spaced repetition system, including progress updates, statistics calculation,
 * mastery tracking, and study streak management.
 */

import { 
  StudyProgress, 
  StudySession, 
  StudyHistory, 
  StudyStats, 
  SRSGrade, 
  StudyState 
} from './types';

// Delegate to canonical SRS logic for progress update and due checks
import {
  processGrade as srsProcessGrade,
  isCardDue as srsIsCardDue,
  daysUntilReview as srsDaysUntilReview
} from './srsAlgorithm';

/**
 * Error types for progress tracking
 */
export class ProgressTrackerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ProgressTrackerError';
  }
}

/**
 * Input validation for progress tracking parameters
 */
function validateProgressUpdate(
  progress: StudyProgress,
  grade: SRSGrade,
  responseTime?: number
): void {
  if (!progress) {
    throw new ProgressTrackerError('Study progress is required', 'MISSING_PROGRESS');
  }

  if (grade < SRSGrade.BLACKOUT || grade > SRSGrade.PERFECT) {
    throw new ProgressTrackerError(
      `Invalid grade: ${grade}. Must be between ${SRSGrade.BLACKOUT} and ${SRSGrade.PERFECT}`,
      'INVALID_GRADE'
    );
  }

  if (responseTime !== undefined && responseTime < 0) {
    throw new ProgressTrackerError(
      `Invalid response time: ${responseTime}. Must be non-negative`,
      'INVALID_RESPONSE_TIME'
    );
  }

  if (progress.eFactor < 1.3 || progress.eFactor > 2.5) {
    throw new ProgressTrackerError(
      `Invalid e-factor: ${progress.eFactor}. Must be between 1.3 and 2.5`,
      'INVALID_E_FACTOR'
    );
  }

  if (progress.interval < 0) {
    throw new ProgressTrackerError(
      `Invalid interval: ${progress.interval}. Must be non-negative`,
      'INVALID_INTERVAL'
    );
  }
}

/**
 * Updates study progress based on a new grade
 * Delegates to processGrade from srsAlgorithm.ts
 * 
 * @param progress - Current study progress
 * @param grade - Grade received (0-5)
 * @param responseTime - Time taken to answer in seconds (optional)
 * @returns Updated study progress
 */
export function updateProgress(
  progress: StudyProgress,
  grade: SRSGrade,
  responseTime?: number
): StudyProgress {
  return srsProcessGrade(grade, progress, responseTime);
}

/**
 * Calculates mastery level for a vocabulary item
 * 
 * @param progress - Study progress for the vocabulary item
 * @returns Mastery level (0-100)
 */
export function calculateMastery(progress: StudyProgress): number {
  if (!progress) {
    throw new ProgressTrackerError('Study progress is required', 'MISSING_PROGRESS');
  }

  // Base mastery on state and consecutive correct answers
  let baseMastery = 0;

  switch (progress.state) {
    case StudyState.NEW:
      baseMastery = 0;
      break;
    case StudyState.LEARNING:
      baseMastery = Math.min(50, progress.consecutiveCorrect * 25);
      break;
    case StudyState.REVIEWING:
      baseMastery = 50 + Math.min(40, progress.consecutiveCorrect * 5);
      break;
    case StudyState.MASTERED:
      baseMastery = 100;
      break;
    default:
      throw new ProgressTrackerError(
        `Invalid study state: ${progress.state}`,
        'INVALID_STATE'
      );
  }

  // Adjust based on e-factor (higher e-factor = easier to remember)
  const eFactorBonus = Math.max(0, (progress.eFactor - 1.3) * 10);

  // Adjust based on total reviews (more reviews = more practice)
  const reviewBonus = Math.min(10, progress.totalReviews * 0.5);

  // Calculate final mastery
  const mastery = Math.min(100, baseMastery + eFactorBonus + reviewBonus);

  return Math.round(mastery);
}

/**
 * Calculates study streak based on study history
 * 
 * @param studyHistory - Array of study history records
 * @returns Current study streak in days
 */
export function getStudyStreak(studyHistory: StudyHistory[]): number {
  if (!studyHistory || studyHistory.length === 0) {
    return 0;
  }

  // Sort history by review date (most recent first)
  const sortedHistory = [...studyHistory].sort(
    (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let currentDate = new Date(today);

  for (const record of sortedHistory) {
    const reviewDate = new Date(record.reviewedAt);
    reviewDate.setHours(0, 0, 0, 0);

    // Check if this review was on the current date we're checking
    if (reviewDate.getTime() === currentDate.getTime()) {
      currentStreak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (reviewDate.getTime() < currentDate.getTime()) {
      // Skip to the review date and continue checking
      currentDate = new Date(reviewDate);
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Check if this review was on the previous day
      const previousDay = new Date(reviewDate);
      previousDay.setDate(previousDay.getDate() - 1);
      
      if (reviewDate.getTime() === previousDay.getTime()) {
        currentStreak++;
      } else {
        // Gap in streak, break
        break;
      }
    } else {
      // Future date, skip
      continue;
    }
  }

  return currentStreak;
}

/**
 * Calculates comprehensive progress statistics
 * 
 * @param progressList - Array of study progress records
 * @param studySessions - Array of study sessions
 * @param studyHistory - Array of study history records
 * @returns Comprehensive study statistics
 */
export function getProgressStats(
  progressList: StudyProgress[],
  studySessions: StudySession[],
  studyHistory: StudyHistory[]
): StudyStats {
  if (!progressList) {
    throw new ProgressTrackerError('Progress list is required', 'MISSING_PROGRESS_LIST');
  }

  if (!studySessions) {
    throw new ProgressTrackerError('Study sessions are required', 'MISSING_STUDY_SESSIONS');
  }

  if (!studyHistory) {
    throw new ProgressTrackerError('Study history is required', 'MISSING_STUDY_HISTORY');
  }

  // Calculate basic statistics
  const totalCardsStudied = progressList.filter(p => p.totalReviews > 0).length;
  const totalCorrectAnswers = studyHistory.filter(h => h.grade >= SRSGrade.GOOD).length;
  const totalIncorrectAnswers = studyHistory.filter(h => h.grade < SRSGrade.GOOD).length;
  const accuracyPercentage = totalCardsStudied > 0 
    ? Math.round((totalCorrectAnswers / (totalCorrectAnswers + totalIncorrectAnswers)) * 100)
    : 0;

  // Calculate study streak
  const currentStreak = getStudyStreak(studyHistory);

  // Calculate longest streak (simplified - in a real app, you'd want to calculate this more efficiently)
  const longestStreak = Math.max(currentStreak, 0); // Simplified for now

  // Calculate study time
  const totalStudyTime = studySessions.reduce((total, session) => {
    return total + (session.duration || 0);
  }, 0);

  const averageSessionTime = studySessions.length > 0 
    ? Math.round(totalStudyTime / studySessions.length)
    : 0;

  // Calculate cards by state
  const cardsByState = {
    new: progressList.filter(p => p.state === StudyState.NEW).length,
    learning: progressList.filter(p => p.state === StudyState.LEARNING).length,
    reviewing: progressList.filter(p => p.state === StudyState.REVIEWING).length,
    mastered: progressList.filter(p => p.state === StudyState.MASTERED).length
  };

  // Calculate cards due today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cardsDueToday = progressList.filter(p => {
    const nextReview = new Date(p.nextReviewDate);
    nextReview.setHours(0, 0, 0, 0);
    return nextReview.getTime() <= today.getTime();
  }).length;

  // Calculate new cards available
  const newCardsAvailable = cardsByState.new;

  const stats: StudyStats = {
    totalCardsStudied,
    totalCorrectAnswers,
    totalIncorrectAnswers,
    accuracyPercentage,
    currentStreak,
    longestStreak,
    totalStudyTime,
    averageSessionTime,
    cardsByState,
    cardsDueToday,
    newCardsAvailable
  };

  return stats;
}

/**
 * Validates study progress data
 * 
 * @param progress - Study progress to validate
 * @returns True if valid, throws error if invalid
 */
export function validateProgress(progress: StudyProgress): boolean {
  if (!progress) {
    throw new ProgressTrackerError('Study progress is required', 'MISSING_PROGRESS');
  }

  if (!progress.id) {
    throw new ProgressTrackerError('Progress ID is required', 'MISSING_PROGRESS_ID');
  }

  if (!progress.vocabularyId) {
    throw new ProgressTrackerError('Vocabulary ID is required', 'MISSING_VOCABULARY_ID');
  }

  if (!progress.userId) {
    throw new ProgressTrackerError('User ID is required', 'MISSING_USER_ID');
  }

  if (!Object.values(StudyState).includes(progress.state)) {
    throw new ProgressTrackerError(
      `Invalid study state: ${progress.state}`,
      'INVALID_STATE'
    );
  }

  if (progress.eFactor < 1.3 || progress.eFactor > 2.5) {
    throw new ProgressTrackerError(
      `Invalid e-factor: ${progress.eFactor}. Must be between 1.3 and 2.5`,
      'INVALID_E_FACTOR'
    );
  }

  if (progress.interval < 0) {
    throw new ProgressTrackerError(
      `Invalid interval: ${progress.interval}. Must be non-negative`,
      'INVALID_INTERVAL'
    );
  }

  if (progress.consecutiveCorrect < 0) {
    throw new ProgressTrackerError(
      `Invalid consecutive correct: ${progress.consecutiveCorrect}. Must be non-negative`,
      'INVALID_CONSECUTIVE_CORRECT'
    );
  }

  if (progress.consecutiveIncorrect < 0) {
    throw new ProgressTrackerError(
      `Invalid consecutive incorrect: ${progress.consecutiveIncorrect}. Must be non-negative`,
      'INVALID_CONSECUTIVE_INCORRECT'
    );
  }

  if (progress.totalReviews < 0) {
    throw new ProgressTrackerError(
      `Invalid total reviews: ${progress.totalReviews}. Must be non-negative`,
      'INVALID_TOTAL_REVIEWS'
    );
  }

  if (!progress.nextReviewDate) {
    throw new ProgressTrackerError('Next review date is required', 'MISSING_NEXT_REVIEW_DATE');
  }

  if (!progress.firstSeenDate) {
    throw new ProgressTrackerError('First seen date is required', 'MISSING_FIRST_SEEN_DATE');
  }

  if (!progress.createdAt) {
    throw new ProgressTrackerError('Created date is required', 'MISSING_CREATED_DATE');
  }

  if (!progress.updatedAt) {
    throw new ProgressTrackerError('Updated date is required', 'MISSING_UPDATED_DATE');
  }

  return true;
}

/**
 * Checks if a card is due for review
 * Delegates to isCardDue from srsAlgorithm.ts
 * 
 * @param progress - Study progress for the card
 * @returns True if the card is due for review
 */
export function isCardDue(progress: StudyProgress): boolean {
  return srsIsCardDue(progress);
}

/**
 * Calculates days until next review
 * Delegates to daysUntilReview from srsAlgorithm.ts
 * 
 * @param progress - Study progress for the card
 * @returns Number of days until next review (negative if overdue)
 */
export function daysUntilReview(progress: StudyProgress): number {
  return srsDaysUntilReview(progress);
} 