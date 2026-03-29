CREATE TABLE IF NOT EXISTS temp_tokens (
  token TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('password_reset', 'google_signup')),
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_temp_tokens_purpose_expires
ON temp_tokens(purpose, expires_at);
