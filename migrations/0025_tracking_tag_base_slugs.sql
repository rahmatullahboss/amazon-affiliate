-- Convert default public aliases from the full Amazon tracking tag to the
-- readable tag portion before the standard -20/-21 account suffix.
-- Custom aliases and collision-prone aliases are intentionally preserved.
CREATE TABLE IF NOT EXISTS _tracking_slug_0025 (
  tracking_id INTEGER PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  marketplace TEXT NOT NULL,
  desired_slug TEXT NOT NULL
);

DELETE FROM _tracking_slug_0025;

INSERT INTO _tracking_slug_0025 (tracking_id, agent_id, marketplace, desired_slug)
SELECT
  t.id,
  t.agent_id,
  t.marketplace,
  CASE
    WHEN lower(t.tag) LIKE '%-20' OR lower(t.tag) LIKE '%-21'
      THEN substr(lower(t.tag), 1, length(t.tag) - 3)
    ELSE lower(t.tag)
  END
FROM tracking_ids t
WHERE (lower(t.tag) LIKE '%-20' OR lower(t.tag) LIKE '%-21')
  AND length(t.tag) > 3;

-- Keep current aliases when the desired base slug is ambiguous or owned by
-- another account. This prevents a live link from being reassigned silently.
DELETE FROM _tracking_slug_0025
WHERE EXISTS (
  SELECT 1
  FROM _tracking_slug_0025 other
  WHERE other.desired_slug = _tracking_slug_0025.desired_slug
    AND other.tracking_id != _tracking_slug_0025.tracking_id
)
OR EXISTS (
  SELECT 1
  FROM agents a
  WHERE a.slug = _tracking_slug_0025.desired_slug
    AND a.id != _tracking_slug_0025.agent_id
)
OR EXISTS (
  SELECT 1
  FROM agent_slug_aliases asa
  WHERE asa.slug = _tracking_slug_0025.desired_slug
    AND asa.tracking_id != _tracking_slug_0025.tracking_id
);

-- Move matching legacy aliases through a unique temporary value first so
-- conversions cannot trip over another alias during the same migration.
UPDATE agent_slug_aliases
SET slug = '__tracking-slug-0025-' || tracking_id,
    updated_at = CURRENT_TIMESTAMP
WHERE tracking_id IN (SELECT tracking_id FROM _tracking_slug_0025)
  AND lower(slug) = lower((
    SELECT t.tag
    FROM tracking_ids t
    WHERE t.id = agent_slug_aliases.tracking_id
  ));

UPDATE agent_slug_aliases
SET slug = (
      SELECT desired_slug
      FROM _tracking_slug_0025 candidate
      WHERE candidate.tracking_id = agent_slug_aliases.tracking_id
    ),
    agent_id = (
      SELECT agent_id
      FROM _tracking_slug_0025 candidate
      WHERE candidate.tracking_id = agent_slug_aliases.tracking_id
    ),
    marketplace = (
      SELECT marketplace
      FROM _tracking_slug_0025 candidate
      WHERE candidate.tracking_id = agent_slug_aliases.tracking_id
    ),
    is_active = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = '__tracking-slug-0025-' || tracking_id;

INSERT OR IGNORE INTO agent_slug_aliases (
  agent_id, tracking_id, marketplace, slug, is_active
)
SELECT
  candidate.agent_id,
  candidate.tracking_id,
  candidate.marketplace,
  candidate.desired_slug,
  1
FROM _tracking_slug_0025 candidate
LEFT JOIN agent_slug_aliases asa
  ON asa.tracking_id = candidate.tracking_id
 AND asa.marketplace = candidate.marketplace
WHERE asa.id IS NULL;

DROP TABLE _tracking_slug_0025;
