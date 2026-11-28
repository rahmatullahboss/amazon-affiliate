-- Preserve current homepage rank/created_at ordering without a temporary sort.
-- 0034/0035 are reserved for the separately held publication pilot.
CREATE INDEX IF NOT EXISTS idx_agent_products_homepage_rank
ON agent_products(COALESCE(homepage_rank, 999999), created_at DESC)
WHERE is_active = 1 AND show_on_homepage = 1;
