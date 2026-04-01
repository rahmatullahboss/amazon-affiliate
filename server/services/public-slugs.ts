export interface ResolvedPublicSlug {
  agentId: number;
  canonicalAgentSlug: string;
  publicSlug: string;
  trackingId: number | null;
  marketplace: string | null;
}

interface PublicSlugRow {
  agent_id: number;
  canonical_agent_slug: string;
  public_slug: string;
  tracking_id: number | null;
  marketplace: string | null;
}

export async function resolvePublicSlug(
  db: D1Database,
  slug: string
): Promise<ResolvedPublicSlug | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    return null;
  }

  const aliasRow = await db
    .prepare(
      `SELECT
         asa.agent_id as agent_id,
         a.slug as canonical_agent_slug,
         asa.slug as public_slug,
         asa.tracking_id as tracking_id,
         asa.marketplace as marketplace
       FROM agent_slug_aliases asa
       JOIN agents a ON a.id = asa.agent_id
       JOIN tracking_ids t ON t.id = asa.tracking_id
       WHERE asa.slug = ?
         AND asa.is_active = 1
         AND a.is_active = 1
         AND t.is_active = 1
       LIMIT 1`
    )
    .bind(normalizedSlug)
    .first<PublicSlugRow>();

  if (aliasRow) {
    return {
      agentId: aliasRow.agent_id,
      canonicalAgentSlug: aliasRow.canonical_agent_slug,
      publicSlug: aliasRow.public_slug,
      trackingId: aliasRow.tracking_id,
      marketplace: aliasRow.marketplace,
    };
  }

  const agentRow = await db
    .prepare(
      `SELECT
         a.id as agent_id,
         a.slug as canonical_agent_slug,
         a.slug as public_slug,
         NULL as tracking_id,
         NULL as marketplace
       FROM agents a
       WHERE a.slug = ?
         AND a.is_active = 1
       LIMIT 1`
    )
    .bind(normalizedSlug)
    .first<PublicSlugRow>();

  if (!agentRow) {
    return null;
  }

  return {
    agentId: agentRow.agent_id,
    canonicalAgentSlug: agentRow.canonical_agent_slug,
    publicSlug: agentRow.public_slug,
    trackingId: null,
    marketplace: null,
  };
}

export async function getPublicSlugForTracking(input: {
  db: D1Database;
  agentId: number;
  trackingId: number;
  marketplace: string;
  fallbackSlug: string;
}): Promise<string> {
  const alias = await input.db
    .prepare(
      `SELECT slug
       FROM agent_slug_aliases
       WHERE agent_id = ?
         AND tracking_id = ?
         AND marketplace = ?
         AND is_active = 1
       LIMIT 1`
    )
    .bind(input.agentId, input.trackingId, input.marketplace)
    .first<{ slug: string }>();

  return alias?.slug ?? input.fallbackSlug;
}
