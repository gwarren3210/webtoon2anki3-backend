/**
 * Progress Tracker Tests
 * 
 * This file contains comprehensive unit tests for the progress tracker functionality,
 * including progress updates, statistics calculation, mastery tracking, and study streaks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  updateProgress,
  calculateMastery,
  getStudyStreak,
  getProgressStats,
  validateProgress,
  isCardDue,
  daysUntilReview,
  ProgressTrackerError
} from '../progressTracker';
import {
  StudyProgress,
  StudySession,
  StudyHistory,
  SRSGrade,
  StudyState
} from '../types';

describe('Progress Tracker', () => {
  let mockProgress: StudyProgress;
  let mockSession: StudySession;
  let mockHistory: StudyHistory[];

  beforeEach(() => {
    // Create mock study progress
    mockProgress = {
      id: 'progress_1',
      vocabularyId: 'vocab_1',
      userId: 'user_1',
      state: StudyState.NEW,
      interval: 1,
      eFactor: 2.5,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      totalReviews: 0,
      nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      firstSeenDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create mock study session
    mockSession = {
      id: 'session_1',
      userId: 'user_1',
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: new Date(),
      duration: 3600, // 1 hour
      cardsStudied: 20,
      correctAnswers: 15,
      incorrectAnswers: 5,
      sessionType: 'mixed',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create mock study history
    mockHistory = [
      {
        id: 'history_1',
        studyProgressId: 'progress_1',
        studySessionId: 'session_1',
        vocabularyId: 'vocab_1',
        userId: 'user_1',
        grade: SRSGrade.GOOD,
        responseTime: 5,
        previousInterval: 1,
        newInterval: 6,
        previousEFactor: 2.5,
        newEFactor: 2.5,
        previousState: StudyState.NEW,
        newState: StudyState.LEARNING,
        reviewedAt: new Date(),
        createdAt: new Date()
      },
      {
        id: 'history_2',
        studyProgressId: 'progress_1',
        studySessionId: 'session_1',
        vocabularyId: 'vocab_1',
        userId: 'user_1',
        grade: SRSGrade.PERFECT,
        responseTime: 3,
        previousInterval: 6,
        newInterval: 15,
        previousEFactor: 2.5,
        newEFactor: 2.5,
        previousState: StudyState.LEARNING,
        newState: StudyState.REVIEWING,
        reviewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        createdAt: new Date()
      }
    ];
  });

  describe('updateProgress', () => {
    it('should update progress for a new card with correct answer', () => {
      const updatedProgress = updateProgress(mockProgress, SRSGrade.GOOD);

      expect(updatedProgress.state).toBe(StudyState.LEARNING);
      expect(updatedProgress.interval).toBe(1);
      expect(updatedProgress.consecutiveCorrect).toBe(1);
      expect(updatedProgress.consecutiveIncorrect).toBe(0);
      expect(updatedProgress.totalReviews).toBe(1);
      expect(updatedProgress.lastReviewedDate).toBeInstanceOf(Date);
    });

    it('should update progress for a new card with incorrect answer', () => {
      const updatedProgress = updateProgress(mockProgress, SRSGrade.BLACKOUT);

      expect(updatedProgress.state).toBe(StudyState.LEARNING);
      expect(updatedProgress.interval).toBe(1);
      expect(updatedProgress.consecutiveCorrect).toBe(0);
      expect(updatedProgress.consecutiveIncorrect).toBe(1);
      expect(updatedProgress.totalReviews).toBe(1);
    });

    it('should graduate learning card to reviewing after 2 correct answers', () => {
      const learningProgress = {
        ...mockProgress,
        state: StudyState.LEARNING,
        consecutiveCorrect: 1,
        totalReviews: 1
      };

      const updatedProgress = updateProgress(learningProgress, SRSGrade.GOOD);

      expect(updatedProgress.state).toBe(StudyState.REVIEWING);
      expect(updatedProgress.consecutiveCorrect).toBe(2);
      expect(updatedProgress.interval).toBeGreaterThan(1);
    });

    it('should reset learning card on incorrect answer', () => {
      const learningProgress = {
        ...mockProgress,
        state: StudyState.LEARNING,
        consecutiveCorrect: 1,
        totalReviews: 1
      };

      const updatedProgress = updateProgress(learningProgress, SRSGrade.INCORRECT);

      expect(updatedProgress.state).toBe(StudyState.LEARNING);
      expect(updatedProgress.consecutiveCorrect).toBe(0);
      expect(updatedProgress.consecutiveIncorrect).toBe(1);
      expect(updatedProgress.interval).toBe(1);
    });

    it('should increase interval for reviewing card with correct answer', () => {
      const reviewingProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        interval: 10,
        totalReviews: 5
      };

      const updatedProgress = updateProgress(reviewingProgress, SRSGrade.EASY);

      expect(updatedProgress.state).toBe(StudyState.REVIEWING);
      expect(updatedProgress.interval).toBeGreaterThan(10);
      expect(updatedProgress.consecutiveCorrect).toBe(1);
    });

    it('should reset reviewing card to learning on incorrect answer', () => {
      const reviewingProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        interval: 10,
        totalReviews: 5
      };

      const updatedProgress = updateProgress(reviewingProgress, SRSGrade.BLACKOUT);

      expect(updatedProgress.state).toBe(StudyState.LEARNING);
      expect(updatedProgress.interval).toBe(1);
      expect(updatedProgress.consecutiveCorrect).toBe(0);
      expect(updatedProgress.consecutiveIncorrect).toBe(1);
    });

    it('should handle mastered card correctly', () => {
      const masteredProgress = {
        ...mockProgress,
        state: StudyState.MASTERED,
        interval: 36500,
        totalReviews: 20
      };

      // Correct answer should keep it mastered
      const updatedProgress = updateProgress(masteredProgress, SRSGrade.PERFECT);
      expect(updatedProgress.state).toBe(StudyState.MASTERED);

      // Incorrect answer should reset to learning
      const resetProgress = updateProgress(masteredProgress, SRSGrade.INCORRECT);
      expect(resetProgress.state).toBe(StudyState.LEARNING);
      expect(resetProgress.interval).toBe(1);
    });

    it('should update e-factor based on grade', () => {
      // Use a lower e-factor to allow for increase
      const lowerEFactorProgress = {
        ...mockProgress,
        eFactor: 2.0
      };

      const updatedProgress = updateProgress(lowerEFactorProgress, SRSGrade.PERFECT);
      expect(updatedProgress.eFactor).toBeGreaterThan(lowerEFactorProgress.eFactor);

      const updatedProgress2 = updateProgress(lowerEFactorProgress, SRSGrade.BLACKOUT);
      expect(updatedProgress2.eFactor).toBeLessThan(lowerEFactorProgress.eFactor);
    });

    it('should cap e-factor within valid range', () => {
      const lowEFactorProgress = {
        ...mockProgress,
        eFactor: 1.3
      };

      const updatedProgress = updateProgress(lowEFactorProgress, SRSGrade.BLACKOUT);
      expect(updatedProgress.eFactor).toBeGreaterThanOrEqual(1.3);

      const highEFactorProgress = {
        ...mockProgress,
        eFactor: 2.5
      };

      const updatedProgress2 = updateProgress(highEFactorProgress, SRSGrade.PERFECT);
      expect(updatedProgress2.eFactor).toBeLessThanOrEqual(2.5);
    });

    it('should cap interval at maximum value', () => {
      const highIntervalProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        interval: 10000,
        eFactor: 2.5
      };

      const updatedProgress = updateProgress(highIntervalProgress, SRSGrade.PERFECT);
      expect(updatedProgress.interval).toBeLessThanOrEqual(36500);
    });

    it('should throw error for invalid grade', () => {
      expect(() => updateProgress(mockProgress, -1 as SRSGrade)).toThrow(ProgressTrackerError);
      expect(() => updateProgress(mockProgress, 6 as SRSGrade)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid response time', () => {
      expect(() => updateProgress(mockProgress, SRSGrade.GOOD, -1)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid e-factor', () => {
      const invalidProgress = {
        ...mockProgress,
        eFactor: 1.0
      };

      expect(() => updateProgress(invalidProgress, SRSGrade.GOOD)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid interval', () => {
      const invalidProgress = {
        ...mockProgress,
        interval: -1
      };

      expect(() => updateProgress(invalidProgress, SRSGrade.GOOD)).toThrow(ProgressTrackerError);
    });
  });

  describe('calculateMastery', () => {
    it('should return 0 for new cards', () => {
      // Use a lower e-factor to avoid bonus
      const newProgress = {
        ...mockProgress,
        eFactor: 1.3
      };
      const mastery = calculateMastery(newProgress);
      expect(mastery).toBe(0);
    });

    it('should calculate mastery for learning cards', () => {
      const learningProgress = {
        ...mockProgress,
        state: StudyState.LEARNING,
        consecutiveCorrect: 1
      };

      const mastery = calculateMastery(learningProgress);
      expect(mastery).toBeGreaterThan(0);
      expect(mastery).toBeLessThanOrEqual(50);
    });

    it('should calculate mastery for reviewing cards', () => {
      const reviewingProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        consecutiveCorrect: 5,
        totalReviews: 10
      };

      const mastery = calculateMastery(reviewingProgress);
      expect(mastery).toBeGreaterThan(50);
      expect(mastery).toBeLessThan(100);
    });

    it('should return 100 for mastered cards', () => {
      const masteredProgress = {
        ...mockProgress,
        state: StudyState.MASTERED
      };

      const mastery = calculateMastery(masteredProgress);
      expect(mastery).toBe(100);
    });

    it('should include e-factor bonus in mastery calculation', () => {
      const highEFactorProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        eFactor: 2.5
      };

      const lowEFactorProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        eFactor: 1.3
      };

      const highMastery = calculateMastery(highEFactorProgress);
      const lowMastery = calculateMastery(lowEFactorProgress);

      expect(highMastery).toBeGreaterThan(lowMastery);
    });

    it('should include review bonus in mastery calculation', () => {
      const manyReviewsProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        totalReviews: 20
      };

      const fewReviewsProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        totalReviews: 5
      };

      const manyMastery = calculateMastery(manyReviewsProgress);
      const fewMastery = calculateMastery(fewReviewsProgress);

      expect(manyMastery).toBeGreaterThan(fewMastery);
    });

    it('should cap mastery at 100', () => {
      const highMasteryProgress = {
        ...mockProgress,
        state: StudyState.REVIEWING,
        consecutiveCorrect: 20,
        eFactor: 2.5,
        totalReviews: 50
      };

      const mastery = calculateMastery(highMasteryProgress);
      expect(mastery).toBeLessThanOrEqual(100);
    });

    it('should throw error for invalid state', () => {
      const invalidProgress = {
        ...mockProgress,
        state: 'invalid' as StudyState
      };

      expect(() => calculateMastery(invalidProgress)).toThrow(ProgressTrackerError);
    });
  });

  describe('getStudyStreak', () => {
    it('should return 0 for empty history', () => {
      const streak = getStudyStreak([]);
      expect(streak).toBe(0);
    });

    it('should return 0 for null history', () => {
      const streak = getStudyStreak(null as any);
      expect(streak).toBe(0);
    });

    it('should calculate streak for consecutive days', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const consecutiveHistory: StudyHistory[] = [
        {
          ...mockHistory[0],
          reviewedAt: today
        },
        {
          ...mockHistory[0],
          reviewedAt: yesterday
        },
        {
          ...mockHistory[0],
          reviewedAt: twoDaysAgo
        }
      ];

      const streak = getStudyStreak(consecutiveHistory);
      expect(streak).toBe(3);
    });

    it('should break streak on gap', () => {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const historyWithGap: StudyHistory[] = [
        {
          ...mockHistory[0],
          reviewedAt: today
        },
        {
          ...mockHistory[0],
          reviewedAt: threeDaysAgo
        }
      ];

      const streak = getStudyStreak(historyWithGap);
      expect(streak).toBe(1);
    });

    it('should handle multiple reviews on same day', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const multipleReviewsHistory: StudyHistory[] = [
        {
          ...mockHistory[0],
          reviewedAt: new Date(today.getTime() + 1000)
        },
        {
          ...mockHistory[0],
          reviewedAt: today
        },
        {
          ...mockHistory[0],
          reviewedAt: yesterday
        }
      ];

      const streak = getStudyStreak(multipleReviewsHistory);
      expect(streak).toBe(2);
    });

    it('should ignore future dates', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const futureHistory: StudyHistory[] = [
        {
          ...mockHistory[0],
          reviewedAt: tomorrow
        },
        {
          ...mockHistory[0],
          reviewedAt: today
        }
      ];

      const streak = getStudyStreak(futureHistory);
      expect(streak).toBe(1);
    });
  });

  describe('getProgressStats', () => {
    it('should calculate basic statistics correctly', () => {
      // Create progress with reviews to count as studied
      const studiedProgress = {
        ...mockProgress,
        totalReviews: 1
      };
      const progressList = [studiedProgress];
      const studySessions = [mockSession];
      const studyHistory = mockHistory;

      const stats = getProgressStats(progressList, studySessions, studyHistory);

      expect(stats.totalCardsStudied).toBe(1);
      expect(stats.totalCorrectAnswers).toBe(2);
      expect(stats.totalIncorrectAnswers).toBe(0);
      expect(stats.accuracyPercentage).toBe(100);
      expect(stats.currentStreak).toBeGreaterThanOrEqual(0);
      expect(stats.totalStudyTime).toBe(3600);
      expect(stats.averageSessionTime).toBe(3600);
    });

    it('should calculate cards by state correctly', () => {
      const newProgress = { ...mockProgress, state: StudyState.NEW };
      const learningProgress = { ...mockProgress, id: 'progress_2', state: StudyState.LEARNING };
      const reviewingProgress = { ...mockProgress, id: 'progress_3', state: StudyState.REVIEWING };
      const masteredProgress = { ...mockProgress, id: 'progress_4', state: StudyState.MASTERED };

      const progressList = [newProgress, learningProgress, reviewingProgress, masteredProgress];
      const studySessions = [mockSession];
      const studyHistory = mockHistory;

      const stats = getProgressStats(progressList, studySessions, studyHistory);

      expect(stats.cardsByState.new).toBe(1);
      expect(stats.cardsByState.learning).toBe(1);
      expect(stats.cardsByState.reviewing).toBe(1);
      expect(stats.cardsByState.mastered).toBe(1);
    });

    it('should calculate cards due today correctly', () => {
      const dueProgress = {
        ...mockProgress,
        nextReviewDate: new Date() // Today
      };
      const notDueProgress = {
        ...mockProgress,
        id: 'progress_2',
        nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      };

      const progressList = [dueProgress, notDueProgress];
      const studySessions = [mockSession];
      const studyHistory = mockHistory;

      const stats = getProgressStats(progressList, studySessions, studyHistory);

      expect(stats.cardsDueToday).toBe(1);
    });

    it('should calculate new cards available correctly', () => {
      const newProgress1 = { ...mockProgress, state: StudyState.NEW };
      const newProgress2 = { ...mockProgress, id: 'progress_2', state: StudyState.NEW };

      const progressList = [newProgress1, newProgress2];
      const studySessions = [mockSession];
      const studyHistory = mockHistory;

      const stats = getProgressStats(progressList, studySessions, studyHistory);

      expect(stats.newCardsAvailable).toBe(2);
    });

    it('should handle zero accuracy correctly', () => {
      const incorrectHistory = [
        {
          ...mockHistory[0],
          grade: SRSGrade.BLACKOUT
        }
      ];

      const stats = getProgressStats([mockProgress], [mockSession], incorrectHistory);

      expect(stats.accuracyPercentage).toBe(0);
    });

    it('should handle empty sessions correctly', () => {
      const stats = getProgressStats([mockProgress], [], mockHistory);

      expect(stats.totalStudyTime).toBe(0);
      expect(stats.averageSessionTime).toBe(0);
    });

    it('should throw error for missing progress list', () => {
      expect(() => getProgressStats(null as any, [mockSession], mockHistory)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing study sessions', () => {
      expect(() => getProgressStats([mockProgress], null as any, mockHistory)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing study history', () => {
      expect(() => getProgressStats([mockProgress], [mockSession], null as any)).toThrow(ProgressTrackerError);
    });
  });

  describe('validateProgress', () => {
    it('should return true for valid progress', () => {
      const isValid = validateProgress(mockProgress);
      expect(isValid).toBe(true);
    });

    it('should throw error for missing progress', () => {
      expect(() => validateProgress(null as any)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing progress ID', () => {
      const invalidProgress = { ...mockProgress, id: '' };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing vocabulary ID', () => {
      const invalidProgress = { ...mockProgress, vocabularyId: '' };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing user ID', () => {
      const invalidProgress = { ...mockProgress, userId: '' };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid state', () => {
      const invalidProgress = { ...mockProgress, state: 'invalid' as StudyState };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid e-factor', () => {
      const invalidProgress = { ...mockProgress, eFactor: 1.0 };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid interval', () => {
      const invalidProgress = { ...mockProgress, interval: -1 };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid consecutive correct', () => {
      const invalidProgress = { ...mockProgress, consecutiveCorrect: -1 };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid consecutive incorrect', () => {
      const invalidProgress = { ...mockProgress, consecutiveIncorrect: -1 };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for invalid total reviews', () => {
      const invalidProgress = { ...mockProgress, totalReviews: -1 };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing next review date', () => {
      const invalidProgress = { ...mockProgress, nextReviewDate: null as any };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing first seen date', () => {
      const invalidProgress = { ...mockProgress, firstSeenDate: null as any };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing created date', () => {
      const invalidProgress = { ...mockProgress, createdAt: null as any };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });

    it('should throw error for missing updated date', () => {
      const invalidProgress = { ...mockProgress, updatedAt: null as any };
      expect(() => validateProgress(invalidProgress)).toThrow(ProgressTrackerError);
    });
  });

  describe('isCardDue', () => {
    it('should return true for overdue card', () => {
      const overdueProgress = {
        ...mockProgress,
        nextReviewDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      };

      const isDue = isCardDue(overdueProgress);
      expect(isDue).toBe(true);
    });

    it('should return true for card due today', () => {
      const dueProgress = {
        ...mockProgress,
        nextReviewDate: new Date() // Today
      };

      const isDue = isCardDue(dueProgress);
      expect(isDue).toBe(true);
    });

    it('should return false for future card', () => {
      const futureProgress = {
        ...mockProgress,
        nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      };

      const isDue = isCardDue(futureProgress);
      expect(isDue).toBe(false);
    });

    it('should throw error for invalid progress', () => {
      expect(() => isCardDue(null as any)).toThrow(ProgressTrackerError);
    });
  });

  describe('daysUntilReview', () => {
    it('should return negative days for overdue card', () => {
      const overdueProgress = {
        ...mockProgress,
        nextReviewDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      };

      const days = daysUntilReview(overdueProgress);
      expect(days).toBeLessThan(0);
    });

    it('should return 0 for card due today', () => {
      const dueProgress = {
        ...mockProgress,
        nextReviewDate: new Date() // Today
      };

      const days = daysUntilReview(dueProgress);
      expect(days).toBe(0);
    });

    it('should return positive days for future card', () => {
      const futureProgress = {
        ...mockProgress,
        nextReviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      };

      const days = daysUntilReview(futureProgress);
      expect(days).toBe(3);
    });

    it('should throw error for invalid progress', () => {
      expect(() => daysUntilReview(null as any)).toThrow(ProgressTrackerError);
    });
  });
}); 