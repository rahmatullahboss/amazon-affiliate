CREATE TABLE IF NOT EXISTS social_links_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  telegram_url TEXT NOT NULL DEFAULT '',
  telegram_enabled INTEGER NOT NULL DEFAULT 0,
  whatsapp_url TEXT NOT NULL DEFAULT '',
  whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
  messenger_url TEXT NOT NULL DEFAULT '',
  messenger_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO social_links_settings (id) VALUES (1);
