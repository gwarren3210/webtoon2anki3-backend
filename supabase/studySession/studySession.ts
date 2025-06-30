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
  VocabularyWithProgress
} from './types';
import { CardScheduler } from './cardScheduler';
import { isCardDue, daysUntilReview } from './progressTracker';

export class ActiveStudySession {
  private state: SessionState;
  private cardQueue: Card[] = [];

  constructor(
    userId: string,
    deckId: string,
    allCards: Card[], // These should be pre-populated with FSRSProgress
    scheduler: CardScheduler
  ) {
    this.cardQueue = scheduler.createSessionDeck();
    this.state = {
      sessionId: uuidv4(),
      userId,
      deckId,
      cards: allCards,
      progress: {
        reviewed: 0,
        grades: [],
      },
      currentCard: this.cardQueue[0] || null,
      createdAt: new Date(),
      lastActive: new Date(),
    };
  }

  /**
   * Retrieves the current state of the session.
   */
  public getState(): SessionState {
    return this.state;
  }

  /**
   * Gets the next card to be reviewed in the session.
   * @returns The next card, or null if the session is complete.
   */
  public getNextCard(): Card | null {
    if (this.cardQueue.length === 0) {
      this.state.currentCard = null;
      return null;
    }
    // Simple queue: take the first card. More complex logic (e.g., interleaving) can be added here.
    this.state.currentCard = this.cardQueue[0];
    return this.state.currentCard;
  }

  /**
   * Processes a user's grade for the current card, updates its progress,
   * and moves to the next card.
   * @param rating - The FSRSRating (Again, Hard, Good, Easy) given by the user.
   * @returns The updated progress for the reviewed card.
   */
  public gradeCard(rating: FSRSRating): { updatedProgress: FSRSProgress, reviewLog: FSRSReviewLog } | null {
    const currentCard = this.state.currentCard;
    if (!currentCard) {
      return null;
    }

    // Process the review using the FSRS algorithm
    const { updatedProgress, reviewLog } = processFSRSReview(
      currentCard.studyProgress,
      rating
    );

    // Update the card's progress within the session state
    const cardIndex = this.state.cards.findIndex(c => c.id === currentCard.id);
    if (cardIndex !== -1) {
      this.state.cards[cardIndex].studyProgress = updatedProgress;
    }

    // Update session stats
    this.state.progress.reviewed++;
    this.state.progress.grades.push(rating);
    this.state.lastActive = new Date();

    // Remove the graded card from the queue
    this.cardQueue.shift();

    // Set the next card
    this.getNextCard();

    // The reviewLog is returned to be saved to the database.
    return { updatedProgress, reviewLog };
  }

  /**
   * Checks if the study session is complete.
   */
  public isFinished(): boolean {
    return this.cardQueue.length === 0 && this.state.currentCard === null;
  }

  /**
   * Re-hydrates an ActiveStudySession instance from a stored state.
   * @param state - The SessionState object from a store.
   * @returns A new instance of ActiveStudySession.
   */
  public static fromState(state: SessionState): ActiveStudySession {
    // This is a simplified re-hydration. It creates a new scheduler and session
    // but restores the state. A more robust implementation might need to
    // serialize/deserialize the scheduler and card queue states as well.

    // Map session cards back to VocabularyWithProgress for the scheduler
    const vocabWithProgress: VocabularyWithProgress[] = state.cards.map(card => ({
      vocabulary: {
        id: card.id,
        korean: card.korean,
        english: card.english,
        importanceScore: card.importanceScore,
      },
      studyProgress: card.studyProgress,
      // These values are temporary for scheduler re-hydration.
      // The scheduler's sorting logic will use the `studyProgress` to determine priority.
      isDue: isCardDue(card.studyProgress),
      daysUntilReview: daysUntilReview(card.studyProgress),
    }));

    const scheduler = new CardScheduler(vocabWithProgress, { maxCards: state.cards.length });
    const session = new ActiveStudySession(state.userId, state.deckId, state.cards, scheduler);
    
    // Restore the exact state
    session.state = state;
    
    // The card queue needs to be rebuilt based on the current state of cards
    // This is a simplification; a real implementation would need to track queue progress.
    const currentCardIndex = state.cards.findIndex(c => c.id === state.currentCard?.id);
    session.cardQueue = state.cards.slice(currentCardIndex >= 0 ? currentCardIndex : 0);

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

  // Generate session ID (in a real app, this would come from the database)
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create new session
  const session: StudySession = {
    id: sessionId,
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