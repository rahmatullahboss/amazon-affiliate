import { ensurePublicSlugAlias } from "./public-slugs";

interface ExistingTrackingRow {
  id: number;
  tag: string;
  is_site_primary: number;
}

export interface SingleTrackingResult {
  id: number;
  agent_id: number;
  tag: string;
  label: string | null;
  marketplace: string;
  is_default: number;
  is_site_primary: number;
  is_active: number;
  is_portal_editable: number;
}

/**
 * Keeps one tracking row per agent + marketplace.
 * Re-adding a marketplace tag updates the existing row instead of appending another one.
 */
export async function replaceSingleTrackingForAgentMarketplace(input: {
  db: D1Database;
  agentId: number;
  marketplace: string;
  tag: string;
  label?: string | null;
  aliasSlug?: string | null;
  isSitePrimary?: boolean;
}): Promise<SingleTrackingResult> {
  const { results } = await input.db
    .prepare(
      `SELECT id, tag, is_site_primary
       FROM tracking_ids
       WHERE agent_id = ? AND marketplace = ?
       ORDER BY created_at DESC, id DESC`
    )
    .bind(input.agentId, input.marketplace)
    .all<ExistingTrackingRow>();

  const rows = results ?? [];
  const matchingTagRow = rows.find((row) => row.tag === input.tag);
  let keepId = matchingTagRow?.id ?? rows[0]?.id ?? null;
  const preserveSitePrimary = Boolean(
    input.isSitePrimary || rows.some((row) => row.is_site_primary === 1)
  );

  if (keepId === null) {
    const insertResult = await input.db
      .prepare(
        `INSERT INTO tracking_ids (
           agent_id, tag, label, marketplace, is_default,
           is_site_primary, is_active, is_portal_editable
         ) VALUES (?, ?, ?, ?, 1, ?, 1, 0)`
      )
      .bind(
        input.agentId,
        input.tag,
        input.label ?? null,
        input.marketplace,
        preserveSitePrimary ? 1 : 0
      )
      .run();

    keepId = Number(insertResult.meta.last_row_id);
  } else {
    const duplicateIds = rows.filter((row) => row.id !== keepId).map((row) => row.id);

    if (duplicateIds.length > 0) {
      const placeholders = duplicateIds.map(() => "?").join(", ");

      await input.db
        .prepare(
          `UPDATE agent_products
           SET tracking_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE agent_id = ? AND tracking_id IN (${placeholders})`
        )
        .bind(keepId, input.agentId, ...duplicateIds)
        .run();

      await input.db
        .prepare(`DELETE FROM agent_slug_aliases WHERE tracking_id IN (${placeholders})`)
        .bind(...duplicateIds)
        .run();

      await input.db
        .prepare(`DELETE FROM tracking_ids WHERE id IN (${placeholders})`)
        .bind(...duplicateIds)
        .run();
    }

    await input.db
      .prepare(
        `UPDATE tracking_ids
         SET tag = ?,
             label = ?,
             is_default = 1,
             is_site_primary = ?,
             is_active = 1,
             is_portal_editable = 0
         WHERE id = ?`
      )
      .bind(
        input.tag,
        input.label ?? null,
        preserveSitePrimary ? 1 : 0,
        keepId
      )
      .run();
  }

  if (keepId === null || !Number.isFinite(keepId)) {
    throw new Error("Tracking tag was not saved.");
  }

  const savedTrackingId = keepId;

  await ensurePublicSlugAlias({
    db: input.db,
    agentId: input.agentId,
    trackingId: savedTrackingId,
    marketplace: input.marketplace,
    fallbackSlug: input.tag,
    preferredAlias: input.aliasSlug?.trim() || input.tag,
  });

  const saved = await input.db
    .prepare(
      `SELECT id, agent_id, tag, label, marketplace, is_default,
              is_site_primary, is_active, is_portal_editable
       FROM tracking_ids
       WHERE id = ?`
    )
    .bind(savedTrackingId)
    .first<SingleTrackingResult>();

  if (!saved) {
    throw new Error("Tracking tag was not saved.");
  }

  return saved;
}
