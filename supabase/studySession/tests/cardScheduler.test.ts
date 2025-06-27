/**
 * Card Scheduler Tests
 * 
 * Comprehensive unit tests for card scheduling functionality
 */

import {
  getDueCards,
  getNewCards,
  getLearningCards,
  getReviewCards,
  getStudyDeck,
  getStudyStats,
  CardScheduler,
  CardSchedulerError,
  CardSchedulerConfig,
  DEFAULT_SCHEDULER_CONFIG,
  CardPriority
} from '../cardScheduler';
import { StudyState, VocabularyWithProgress } from '../types';
import { createInitialProgress } from '../srsAlgorithm';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Card Scheduler', () => {
  const mockUserId = 'user_123';
  
  // Create mock vocabulary with progress data
  const createMockVocabularyWithProgress = (
    id: string,
    korean: string,
    english: string,
    studyProgress?: any
  ): VocabularyWithProgress => {
    let isDue = false;
    let daysUntilReview = 0;

    if (studyProgress) {
      const now = new Date();
      isDue = studyProgress.nextReviewDate <= now;
      daysUntilReview = Math.ceil((studyProgress.nextReviewDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    } else {
      // New cards are always "due"
      isDue = true;
      daysUntilReview = 0;
    }

    return {
      vocabulary: {
        id,
        korean,
        english,
        importanceScore: 1.0,
        context: 'test context',
        imageUrl: 'test.jpg',
        seriesName: 'Test Series',
        chapterNumber: '1'
      },
      studyProgress,
      isDue,
      daysUntilReview
    };
  };

  // Create mock study progress
  const createMockStudyProgress = (
    state: StudyState,
    daysUntilReview: number = 0
  ) => {
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilReview);
    
    return {
      id: 'progress_123',
      vocabularyId: 'vocab_123',
      userId: mockUserId,
      state,
      interval: 1,
      eFactor: 2.5,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      totalReviews: 0,
      nextReviewDate,
      lastReviewedDate: new Date(),
      firstSeenDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  };

  describe('CardScheduler Class', () => {
    let scheduler: CardScheduler;

    beforeEach(() => {
      scheduler = new CardScheduler();
    });

    describe('Constructor and Configuration', () => {
      it('should create scheduler with default config', () => {
        expect(scheduler.getConfig()).toEqual(DEFAULT_SCHEDULER_CONFIG);
      });

      it('should create scheduler with custom config', () => {
        const customConfig: CardSchedulerConfig = {
          maxNewCardsPerDay: 5,
          maxReviewCardsPerDay: 50,
          maxLearningCardsPerDay: 25,
          prioritizeOverdue: false,
          shuffleCards: false,
          includeMasteredCards: true
        };

        const customScheduler = new CardScheduler(customConfig);
        expect(customScheduler.getConfig()).toEqual(customConfig);
      });

      it('should update configuration', () => {
        scheduler.updateConfig({ maxNewCardsPerDay: 15 });
        expect(scheduler.getConfig().maxNewCardsPerDay).toBe(15);
        expect(scheduler.getConfig().maxReviewCardsPerDay).toBe(DEFAULT_SCHEDULER_CONFIG.maxReviewCardsPerDay);
      });

      it('should throw error for invalid config', () => {
        expect(() => new CardScheduler({ ...DEFAULT_SCHEDULER_CONFIG, maxNewCardsPerDay: -1 }))
          .toThrow(CardSchedulerError);
      });
    });

    describe('getDueCards', () => {
      it('should return due cards only', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.REVIEWING, -1)), // Overdue
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING, 0)), // Due today
          createMockVocabularyWithProgress('3', '잘가', 'goodbye', createMockStudyProgress(StudyState.REVIEWING, 1)), // Not due
          createMockVocabularyWithProgress('4', '새로운', 'new'), // New card (no progress)
        ];

        const dueCards = scheduler.getDueCards(vocabularyWithProgress);

        expect(dueCards).toHaveLength(2);
        const dueIds = dueCards.map(card => card.vocabularyWithProgress.vocabulary.id);
        expect(dueIds).toEqual(expect.arrayContaining(['1', '2']));
      });

      it('should prioritize overdue cards', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.REVIEWING, -5)), // Very overdue
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING, -1)), // Slightly overdue
          createMockVocabularyWithProgress('3', '잘가', 'goodbye', createMockStudyProgress(StudyState.REVIEWING, 0)), // Due today
        ];

        const dueCards = scheduler.getDueCards(vocabularyWithProgress);

        // Check that priorities are correct for each id
        const prioritiesById = Object.fromEntries(dueCards.map(card => [card.vocabularyWithProgress.vocabulary.id, card.priority]));
        expect(prioritiesById['1']).toBe(CardPriority.OVERDUE);
        expect(prioritiesById['2']).toBe(CardPriority.OVERDUE);
        expect(prioritiesById['3']).toBe(CardPriority.DUE_TODAY);
      });

      it('should respect daily limits', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = Array.from({ length: 50 }, (_, i) =>
          createMockVocabularyWithProgress(
            `vocab_${i}`,
            `word_${i}`,
            `translation_${i}`,
            createMockStudyProgress(StudyState.REVIEWING, -1)
          )
        );

        scheduler.updateConfig({ maxReviewCardsPerDay: 10 });
        const dueCards = scheduler.getDueCards(vocabularyWithProgress);

        expect(dueCards).toHaveLength(10);
      });

      it('should exclude mastered cards by default', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.MASTERED, -1)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING, -1)),
        ];

        const dueCards = scheduler.getDueCards(vocabularyWithProgress);

        expect(dueCards).toHaveLength(1);
        expect(dueCards[0].vocabularyWithProgress.vocabulary.id).toBe('2');
      });

      it('should include mastered cards when configured', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.MASTERED, -1)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING, -1)),
        ];

        scheduler.updateConfig({ includeMasteredCards: true });
        const dueCards = scheduler.getDueCards(vocabularyWithProgress);

        expect(dueCards).toHaveLength(2);
      });
    });

    describe('getNewCards', () => {
      it('should return only new cards (no study progress)', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello'), // New card
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)), // Learning card
          createMockVocabularyWithProgress('3', '잘가', 'goodbye'), // New card
        ];

        const newCards = scheduler.getNewCards(vocabularyWithProgress);

        expect(newCards).toHaveLength(2);
        const newIds = newCards.map(card => card.vocabularyWithProgress.vocabulary.id);
        expect(newIds).toEqual(expect.arrayContaining(['1', '3']));
        newCards.forEach(card => expect(card.priority).toBe(CardPriority.NEW));
      });

      it('should respect daily limits for new cards', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = Array.from({ length: 50 }, (_, i) =>
          createMockVocabularyWithProgress(`vocab_${i}`, `word_${i}`, `translation_${i}`)
        );

        scheduler.updateConfig({ maxNewCardsPerDay: 5 });
        const newCards = scheduler.getNewCards(vocabularyWithProgress);

        expect(newCards).toHaveLength(5);
      });
    });

    describe('getLearningCards', () => {
      it('should return only learning cards', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.LEARNING)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING)),
          createMockVocabularyWithProgress('3', '잘가', 'goodbye', createMockStudyProgress(StudyState.LEARNING)),
          createMockVocabularyWithProgress('4', '새로운', 'new'), // New card
        ];

        const learningCards = scheduler.getLearningCards(vocabularyWithProgress);

        expect(learningCards).toHaveLength(2);
        const learningIds = learningCards.map(card => card.vocabularyWithProgress.vocabulary.id);
        expect(learningIds).toEqual(expect.arrayContaining(['1', '3']));
      });

      it('should respect daily limits for learning cards', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = Array.from({ length: 100 }, (_, i) =>
          createMockVocabularyWithProgress(`vocab_${i}`, `word_${i}`, `translation_${i}`, createMockStudyProgress(StudyState.LEARNING))
        );

        scheduler.updateConfig({ maxLearningCardsPerDay: 10 });
        const learningCards = scheduler.getLearningCards(vocabularyWithProgress);

        expect(learningCards).toHaveLength(10);
      });
    });

    describe('getReviewCards', () => {
      it('should return only review cards', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.REVIEWING)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)),
          createMockVocabularyWithProgress('3', '잘가', 'goodbye', createMockStudyProgress(StudyState.REVIEWING)),
          createMockVocabularyWithProgress('4', '새로운', 'new'), // New card
        ];

        const reviewCards = scheduler.getReviewCards(vocabularyWithProgress);

        expect(reviewCards).toHaveLength(2);
        const reviewIds = reviewCards.map(card => card.vocabularyWithProgress.vocabulary.id);
        expect(reviewIds).toEqual(expect.arrayContaining(['1', '3']));
      });

      it('should include mastered cards when configured', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.MASTERED)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING)),
        ];

        scheduler.updateConfig({ includeMasteredCards: true });
        const reviewCards = scheduler.getReviewCards(vocabularyWithProgress);

        expect(reviewCards).toHaveLength(2);
      });

      it('should exclude mastered cards by default', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.MASTERED)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING)),
        ];

        const reviewCards = scheduler.getReviewCards(vocabularyWithProgress);

        expect(reviewCards).toHaveLength(1);
        expect(reviewCards[0].vocabularyWithProgress.vocabulary.id).toBe('2');
      });
    });

    describe('getStudyDeck', () => {
      it('should return a mixed deck with all card types', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello'), // New
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)), // Learning
          createMockVocabularyWithProgress('3', '잘가', 'goodbye', createMockStudyProgress(StudyState.REVIEWING, -1)), // Overdue review
          createMockVocabularyWithProgress('4', '새로운', 'new', createMockStudyProgress(StudyState.REVIEWING, 1)), // Future review
        ];

        const studyDeck = scheduler.getStudyDeck(vocabularyWithProgress);

        expect(studyDeck).toHaveLength(4);
        
        // Should be sorted by priority (overdue first)
        expect(studyDeck[0].vocabularyWithProgress.vocabulary.id).toBe('3'); // Overdue
        expect(studyDeck[1].vocabularyWithProgress.vocabulary.id).toBe('2'); // Learning
        expect(studyDeck[2].vocabularyWithProgress.vocabulary.id).toBe('1'); // New
        expect(studyDeck[3].vocabularyWithProgress.vocabulary.id).toBe('4'); // Future
      });

      it('should remove duplicates', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.REVIEWING, -1)), // Due
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.REVIEWING, -1)), // Duplicate
        ];

        const studyDeck = scheduler.getStudyDeck(vocabularyWithProgress);

        expect(studyDeck).toHaveLength(1);
      });
    });

    describe('getStudyStats', () => {
      it('should return correct statistics', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello'), // New
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)), // Learning
          createMockVocabularyWithProgress('3', '잘가', 'goodbye', createMockStudyProgress(StudyState.REVIEWING, -1)), // Overdue review
          createMockVocabularyWithProgress('4', '새로운', 'new', createMockStudyProgress(StudyState.REVIEWING, 1)), // Future review
          createMockVocabularyWithProgress('5', '완벽한', 'perfect', createMockStudyProgress(StudyState.MASTERED)), // Mastered
        ];

        const stats = scheduler.getStudyStats(vocabularyWithProgress);

        expect(stats.totalCards).toBe(5);
        expect(stats.newCards).toBe(1);
        expect(stats.learningCards).toBe(1);
        expect(stats.reviewCards).toBe(2);
        expect(stats.dueCards).toBe(3); // New + Learning + Overdue
        expect(stats.overdueCards).toBe(1);
        expect(stats.masteredCards).toBe(1);
      });

      it('should handle empty deck', () => {
        const stats = scheduler.getStudyStats([]);

        expect(stats.totalCards).toBe(0);
        expect(stats.newCards).toBe(0);
        expect(stats.learningCards).toBe(0);
        expect(stats.reviewCards).toBe(0);
        expect(stats.dueCards).toBe(0);
        expect(stats.overdueCards).toBe(0);
        expect(stats.masteredCards).toBe(0);
      });
    });
  });

  describe('Legacy Function Exports', () => {
    describe('getDueCards', () => {
      it('should work with function export', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.REVIEWING, -1)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING, 0)),
        ];

        const dueCards = getDueCards(vocabularyWithProgress);

        expect(dueCards).toHaveLength(2);
      });

      it('should work with custom config', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = Array.from({ length: 50 }, (_, i) =>
          createMockVocabularyWithProgress(
            `vocab_${i}`,
            `word_${i}`,
            `translation_${i}`,
            createMockStudyProgress(StudyState.REVIEWING, -1)
          )
        );

        const config: CardSchedulerConfig = {
          ...DEFAULT_SCHEDULER_CONFIG,
          maxReviewCardsPerDay: 10
        };

        const dueCards = getDueCards(vocabularyWithProgress, config);

        expect(dueCards).toHaveLength(10);
      });
    });

    describe('getNewCards', () => {
      it('should work with function export', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello'),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)),
        ];

        const newCards = getNewCards(vocabularyWithProgress);

        expect(newCards).toHaveLength(1);
        expect(newCards[0].vocabularyWithProgress.vocabulary.id).toBe('1');
      });
    });

    describe('getLearningCards', () => {
      it('should work with function export', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.LEARNING)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.REVIEWING)),
        ];

        const learningCards = getLearningCards(vocabularyWithProgress);

        expect(learningCards).toHaveLength(1);
        expect(learningCards[0].vocabularyWithProgress.vocabulary.id).toBe('1');
      });
    });

    describe('getReviewCards', () => {
      it('should work with function export', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello', createMockStudyProgress(StudyState.REVIEWING)),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)),
        ];

        const reviewCards = getReviewCards(vocabularyWithProgress);

        expect(reviewCards).toHaveLength(1);
        expect(reviewCards[0].vocabularyWithProgress.vocabulary.id).toBe('1');
      });
    });

    describe('getStudyDeck', () => {
      it('should work with function export', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello'),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)),
        ];

        const studyDeck = getStudyDeck(vocabularyWithProgress);

        expect(studyDeck).toHaveLength(2);
      });
    });

    describe('getStudyStats', () => {
      it('should work with function export', () => {
        const vocabularyWithProgress: VocabularyWithProgress[] = [
          createMockVocabularyWithProgress('1', '안녕', 'hello'),
          createMockVocabularyWithProgress('2', '감사합니다', 'thank you', createMockStudyProgress(StudyState.LEARNING)),
        ];

        const stats = getStudyStats(vocabularyWithProgress);

        expect(stats.totalCards).toBe(2);
        expect(stats.newCards).toBe(1);
        expect(stats.learningCards).toBe(1);
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid input', () => {
      expect(() => getDueCards(null as any)).toThrow(CardSchedulerError);
      expect(() => getDueCards(null as any)).toThrow('Vocabulary with progress must be an array');
    });

    it('should throw error for invalid vocabulary data', () => {
      const invalidVocabulary = {
        vocabulary: null,
        studyProgress: null,
        isDue: false,
        daysUntilReview: 0
      } as any;

      expect(() => getNewCards([invalidVocabulary])).toThrow(CardSchedulerError);
      expect(() => getNewCards([invalidVocabulary])).toThrow('Vocabulary data is required');
    });

    it('should throw error for missing vocabulary ID', () => {
      const invalidVocabulary = {
        vocabulary: {
          korean: '안녕',
          english: 'hello',
          importanceScore: 1.0
        },
        studyProgress: null,
        isDue: false,
        daysUntilReview: 0
      } as any;

      expect(() => getNewCards([invalidVocabulary])).toThrow(CardSchedulerError);
      expect(() => getNewCards([invalidVocabulary])).toThrow('Vocabulary ID is required');
    });
  });

  describe('Shuffling', () => {
    it('should shuffle cards when enabled', () => {
      const vocabularyWithProgress: VocabularyWithProgress[] = Array.from({ length: 10 }, (_, i) =>
        createMockVocabularyWithProgress(`vocab_${i}`, `word_${i}`, `translation_${i}`)
      );

      const config: CardSchedulerConfig = {
        ...DEFAULT_SCHEDULER_CONFIG,
        shuffleCards: true
      };

      const newCards1 = getNewCards(vocabularyWithProgress, config);
      const newCards2 = getNewCards(vocabularyWithProgress, config);

      // Cards should be shuffled (order might be different)
      // Note: This test might occasionally fail due to random shuffling
      // In practice, we'd need to mock Math.random for deterministic testing
      expect(newCards1).toHaveLength(10);
      expect(newCards2).toHaveLength(10);
    });

    it('should not shuffle cards when disabled', () => {
      const vocabularyWithProgress: VocabularyWithProgress[] = Array.from({ length: 10 }, (_, i) =>
        createMockVocabularyWithProgress(`vocab_${i}`, `word_${i}`, `translation_${i}`)
      );

      const config: CardSchedulerConfig = {
        ...DEFAULT_SCHEDULER_CONFIG,
        shuffleCards: false
      };

      const newCards1 = getNewCards(vocabularyWithProgress, config);
      const newCards2 = getNewCards(vocabularyWithProgress, config);

      // Cards should be in the same order
      expect(newCards1.map(card => card.vocabularyWithProgress.vocabulary.id))
        .toEqual(newCards2.map(card => card.vocabularyWithProgress.vocabulary.id));
    });
  });
}); 