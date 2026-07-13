import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";

const migrationModules = import.meta.glob("../../migrations/0024_single_tracking_per_agent_marketplace.sql", {
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

describe("single tracking migration", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_slug_aliases").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DROP INDEX IF EXISTS idx_tracking_ids_single_agent_marketplace").run();
  });

  it("keeps the latest valid active row, ignores archived rows, remaps products, and preserves site-primary status", async () => {
    await env.DB.prepare(
      "INSERT INTO agents (id, slug, name, is_active) VALUES (901, 'migration-agent', 'Migration Agent', 1)"
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default,
         is_site_primary, is_active, is_portal_editable
       ) VALUES
         (9001, 901, 'migration-old-20', 'US', 1, 1, 1, 1),
         (9002, 901, 'migration-latest-20', 'US', 0, 0, 1, 1),
         (9003, 901, 'migration-latest-20-archived-9003', 'US', 0, 0, 0, 1)`
    ).run();
    await env.DB.prepare(
      "INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active) VALUES (9101, 'B0MIGRATE1', 'Migration Product', 'https://img.test/migration.jpg', 'US', 'active', 1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active) VALUES (901, 9101, 9001, 1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO agent_slug_aliases (agent_id, tracking_id, marketplace, slug, is_active) VALUES (901, 9001, 'US', 'migration-old', 1)"
    ).run();

    await applyMigration();

    const { results } = await env.DB.prepare(
      `SELECT id, tag, is_default, is_site_primary, is_active, is_portal_editable
       FROM tracking_ids
       WHERE agent_id = 901 AND marketplace = 'US'`
    ).all<{
      id: number;
      tag: string;
      is_default: number;
      is_site_primary: number;
      is_active: number;
      is_portal_editable: number;
    }>();

    expect(results).toEqual([
      {
        id: 9002,
        tag: "migration-latest-20",
        is_default: 1,
        is_site_primary: 1,
        is_active: 1,
        is_portal_editable: 0,
      },
    ]);

    const mapping = await env.DB.prepare(
      "SELECT tracking_id FROM agent_products WHERE agent_id = 901 AND product_id = 9101"
    ).first<{ tracking_id: number }>();
    expect(mapping?.tracking_id).toBe(9002);

    const alias = await env.DB.prepare(
      "SELECT tracking_id, slug FROM agent_slug_aliases WHERE agent_id = 901 AND marketplace = 'US'"
    ).first<{ tracking_id: number; slug: string }>();
    expect(alias).toEqual({ tracking_id: 9002, slug: "migration-latest-20" });
  });
});
