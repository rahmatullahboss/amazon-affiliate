CREATE TABLE IF NOT EXISTS agent_slug_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  tracking_id INTEGER NOT NULL,
  marketplace TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (tracking_id) REFERENCES tracking_ids(id) ON DELETE CASCADE,
  UNIQUE(tracking_id, marketplace)
);

CREATE INDEX IF NOT EXISTS idx_agent_slug_aliases_slug
ON agent_slug_aliases(slug)
WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_agent_slug_aliases_tracking
ON agent_slug_aliases(tracking_id, marketplace)
WHERE is_active = 1;
