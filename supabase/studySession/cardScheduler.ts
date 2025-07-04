/**
 * FSRS Card Scheduler
 * 
 * This file is responsible for selecting and ordering cards for a study session
 * based on FSRS progress data and session configuration.
 */
import { FSRSProgress, FSRSState } from '../fsrs';
import { VocabularyWithProgress, Card, SessionQueues } from './types';
import { isCardDue } from './progressTracker';
import { FSRSState as FSRSStateType } from '../fsrs/types';

const DEFAULT_SESSION_SIZE = 50;
const NEW_CARD_PENALTY = 1000; // Arbitrary high penalty to sort new cards last

export class CardScheduler {
  private cards: VocabularyWithProgress[];
  private config: {
    maxCards: number;
    // Future config options can be added here
  };

  constructor(
    cards: VocabularyWithProgress[],
    config: { maxCards?: number } = {}
  ) {
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
    const sessionVwps = sortedCards.slice(0, this.config.maxCards);
    
    // Map VocabularyWithProgress to the session Card type
    return sessionVwps.map(vwp => ({
      id: vwp.vocabulary.id,
      korean: vwp.vocabulary.korean,
      english: vwp.vocabulary.english,
      importanceScore: vwp.vocabulary.importanceScore,
      // Ensure studyProgress is not undefined, though sorting should handle this
      studyProgress: vwp.studyProgress!,
    }));
  }
  
  /**
   * Sorts cards based on their FSRS state and due date.
   * The order of priority is:
   * 1. Learning cards (due soonest)
   * 2. Overdue Review cards (most overdue first)
   * 3. New cards (based on importance score or other metric)
   * 4. Due Today Review cards
   * @returns A sorted array of `VocabularyWithProgress`.
   */
  private sortCards(): VocabularyWithProgress[] {
    return this.cards
      .map(vwp => ({
        ...vwp,
        // Ensure every card has progress for sorting; new cards get a placeholder
        studyProgress: vwp.studyProgress || this.createPlaceholderProgress(vwp.vocabulary.id)
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
    const dueDate = progress.due.getTime();
    const daysOverdue = Math.max(0, (now - dueDate) / (1000 * 3600 * 24));

    switch (progress.state) {
      case FSRSStateType.Learning:
      case FSRSStateType.Relearning:
        // Highest priority, sorted by due date
        return dueDate;
      
      case FSRSStateType.Review:
        if (dueDate < now) {
          // Overdue reviews, prioritized by how overdue they are
          return now - daysOverdue * 100000; // Heavily weight overdue cards
        } else {
          // Reviews due today or in the future, sorted by due date
          return dueDate + 1e12; // Push non-overdue reviews to the back
        }

      case FSRSStateType.New:
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
      state: FSRSStateType.New,
      learning_steps: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Creates session buckets (queues) for the bucket-based session logic.
   * @returns {SessionQueues} Buckets of cards by learning state.
   */
  public createSessionBuckets(): SessionQueues {
    const buckets: SessionQueues = {
      [FSRSStateType.New]: [],
      [FSRSStateType.Learning]: [],
      [FSRSStateType.Review]: [],
      [FSRSStateType.Relearning]: []
    };
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    for (const vwp of this.cards) {
      const progress = vwp.studyProgress || this.createPlaceholderProgress(vwp.vocabulary.id);
      const card: Card = {
        id: vwp.vocabulary.id,
        korean: vwp.vocabulary.korean,
        english: vwp.vocabulary.english,
        importanceScore: vwp.vocabulary.importanceScore,
        studyProgress: progress,
      };
      if (progress.state === FSRSStateType.New) {
        buckets[FSRSStateType.New].push(card);
      } else if (progress.due < tomorrow) {
        buckets[progress.state]?.push(card);
      }
    }
    return buckets;
  }
} 