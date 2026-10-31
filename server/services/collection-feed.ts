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

export async function getAllProductRows(
  db: D1Database,
  marketplace: string,
  limit = 6
): Promise<CollectionProductRow[]> {
  const safeLimit = Math.max(1, Math.min(60, Math.trunc(limit)));
  const result = await db.prepare(
    `SELECT p.id, p.asin, p.title, p.image_url, p.category, p.marketplace
     FROM products p
     WHERE ${ACTIVE_FILTER}
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT ?`
  ).bind(marketplace, safeLimit).all<CollectionProductRow>();
  return result.results ?? [];
}

export async function getCollectionRows(
  db: D1Database,
  marketplace: string,
  kind: CollectionKind,
  limit = 30
): Promise<CollectionProductRow[]> {
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
    sql = `WITH sheet_provenance AS (
        SELECT asin, marketplace,
          MAX(CASE
            WHEN is_present = 1 AND row_status = 'active'
              AND published_revision = revision
              THEN published_at ELSE NULL END
          ) AS last_published
        FROM sheet_listing_activity
        GROUP BY asin, marketplace
      )
      SELECT ${select}
      FROM products p
      LEFT JOIN sheet_provenance sa ON sa.asin = p.asin AND sa.marketplace = p.marketplace
      WHERE ${ACTIVE_FILTER} AND (
        (sa.asin IS NOT NULL AND sa.last_published >= datetime('now', '-72 hours'))
        OR (sa.asin IS NULL AND p.updated_at >= datetime('now', '-72 hours'))
      )
      ORDER BY COALESCE(sa.last_published, p.updated_at) DESC, p.id DESC
      LIMIT ?`;
  } else {
    sql = `SELECT ${select}, COUNT(c.id) AS activity_count
      FROM clicks c JOIN products p ON p.id = c.product_id
      WHERE ${ACTIVE_FILTER} AND c.clicked_at >= datetime('now', '-7 days')
      GROUP BY p.id
      HAVING COUNT(c.id) > 0
      ORDER BY activity_count DESC, p.id DESC
      LIMIT ?`;
  }

  const result = await db.prepare(sql).bind(marketplace, kind === "top-10" ? Math.min(10, safeLimit) : safeLimit).all<CollectionProductRow>();
  return result.results ?? [];
}
