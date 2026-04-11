ALTER TABLE blog_posts
  ADD COLUMN generation_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (generation_source IN ('manual', 'ai'));

ALTER TABLE blog_posts
  ADD COLUMN generation_provider TEXT;

ALTER TABLE blog_posts
  ADD COLUMN generation_topic TEXT;

ALTER TABLE blog_posts
  ADD COLUMN generation_focus_asin TEXT;

ALTER TABLE blog_posts
  ADD COLUMN generation_marketplace TEXT;

CREATE TABLE IF NOT EXISTS blog_generation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('success', 'skipped', 'failed')),
  provider TEXT,
  model TEXT,
  topic_label TEXT,
  focus_asin TEXT,
  marketplace TEXT,
  blog_post_id INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_generation_runs_created_at
  ON blog_generation_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_generation_runs_status
  ON blog_generation_runs(status, created_at DESC);
