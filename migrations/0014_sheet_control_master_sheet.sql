ALTER TABLE agent_sheet_sources
ADD COLUMN source_code TEXT;

CREATE TABLE IF NOT EXISTS sheet_control_master_configs (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sheet_url TEXT,
  sheet_tab_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  last_exported_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO sheet_control_master_configs (
  id,
  sheet_url,
  sheet_tab_name,
  is_active
) VALUES (1, NULL, NULL, 0);
