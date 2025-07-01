/**
 * FSRS Session Manager
 * 
 * This file handles the lifecycle of study sessions, including creating new sessions,
 * retrieving existing sessions, and persisting session state. It acts as a bridge
 * between the database/cache and the active session logic.
 */
import { ActiveStudySession } from './studySession';
import { CardScheduler } from './cardScheduler';
import { SessionState, VocabularyWithProgress, Card as SessionCard } from './types';
import { FSRSProgress, createInitialFSRSProgress } from '../fsrs';
import log from "encore.dev/log";

// In a real application, these would interact with a database or a cache like Redis.
const sessionStore: Map<string, SessionState> = new Map();

export class SessionManager {
  /**
   * Creates a new study session for a user with a given deck of vocabulary.
   * @param userId - The ID of the user.
   * @param deckId - The ID of the deck being studied.
   * @param vocabWithProgress - The full list of vocabulary items and their progress.
   * @returns The newly created ActiveStudySession instance.
   */
  public createSession(
    userId: string,
    deckId: string,
    vocabWithProgress: VocabularyWithProgress[]
  ): ActiveStudySession {
    // For new words, create an initial FSRS progress record.
    const allCardsWithProgress = this.ensureAllVocabHasProgress(userId, vocabWithProgress);

    const scheduler = new CardScheduler(allCardsWithProgress, { maxCards: 50 });
    
    const sessionCards = allCardsWithProgress.map(vwp => ({
        id: vwp.vocabulary.id,
        korean: vwp.vocabulary.korean,
        english: vwp.vocabulary.english,
        importanceScore: vwp.vocabulary.importanceScore,
        studyProgress: vwp.studyProgress!,
    }));

    const session = new ActiveStudySession(userId, deckId, sessionCards, scheduler);
    this.saveSessionState(session.getState());
    
    return session;
  }

  /**
   * Ensures every vocabulary item has an FSRSProgress record.
   * If a vocab item doesn't have one, it's considered new and one is created.
   */
  private ensureAllVocabHasProgress(
    userId: string,
    vocabItems: VocabularyWithProgress[]
  ): VocabularyWithProgress[] {
    return vocabItems.map(vwp => {
      if (!vwp.studyProgress) {
        return {
          ...vwp,
          studyProgress: createInitialFSRSProgress(userId, vwp.vocabulary.id),
        };
      }
      return vwp;
    });
  }

  /**
   * Saves the session's state to the store.
   * @param state - The session state to save.
   */
  public saveSessionState(state: SessionState): void {
    log.info("Saving session", { sessionId: state.sessionId, keys: Object.keys(state) });
    sessionStore.set(state.sessionId, state);
  }

  /**
   * Retrieves a session's state from the store.
   * @param sessionId - The ID of the session to retrieve.
   * @returns The session state, or undefined if not found.
   */
  public getSessionState(sessionId: string): SessionState | undefined {
    const session = sessionStore.get(sessionId);
    log.info("Loading session", { sessionId, found: !!session });
    return session;
  }
} 