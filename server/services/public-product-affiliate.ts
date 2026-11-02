import { buildAmazonUrl } from "../utils/types";

/**
 * Resolve each product's approved Sheet/agent tracking mapping.
 * Never depend on is_site_primary: older live data has none set.
 * Do not borrow a tracking tag from a different product or marketplace.
 */
export interface PublicAffiliateProduct {
  id: number;
  asin: string;
  marketplace: string | null;
}

export interface PublicAffiliateRow {
  product_id: number;
  marketplace: string;
  tracking_tag: string;
}

export function isValidPublicTrackingTag(tag: string | null | undefined): tag is string {
  return typeof tag === "string" && /^[a-z0-9][a-z0-9_-]{1,79}$/i.test(tag);
}

export function createAmazonAffiliateHref(
  asin: string,
  marketplace: string | null,
  trackingTag: string | null | undefined,
): string | null {
  if (!/^[A-Z0-9]{10}$/i.test(asin) || !marketplace || !isValidPublicTrackingTag(trackingTag)) return null;
  if (!["US", "CA", "UK", "DE", "IT", "FR", "ES"].includes(marketplace.toUpperCase())) return null;
  return buildAmazonUrl(asin.toUpperCase(), trackingTag, marketplace.toUpperCase());
}

export async function getPublicProductAffiliateHrefs(
  db: D1Database,
  products: PublicAffiliateProduct[],
): Promise<Map<number, string>> {
  const candidates = products.filter((p) => p.id > 0 && Boolean(p.marketplace));
  if (!candidates.length) return new Map();
  const productsById = new Map(candidates.map((p) => [p.id, p]));
  const links = new Map<number, string>();

  // Bound IDs, no string interpolation of untrusted values.
  for (let offset = 0; offset < candidates.length; offset += 80) {
    const ids = Array.from(new Set(candidates.slice(offset, offset + 80).map((p) => p.id)));
    const placeholders = ids.map(() => "?").join(", ");
    const { results } = await db.prepare(`
      SELECT ap.product_id, t.marketplace, t.tag AS tracking_tag
      FROM agent_products ap
      JOIN tracking_ids t ON t.id = ap.tracking_id
      JOIN agents a ON a.id = ap.agent_id
      JOIN products p ON p.id = ap.product_id
      WHERE ap.product_id IN (${placeholders})
        AND ap.is_active = 1 AND a.is_active = 1 AND t.is_active = 1
        AND p.is_active = 1 AND p.status = 'active' AND p.is_adult = 0
        AND t.marketplace = p.marketplace
      ORDER BY ap.show_on_homepage DESC,
               COALESCE(ap.homepage_rank, 999999) ASC,
               ap.updated_at DESC, ap.id DESC
    `).bind(...ids).all<PublicAffiliateRow>();
    for (const row of results ?? []) {
      if (links.has(row.product_id)) continue;
      const product = productsById.get(row.product_id);
      if (!product || row.marketplace !== product.marketplace) continue;
      const href = createAmazonAffiliateHref(product.asin, row.marketplace, row.tracking_tag);
      if (href) links.set(row.product_id, href);
    }
  }
  // Product-specific Sheet/agent mappings have priority. Only a separately
  // designated site-primary tag can serve as a generic-product fallback.
  const unresolved = candidates.filter((product) => !links.has(product.id));
  const marketplaces = Array.from(new Set(
    unresolved.map((product) => product.marketplace).filter((m): m is string => Boolean(m))
  ));
  if (marketplaces.length) {
    const placeholders = marketplaces.map(() => "?").join(", ");
    const { results } = await db.prepare(`
      SELECT t.marketplace, t.tag AS tracking_tag
      FROM tracking_ids t JOIN agents a ON a.id = t.agent_id
      WHERE t.marketplace IN (${placeholders})
        AND t.is_active = 1 AND t.is_site_primary = 1 AND a.is_active = 1
      ORDER BY t.marketplace, t.id DESC
    `).bind(...marketplaces).all<{ marketplace: string; tracking_tag: string }>();
    const sitePrimary = new Map<string, string>();
    for (const row of results ?? []) {
      if (!sitePrimary.has(row.marketplace) && isValidPublicTrackingTag(row.tracking_tag)) {
        sitePrimary.set(row.marketplace, row.tracking_tag);
      }
    }
    for (const product of unresolved) {
      const href = createAmazonAffiliateHref(
        product.asin, product.marketplace, sitePrimary.get(product.marketplace ?? "")
      );
      if (href) links.set(product.id, href);
    }
  }
  return links;
}
