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