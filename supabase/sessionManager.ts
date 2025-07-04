import { supabase } from "./client";
import log from "encore.dev/log";
import { SessionState } from "./studySession/types";

export async function saveSessionState(state: SessionState): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .upsert({
      session_id: state.sessionId,
      user_id: state.userId,
      state,
      updated_at: new Date().toISOString(),
      created_at: state.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  if (error) {
    log.error("Failed to save session", { sessionId: state.sessionId, error });
    throw new Error("Failed to save session: " + error.message);
  }
  log.info("Saved session to Supabase", { sessionId: state.sessionId });
}

export async function getSessionState(sessionId: string): Promise<SessionState | undefined> {
  const { data, error } = await supabase
    .from("sessions")
    .select("state")
    .eq("session_id", sessionId)
    .single();
  if (error || !data) {
    log.info("Session not found in Supabase", { sessionId });
    return undefined;
  }
  log.info("Loaded session from Supabase", { sessionId });
  return data.state as SessionState;
}

export async function deleteSessionState(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("session_id", sessionId);
  if (error) {
    log.error("Failed to delete session", { sessionId, error });
    throw new Error("Failed to delete session: " + error.message);
  }
  log.info("Deleted session from Supabase", { sessionId });
} 