/**
 * FSRS Study Session Module
 * 
 * This module provides the primary interface for managing FSRS-based study sessions.
 * It exposes functionality to start, manage, and interact with a user's study session.
 */
import { ActiveStudySession } from './studySession';
import { SessionState, Card } from './types';
import { Rating, FSRSProgress, FSRSReviewLog } from '../fsrs/types';
import { CardScheduler } from './cardScheduler';
import { saveSessionState, getSessionState, deleteSessionState, createSession } from "../sessionManager";
import log from "encore.dev/log";
import { supabase } from "../client";

/**
 * Starts a new study session.
 * @param userId The ID of the user.
 * @param deckId The ID of the deck to study.
 * @param vocabWithProgress The user's vocabulary and their FSRS progress.
 * @returns The initial state of the new session.
 */
export async function startStudySession(
  userId: string,
  deckPublicId: string,
  cards: Card[]
): Promise<SessionState> {
  // Use the sessionManager to create a new session and get the sessionId
  const sessionId = await createSession(userId);
  const session = new ActiveStudySession(userId, sessionId, deckPublicId, cards);
  const sessionState = session.getState();
  await saveSessionState(sessionState);
  log.info("Session started and saved", { sessionId: sessionState.id });
  return sessionState;
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
  const sessionState = await getSessionState(sessionId);
  if (!sessionState) {
    log.error("Session not found for grading", { sessionId });
    throw new Error('Session not found.');
  }
  // Re-hydrate the ActiveStudySession instance from its state (now uses queues)
  const session = ActiveStudySession.fromState(sessionState);
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

  // --- Insert review log into fsrs_review_logs table ---
  // Convert date fields to ISO strings for DB compatibility
  const logToInsert = {
    ...reviewLog,
    due: reviewLog.due instanceof Date ? reviewLog.due.toISOString() : reviewLog.due,
    review: reviewLog.review instanceof Date ? reviewLog.review.toISOString() : reviewLog.review,
  };
  const { error: logError } = await supabase
    .from("fsrs_review_logs")
    .upsert([logToInsert], { onConflict: "id" });
  if (logError) {
    log.error("Failed to upsert FSRS review log on grade", { sessionId, error: logError });
  } else {
    log.info("Upserted FSRS review log on grade", { sessionId, logId: reviewLog.id });
  }

  // The results are returned to be persisted to the database by the caller.
  return { newState, updatedProgress, reviewLog };
}

/**
 * Ends a study session.
 * @param sessionId The ID of the session to end.
 */
export async function endStudySession(sessionId: string): Promise<void> {
  const sessionState = await getSessionState(sessionId);
  if (sessionState) {
   // TODO
    // In a real app, you would finalize stats and persist the results.
    // For now, we just log it.
    console.log(`Ending session ${sessionId}. Reviewed ${sessionState.stats.reviewed} cards.`);
    // sessionManager.deleteSession(sessionId); // Or mark as inactive
  }
}

export async function finishStudySession(sessionId: string): Promise<void> {
  const sessionState = await getSessionState(sessionId);
  if (!sessionState) {
    log.error("Session not found for finish", { sessionId });
    throw new Error("Session not found.");
  }
  // Gather all FSRSProgress from queues
  const allProgress: any[] = [];
  for (const bucket of Object.values(sessionState.queues)) {
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
  // --- Removed reviewLogs upsert logic ---
  //await deleteSessionState(sessionId);
  //log.info("Session finished and deleted", { sessionId });
}