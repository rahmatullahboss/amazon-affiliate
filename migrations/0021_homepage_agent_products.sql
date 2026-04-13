ALTER TABLE agent_products ADD COLUMN show_on_homepage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_products ADD COLUMN homepage_rank INTEGER;

CREATE INDEX IF NOT EXISTS idx_agent_products_homepage
  ON agent_products(show_on_homepage, created_at DESC)
  WHERE is_active = 1 AND show_on_homepage = 1;

UPDATE agent_products
SET show_on_homepage = 1
WHERE id IN (
  SELECT ap.id
  FROM agent_products ap
  JOIN tracking_ids t ON t.id = ap.tracking_id
  JOIN products p ON p.id = ap.product_id
  WHERE ap.is_active = 1
    AND t.is_active = 1
    AND t.is_default = 1
    AND p.is_active = 1
    AND p.status = 'active'
);
