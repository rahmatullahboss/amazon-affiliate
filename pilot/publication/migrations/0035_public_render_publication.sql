-- Explicit opt-in catalog for pre-rendering. Never auto-enroll the whole catalog.
-- The first prototype is intentionally capped at 100 exact document URLs.
CREATE TABLE IF NOT EXISTS public_render_publication (
  path TEXT PRIMARY KEY CHECK(
    substr(path,1,7)='/deals/' AND length(substr(path,8,10))=10
    AND substr(path,8,10) NOT GLOB '*[^A-Z0-9]*'
    AND substr(path,18) IN ('','?market=US','?market=CA','?market=UK','?market=DE','?market=IT','?market=FR','?market=ES')
  ),
  last_checked_at INTEGER NOT NULL DEFAULT 0,
  next_check_at INTEGER NOT NULL DEFAULT 0,
  checked_version TEXT NOT NULL DEFAULT '',
  checked_revision TEXT NOT NULL DEFAULT '',
  dirty_token TEXT NOT NULL DEFAULT (lower(hex(randomblob(16))))
);
CREATE INDEX IF NOT EXISTS idx_public_render_publication_checked ON public_render_publication(last_checked_at,path);
CREATE INDEX IF NOT EXISTS idx_public_render_publication_due ON public_render_publication(next_check_at);
CREATE TRIGGER IF NOT EXISTS public_render_publication_cap BEFORE INSERT ON public_render_publication
WHEN (SELECT COUNT(*) FROM public_render_publication)>=100
  AND NOT EXISTS(SELECT 1 FROM public_render_publication WHERE path=NEW.path)
BEGIN
  SELECT RAISE(ABORT,'Publication prototype enrollment limit');
END;
-- The scheduler compares persisted and current scope revisions. Never fan out
-- queue updates from catalog-write triggers; this keeps bulk imports bounded.
