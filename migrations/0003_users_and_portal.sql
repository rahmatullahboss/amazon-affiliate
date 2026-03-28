-- ============================================
-- Users, agent portal, and reporting support
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'agent')),
  agent_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_users_agent ON users(agent_id);

ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE agent_products ADD COLUMN submitted_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE agent_products ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

CREATE TABLE IF NOT EXISTS amazon_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marketplace TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'tracking_summary',
  period_start TEXT,
  period_end TEXT,
  source_file_name TEXT NOT NULL,
  imported_by_user_id INTEGER,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (imported_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS amazon_conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  tracking_tag TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  asin TEXT,
  ordered_items INTEGER NOT NULL DEFAULT 0,
  shipped_items INTEGER NOT NULL DEFAULT 0,
  revenue_amount REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,
  raw_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (report_id) REFERENCES amazon_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_amazon_conversions_tracking
ON amazon_conversions(tracking_tag, marketplace, raw_date);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON audit_logs(entity_type, entity_id, created_at);
