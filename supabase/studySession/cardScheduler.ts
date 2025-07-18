/**
 * FSRS Card Scheduler
 * 
 * This file is responsible for selecting and ordering cards for a study session
 * based on FSRS progress data and session configuration.
 */
import { FSRSProgress, FSRSState } from '../fsrs';
import { Card, SessionQueues } from './types';
import { isCardDue } from './progressTracker';
import log from 'encore.dev/log';

const DEFAULT_SESSION_SIZE = 50;
const NEW_CARD_PENALTY = 1000; // Arbitrary high penalty to sort new cards last

export class CardScheduler {
  private cards: Card[];
  private config: {
    maxCards: number;
    // Future config options can be added here
  };

  constructor(
    cards: Card[],
    config: { maxCards?: number } = {}
  ) {
    log.info('[CardScheduler] constructor called', { cardsLength: cards.length, config });
    this.cards = cards;
    this.config = {
      maxCards: config.maxCards || DEFAULT_SESSION_SIZE,
    };
  }

  /**
   * Creates a prioritized and sorted list of cards for a study session.
   * @returns An array of `Card` objects ready for the session.
   */
  public createSessionDeck(): Card[] {
    const sortedCards = this.sortCards();
    return sortedCards.slice(0, this.config.maxCards);
  }
  
  /**
   * Sorts cards based on their FSRS state and due date.
   * The order of priority is:
   * 1. Learning cards (due soonest)
   * 2. Overdue Review cards (most overdue first)
   * 3. New cards (based on importance score or other metric)
   * 4. Due Today Review cards
   * @returns A sorted array of `Card`.
   */
  private sortCards(): Card[] {
    return this.cards
      .map(card => ({
        ...card,
        // Ensure every card has progress for sorting; new cards get a placeholder
        studyProgress: card.studyProgress || this.createPlaceholderProgress(card.id)
      }))
      .sort((a, b) => this.getSortPriority(a.studyProgress) - this.getSortPriority(b.studyProgress));
  }

  /**
   * Calculates a numeric priority for a card for sorting purposes.
   * Lower numbers have higher priority.
   * @param progress The card's FSRS progress.
   * @returns A numeric priority value.
   */
  private getSortPriority(progress: FSRSProgress): number {
    const now = new Date().getTime();
    if (progress.state === FSRSState.New) return now + 1e13 + (progress.id.charCodeAt(0) * NEW_CARD_PENALTY); 
    const dueDate = progress.due.getTime();
    const daysOverdue = Math.max(0, (now - dueDate) / (1000 * 3600 * 24));

    switch (progress.state) {
      case FSRSState.Learning:
      case FSRSState.Relearning:
        // Highest priority, sorted by due date
        return dueDate;
      
      case FSRSState.Review:
        if (dueDate < now) {
          // Overdue reviews, prioritized by how overdue they are
          return now - daysOverdue * 100000; // Heavily weight overdue cards
        } else {
          // Reviews due today or in the future, sorted by due date
          return dueDate + 1e12; // Push non-overdue reviews to the back
        }
      default:
        // New cards are sorted last, can be further prioritized by importance score
        return now + 1e13 + (progress.id.charCodeAt(0) * NEW_CARD_PENALTY); // Base sort on something arbitrary
    }
  }

  /**
   * Creates a temporary placeholder progress object for new cards
   * to allow them to be sorted correctly.
   */
  private createPlaceholderProgress(vocabId: string): FSRSProgress {
    const now = new Date();
    return {
      id: `new-${vocabId}`,
      userId: '',
      vocabularyId: vocabId,
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: FSRSState.New,
      learning_steps: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Creates session buckets (queues) for the bucket-based session logic.
   * @returns {SessionQueues} Buckets of cards by learning state.
   */
  public createSessionBuckets() {
    log.info('[CardScheduler] createSessionBuckets called', { cardsLength: this.cards.length });
    const buckets: SessionQueues = {
      New: [],
      Learning: [],
      Review: [],
      Relearning: [],
      Mistakes: [],
    };
    const now = new Date();
    //const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    for (const card of this.cards) {
      const progress = card.studyProgress || this.createPlaceholderProgress(card.id);
      let key = progress.state;
      // Expect key to be a number; if not, try to convert from string enum value
      if (typeof key === 'number') {
        key = Object.values(FSRSState)[key];
      } else {
        // Try to convert from string enum value to number
        log.warn('[CardScheduler] key id not number', { cardId: card.id, state: key, type: typeof key });
      }
      const validBuckets = [FSRSState.New, FSRSState.Learning, FSRSState.Review, FSRSState.Relearning, 'Mistakes'];
      if (!validBuckets.includes(key)) {
        log.error('[CardScheduler] Invalid bucket key for card, assigning to Learning', { cardId: card.id, state: progress.state });
        key = FSRSState.Learning;
      }
      log.info('[CardScheduler] Assigning card to bucket', { cardId: card.id, bucket: key });
      buckets[key].push(card);
    }
    log.info('[CardScheduler] Buckets created', { buckets });
    return buckets;
  }
} 