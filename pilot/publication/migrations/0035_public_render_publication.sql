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

-- Enrollment is the single source of truth for active revision scopes. This
-- trigger runs only when an exact pilot URL is added; it never runs per visitor.
CREATE TRIGGER IF NOT EXISTS public_render_publication_seed_scope_insert AFTER INSERT ON public_render_publication
BEGIN
  -- Seed only explicitly enrolled ASINs and their potentially selected
  -- categories. Unrelated catalog updates then cannot create revision rows.
  -- Re-enrolling a removed URL must change its revision identity, otherwise
  -- the prior durable R2 slot could become valid again without regeneration.
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
    VALUES('asin',substr(NEW.path,8,10),lower(hex(randomblob(16))))
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
    SELECT 'category',p.category,lower(hex(randomblob(16)))
    FROM products p WHERE p.asin=substr(NEW.path,8,10) AND p.category IS NOT NULL;
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
    SELECT 'fallback','',lower(hex(randomblob(16)))
    WHERE EXISTS(
      SELECT 1 FROM products p WHERE p.asin=substr(NEW.path,8,10)
        AND (p.category IS NULL OR trim(p.category,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))='')
    );
END;
-- A rare manual URL change is equivalent to adding the replacement exact URL.
CREATE TRIGGER IF NOT EXISTS public_render_publication_seed_scope_update AFTER UPDATE OF path ON public_render_publication
WHEN OLD.path IS NOT NEW.path
BEGIN
  -- Seed only explicitly enrolled ASINs and their potentially selected
  -- categories. Unrelated catalog updates then cannot create revision rows.
  -- Re-enrolling a removed URL must change its revision identity, otherwise
  -- the prior durable R2 slot could become valid again without regeneration.
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
    VALUES('asin',substr(NEW.path,8,10),lower(hex(randomblob(16))))
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
    SELECT 'category',p.category,lower(hex(randomblob(16)))
    FROM products p WHERE p.asin=substr(NEW.path,8,10) AND p.category IS NOT NULL;
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
    SELECT 'fallback','',lower(hex(randomblob(16)))
    WHERE EXISTS(
      SELECT 1 FROM products p WHERE p.asin=substr(NEW.path,8,10)
        AND (p.category IS NULL OR trim(p.category,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))='')
    );
END;
