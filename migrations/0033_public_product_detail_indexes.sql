-- Live D1 Insights: unscoped ASIN/related/fallback queries dominated reads.
-- Retain cross-market product selection and the original visibility predicate.
CREATE INDEX IF NOT EXISTS idx_products_visible_asin_created
  ON products(asin, created_at DESC, id DESC)
  WHERE is_active = 1 AND status = 'active' AND is_adult = 0;

CREATE INDEX IF NOT EXISTS idx_products_visible_category_created
  ON products(is_active, status, is_adult, category, created_at DESC)
  WHERE is_active = 1 AND status = 'active' AND is_adult = 0;

CREATE INDEX IF NOT EXISTS idx_products_visible_created
  ON products(is_active, status, is_adult, created_at DESC)
  WHERE is_active = 1 AND status = 'active' AND is_adult = 0;
