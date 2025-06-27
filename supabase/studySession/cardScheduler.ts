/**
 * Card Scheduler
 * 
 * This file implements algorithms for determining which cards to study,
 * including prioritization logic and daily limits.
 */

import { StudyState, VocabularyWithProgress } from './types';
import { isCardDue, daysUntilReview } from './srsAlgorithm';

/**
 * Error types for card scheduler
 */
export class CardSchedulerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CardSchedulerError';
  }
}

/**
 * Configuration for card scheduling
 */
export interface CardSchedulerConfig {
  /** Maximum number of new cards per day */
  maxNewCardsPerDay: number;
  /** Maximum number of review cards per day */
  maxReviewCardsPerDay: number;
  /** Maximum number of learning cards per day */
  maxLearningCardsPerDay: number;
  /** Whether to prioritize overdue cards */
  prioritizeOverdue: boolean;
  /** Whether to shuffle cards */
  shuffleCards: boolean;
  /** Whether to include mastered cards in reviews */
  includeMasteredCards: boolean;
}

/**
 * Default configuration for card scheduling
 */
export const DEFAULT_SCHEDULER_CONFIG: CardSchedulerConfig = {
  maxNewCardsPerDay: 20,
  maxReviewCardsPerDay: 100,
  maxLearningCardsPerDay: 50,
  prioritizeOverdue: true,
  shuffleCards: true,
  includeMasteredCards: false
};

/**
 * Card priority levels for scheduling
 */
export enum CardPriority {
  /** Overdue cards (highest priority) */
  OVERDUE = 0,
  /** Due today */
  DUE_TODAY = 1,
  /** Learning cards */
  LEARNING = 2,
  /** New cards */
  NEW = 3,
  /** Future due cards (lowest priority) */
  FUTURE = 4
}

/**
 * Represents a card with its priority for scheduling
 */
export interface ScheduledCard {
  /** Vocabulary with progress */
  vocabularyWithProgress: VocabularyWithProgress;
  /** Priority level for scheduling */
  priority: CardPriority;
  /** Days until review (negative if overdue) */
  daysUntilReview: number;
  /** Whether this card is due */
  isDue: boolean;
}

/**
 * Card Scheduler class for managing study deck creation and prioritization
 */
export class CardScheduler {
  private config: CardSchedulerConfig;

  constructor(config: CardSchedulerConfig = DEFAULT_SCHEDULER_CONFIG) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Gets the current configuration
   */
  getConfig(): CardSchedulerConfig {
    return { ...this.config };
  }

  /**
   * Updates the configuration
   */
  updateConfig(newConfig: Partial<CardSchedulerConfig>): void {
    const updatedConfig = { ...this.config, ...newConfig };
    this.validateConfig(updatedConfig);
    this.config = updatedConfig;
  }

  /**
   * Input validation for card scheduler parameters
   */
  private validateConfig(config: CardSchedulerConfig): void {
    if (!config) {
      throw new CardSchedulerError('Scheduler configuration is required', 'MISSING_CONFIG');
    }

    if (config.maxNewCardsPerDay < 0) {
      throw new CardSchedulerError(
        `Invalid maxNewCardsPerDay: ${config.maxNewCardsPerDay}. Must be non-negative`,
        'INVALID_MAX_NEW_CARDS'
      );
    }

    if (config.maxReviewCardsPerDay < 0) {
      throw new CardSchedulerError(
        `Invalid maxReviewCardsPerDay: ${config.maxReviewCardsPerDay}. Must be non-negative`,
        'INVALID_MAX_REVIEW_CARDS'
      );
    }

    if (config.maxLearningCardsPerDay < 0) {
      throw new CardSchedulerError(
        `Invalid maxLearningCardsPerDay: ${config.maxLearningCardsPerDay}. Must be non-negative`,
        'INVALID_MAX_LEARNING_CARDS'
      );
    }
  }

  /**
   * Validates vocabulary with progress data
   */
  private validateVocabularyWithProgress(vocabularyWithProgress: VocabularyWithProgress): void {
    if (!vocabularyWithProgress) {
      throw new CardSchedulerError('Vocabulary with progress is required', 'MISSING_VOCABULARY');
    }

    if (!vocabularyWithProgress.vocabulary) {
      throw new CardSchedulerError('Vocabulary data is required', 'MISSING_VOCABULARY_DATA');
    }

    if (!vocabularyWithProgress.vocabulary.id) {
      throw new CardSchedulerError('Vocabulary ID is required', 'MISSING_VOCABULARY_ID');
    }
  }

  /**
   * Calculates card priority based on its state and due status
   */
  private calculateCardPriority(vocabularyWithProgress: VocabularyWithProgress): CardPriority {
    const { studyProgress, isDue, daysUntilReview } = vocabularyWithProgress;

    // If no study progress, it's a new card
    if (!studyProgress) {
      return CardPriority.NEW;
    }

    // Check if card is overdue
    if (daysUntilReview < 0) {
      return CardPriority.OVERDUE;
    }

    // Check if card is due today
    if (isDue) {
      return CardPriority.DUE_TODAY;
    }

    // Check card state
    switch (studyProgress.state) {
      case StudyState.LEARNING:
        return CardPriority.LEARNING;
      case StudyState.NEW:
        return CardPriority.NEW;
      case StudyState.REVIEWING:
      case StudyState.MASTERED:
        return CardPriority.FUTURE;
      default:
        return CardPriority.FUTURE;
    }
  }

  /**
   * Shuffles an array of cards using Fisher-Yates algorithm
   */
  private shuffleCards<T>(cards: T[]): T[] {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Gets all cards that are due for review
   */
  getDueCards(vocabularyWithProgress: VocabularyWithProgress[]): ScheduledCard[] {
    // Validate inputs
    if (!Array.isArray(vocabularyWithProgress)) {
      throw new CardSchedulerError('Vocabulary with progress must be an array', 'INVALID_INPUT');
    }

    // Filter for due cards
    const dueCards = vocabularyWithProgress
      .filter(vwp => {
        this.validateVocabularyWithProgress(vwp);
        
        // Skip cards without progress (they're new, not due)
        if (!vwp.studyProgress) {
          return false;
        }

        // Skip mastered cards if not included
        if (!this.config.includeMasteredCards && vwp.studyProgress.state === StudyState.MASTERED) {
          return false;
        }

        return vwp.isDue;
      })
      .map(vwp => ({
        vocabularyWithProgress: vwp,
        priority: this.calculateCardPriority(vwp),
        daysUntilReview: vwp.daysUntilReview,
        isDue: vwp.isDue
      }));

    // Sort by priority, then by id for deterministic order
    dueCards.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.daysUntilReview !== b.daysUntilReview) {
        return a.daysUntilReview - b.daysUntilReview;
      }
      // Deterministic order for tests
      return a.vocabularyWithProgress.vocabulary.id.localeCompare(b.vocabularyWithProgress.vocabulary.id);
    });

    // Apply daily limits
    const limitedCards = this.applyDailyLimits(dueCards);

    // Shuffle if enabled
    if (this.config.shuffleCards) {
      return this.shuffleCards(limitedCards);
    }

    return limitedCards;
  }

  /**
   * Gets new cards that haven't been studied yet
   */
  getNewCards(vocabularyWithProgress: VocabularyWithProgress[]): ScheduledCard[] {
    // Validate inputs
    if (!Array.isArray(vocabularyWithProgress)) {
      throw new CardSchedulerError('Vocabulary with progress must be an array', 'INVALID_INPUT');
    }

    // Filter for new cards (no study progress)
    const newCards = vocabularyWithProgress
      .filter(vwp => {
        this.validateVocabularyWithProgress(vwp);
        return !vwp.studyProgress; // No progress means new card
      })
      .map(vwp => ({
        vocabularyWithProgress: vwp,
        priority: CardPriority.NEW,
        daysUntilReview: 0, // New cards are available immediately
        isDue: true // New cards are always "due"
      }));

    // Sort new cards by id for deterministic order
    newCards.sort((a, b) => a.vocabularyWithProgress.vocabulary.id.localeCompare(b.vocabularyWithProgress.vocabulary.id));

    // Apply daily limit for new cards
    const limitedCards = newCards.slice(0, this.config.maxNewCardsPerDay);

    // Shuffle if enabled
    if (this.config.shuffleCards) {
      return this.shuffleCards(limitedCards);
    }

    return limitedCards;
  }

  /**
   * Gets learning cards (cards in the learning phase)
   */
  getLearningCards(vocabularyWithProgress: VocabularyWithProgress[]): ScheduledCard[] {
    // Validate inputs
    if (!Array.isArray(vocabularyWithProgress)) {
      throw new CardSchedulerError('Vocabulary with progress must be an array', 'INVALID_INPUT');
    }

    // Filter for learning cards
    const learningCards = vocabularyWithProgress
      .filter(vwp => {
        this.validateVocabularyWithProgress(vwp);
        
        return vwp.studyProgress?.state === StudyState.LEARNING;
      })
      .map(vwp => ({
        vocabularyWithProgress: vwp,
        priority: this.calculateCardPriority(vwp),
        daysUntilReview: vwp.daysUntilReview,
        isDue: vwp.isDue
      }));

    // Sort by priority, then by id for deterministic order
    learningCards.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.daysUntilReview !== b.daysUntilReview) {
        return a.daysUntilReview - b.daysUntilReview;
      }
      return a.vocabularyWithProgress.vocabulary.id.localeCompare(b.vocabularyWithProgress.vocabulary.id);
    });

    // Apply daily limit for learning cards
    const limitedCards = learningCards.slice(0, this.config.maxLearningCardsPerDay);

    // Shuffle if enabled
    if (this.config.shuffleCards) {
      return this.shuffleCards(limitedCards);
    }

    return limitedCards;
  }

  /**
   * Gets review cards (cards in the review phase)
   */
  getReviewCards(vocabularyWithProgress: VocabularyWithProgress[]): ScheduledCard[] {
    // Validate inputs
    if (!Array.isArray(vocabularyWithProgress)) {
      throw new CardSchedulerError('Vocabulary with progress must be an array', 'INVALID_INPUT');
    }

    // Filter for review cards
    const reviewCards = vocabularyWithProgress
      .filter(vwp => {
        this.validateVocabularyWithProgress(vwp);
        
        const state = vwp.studyProgress?.state;
        return state === StudyState.REVIEWING || 
               (state === StudyState.MASTERED && this.config.includeMasteredCards);
      })
      .map(vwp => ({
        vocabularyWithProgress: vwp,
        priority: this.calculateCardPriority(vwp),
        daysUntilReview: vwp.daysUntilReview,
        isDue: vwp.isDue
      }));

    // Sort by priority, then by id for deterministic order
    reviewCards.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.daysUntilReview !== b.daysUntilReview) {
        return a.daysUntilReview - b.daysUntilReview;
      }
      return a.vocabularyWithProgress.vocabulary.id.localeCompare(b.vocabularyWithProgress.vocabulary.id);
    });

    // Apply daily limit for review cards
    const limitedCards = reviewCards.slice(0, this.config.maxReviewCardsPerDay);

    // Shuffle if enabled
    if (this.config.shuffleCards) {
      return this.shuffleCards(limitedCards);
    }

    return limitedCards;
  }

  /**
   * Applies daily limits to cards based on their type
   */
  private applyDailyLimits(cards: ScheduledCard[]): ScheduledCard[] {
    const newCards = cards.filter(card => !card.vocabularyWithProgress.studyProgress);
    const learningCards = cards.filter(card => 
      card.vocabularyWithProgress.studyProgress?.state === StudyState.LEARNING
    );
    const reviewCards = cards.filter(card => 
      card.vocabularyWithProgress.studyProgress?.state === StudyState.REVIEWING ||
      card.vocabularyWithProgress.studyProgress?.state === StudyState.MASTERED
    );

    // Apply limits
    const limitedNewCards = newCards.slice(0, this.config.maxNewCardsPerDay);
    const limitedLearningCards = learningCards.slice(0, this.config.maxLearningCardsPerDay);
    const limitedReviewCards = reviewCards.slice(0, this.config.maxReviewCardsPerDay);

    // Combine and maintain original order
    const limitedCards: ScheduledCard[] = [];
    const allCards = [...limitedNewCards, ...limitedLearningCards, ...limitedReviewCards];

    // Re-sort by priority to maintain order
    allCards.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.daysUntilReview - b.daysUntilReview;
    });

    return allCards;
  }

  /**
   * Gets a mixed deck of cards for study based on configuration
   */
  getStudyDeck(vocabularyWithProgress: VocabularyWithProgress[]): ScheduledCard[] {
    // Validate inputs
    if (!Array.isArray(vocabularyWithProgress)) {
      throw new CardSchedulerError('Vocabulary with progress must be an array', 'INVALID_INPUT');
    }

    // Get all types of cards
    const dueCards = this.getDueCards(vocabularyWithProgress);
    const newCards = this.getNewCards(vocabularyWithProgress);
    const learningCards = this.getLearningCards(vocabularyWithProgress);
    const reviewCards = this.getReviewCards(vocabularyWithProgress);

    // Combine all cards
    const allCards = [...dueCards, ...newCards, ...learningCards, ...reviewCards];

    // Remove duplicates (cards might appear in multiple categories)
    const uniqueCards = allCards.filter((card, index, self) => 
      index === self.findIndex(c => 
        c.vocabularyWithProgress.vocabulary.id === card.vocabularyWithProgress.vocabulary.id
      )
    );

    // Sort by priority
    uniqueCards.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.daysUntilReview - b.daysUntilReview;
    });

    return uniqueCards;
  }

  /**
   * Gets study statistics for the current deck
   */
  getStudyStats(vocabularyWithProgress: VocabularyWithProgress[]): {
    totalCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
    dueCards: number;
    overdueCards: number;
    masteredCards: number;
  } {
    // Validate inputs
    if (!Array.isArray(vocabularyWithProgress)) {
      throw new CardSchedulerError('Vocabulary with progress must be an array', 'INVALID_INPUT');
    }

    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;
    let dueCards = 0;
    let overdueCards = 0;
    let masteredCards = 0;

    vocabularyWithProgress.forEach(vwp => {
      if (!vwp.studyProgress) {
        newCards++;
      } else {
        switch (vwp.studyProgress.state) {
          case StudyState.LEARNING:
            learningCards++;
            break;
          case StudyState.REVIEWING:
            reviewCards++;
            break;
          case StudyState.MASTERED:
            masteredCards++;
            break;
          default:
            break;
        }

        if (vwp.isDue) {
          dueCards++;
          if (vwp.daysUntilReview < 0) {
            overdueCards++;
          }
        }
      }
    });

    return {
      totalCards: vocabularyWithProgress.length,
      newCards,
      learningCards,
      reviewCards,
      dueCards,
      overdueCards,
      masteredCards
    };
  }
}

// Legacy function exports for backward compatibility
export function getDueCards(
  vocabularyWithProgress: VocabularyWithProgress[],
  config: CardSchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): ScheduledCard[] {
  const scheduler = new CardScheduler(config);
  return scheduler.getDueCards(vocabularyWithProgress);
}

export function getNewCards(
  vocabularyWithProgress: VocabularyWithProgress[],
  config: CardSchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): ScheduledCard[] {
  const scheduler = new CardScheduler(config);
  return scheduler.getNewCards(vocabularyWithProgress);
}

export function getLearningCards(
  vocabularyWithProgress: VocabularyWithProgress[],
  config: CardSchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): ScheduledCard[] {
  const scheduler = new CardScheduler(config);
  return scheduler.getLearningCards(vocabularyWithProgress);
}

export function getReviewCards(
  vocabularyWithProgress: VocabularyWithProgress[],
  config: CardSchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): ScheduledCard[] {
  const scheduler = new CardScheduler(config);
  return scheduler.getReviewCards(vocabularyWithProgress);
}

export function getStudyDeck(
  vocabularyWithProgress: VocabularyWithProgress[],
  config: CardSchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): ScheduledCard[] {
  const scheduler = new CardScheduler(config);
  return scheduler.getStudyDeck(vocabularyWithProgress);
}

export function getStudyStats(
  vocabularyWithProgress: VocabularyWithProgress[],
  config: CardSchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  dueCards: number;
  overdueCards: number;
  masteredCards: number;
} {
  const scheduler = new CardScheduler(config);
  return scheduler.getStudyStats(vocabularyWithProgress);
} 