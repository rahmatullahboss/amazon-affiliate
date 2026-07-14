export interface DefaultTrackingTarget {
  agentId: number;
  trackingId: number;
  marketplace: string;
  tag: string;
}

export interface DefaultMappingBackfillResult {
  checked: number;
  assigned: number;
  skippedWithoutDefault: number;
}

async function loadDefaultTrackingTarget(
  db: D1Database,
  marketplace: string
): Promise<DefaultTrackingTarget | null> {
  return db
    .prepare(
      `SELECT
         t.agent_id AS agentId,
         t.id AS trackingId,
         t.marketplace AS marketplace,
         t.tag AS tag
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       WHERE t.marketplace = ?
         AND t.is_active = 1
         AND a.is_active = 1
         AND (t.is_site_primary = 1 OR t.is_default = 1)
       ORDER BY t.is_site_primary DESC, t.is_default DESC, t.created_at ASC, t.id ASC
       LIMIT 1`
    )
    .bind(marketplace)
    .first<DefaultTrackingTarget>();
}

export async function ensureDefaultProductMapping(
  db: D1Database,
  productId: number,
  marketplace: string
): Promise<DefaultTrackingTarget | null> {
  const activeMapping = await db
    .prepare(
      `SELECT 1
       FROM agent_products
       WHERE product_id = ? AND is_active = 1
       LIMIT 1`
    )
    .bind(productId)
    .first<{ 1: number }>();

  if (activeMapping) {
    return null;
  }

  const target = await loadDefaultTrackingTarget(db, marketplace);
  if (!target) {
    return null;
  }

  await db
    .prepare(
      `INSERT INTO agent_products (
         agent_id, product_id, tracking_id, custom_title, is_active
       ) VALUES (?, ?, ?, NULL, 1)
       ON CONFLICT(agent_id, product_id) DO UPDATE SET
         tracking_id = excluded.tracking_id,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(target.agentId, productId, target.trackingId)
    .run();

  return target;
}

export async function backfillMissingDefaultProductMappings(
  db: D1Database,
  marketplace?: string | null
): Promise<DefaultMappingBackfillResult> {
  const normalizedMarketplace = marketplace?.trim().toUpperCase() || null;
  const query = normalizedMarketplace
    ? `SELECT p.id, p.marketplace
       FROM products p
       WHERE p.is_active = 1
         AND p.marketplace = ?
         AND NOT EXISTS (
           SELECT 1
           FROM agent_products ap
           WHERE ap.product_id = p.id AND ap.is_active = 1
         )
       ORDER BY p.created_at DESC, p.id DESC`
    : `SELECT p.id, p.marketplace
       FROM products p
       WHERE p.is_active = 1
         AND NOT EXISTS (
           SELECT 1
           FROM agent_products ap
           WHERE ap.product_id = p.id AND ap.is_active = 1
         )
       ORDER BY p.created_at DESC, p.id DESC`;

  const statement = db.prepare(query);
  const rows = normalizedMarketplace
    ? await statement.bind(normalizedMarketplace).all<{ id: number; marketplace: string }>()
    : await statement.all<{ id: number; marketplace: string }>();

  let assigned = 0;
  let skippedWithoutDefault = 0;

  for (const product of rows.results ?? []) {
    const target = await ensureDefaultProductMapping(db, product.id, product.marketplace);
    if (target) {
      assigned += 1;
    } else {
      skippedWithoutDefault += 1;
    }
  }

  return {
    checked: rows.results?.length ?? 0,
    assigned,
    skippedWithoutDefault,
  };
}
