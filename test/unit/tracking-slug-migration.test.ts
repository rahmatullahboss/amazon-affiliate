import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";

const migrationModules = import.meta.glob("../../migrations/0025_tracking_tag_base_slugs.sql", {
  eager: true,
  query: "?raw",
  import: "default",
});

const migrationSql = Object.values(migrationModules)[0] as string;

async function applyMigration(): Promise<void> {
  const cleanSql = migrationSql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const statements = cleanSql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
}

describe("tracking tag base slug migration", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_slug_aliases").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  it("removes -20/-21 from default aliases without changing the full tracking tag", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES
         (951, 'legacy-agent-20', 'Legacy Agent', 1),
         (952, 'uk-agent-21', 'UK Agent', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable
       ) VALUES
         (9501, 951, 'legacy-agent-20', 'US', 1, 1, 0),
         (9502, 952, 'uk-agent-21', 'UK', 1, 1, 0)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_slug_aliases (agent_id, tracking_id, marketplace, slug, is_active) VALUES
         (951, 9501, 'US', 'legacy-agent-20', 1),
         (952, 9502, 'UK', 'uk-agent-21', 1)`
    ).run();

    await applyMigration();

    const { results } = await env.DB.prepare(
      `SELECT t.tag, asa.slug
       FROM tracking_ids t
       JOIN agent_slug_aliases asa ON asa.tracking_id = t.id
       ORDER BY t.id`
    ).all<{ tag: string; slug: string }>();

    expect(results).toEqual([
      { tag: "legacy-agent-20", slug: "legacy-agent" },
      { tag: "uk-agent-21", slug: "uk-agent" },
    ]);
  });

  it("preserves a custom alias and skips a base slug owned by another agent", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES
         (961, 'custom-owner', 'Custom Owner', 1),
         (962, 'reserved', 'Reserved Agent', 1),
         (963, 'legacy-reserved-20', 'Legacy Reserved', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable
       ) VALUES
         (9601, 961, 'custom-owner-20', 'US', 1, 1, 0),
         (9602, 963, 'reserved-20', 'CA', 1, 1, 0)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_slug_aliases (agent_id, tracking_id, marketplace, slug, is_active) VALUES
         (961, 9601, 'US', 'my-custom-link', 1),
         (963, 9602, 'CA', 'reserved-20', 1)`
    ).run();

    await applyMigration();

    const { results } = await env.DB.prepare(
      "SELECT tracking_id, slug FROM agent_slug_aliases ORDER BY tracking_id"
    ).all<{ tracking_id: number; slug: string }>();

    expect(results).toEqual([
      { tracking_id: 9601, slug: "my-custom-link" },
      { tracking_id: 9602, slug: "reserved-20" },
    ]);
  });
});
