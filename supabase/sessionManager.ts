import { supabase } from "./client";
import log from "encore.dev/log";
import { SessionState } from "./studySession/types";
import { reviveSessionState } from './studySession/utils';

export async function saveSessionState(state: SessionState): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .upsert({
      id: state.id,
      user_id: state.userId,
      state,
      updated_at: new Date().toISOString(),
      created_at: state.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  if (error) {
    log.error("Failed to save session", { sessionId: state.id, error });
    throw new Error("Failed to save session: " + error.message);
  }
  log.info("Saved session to Supabase", { sessionId: state.id });
}

export async function getSessionState(sessionId: string): Promise<SessionState | undefined> {
  const { data, error } = await supabase
    .from("sessions")
    .select("state")
    .eq("id", sessionId)
    .single();
  if (error || !data) {
    log.info("Session not found in Supabase", { sessionId, error });
    return undefined;
  }
  log.info("Loaded session from Supabase", { sessionId });
  return reviveSessionState(data.state as SessionState);
}

export async function deleteSessionState(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);
  if (error) {
    log.error("Failed to delete session", { sessionId, error });
    throw new Error("Failed to delete session: " + error.message);
  }
  log.info("Deleted session from Supabase", { sessionId });
}

export async function createSession(userId: string, deckPublicId: string): Promise<string> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      deck_public_id: deckPublicId,
      state: {}, // initial state, will update after
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) {
    log.error("Failed to create session", { userId, deckPublicId, error });
    throw new Error('Failed to create session');
  }
  log.info("Session created", { userId, deckPublicId, sessionId: data.id });
  return data.id;
} 