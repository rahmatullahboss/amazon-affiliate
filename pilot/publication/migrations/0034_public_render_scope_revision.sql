-- Publication-first prototype: scope epochs by ASIN and related category.
-- Global epoch for shared tracking/agent/settings; fallback epoch for uncategorized pages.
-- Prototype migration, not authorized for production application.
CREATE TABLE IF NOT EXISTS public_render_scope_revision (kind TEXT NOT NULL, scope_key TEXT NOT NULL, revision TEXT NOT NULL, PRIMARY KEY(kind,scope_key));
CREATE TRIGGER IF NOT EXISTS public_render_scope_products_insert AFTER INSERT ON products
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',NEW.asin,lower(hex(randomblob(16))) WHERE NEW.asin IS NOT NULL
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',NEW.category,lower(hex(randomblob(16))) WHERE NEW.category IS NOT NULL
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agent_products_insert AFTER INSERT ON agent_products
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',(SELECT asin FROM products WHERE id=NEW.product_id),lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND asin IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',(SELECT category FROM products WHERE id=NEW.product_id),lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND category IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
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
WHEN OLD.id IS NOT NEW.id OR OLD.asin IS NOT NEW.asin OR OLD.title IS NOT NEW.title OR OLD.image_url IS NOT NEW.image_url OR OLD.category IS NOT NEW.category OR OLD.marketplace IS NOT NEW.marketplace OR OLD.review_content IS NOT NEW.review_content OR OLD.product_images IS NOT NEW.product_images OR OLD.is_active IS NOT NEW.is_active OR OLD.status IS NOT NEW.status OR OLD.is_adult IS NOT NEW.is_adult OR OLD.created_at IS NOT NEW.created_at
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',OLD.asin,lower(hex(randomblob(16))) WHERE OLD.asin IS NOT NULL AND OLD.asin IS NOT NEW.asin
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',OLD.category,lower(hex(randomblob(16))) WHERE OLD.category IS NOT NULL AND OLD.category IS NOT NEW.category
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',NEW.asin,lower(hex(randomblob(16))) WHERE NEW.asin IS NOT NULL
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',NEW.category,lower(hex(randomblob(16))) WHERE NEW.category IS NOT NULL
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agent_products_update AFTER UPDATE ON agent_products
WHEN OLD.id IS NOT NEW.id OR OLD.agent_id IS NOT NEW.agent_id OR OLD.product_id IS NOT NEW.product_id OR OLD.tracking_id IS NOT NEW.tracking_id OR OLD.is_active IS NOT NEW.is_active OR OLD.updated_at IS NOT NEW.updated_at OR OLD.show_on_homepage IS NOT NEW.show_on_homepage OR OLD.homepage_rank IS NOT NEW.homepage_rank
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',(SELECT asin FROM products WHERE id=OLD.product_id),lower(hex(randomblob(16))) WHERE OLD.product_id IS NOT NEW.product_id AND EXISTS(SELECT 1 FROM products WHERE id=OLD.product_id AND asin IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',(SELECT category FROM products WHERE id=OLD.product_id),lower(hex(randomblob(16))) WHERE OLD.product_id IS NOT NEW.product_id AND EXISTS(SELECT 1 FROM products WHERE id=OLD.product_id AND category IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',(SELECT asin FROM products WHERE id=NEW.product_id),lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND asin IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',(SELECT category FROM products WHERE id=NEW.product_id),lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND category IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
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
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',OLD.asin,lower(hex(randomblob(16))) WHERE OLD.asin IS NOT NULL
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',OLD.category,lower(hex(randomblob(16))) WHERE OLD.category IS NOT NULL
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS public_render_scope_agent_products_delete AFTER DELETE ON agent_products
BEGIN
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'asin',(SELECT asin FROM products WHERE id=OLD.product_id),lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM products WHERE id=OLD.product_id AND asin IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'category',(SELECT category FROM products WHERE id=OLD.product_id),lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM products WHERE id=OLD.product_id AND category IS NOT NULL)
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
  INSERT INTO public_render_scope_revision(kind,scope_key,revision)
  SELECT 'fallback','',lower(hex(randomblob(16))) WHERE 1
  ON CONFLICT(kind,scope_key) DO UPDATE SET revision=excluded.revision;
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
