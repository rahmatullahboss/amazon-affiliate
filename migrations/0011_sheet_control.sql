-- ============================================
-- Hybrid sheet control center
-- Per-agent input sheets -> staging -> admin review -> live DB
-- ============================================

CREATE TABLE IF NOT EXISTS agent_sheet_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL UNIQUE,
  sheet_url TEXT NOT NULL,
  sheet_tab_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  auto_approve_clean_rows INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  last_sync_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_sheet_sources_active
ON agent_sheet_sources(is_active, agent_id);

CREATE TABLE IF NOT EXISTS sheet_submission_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL DEFAULT 'agent_sheet' CHECK (source_type IN ('agent_sheet')),
  source_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  queued_rows INTEGER NOT NULL DEFAULT 0,
  approved_rows INTEGER NOT NULL DEFAULT 0,
  flagged_rows INTEGER NOT NULL DEFAULT 0,
  rejected_rows INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  triggered_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (source_id) REFERENCES agent_sheet_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sheet_submission_batches_source
ON sheet_submission_batches(source_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sheet_submission_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  asin TEXT,
  marketplace TEXT,
  title TEXT,
  category TEXT,
  custom_title TEXT,
  tracking_tag TEXT,
  row_status TEXT NOT NULL DEFAULT 'active' CHECK (row_status IN ('active', 'inactive')),
  product_status TEXT NOT NULL DEFAULT 'active' CHECK (product_status IN ('active', 'pending_review', 'rejected')),
  raw_payload TEXT NOT NULL,
  validation_color TEXT NOT NULL CHECK (validation_color IN ('green', 'yellow', 'red')),
  validation_code TEXT,
  validation_message TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  product_id INTEGER,
  tracking_id INTEGER,
  agent_product_id INTEGER,
  reviewed_by_user_id INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES sheet_submission_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES agent_sheet_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (tracking_id) REFERENCES tracking_ids(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_product_id) REFERENCES agent_products(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sheet_submission_rows_status
ON sheet_submission_rows(status, validation_color, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sheet_submission_rows_agent
ON sheet_submission_rows(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sheet_submission_rows_asin
ON sheet_submission_rows(asin, marketplace, created_at DESC);
