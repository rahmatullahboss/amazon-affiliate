-- Publication-first prototype: scope epochs by ASIN and related category.
-- Global epoch for shared tracking/agent/settings; fallback epoch for uncategorized pages.
-- Prototype migration, not authorized for production application.
-- Revision scopes are seeded from explicitly enrolled URLs. Product changes
-- update only existing scope keys; related scopes ignore gallery/review-only edits.
CREATE TABLE IF NOT EXISTS public_render_scope_revision (kind TEXT NOT NULL, scope_key TEXT NOT NULL, revision TEXT NOT NULL, PRIMARY KEY(kind,scope_key));
CREATE TRIGGER IF NOT EXISTS public_render_scope_products_insert AFTER INSERT ON products
BEGIN
  -- Only enrolled ASINs seed additional category/fallback scope keys.
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',NEW.category,lower(hex(randomblob(16))) WHERE NEW.category IS NOT NULL AND EXISTS(SELECT 1 FROM public_render_scope_revision WHERE kind='asin' AND scope_key=NEW.asin);
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16)))
  WHERE (NEW.category IS NULL OR trim(NEW.category,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))='') AND EXISTS(SELECT 1 FROM public_render_scope_revision WHERE kind='asin' AND scope_key=NEW.asin);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=NEW.asin;
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=NEW.category;
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='fallback' AND scope_key='';
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agent_products_insert AFTER INSERT ON agent_products
BEGIN
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=(SELECT asin FROM products WHERE id=NEW.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=(SELECT category FROM products WHERE id=NEW.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='fallback' AND scope_key='';
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_tracking_ids_insert AFTER INSERT ON tracking_ids
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agents_insert AFTER INSERT ON agents
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_social_links_settings_insert AFTER INSERT ON social_links_settings
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_products_update AFTER UPDATE ON products
WHEN OLD.id IS NOT NEW.id OR OLD.asin IS NOT NEW.asin OR OLD.title IS NOT NEW.title OR OLD.image_url IS NOT NEW.image_url OR OLD.category IS NOT NEW.category OR OLD.marketplace IS NOT NEW.marketplace OR OLD.is_active IS NOT NEW.is_active OR OLD.status IS NOT NEW.status OR OLD.is_adult IS NOT NEW.is_adult OR OLD.created_at IS NOT NEW.created_at
BEGIN
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=OLD.asin;
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=NEW.asin AND OLD.asin IS NOT NEW.asin;
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=OLD.category AND (OLD.asin IS NOT NEW.asin OR OLD.title IS NOT NEW.title OR OLD.image_url IS NOT NEW.image_url OR OLD.category IS NOT NEW.category OR OLD.marketplace IS NOT NEW.marketplace OR OLD.is_active IS NOT NEW.is_active OR OLD.status IS NOT NEW.status OR OLD.is_adult IS NOT NEW.is_adult OR OLD.created_at IS NOT NEW.created_at);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=NEW.category AND OLD.category IS NOT NEW.category AND (OLD.asin IS NOT NEW.asin OR OLD.title IS NOT NEW.title OR OLD.image_url IS NOT NEW.image_url OR OLD.category IS NOT NEW.category OR OLD.marketplace IS NOT NEW.marketplace OR OLD.is_active IS NOT NEW.is_active OR OLD.status IS NOT NEW.status OR OLD.is_adult IS NOT NEW.is_adult OR OLD.created_at IS NOT NEW.created_at);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='fallback' AND scope_key='' AND (OLD.asin IS NOT NEW.asin OR OLD.title IS NOT NEW.title OR OLD.image_url IS NOT NEW.image_url OR OLD.category IS NOT NEW.category OR OLD.marketplace IS NOT NEW.marketplace OR OLD.is_active IS NOT NEW.is_active OR OLD.status IS NOT NEW.status OR OLD.is_adult IS NOT NEW.is_adult OR OLD.created_at IS NOT NEW.created_at);
  -- Only enrolled ASINs seed additional category/fallback scope keys.
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',NEW.category,lower(hex(randomblob(16))) WHERE NEW.category IS NOT NULL AND EXISTS(SELECT 1 FROM public_render_scope_revision WHERE kind='asin' AND scope_key=NEW.asin);
  INSERT OR IGNORE INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16)))
  WHERE (NEW.category IS NULL OR trim(NEW.category,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))='') AND EXISTS(SELECT 1 FROM public_render_scope_revision WHERE kind='asin' AND scope_key=NEW.asin);
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agent_products_update AFTER UPDATE ON agent_products
WHEN OLD.id IS NOT NEW.id OR OLD.agent_id IS NOT NEW.agent_id OR OLD.product_id IS NOT NEW.product_id OR OLD.tracking_id IS NOT NEW.tracking_id OR OLD.is_active IS NOT NEW.is_active OR OLD.updated_at IS NOT NEW.updated_at OR OLD.show_on_homepage IS NOT NEW.show_on_homepage OR OLD.homepage_rank IS NOT NEW.homepage_rank
BEGIN
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=(SELECT asin FROM products WHERE id=OLD.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=(SELECT category FROM products WHERE id=OLD.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=(SELECT asin FROM products WHERE id=NEW.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=(SELECT category FROM products WHERE id=NEW.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='fallback' AND scope_key='';
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_tracking_ids_update AFTER UPDATE ON tracking_ids
WHEN OLD.id IS NOT NEW.id OR OLD.agent_id IS NOT NEW.agent_id OR OLD.marketplace IS NOT NEW.marketplace OR OLD.tag IS NOT NEW.tag OR OLD.is_active IS NOT NEW.is_active OR OLD.is_site_primary IS NOT NEW.is_site_primary
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agents_update AFTER UPDATE ON agents
WHEN OLD.id IS NOT NEW.id OR OLD.is_active IS NOT NEW.is_active
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_social_links_settings_update AFTER UPDATE ON social_links_settings
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_products_delete AFTER DELETE ON products
BEGIN
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=OLD.asin;
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=OLD.category;
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='fallback' AND scope_key='';
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agent_products_delete AFTER DELETE ON agent_products
BEGIN
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='asin' AND scope_key=(SELECT asin FROM products WHERE id=OLD.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='category' AND scope_key=(SELECT category FROM products WHERE id=OLD.product_id);
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16))) WHERE kind='fallback' AND scope_key='';
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_tracking_ids_delete AFTER DELETE ON tracking_ids
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agents_delete AFTER DELETE ON agents
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_social_links_settings_delete AFTER DELETE ON social_links_settings
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'global','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;

-- Review/gallery-only edits affect product meta/gallery, but do not affect
-- related cards on other product pages. Separate the own-ASIN epoch path so
-- high-volume editorial regeneration does not run category/fallback SQL.
CREATE TRIGGER IF NOT EXISTS public_render_scope_products_editorial_update
AFTER UPDATE OF review_content,product_images ON products
WHEN (OLD.review_content IS NOT NEW.review_content OR OLD.product_images IS NOT NEW.product_images)
 AND NOT (OLD.id IS NOT NEW.id OR OLD.asin IS NOT NEW.asin OR OLD.title IS NOT NEW.title OR OLD.image_url IS NOT NEW.image_url OR OLD.category IS NOT NEW.category OR OLD.marketplace IS NOT NEW.marketplace OR OLD.is_active IS NOT NEW.is_active OR OLD.status IS NOT NEW.status OR OLD.is_adult IS NOT NEW.is_adult OR OLD.created_at IS NOT NEW.created_at)
 AND EXISTS(SELECT 1 FROM public_render_scope_revision WHERE kind='asin' AND scope_key=NEW.asin)
BEGIN
  UPDATE public_render_scope_revision SET revision=lower(hex(randomblob(16)))
  WHERE kind='asin' AND scope_key=NEW.asin;
END;
