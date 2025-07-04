import { SessionState } from "./types";

/**
 * Converts string date fields in a SessionState to Date objects.
 * @param state SessionState with possible string dates
 * @returns SessionState with all date fields as Date objects
 */
export function reviveSessionState(state: SessionState): SessionState {
  return {
    ...state,
    createdAt: new Date(state.createdAt),
    lastActive: new Date(state.lastActive),
    // Add more fields here if SessionState adds more dates in the future
  };
} 