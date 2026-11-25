-- Public catalog read paths only. Existing created_at visibility index remains.
CREATE INDEX IF NOT EXISTS idx_products_public_updated
  ON products(marketplace, updated_at DESC, id DESC)
  WHERE is_active = 1 AND status = 'active' AND is_adult = 0;

CREATE INDEX IF NOT EXISTS idx_products_public_category_created
  ON products(is_active, status, is_adult, marketplace, category, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_blog_public_comparison
  ON blog_posts(generation_marketplace, published_at DESC, id DESC)
  WHERE is_deleted = 0 AND status = 'published' AND generation_topic = 'automated_comparison';
