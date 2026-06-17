-- Index for COUNT(*) subquery in products list: WHERE product_id = ? AND is_active = 1
-- Existing idx_ap_agent_product is on (agent_id, product_id) — wrong order for this query.
CREATE INDEX IF NOT EXISTS idx_ap_product_active ON agent_products(product_id) WHERE is_active = 1;
