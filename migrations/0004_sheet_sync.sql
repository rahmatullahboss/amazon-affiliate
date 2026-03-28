-- ============================================
-- Google Sheet product sync support
-- ============================================

CREATE TABLE IF NOT EXISTS sheet_sync_configs (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sheet_url TEXT,
  sheet_tab_name TEXT,
  default_marketplace TEXT NOT NULL DEFAULT 'US',
  is_active INTEGER NOT NULL DEFAULT 0,
  last_imported_at TEXT,
  last_exported_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO sheet_sync_configs (
  id,
  sheet_url,
  sheet_tab_name,
  default_marketplace,
  is_active
) VALUES (1, NULL, NULL, 'US', 0);

CREATE TABLE IF NOT EXISTS sheet_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL CHECK (direction IN ('import', 'export')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  details TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  triggered_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sheet_sync_logs_created_at
ON sheet_sync_logs(created_at DESC);
