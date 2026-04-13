import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

describe("Admin agent management API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM audit_logs").run();
    await env.DB.prepare("DELETE FROM agent_slug_aliases").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM users").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
    await env.DB.prepare(
      `INSERT INTO users (id, username, email, password_hash, role, is_active)
       VALUES (1, 'admin-audit', 'admin@example.com', 'hash', 'admin', 1)`
    ).run();
  });

  it("lets admin update an agent base slug", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 901, "old-agent-slug", "Old Agent");
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/agents/901", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          slug: "new-agent-slug",
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const updatedAgent = await env.DB.prepare(
      `SELECT slug
       FROM agents
       WHERE id = ?`
    )
      .bind(901)
      .first<{ slug: string }>();

    expect(updatedAgent?.slug).toBe("new-agent-slug");
  });

  it("rejects deleting an active agent", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 902, "active-agent", "Active Agent");
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/agents/902", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Deactivate the agent before deleting it.",
    });
  });

  it("deletes an inactive agent and remaps linked products to marketplace site-primary tags", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 903, "site-owner", "Site Owner");
    await DbFactory.seedAgent(env.DB, 904, "inactive-agent", "Inactive Agent");
    await env.DB.prepare(
      `UPDATE agents
       SET is_active = 0
       WHERE id = 904`
    ).run();
    await env.DB.prepare(
      `INSERT INTO users (id, username, email, password_hash, role, agent_id, is_active)
       VALUES (501, 'inactive-user', 'inactive@example.com', 'hash', 'agent', 904, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
         (601, 'B0AGENTUS1', 'US Product', 'http://img.com/us.jpg', 'US', 'active', 1),
         (602, 'B0AGENTDE1', 'DE Product', 'http://img.com/de.jpg', 'DE', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_site_primary, is_active)
       VALUES
         (701, 903, 'site-us-20', 'US', 1, 1, 1),
         (702, 903, 'site-de-21', 'DE', 1, 1, 1),
         (703, 904, 'inactive-us-20', 'US', 1, 0, 1),
         (704, 904, 'inactive-de-21', 'DE', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES
         (801, 904, 601, 703, NULL, 1),
         (802, 904, 602, 704, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/agents/904", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const deletedAgent = await env.DB.prepare(
      `SELECT id
       FROM agents
       WHERE id = 904`
    ).first<{ id: number }>();
    const orphanedTags = await env.DB.prepare(
      `SELECT id
       FROM tracking_ids
       WHERE agent_id = 904`
    ).all();
    const remappedRows = await env.DB.prepare(
      `SELECT product_id, agent_id, tracking_id
       FROM agent_products
       WHERE id IN (801, 802)
       ORDER BY id ASC`
    ).all<{ product_id: number; agent_id: number; tracking_id: number }>();
    const detachedUser = await env.DB.prepare(
      `SELECT agent_id, is_active
       FROM users
       WHERE id = 501`
    ).first<{ agent_id: number | null; is_active: number }>();

    expect(deletedAgent).toBeNull();
    expect(orphanedTags.results).toHaveLength(0);
    expect(remappedRows.results).toEqual([
      { product_id: 601, agent_id: 903, tracking_id: 701 },
      { product_id: 602, agent_id: 903, tracking_id: 702 },
    ]);
    expect(detachedUser).toEqual({ agent_id: null, is_active: 0 });
  });

  it("deletes all tracking for an inactive agent and remaps products to site-primary owners", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 907, "site-owner-three", "Site Owner Three");
    await DbFactory.seedAgent(env.DB, 908, "inactive-no-tags", "Inactive No Tags");
    await env.DB.prepare(
      `UPDATE agents
       SET is_active = 0
       WHERE id = 908`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (604, 'B0DELETEALL', 'Delete All Product', 'http://img.com/delete-all.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_site_primary, is_active)
       VALUES
         (707, 907, 'site-owner-three-us-20', 'US', 1, 1, 1),
         (708, 908, 'inactive-delete-all-us-20', 'US', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (804, 908, 604, 708, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/agents/908/tracking", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const preservedAgent = await env.DB.prepare(
      `SELECT id, is_active
       FROM agents
       WHERE id = 908`
    ).first<{ id: number; is_active: number }>();
    const remainingTags = await env.DB.prepare(
      `SELECT id
       FROM tracking_ids
       WHERE agent_id = 908`
    ).all();
    const remappedRow = await env.DB.prepare(
      `SELECT agent_id, tracking_id
       FROM agent_products
       WHERE id = 804`
    ).first<{ agent_id: number; tracking_id: number }>();

    expect(preservedAgent).toEqual({ id: 908, is_active: 0 });
    expect(remainingTags.results).toHaveLength(0);
    expect(remappedRow).toEqual({ agent_id: 907, tracking_id: 707 });
  });

  it("blocks agent delete when a marketplace site-primary tag is missing", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 905, "site-owner-two", "Site Owner Two");
    await DbFactory.seedAgent(env.DB, 906, "inactive-no-primary", "Inactive No Primary");
    await env.DB.prepare(
      `UPDATE agents
       SET is_active = 0
       WHERE id = 906`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (603, 'B0NODEPRIM', 'No Primary Product', 'http://img.com/de2.jpg', 'DE', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_site_primary, is_active)
       VALUES
         (705, 905, 'site-us-only-20', 'US', 1, 1, 1),
         (706, 906, 'inactive-needs-de-21', 'DE', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (803, 906, 603, 706, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/agents/906", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing active site-primary tag for marketplace(s): DE",
    });
  });
});
