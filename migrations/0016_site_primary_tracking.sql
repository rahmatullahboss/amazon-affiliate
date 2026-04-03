ALTER TABLE tracking_ids ADD COLUMN is_site_primary INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_ids_site_primary_marketplace
ON tracking_ids(marketplace)
WHERE is_site_primary = 1 AND is_active = 1;
