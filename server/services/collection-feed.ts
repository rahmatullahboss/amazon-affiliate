export const COLLECTION_KINDS = ["featured", "trending", "latest", "top-10"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export interface CollectionProductRow {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  marketplace: string;
  category: string | null;
  activity_count?: number;
  tracking_tag?: string | null;
}

export function isCollectionKind(value: string | undefined): value is CollectionKind {
  return COLLECTION_KINDS.some((kind) => kind === value);
}

const ACTIVE_FILTER =
  "p.is_active = 1 AND p.status = 'active' AND p.is_adult = 0 AND p.marketplace = ?";

export function prepareAllProductRows(
  db: D1Database,
  marketplace: string,
  limit = 6
): D1PreparedStatement {
  const safeLimit = Math.max(1, Math.min(60, Math.trunc(limit)));
  return db.prepare(
    `SELECT p.id, p.asin, p.title, p.image_url, p.category, p.marketplace
     FROM products p
     WHERE ${ACTIVE_FILTER}
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT ?`
  ).bind(marketplace, safeLimit);
}

export async function getAllProductRows(db: D1Database, marketplace: string, limit = 6): Promise<CollectionProductRow[]> {
  const result = await prepareAllProductRows(db, marketplace, limit).all<CollectionProductRow>();
  return result.results ?? [];
}

/** Both homepage click-based sections share the same ranking and tie-breaker. */
export async function getHomepageRankingRows(db: D1Database, marketplace: string) {
  const topRows = await getCollectionRows(db, marketplace, "top-10", 10);
  return { trendingRows: topRows.slice(0, 6), topRows };
}

export const LATEST_UNAVAILABLE_MESSAGE = "Latest listings are temporarily unavailable. Please check back later.";

/** A missing optional provenance schema must not bring down the whole storefront.
 * Never substitute unverified listing dates for missing provenance.
 */
export async function getLatestCollectionResult(db: D1Database, marketplace: string, limit = 30) {
  try {
    return { rows: await getCollectionRows(db, marketplace, "latest", limit), available: true };
  } catch (error) {
    if (!(error instanceof Error) || !/no such table:\s*(?:main\.)?sheet_listing_activity\b/i.test(error.message)) {
      throw error;
    }
    console.warn("[LATEST_COLLECTION] Missing sheet_listing_activity schema; latest listings unavailable");
    return { rows: [] as CollectionProductRow[], available: false };
  }
}

export function prepareCollectionRows(
  db: D1Database,
  marketplace: string,
  kind: CollectionKind,
  limit = 30
): D1PreparedStatement {
  const safeLimit = Math.max(1, Math.min(60, Math.trunc(limit)));
  const select =
    "p.id, p.asin, p.title, p.image_url, p.category, p.marketplace";
  let sql: string;

  if (kind === "featured") {
    sql = `SELECT ${select}
      FROM agent_products ap JOIN products p ON p.id = ap.product_id
      JOIN agents a ON a.id = ap.agent_id
      JOIN tracking_ids t ON t.id = ap.tracking_id
      WHERE ${ACTIVE_FILTER} AND ap.is_active = 1
        AND ap.show_on_homepage = 1 AND a.is_active = 1 AND t.is_active = 1
        AND ap.created_at >= datetime('now', '-72 hours')
      GROUP BY p.id
      ORDER BY MIN(COALESCE(ap.homepage_rank, 999999)), MAX(ap.created_at) DESC
      LIMIT ?`;
  } else if (kind === "latest") {
    // These branches are disjoint: any provenance row (including pending,
    // inactive, removed, or stale rows) excludes the product-updated fallback.
    // Each branch needs at most the requested top N before the final merge.
    sql = `WITH sheet_recent AS MATERIALIZED (
        SELECT asin, marketplace, MAX(published_at) AS fresh_at
        FROM sheet_listing_activity INDEXED BY idx_sheet_listing_activity_latest
        WHERE marketplace = ?1 AND is_present = 1 AND row_status = 'active'
          AND published_revision = revision
          AND published_at >= datetime('now', '-72 hours')
        GROUP BY asin, marketplace
      ), sheet_top AS (
        SELECT p.id, s.fresh_at FROM sheet_recent s
        CROSS JOIN products p INDEXED BY idx_products_asin
          ON p.asin = s.asin AND p.marketplace = s.marketplace
        WHERE p.is_active = 1 AND p.status = 'active' AND p.is_adult = 0
        ORDER BY s.fresh_at DESC, p.id DESC LIMIT ?2
      ), fallback_top AS (
        SELECT p.id, p.updated_at AS fresh_at
        FROM products p INDEXED BY idx_products_public_updated
        WHERE p.is_active = 1 AND p.status = 'active' AND p.is_adult = 0
          AND p.marketplace = ?1 AND p.updated_at >= datetime('now', '-72 hours')
          AND NOT EXISTS (
            SELECT 1 FROM sheet_listing_activity s
            WHERE s.asin = p.asin AND s.marketplace = p.marketplace
          )
        ORDER BY p.updated_at DESC, p.id DESC LIMIT ?2
      ), combined AS (
        SELECT id, fresh_at FROM sheet_top UNION ALL SELECT id, fresh_at FROM fallback_top
        ORDER BY fresh_at DESC, id DESC LIMIT ?2
      )
      SELECT ${select} FROM combined c
      CROSS JOIN products p ON p.id = c.id
      ORDER BY c.fresh_at DESC, p.id DESC`;
  } else {
    // Aggregate only the recent click window, then look up the matching products.
    // The existing date index and join order avoid scanning the entire catalog
    // when click activity is sparse. Visibility and deterministic ties are unchanged.
    sql = `WITH recent AS MATERIALIZED (
        SELECT product_id, COUNT(*) AS activity_count
        FROM clicks INDEXED BY idx_clicks_date
        WHERE clicked_at >= datetime('now', '-7 days')
        GROUP BY product_id
      )
      SELECT ${select}, r.activity_count AS activity_count
      FROM recent r CROSS JOIN products p ON p.id = r.product_id
      WHERE ${ACTIVE_FILTER}
      ORDER BY activity_count DESC, p.id DESC
      LIMIT ?`;
  }

  return db.prepare(sql).bind(marketplace, kind === "top-10" ? Math.min(10, safeLimit) : safeLimit);
}

export async function getCollectionRows(db: D1Database, marketplace: string, kind: CollectionKind, limit = 30): Promise<CollectionProductRow[]> {
  const result = await prepareCollectionRows(db, marketplace, kind, limit).all<CollectionProductRow>();
  return result.results ?? [];
}
