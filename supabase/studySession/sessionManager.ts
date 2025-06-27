import { SessionState } from './types';

// In-memory session store (sessionId -> SessionState)
const sessionStore = new Map<string, SessionState>();

/**
 * Creates a new session and stores it in memory.
 * @param session SessionState object to store
 */
export function createSession(session: SessionState): void {
  sessionStore.set(session.sessionId, session);
}

/**
 * Retrieves a session by sessionId.
 * @param sessionId string
 * @returns SessionState | undefined
 */
export function getSession(sessionId: string): SessionState | undefined {
  return sessionStore.get(sessionId);
}

/**
 * Updates an existing session in memory.
 * @param session SessionState object
 */
export function updateSession(session: SessionState): void {
  sessionStore.set(session.sessionId, session);
}

/**
 * Deletes a session from memory.
 * @param sessionId string
 */
export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/**
 * Cleans up all sessions (for testing or shutdown).
 */
export function clearSessions(): void {
  sessionStore.clear();
} 