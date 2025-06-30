/**
 * FSRS (Free Spaced Repetition Scheduler) Algorithm
 * 
 * This file contains the core logic for interacting with the `ts-fsrs` library.
 * It handles creating new progress records, processing reviews, and mapping
 * between our application's data structures and the FSRS engine's `Card` type.
 */
import {
  fsrs,
  FSRS,
  Card,
  Rating,
  Grade,
  createEmptyCard,
  RecordLog,
  FSRSParameters as TsFSRSParameters
} from 'ts-fsrs';
import { v4 as uuidv4 } from 'uuid';
import { FSRSProgress, FSRSReviewLog, FSRSRating, FSRSParameters, defaultFSRSParameters } from './types';

// --- Mappers ---

/**
 * Maps our internal FSRSProgress object to a `ts-fsrs` Card object.
 * @param progress - The FSRSProgress object from our database.
 * @returns A Card object compatible with the `ts-fsrs` library.
 */
function toFsrsCard(progress: FSRSProgress): Card {
  return {
    due: progress.due,
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsed_days,
    scheduled_days: progress.scheduled_days,
    reps: progress.reps,
    lapses: progress.lapses,
    state: progress.state,
    last_review: progress.last_review,
    learning_steps: progress.learning_steps,
  };
}

/**
 * Maps a `ts-fsrs` Card object back to our internal FSRSProgress object.
 * @param card - The Card object from the `ts-fsrs` library.
 * @param existingProgress - The existing progress record to update.
 * @returns An updated FSRSProgress object.
 */
function fromFsrsCard(card: Card, existingProgress: FSRSProgress): FSRSProgress {
  return {
    ...existingProgress,
    ...card,
    updatedAt: new Date(),
  };
}


// --- Core SRS Functions ---

/**
 * Creates an initial FSRSProgress record for a new vocabulary item.
 * @param userId - The ID of the user.
 * @param vocabularyId - The ID of the vocabulary item.
 * @returns A new FSRSProgress object, ready to be saved.
 */
export function createInitialFSRSProgress(userId: string, vocabularyId: string): FSRSProgress {
  const now = new Date();
  const emptyCard = createEmptyCard(now);
  
  return {
    id: uuidv4(),
    userId,
    vocabularyId,
    ...emptyCard,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Processes a user's review of a card and returns the updated progress and review log.
 * @param progress - The current study progress of the card.
 * @param rating - The user's rating for the card (Again, Hard, Good, Easy).
 * @param params - Optional FSRS parameters to use for this review.
 * @returns An object containing the updated progress and the generated review log.
 */
export function processFSRSReview(
  progress: FSRSProgress,
  rating: FSRSRating,
  params: FSRSParameters = defaultFSRSParameters,
): { updatedProgress: FSRSProgress; reviewLog: FSRSReviewLog } {
  const scheduler: FSRS = fsrs(params as unknown as TsFSRSParameters);
  const now = new Date();

  // Get all possible scheduling results from FSRS
  const scheduling_cards: RecordLog = scheduler.repeat(toFsrsCard(progress), now);
  
  if (rating === Rating.Manual) {
    throw new Error('Manual rating is not a valid review rating.');
  }
  // Select the result corresponding to the user's rating
  const result = scheduling_cards[rating as Grade];
  if (!result) {
    throw new Error(`Invalid FSRS rating provided: ${rating}`);
  }

  // Map the FSRS result back to our internal types
  const updatedProgress = fromFsrsCard(result.card, progress);
  
  const reviewLog: FSRSReviewLog = {
    id: uuidv4(),
    progressId: progress.id,
    userId: progress.userId,
    ...result.log
  };

  return { updatedProgress, reviewLog };
} 