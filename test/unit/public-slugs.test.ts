import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { resolvePublicSlug } from "../../server/services/public-slugs";

describe("public slug resolution", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_slug_aliases").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  it("keeps a full tracking-tag URL working after its public alias becomes suffix-free", async () => {
    await env.DB.prepare(
      "INSERT INTO agents (id, slug, name, is_active) VALUES (971, 'canonical-owner', 'Canonical Owner', 1)"
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable
       ) VALUES (9701, 971, 'legacy-owner-20', 'US', 1, 1, 0)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_slug_aliases (agent_id, tracking_id, marketplace, slug, is_active)
       VALUES (971, 9701, 'US', 'legacy-owner', 1)`
    ).run();

    await expect(resolvePublicSlug(env.DB, "legacy-owner")).resolves.toMatchObject({
      agentId: 971,
      publicSlug: "legacy-owner",
      trackingId: 9701,
      marketplace: "US",
    });

    await expect(resolvePublicSlug(env.DB, "LEGACY-OWNER-20")).resolves.toMatchObject({
      agentId: 971,
      publicSlug: "legacy-owner-20",
      trackingId: 9701,
      marketplace: "US",
    });
  });
});
