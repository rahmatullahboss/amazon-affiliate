ALTER TABLE blog_posts ADD COLUMN scheduled_for TEXT;

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at
  ON blog_posts(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled_for
  ON blog_posts(status, scheduled_for);
