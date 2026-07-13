-- Collapse historical duplicate tracking rows so each agent + marketplace keeps the latest valid active row.
CREATE TABLE IF NOT EXISTS _tracking_keep_0024 (
  agent_id INTEGER NOT NULL,
  marketplace TEXT NOT NULL,
  keep_id INTEGER NOT NULL,
  had_site_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, marketplace)
);

DELETE FROM _tracking_keep_0024;

INSERT INTO _tracking_keep_0024 (agent_id, marketplace, keep_id, had_site_primary)
SELECT
  grouped.agent_id,
  grouped.marketplace,
  COALESCE(
    MAX(CASE
      WHEN grouped.is_active = 1
       AND lower(grouped.tag) NOT LIKE '%-archived-%'
      THEN grouped.id
    END),
    MAX(grouped.id)
  ) AS keep_id,
  MAX(grouped.is_site_primary) AS had_site_primary
FROM tracking_ids grouped
GROUP BY grouped.agent_id, grouped.marketplace;

-- Move every linked product to the surviving tracking row.
UPDATE agent_products
SET tracking_id = (
  SELECT keep.keep_id
  FROM tracking_ids source
  JOIN _tracking_keep_0024 keep
    ON keep.agent_id = source.agent_id
   AND keep.marketplace = source.marketplace
  WHERE source.id = agent_products.tracking_id
  LIMIT 1
),
updated_at = CURRENT_TIMESTAMP
WHERE tracking_id IN (
  SELECT source.id
  FROM tracking_ids source
  JOIN _tracking_keep_0024 keep
    ON keep.agent_id = source.agent_id
   AND keep.marketplace = source.marketplace
  WHERE source.id != keep.keep_id
);

DELETE FROM agent_slug_aliases
WHERE tracking_id IN (
  SELECT source.id
  FROM tracking_ids source
  JOIN _tracking_keep_0024 keep
    ON keep.agent_id = source.agent_id
   AND keep.marketplace = source.marketplace
  WHERE source.id != keep.keep_id
);

DELETE FROM tracking_ids
WHERE id NOT IN (SELECT keep_id FROM _tracking_keep_0024);

-- Restore site-primary on the survivor only after the older primary row is gone.
UPDATE tracking_ids
SET is_site_primary = COALESCE(
      (SELECT keep.had_site_primary FROM _tracking_keep_0024 keep WHERE keep.keep_id = tracking_ids.id),
      is_site_primary
    );

-- Single tracking is always active/default and editable only by admin.
UPDATE tracking_ids
SET is_active = 1,
    is_default = 1,
    is_portal_editable = 0;

-- A tracking tag owns its matching public slug. Remove stale conflicting aliases first.
DELETE FROM agent_slug_aliases
WHERE EXISTS (
  SELECT 1
  FROM tracking_ids t
  WHERE lower(t.tag) = agent_slug_aliases.slug
    AND t.id != agent_slug_aliases.tracking_id
);

UPDATE agent_slug_aliases
SET agent_id = (
      SELECT t.agent_id FROM tracking_ids t WHERE t.id = agent_slug_aliases.tracking_id
    ),
    marketplace = (
      SELECT t.marketplace FROM tracking_ids t WHERE t.id = agent_slug_aliases.tracking_id
    ),
    slug = (
      SELECT lower(t.tag) FROM tracking_ids t WHERE t.id = agent_slug_aliases.tracking_id
    ),
    is_active = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE tracking_id IN (SELECT id FROM tracking_ids);

INSERT OR IGNORE INTO agent_slug_aliases (
  agent_id, tracking_id, marketplace, slug, is_active
)
SELECT t.agent_id, t.id, t.marketplace, lower(t.tag), 1
FROM tracking_ids t
LEFT JOIN agent_slug_aliases asa
  ON asa.tracking_id = t.id AND asa.marketplace = t.marketplace
WHERE asa.id IS NULL;

-- Prevent future code paths from reintroducing multiple rows for one account + marketplace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_ids_single_agent_marketplace
  ON tracking_ids(agent_id, marketplace);

DROP TABLE _tracking_keep_0024;
