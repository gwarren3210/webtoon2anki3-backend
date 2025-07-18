/**
 * FSRS Study Session Manager
 *
 * This file orchestrates an active study session. It uses the CardScheduler to
 * build a deck, manages the queue of cards to be reviewed, processes user
 * grades using the FSRS algorithm, and tracks session-specific statistics.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  FSRSProgress,
  FSRSRating,
  processFSRSReview,
  createInitialFSRSProgress,
  FSRSReviewLog,
} from '../fsrs';
import {
  Card,
  SessionState,
  ProgressStats,
  StudySession as StudySessionData,
  SessionQueues
} from './types';
import { CardScheduler } from './cardScheduler';
import { isCardDue, daysUntilReview } from './progressTracker';
import { FSRSState } from '../fsrs/types';
import log from 'encore.dev/log';

export class ActiveStudySession {
  private state: SessionState;
  private queues: SessionQueues;
  private allCards: Card[];
  private bucketOrder: (FSRSState)[] = [
    FSRSState.Learning,
    FSRSState.Review,
    FSRSState.New,
    FSRSState.Relearning
  ];
  private bucketIndex: number = 0;

  constructor(
    userId: string,
    sessionId: string,
    deckPublicId: string,
    cards: Card[],
  ) {
    log.info('[ActiveStudySession] constructor called', { userId, sessionId, deckPublicId, cardsLength: cards.length });
    const scheduler = new CardScheduler(cards);
    this.queues = scheduler.createSessionBuckets();
    log.info('[ActiveStudySession] Queues initialized', Object.fromEntries(Object.entries(this.queues).map(([k, v]) => [k, Array.isArray(v) ? v.length : 'not array'])));
    this.allCards = scheduler.createSessionDeck();
    this.state = {
      id: sessionId,
      userId,
      deckPublicId,
      queues: this.queues,
      stats: {
        reviewed: 0,
        correctCount: 0,
        totalCards: this.allCards.length,
        grades: [],
      },
      currentCard: null,
      reviewHistory: [],
      cardRatings: {},
      isComplete: false,
      createdAt: new Date(),
      lastActive: new Date(),
      allCards: cards, // persist original cards
    };
    this.getNextCard();
  }

  /**
   * Retrieves the current state of the session.
   */
  public getState(): SessionState {
    return this.state;
  }

  /**
   * Draws the next card from the buckets using round robin.
   */
  public getNextCard(): Card | null {
    log.info('[ActiveStudySession] getNextCard called', { bucketOrder: this.bucketOrder, bucketIndex: this.bucketIndex });
    const buckets = this.queues;
    for (let i = 0; i < this.bucketOrder.length; i++) {
      const bucketName = this.bucketOrder[this.bucketIndex];
      this.bucketIndex = (this.bucketIndex + 1) % this.bucketOrder.length;
      log.info('[ActiveStudySession] Checking bucket', { bucketName, bucket: buckets[bucketName] });
      if (buckets[bucketName] && buckets[bucketName].length > 0) {
        const card = buckets[bucketName].shift()!;
        log.info('[ActiveStudySession] Card drawn from bucket', { bucketName, card });
        this.state.currentCard = card;
        return card;
      }
    }
    log.info('[ActiveStudySession] No cards left in any bucket');
    this.state.currentCard = null;
    return null;
  }

  /**
   * Grades the current card and re-inserts if due again today.
   */
  public gradeCard(rating: FSRSRating): { updatedProgress: FSRSProgress, reviewLog: FSRSReviewLog } | null {
    log.info('[ActiveStudySession] gradeCard called', { rating, currentCard: this.state.currentCard });
    const currentCard = this.state.currentCard;
    if (!currentCard) {
      log.warn('[ActiveStudySession] No current card to grade');
      return null;
    }
    const { updatedProgress, reviewLog } = processFSRSReview(
      currentCard.studyProgress,
      rating
    );
    // Update card's progress in queues
    currentCard.studyProgress = updatedProgress;
    // Update session stats
    this.state.stats.reviewed++;
    this.state.stats.grades.push(rating);
    this.state.lastActive = new Date();
    // --- New: Update reviewHistory ---
    this.state.reviewHistory.push({
      cardId: currentCard.id,
      rating,
      reviewedAt: new Date().toISOString(),
      // Optionally add responseTime, etc.
    });
    // --- New: Update cardRatings ---
    if (!this.state.cardRatings[currentCard.id]) {
      log.info('[ActiveStudySession] Initializing cardRatings array', { cardId: currentCard.id });
      this.state.cardRatings[currentCard.id] = [];
    }
    this.state.cardRatings[currentCard.id].push(rating);
    // If card is due again today, re-insert into the correct bucket
    const now = new Date();
    const due = new Date(updatedProgress.due);
    const validBuckets = [FSRSState.New, FSRSState.Learning, FSRSState.Review, FSRSState.Relearning, 'Mistakes'];
    let bucketKey = updatedProgress.state;
    if (!validBuckets.includes(bucketKey)) {
      log.error('[ActiveStudySession] Invalid bucket key for graded card, assigning to Learning', { cardId: currentCard.id, state: updatedProgress.state });
      bucketKey = FSRSState.Learning;
    }
    if ((due.getTime() - now.getTime()) < 24 * 60 * 60 * 1000) {
      log.info('[ActiveStudySession] Card is due again today', { cardId: currentCard.id, state: updatedProgress.state });
      if (!Array.isArray(this.queues[bucketKey])) {
        log.error('[ActiveStudySession] Queue is not an array', { state: bucketKey, queue: this.queues[bucketKey] });
        this.queues[bucketKey] = [];
      }
      this.queues[bucketKey].push(currentCard);
    }
    // Draw next card
    this.getNextCard();
    // --- New: Set isComplete if finished ---
    this.state.isComplete = this.isFinished();
    return { updatedProgress, reviewLog };
  }

  /**
   * Checks if the study session is complete.
   */
  public isFinished(): boolean {
    return this.bucketOrder.every(bucket => (this.queues[bucket] || []).length === 0) && this.state.currentCard === null;
  }

  /**
   * Re-hydrates an ActiveStudySession instance from a stored state.
   * @param state - The SessionState object from a store.
   * @returns A new instance of ActiveStudySession.
   */
  public static fromState(state: SessionState): ActiveStudySession {
    // Rehydrate queues from state
    const cards = state.allCards || [];
    const session = new ActiveStudySession(state.userId, state.id, state.deckPublicId, cards);
    session.state = state;
    session.queues = state.queues;
    return session;
  }
}

/**
 * Study Session Management
 * 
 * This file implements study session management functionality including
 * creating, ending, pausing, and resuming study sessions.
 */

import { StudySession, StudySessionConfig, StudyStats } from './types';

/**
 * Error types for study session management
 */
export class StudySessionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'StudySessionError';
  }
}

/**
 * Input validation for study session parameters
 */
function validateSessionConfig(config: StudySessionConfig): void {
  if (!config) {
    throw new StudySessionError('Session configuration is required', 'MISSING_CONFIG');
  }

  if (config.maxNewCards < 0) {
    throw new StudySessionError(
      `Invalid maxNewCards: ${config.maxNewCards}. Must be non-negative`,
      'INVALID_MAX_NEW_CARDS'
    );
  }

  if (config.maxReviewCards < 0) {
    throw new StudySessionError(
      `Invalid maxReviewCards: ${config.maxReviewCards}. Must be non-negative`,
      'INVALID_MAX_REVIEW_CARDS'
    );
  }

  if (config.maxSessionDuration !== undefined && config.maxSessionDuration <= 0) {
    throw new StudySessionError(
      `Invalid maxSessionDuration: ${config.maxSessionDuration}. Must be positive`,
      'INVALID_MAX_SESSION_DURATION'
    );
  }

  if (!config.includeNewCards && !config.includeReviewCards && !config.includeLearningCards) {
    throw new StudySessionError(
      'At least one card type must be included in the session',
      'NO_CARD_TYPES_INCLUDED'
    );
  }
}

/**
 * Validates study session data
 */
function validateStudySession(session: StudySession): void {
  if (!session) {
    throw new StudySessionError('Study session is required', 'MISSING_SESSION');
  }

  if (!session.id) {
    throw new StudySessionError('Session ID is required', 'MISSING_SESSION_ID');
  }

  if (!session.userId) {
    throw new StudySessionError('User ID is required', 'MISSING_USER_ID');
  }

  if (!session.startTime) {
    throw new StudySessionError('Start time is required', 'MISSING_START_TIME');
  }

  if (session.cardsStudied < 0) {
    throw new StudySessionError(
      `Invalid cardsStudied: ${session.cardsStudied}. Must be non-negative`,
      'INVALID_CARDS_STUDIED'
    );
  }

  if (session.correctAnswers < 0) {
    throw new StudySessionError(
      `Invalid correctAnswers: ${session.correctAnswers}. Must be non-negative`,
      'INVALID_CORRECT_ANSWERS'
    );
  }

  if (session.incorrectAnswers < 0) {
    throw new StudySessionError(
      `Invalid incorrectAnswers: ${session.incorrectAnswers}. Must be non-negative`,
      'INVALID_INCORRECT_ANSWERS'
    );
  }

  if (session.correctAnswers + session.incorrectAnswers > session.cardsStudied) {
    throw new StudySessionError(
      'Sum of correct and incorrect answers cannot exceed total cards studied',
      'INVALID_ANSWER_COUNT'
    );
  }

  if (session.endTime && session.startTime > session.endTime) {
    throw new StudySessionError(
      'End time cannot be before start time',
      'INVALID_TIME_RANGE'
    );
  }
}

/**
 * Creates a new study session
 * 
 * @param userId - ID of the user creating the session
 * @param config - Session configuration
 * @returns New study session object
 */
export function createStudySession(userId: string, config: StudySessionConfig): StudySession {
  // Validate inputs
  if (!userId) {
    throw new StudySessionError('User ID is required', 'MISSING_USER_ID');
  }

  validateSessionConfig(config);

  // TODO: Generate session ID (in a real app, this would come from the database)
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Create new session
  const session: StudySession = {
    id,
    userId,
    startTime: new Date(),
    cardsStudied: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    sessionType: determineSessionType(config),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return session;
}

/**
 * Ends a study session
 * 
 * @param session - Current study session
 * @returns Updated study session with end time and duration
 */
export function endStudySession(session: StudySession): StudySession {
  // Validate session
  validateStudySession(session);

  if (!session.isActive) {
    throw new StudySessionError(
      'Cannot end an inactive session',
      'SESSION_ALREADY_ENDED'
    );
  }

  if (session.endTime) {
    throw new StudySessionError(
      'Session already has an end time',
      'SESSION_ALREADY_ENDED'
    );
  }

  // Calculate session duration
  const endTime = new Date();
  const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

  // Update session
  const updatedSession: StudySession = {
    ...session,
    endTime,
    duration,
    isActive: false,
    updatedAt: new Date()
  };

  return updatedSession;
}

/**
 * Pauses a study session
 * 
 * @param session - Current study session
 * @returns Updated study session marked as paused
 */
export function pauseStudySession(session: StudySession): StudySession {
  // Validate session
  validateStudySession(session);

  if (!session.isActive) {
    throw new StudySessionError(
      'Cannot pause an inactive session',
      'SESSION_NOT_ACTIVE'
    );
  }

  // Update session to indicate it's paused
  // Note: In a real implementation, you might want to store pause state separately
  const updatedSession: StudySession = {
    ...session,
    isActive: false, // Mark as inactive when paused
    updatedAt: new Date()
  };

  return updatedSession;
}

/**
 * Resumes a paused study session
 * 
 * @param session - Current study session
 * @returns Updated study session marked as active
 */
export function resumeStudySession(session: StudySession): StudySession {
  // Validate session
  validateStudySession(session);

  if (session.isActive) {
    throw new StudySessionError(
      'Cannot resume an active session',
      'SESSION_ALREADY_ACTIVE'
    );
  }

  if (session.endTime) {
    throw new StudySessionError(
      'Cannot resume an ended session',
      'SESSION_ALREADY_ENDED'
    );
  }

  // Update session to indicate it's active again
  const updatedSession: StudySession = {
    ...session,
    isActive: true,
    updatedAt: new Date()
  };

  return updatedSession;
}

/**
 * Updates session statistics when a card is answered
 * 
 * @param session - Current study session
 * @param isCorrect - Whether the answer was correct
 * @returns Updated study session with new statistics
 */
export function updateSessionStats(session: StudySession, isCorrect: boolean): StudySession {
  // Validate session
  validateStudySession(session);

  if (!session.isActive) {
    throw new StudySessionError(
      'Cannot update stats for an inactive session',
      'SESSION_NOT_ACTIVE'
    );
  }

  // Update statistics
  const updatedSession: StudySession = {
    ...session,
    cardsStudied: session.cardsStudied + 1,
    correctAnswers: session.correctAnswers + (isCorrect ? 1 : 0),
    incorrectAnswers: session.incorrectAnswers + (isCorrect ? 0 : 1),
    updatedAt: new Date()
  };

  return updatedSession;
}

/**
 * Calculates session statistics
 * 
 * @param session - Study session
 * @returns Session statistics
 */
export function calculateSessionStats(session: StudySession): {
  accuracy: number;
  averageResponseTime?: number;
  sessionDuration: number;
} {
  // Validate session
  validateStudySession(session);

  // Calculate accuracy
  const accuracy = session.cardsStudied > 0 
    ? (session.correctAnswers / session.cardsStudied) * 100 
    : 0;

  // Calculate session duration
  const endTime = session.endTime || new Date();
  const sessionDuration = Math.floor(
    (endTime.getTime() - session.startTime.getTime()) / 1000
  );

  return {
    accuracy: Math.round(accuracy * 100) / 100, // Round to 2 decimal places
    sessionDuration
  };
}

/**
 * Determines session type based on configuration
 * 
 * @param config - Session configuration
 * @returns Session type
 */
function determineSessionType(config: StudySessionConfig): 'new' | 'review' | 'mixed' {
  const hasNewCards = config.includeNewCards;
  const hasReviewCards = config.includeReviewCards;
  const hasLearningCards = config.includeLearningCards;

  if (hasNewCards && !hasReviewCards && !hasLearningCards) {
    return 'new';
  } else if (!hasNewCards && hasReviewCards && !hasLearningCards) {
    return 'review';
  } else {
    return 'mixed';
  }
}

/**
 * Validates if a session can be continued
 * 
 * @param session - Current study session
 * @param config - Session configuration
 * @returns Whether the session can continue
 */
export function canContinueSession(session: StudySession, config: StudySessionConfig): boolean {
  // Validate inputs
  validateStudySession(session);
  validateSessionConfig(config);

  // Check if session is active
  if (!session.isActive) {
    return false;
  }

  // Check if session has ended
  if (session.endTime) {
    return false;
  }

  // Check session duration limit
  if (config.maxSessionDuration) {
    const currentDuration = Math.floor(
      (new Date().getTime() - session.startTime.getTime()) / 1000 / 60
    );
    if (currentDuration >= config.maxSessionDuration) {
      return false;
    }
  }

  // Check card limits
  if (config.maxNewCards && session.cardsStudied >= config.maxNewCards) {
    return false;
  }

  if (config.maxReviewCards && session.cardsStudied >= config.maxReviewCards) {
    return false;
  }

  return true;
}

/**
 * Gets session summary for display
 * 
 * @param session - Study session
 * @returns Formatted session summary
 */
export function getSessionSummary(session: StudySession): {
  duration: string;
  accuracy: string;
  cardsStudied: number;
  correctAnswers: number;
  incorrectAnswers: number;
} {
  // Validate session
  validateStudySession(session);

  const stats = calculateSessionStats(session);
  
  // Format duration
  const minutes = Math.floor(stats.sessionDuration / 60);
  const seconds = stats.sessionDuration % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Format accuracy
  const accuracy = `${stats.accuracy}%`;

  return {
    duration,
    accuracy,
    cardsStudied: session.cardsStudied,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers
  };
} 