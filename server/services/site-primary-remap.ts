import type { D1Database } from "@cloudflare/workers-types";

export interface SitePrimaryTrackingTarget {
  agentId: number;
  trackingId: number;
  marketplace: string;
  tag: string;
}

async function loadSitePrimaryTrackingTarget(
  db: D1Database,
  marketplace: string,
  excludedTrackingId?: number
): Promise<SitePrimaryTrackingTarget | null> {
  const clauses = [
    "t.marketplace = ?",
    "t.is_active = 1",
    "t.is_site_primary = 1",
    "a.is_active = 1",
  ];
  const params: Array<string | number> = [marketplace];

  if (excludedTrackingId) {
    clauses.push("t.id != ?");
    params.push(excludedTrackingId);
  }

  return db
    .prepare(
      `SELECT
         t.id as trackingId,
         t.agent_id as agentId,
         t.marketplace as marketplace,
         t.tag as tag
       FROM tracking_ids t
       JOIN agents a ON a.id = t.agent_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY t.created_at ASC
       LIMIT 1`
    )
    .bind(...params)
    .first<SitePrimaryTrackingTarget>();
}

export async function requireSitePrimaryTrackingTarget(
  db: D1Database,
  marketplace: string,
  excludedTrackingId?: number
): Promise<SitePrimaryTrackingTarget> {
  const replacement = await loadSitePrimaryTrackingTarget(db, marketplace, excludedTrackingId);

  if (!replacement) {
    throw new Error(`Missing active site-primary tag for marketplace: ${marketplace}`);
  }

  return replacement;
}

export async function collectAgentDeleteMarketplaces(
  db: D1Database,
  agentId: number
): Promise<string[]> {
  const remapRows = await db
    .prepare(
      `SELECT DISTINCT t.marketplace as marketplace
       FROM agent_products ap
       JOIN tracking_ids t ON t.id = ap.tracking_id
       WHERE ap.agent_id = ?`
    )
    .bind(agentId)
    .all<{ marketplace: string }>();

  const clickRows = await db
    .prepare(
      `SELECT DISTINCT p.marketplace as marketplace
       FROM clicks c
       JOIN products p ON p.id = c.product_id
       WHERE c.agent_id = ?`
    )
    .bind(agentId)
    .all<{ marketplace: string }>();

  const pageViewRows = await db
    .prepare(
      `SELECT DISTINCT p.marketplace as marketplace
       FROM page_views pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.agent_id = ?`
    )
    .bind(agentId)
    .all<{ marketplace: string }>();

  return [...new Set([
    ...(remapRows.results ?? []).map((row) => row.marketplace),
    ...(clickRows.results ?? []).map((row) => row.marketplace),
    ...(pageViewRows.results ?? []).map((row) => row.marketplace),
  ])];
}

export async function ensureSitePrimaryCoverageForMarketplaces(
  db: D1Database,
  marketplaces: string[],
  excludedTrackingIdsByMarketplace?: Map<string, number>
): Promise<Map<string, SitePrimaryTrackingTarget>> {
  const replacements = new Map<string, SitePrimaryTrackingTarget>();
  const missing: string[] = [];

  for (const marketplace of marketplaces) {
    const replacement = await loadSitePrimaryTrackingTarget(
      db,
      marketplace,
      excludedTrackingIdsByMarketplace?.get(marketplace)
    );

    if (!replacement) {
      missing.push(marketplace);
      continue;
    }

    replacements.set(marketplace, replacement);
  }

  if (missing.length > 0) {
    throw new Error(`Missing active site-primary tag for marketplace(s): ${missing.join(", ")}`);
  }

  return replacements;
}

export async function remapAgentProductsForAgentToSitePrimary(
  db: D1Database,
  agentId: number,
  replacements: Map<string, SitePrimaryTrackingTarget>
): Promise<void> {
  for (const [marketplace, replacement] of replacements) {
    await db
      .prepare(
        `UPDATE agent_products
         SET agent_id = ?, tracking_id = ?
         WHERE agent_id = ?
           AND tracking_id IN (
             SELECT id
             FROM tracking_ids
             WHERE agent_id = ? AND marketplace = ?
           )`
      )
      .bind(replacement.agentId, replacement.trackingId, agentId, agentId, marketplace)
      .run();
  }
}

export async function remapAgentTrackingToSitePrimary(
  db: D1Database,
  trackingId: number,
  replacement: SitePrimaryTrackingTarget
): Promise<void> {
  await db
    .prepare(
      `UPDATE agent_products
       SET agent_id = ?, tracking_id = ?
       WHERE tracking_id = ?`
    )
    .bind(replacement.agentId, replacement.trackingId, trackingId)
    .run();
}

export async function remapAgentAnalyticsToSitePrimary(
  db: D1Database,
  deletedAgentId: number,
  replacements: Map<string, SitePrimaryTrackingTarget>
): Promise<void> {
  for (const [marketplace, replacement] of replacements) {
    await db
      .prepare(
        `UPDATE clicks
         SET agent_id = ?
         WHERE agent_id = ?
           AND product_id IN (
             SELECT id
             FROM products
             WHERE marketplace = ?
           )`
      )
      .bind(replacement.agentId, deletedAgentId, marketplace)
      .run();

    await db
      .prepare(
        `UPDATE page_views
         SET agent_id = ?
         WHERE agent_id = ?
           AND product_id IN (
             SELECT id
             FROM products
             WHERE marketplace = ?
           )`
      )
      .bind(replacement.agentId, deletedAgentId, marketplace)
      .run();
  }
}
