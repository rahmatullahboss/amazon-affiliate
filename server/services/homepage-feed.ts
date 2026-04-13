import type { D1Database } from "@cloudflare/workers-types";

export interface HomepageFeedRow {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  category: string | null;
  marketplace: string | null;
  created_at: string;
  agent_slug: string | null;
  agent_name: string | null;
  tracking_tag: string | null;
  show_on_homepage: number;
  source_type: "mapping" | "fallback";
}

export async function getHomepageFeedRows(
  db: D1Database,
  marketplace: string,
  limit: number
): Promise<HomepageFeedRow[]> {
  const mappingResults = await db
    .prepare(
      `SELECT
         p.id,
         p.asin,
         COALESCE(ap.custom_title, p.title) as title,
         p.image_url,
         p.category,
         p.marketplace,
         ap.created_at,
         a.slug as agent_slug,
         a.name as agent_name,
         t.tag as tracking_tag,
         ap.show_on_homepage,
         'mapping' as source_type
       FROM agent_products ap
       JOIN products p ON p.id = ap.product_id
       JOIN agents a ON a.id = ap.agent_id
       JOIN tracking_ids t ON t.id = ap.tracking_id
       WHERE ap.is_active = 1
         AND ap.show_on_homepage = 1
         AND p.is_active = 1
         AND p.status = 'active'
         AND a.is_active = 1
         AND t.is_active = 1
         AND t.marketplace = ?
         AND p.marketplace = ?
       ORDER BY COALESCE(ap.homepage_rank, 999999) ASC, ap.created_at DESC
       LIMIT ?`
    )
    .bind(marketplace, marketplace, limit)
    .all<HomepageFeedRow>();

  if ((mappingResults.results ?? []).length > 0) {
    return mappingResults.results ?? [];
  }

  const fallbackResults = await db
    .prepare(
      `SELECT
         p.id,
         p.asin,
         p.title,
         p.image_url,
         p.category,
         p.marketplace,
         p.created_at,
         NULL as agent_slug,
         NULL as agent_name,
         NULL as tracking_tag,
         0 as show_on_homepage,
         'fallback' as source_type
       FROM products p
       WHERE p.is_active = 1
         AND p.status = 'active'
         AND p.marketplace = ?
       ORDER BY p.created_at DESC
       LIMIT ?`
    )
    .bind(marketplace, limit)
    .all<HomepageFeedRow>();

  return fallbackResults.results ?? [];
}
