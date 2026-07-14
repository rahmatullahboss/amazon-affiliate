-- Restore automatic default tracking coverage and separate public visibility
-- from redirect/order-link eligibility for adult or sexually explicit products.

ALTER TABLE products ADD COLUMN is_adult INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN adult_detection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_products_public_visibility
  ON products(is_active, status, is_adult, marketplace, created_at);

-- Backfill high-confidence adult-product matches without disabling the product.
-- These records remain eligible for tracked /go redirects but are hidden from
-- public product pages, feeds, storefronts, categories, and bridge content.
UPDATE products
SET is_adult = 1,
    adult_detection_reason = 'Auto-detected during migration'
WHERE lower(
  coalesce(title, '') || ' ' ||
  coalesce(category, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(features, '')
) LIKE '%sex toy%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%sexual wellness%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%adult toy%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%vibrator%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%dildo%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%cock ring%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%penis ring%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%masturbator%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%butt plug%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%anal plug%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%bdsm%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%bondage%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%sex doll%'
   OR lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) LIKE '%pornographic%';

-- Assign every currently unmapped active product to the best active default tag
-- for its marketplace. Site-primary wins; otherwise the oldest active default
-- tag is used. Existing active mappings are never overwritten.
INSERT INTO agent_products (
  agent_id,
  product_id,
  tracking_id,
  custom_title,
  is_active
)
SELECT
  selected.agent_id,
  p.id,
  selected.id,
  NULL,
  1
FROM products p
JOIN tracking_ids selected
  ON selected.id = (
    SELECT t.id
    FROM tracking_ids t
    JOIN agents a ON a.id = t.agent_id
    WHERE t.marketplace = p.marketplace
      AND t.is_active = 1
      AND a.is_active = 1
      AND (t.is_site_primary = 1 OR t.is_default = 1)
    ORDER BY t.is_site_primary DESC, t.is_default DESC, t.created_at ASC, t.id ASC
    LIMIT 1
  )
WHERE p.is_active = 1
  AND NOT EXISTS (
    SELECT 1
    FROM agent_products ap
    WHERE ap.product_id = p.id
      AND ap.is_active = 1
  )
ON CONFLICT(agent_id, product_id) DO UPDATE SET
  tracking_id = excluded.tracking_id,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
