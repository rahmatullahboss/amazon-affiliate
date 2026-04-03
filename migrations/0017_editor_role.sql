PRAGMA foreign_keys=OFF;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'editor', 'agent')),
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  is_active INTEGER DEFAULT 1,
  google_sub TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (
  id,
  username,
  email,
  password_hash,
  role,
  agent_id,
  is_active,
  google_sub,
  created_at,
  updated_at
)
SELECT
  id,
  username,
  email,
  password_hash,
  role,
  agent_id,
  is_active,
  google_sub,
  created_at,
  updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_agent_id ON users(agent_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_google_sub ON users(google_sub);

PRAGMA foreign_keys=ON;
