CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);