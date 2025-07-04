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
import { saveSessionState, getSessionState, deleteSessionState } from "../sessionManager";
import log from "encore.dev/log";
import { supabase } from "../client";

// Initialize a singleton instance of the SessionManager
const sessionManager = new SessionManager();

/**
 * Starts a new study session.
 * @param userId The ID of the user.
 * @param deckId The ID of the deck to study.
 * @param vocabWithProgress The user's vocabulary and their FSRS progress.
 * @returns The initial state of the new session.
 */
export async function startStudySession(
  userId: string,
  deckId: string,
  vocabWithProgress: VocabularyWithProgress[]
): Promise<SessionState> {
  // Use CardScheduler to create buckets and pass to ActiveStudySession
  const scheduler = new CardScheduler(vocabWithProgress);
  // The allCards param is not used in the new bucket-based logic, so pass an empty array
  const session = new ActiveStudySession(userId, deckId, [], scheduler);
  const state = session.getState();
  await saveSessionState(state);
  log.info("Session started and saved", { sessionId: state.sessionId });
  return state;
}

/**
 * Records a user's grade for the current card in a session and advances to the next.
 * @param sessionId The ID of the active session.
 * @param rating The FSRS rating from the user.
 * @returns The updated session state.
 */
export async function gradeCard(
  sessionId: string,
  rating: Rating
): Promise<{ newState: SessionState; updatedProgress: FSRSProgress; reviewLog: FSRSReviewLog }> {
  const state = await getSessionState(sessionId);
  if (!state) {
    log.error("Session not found for grading", { sessionId });
    throw new Error('Session not found.');
  }
  // Re-hydrate the ActiveStudySession instance from its state (now uses queues)
  const session = ActiveStudySession.fromState(state);
  // Grade the card. This mutates the session's state internally.
  const gradeResult = session.gradeCard(rating);
  if (!gradeResult) {
    throw new Error('Cannot grade card, no card is active in the session.');
  }
  const { updatedProgress, reviewLog } = gradeResult;
  // Persist the updated state (with queues)
  const newState = session.getState();
  await saveSessionState(newState);
  log.info("Session graded and saved", { sessionId });
  // The results are returned to be persisted to the database by the caller.
  return { newState, updatedProgress, reviewLog };
}

/**
 * Ends a study session.
 * @param sessionId The ID of the session to end.
 */
export async function endStudySession(sessionId: string): Promise<void> {
  const state = await getSessionState(sessionId);
  if (state) {
    // In a real app, you would finalize stats and persist the results.
    // For now, we just log it.
    console.log(`Ending session ${sessionId}. Reviewed ${state.progress.reviewed} cards.`);
    // sessionManager.deleteSession(sessionId); // Or mark as inactive
  }
}

export async function finishStudySession(sessionId: string): Promise<void> {
  const state = await getSessionState(sessionId);
  if (!state) {
    log.error("Session not found for finish", { sessionId });
    throw new Error("Session not found.");
  }
  // Gather all FSRSProgress from queues
  const allProgress: any[] = [];
  for (const bucket of Object.values(state.queues)) {
    for (const card of bucket) {
      if (card.studyProgress) {
        allProgress.push({
          ...card.studyProgress,
          due: (card.studyProgress.due instanceof Date) ? card.studyProgress.due.toISOString() : card.studyProgress.due,
          last_review: card.studyProgress.last_review ? (card.studyProgress.last_review instanceof Date ? card.studyProgress.last_review.toISOString() : card.studyProgress.last_review) : null,
          createdAt: (card.studyProgress.createdAt instanceof Date) ? card.studyProgress.createdAt.toISOString() : card.studyProgress.createdAt,
          updatedAt: (card.studyProgress.updatedAt instanceof Date) ? card.studyProgress.updatedAt.toISOString() : card.studyProgress.updatedAt,
        });
      }
    }
  }
  // Upsert all progress
  if (allProgress.length > 0) {
    const { error: progressError } = await supabase
      .from("fsrs_progress")
      .upsert(allProgress, { onConflict: "id" });
    if (progressError) {
      log.error("Failed to upsert FSRS progress on finish", { sessionId, error: progressError });
    } else {
      log.info("Upserted FSRS progress on finish", { sessionId, count: allProgress.length });
    }
  }
  // Upsert all review logs if present
  if ((state as any).reviewLogs && Array.isArray((state as any).reviewLogs)) {
    const logs = (state as any).reviewLogs.map((log: any) => ({
      ...log,
      due: (log.due instanceof Date) ? log.due.toISOString() : log.due,
      review: (log.review instanceof Date) ? log.review.toISOString() : log.review,
    }));
    if (logs.length > 0) {
      const { error: logError } = await supabase
        .from("fsrs_review_logs")
        .upsert(logs, { onConflict: "id" });
      if (logError) {
        log.error("Failed to upsert FSRS review logs on finish", { sessionId, error: logError });
      } else {
        log.info("Upserted FSRS review logs on finish", { sessionId, count: logs.length });
      }
    }
  }
  await deleteSessionState(sessionId);
  log.info("Session finished and deleted", { sessionId });
}