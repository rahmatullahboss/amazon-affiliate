PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS agent_sheet_sources_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  sheet_url TEXT NOT NULL,
  spreadsheet_id TEXT,
  sheet_tab_name TEXT,
  sheet_gid INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  auto_approve_clean_rows INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  last_sync_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

INSERT INTO agent_sheet_sources_new (
  id,
  agent_id,
  sheet_url,
  spreadsheet_id,
  sheet_tab_name,
  sheet_gid,
  is_active,
  auto_approve_clean_rows,
  last_synced_at,
  last_sync_status,
  last_sync_message,
  created_at,
  updated_at
)
SELECT
  id,
  agent_id,
  sheet_url,
  CASE
    WHEN instr(sheet_url, '/spreadsheets/d/') > 0 THEN
      substr(
        sheet_url,
        instr(sheet_url, '/spreadsheets/d/') + 17,
        CASE
          WHEN instr(substr(sheet_url, instr(sheet_url, '/spreadsheets/d/') + 17), '/') > 0 THEN
            instr(substr(sheet_url, instr(sheet_url, '/spreadsheets/d/') + 17), '/') - 1
          ELSE
            length(sheet_url)
        END
      )
    ELSE NULL
  END AS spreadsheet_id,
  sheet_tab_name,
  CASE
    WHEN instr(sheet_url, 'gid=') > 0 THEN CAST(substr(sheet_url, instr(sheet_url, 'gid=') + 4) AS INTEGER)
    ELSE NULL
  END AS sheet_gid,
  is_active,
  auto_approve_clean_rows,
  last_synced_at,
  last_sync_status,
  last_sync_message,
  created_at,
  updated_at
FROM agent_sheet_sources;

DROP TABLE agent_sheet_sources;
ALTER TABLE agent_sheet_sources_new RENAME TO agent_sheet_sources;

CREATE INDEX IF NOT EXISTS idx_agent_sheet_sources_active
ON agent_sheet_sources(is_active, agent_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sheet_sources_agent_sheet_tab
ON agent_sheet_sources(agent_id, spreadsheet_id, sheet_tab_name);

PRAGMA foreign_keys = ON;
