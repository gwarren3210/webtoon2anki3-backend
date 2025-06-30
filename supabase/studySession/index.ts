/**
 * FSRS Study Session Module
 * 
 * This module provides the primary interface for managing FSRS-based study sessions.
 * It exposes functionality to start, manage, and interact with a user's study session.
 */

import { SessionManager } from './sessionManager';
import { ActiveStudySession } from './studySession';
import { VocabularyWithProgress, SessionState, Card } from './types';
import { Rating, FSRSProgress, FSRSReviewLog } from '../fsrs/types';
import { CardScheduler } from './cardScheduler';

// Initialize a singleton instance of the SessionManager
const sessionManager = new SessionManager();

/**
 * Starts a new study session.
 * @param userId The ID of the user.
 * @param deckId The ID of the deck to study.
 * @param vocabWithProgress The user's vocabulary and their FSRS progress.
 * @returns The initial state of the new session.
 */
export function startStudySession(
  userId: string,
  deckId: string,
  vocabWithProgress: VocabularyWithProgress[]
): SessionState {
  const session = sessionManager.createSession(userId, deckId, vocabWithProgress);
  return session.getState();
}

/**
 * Records a user's grade for the current card in a session and advances to the next.
 * @param sessionId The ID of the active session.
 * @param rating The FSRS rating from the user.
 * @returns The updated session state.
 */
export function gradeCard(
  sessionId: string,
  rating: Rating
): { newState: SessionState; updatedProgress: FSRSProgress; reviewLog: FSRSReviewLog } {
  const state = sessionManager.getSessionState(sessionId);
  if (!state) {
    throw new Error('Session not found.');
  }
  
  // Re-hydrate the ActiveStudySession instance from its state
  const session = ActiveStudySession.fromState(state);
  
  // Grade the card. This mutates the session's state internally.
  const gradeResult = session.gradeCard(rating);
  if (!gradeResult) {
    throw new Error('Cannot grade card, no card is active in the session.');
  }

  const { updatedProgress, reviewLog } = gradeResult;

  // Persist the updated state
  const newState = session.getState();
  sessionManager.saveSessionState(newState);

  // The results are returned to be persisted to the database by the caller.
  return { newState, updatedProgress, reviewLog };
}

/**
 * Ends a study session.
 * @param sessionId The ID of the session to end.
 */
export function endStudySession(sessionId: string): void {
  const state = sessionManager.getSessionState(sessionId);
  if (state) {
    // In a real app, you would finalize stats and persist the results.
    // For now, we just log it.
    console.log(`Ending session ${sessionId}. Reviewed ${state.progress.reviewed} cards.`);
    // sessionManager.deleteSession(sessionId); // Or mark as inactive
  }
}