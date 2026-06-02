import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

async function fetchBulkReplaceTag(body: Record<string, unknown>, token: string) {
  return apiApp.fetch(
    new Request("http://localhost/api/mappings/bulk-replace-tag", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify(body),
    }),
    env as never,
    { waitUntil: () => undefined } as never
  );
}

async function readErrorMessage(response: Response) {
  const payload = (await response.json()) as Record<string, unknown>;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  return JSON.stringify(payload);
}

describe("Mappings bulk-replace-tag API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM audit_logs").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
  });

  it("replaces the source tag on every matching mapping when no mapping_ids filter is provided", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 501, "bulk-replace-agent", "Bulk Replace Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
         (701, 'B0BR000001', 'Replace Product 1', 'https://example.com/p1.webp', 'US', 'active', 1),
         (702, 'B0BR000002', 'Replace Product 2', 'https://example.com/p2.webp', 'US', 'active', 1),
         (703, 'B0BR000003', 'Replace Product 3', 'https://example.com/p3.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
         (601, 501, 'replace-old-20', 'US', 1, 1),
         (602, 501, 'replace-new-20', 'US', 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES
         (401, 501, 701, 601, NULL, 1),
         (402, 501, 702, 601, NULL, 1),
         (403, 501, 703, 602, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 601,
        target_tracking_id: 602,
      },
      token
    );

    expect(response.status).toBe(200);
    expect(await readErrorMessage(response)).toBe(
      "Replaced source tag on 2 mappings"
    );

    const { results } = await env.DB.prepare(
      `SELECT id, tracking_id
       FROM agent_products
       WHERE agent_id = 501
       ORDER BY id ASC`
    ).all<{ id: number; tracking_id: number }>();

    expect(results).toEqual([
      { id: 401, tracking_id: 602 },
      { id: 402, tracking_id: 602 },
      { id: 403, tracking_id: 602 },
    ]);
  });

  it("only updates the mapping_ids that were explicitly selected", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 502, "filter-agent", "Filter Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
         (711, 'B0BR000011', 'Filter Product 1', 'https://example.com/p1.webp', 'US', 'active', 1),
         (712, 'B0BR000012', 'Filter Product 2', 'https://example.com/p2.webp', 'US', 'active', 1),
         (713, 'B0BR000013', 'Filter Product 3', 'https://example.com/p3.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
         (611, 502, 'filter-old-20', 'US', 1, 1),
         (612, 502, 'filter-new-20', 'US', 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES
         (411, 502, 711, 611, NULL, 1),
         (412, 502, 712, 611, NULL, 1),
         (413, 502, 713, 611, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 611,
        target_tracking_id: 612,
        mapping_ids: [411, 412],
      },
      token
    );

    expect(response.status).toBe(200);
    expect(await readErrorMessage(response)).toBe(
      "Replaced source tag on 2 mappings"
    );

    const { results } = await env.DB.prepare(
      `SELECT id, tracking_id
       FROM agent_products
       WHERE agent_id = 502
       ORDER BY id ASC`
    ).all<{ id: number; tracking_id: number }>();

    expect(results).toEqual([
      { id: 411, tracking_id: 612 },
      { id: 412, tracking_id: 612 },
      { id: 413, tracking_id: 611 },
    ]);
  });

  it("reactivates a soft-deleted mapping when its tag is bulk-replaced", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 503, "reactivate-agent", "Reactivate Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (721, 'B0BR000021', 'Reactivated Product', 'https://example.com/r.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
         (621, 503, 'reactivate-old-20', 'US', 1, 1),
         (622, 503, 'reactivate-new-20', 'US', 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (421, 503, 721, 621, NULL, 0)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 621,
        target_tracking_id: 622,
      },
      token
    );

    expect(response.status).toBe(200);

    const mapping = await env.DB.prepare(
      `SELECT tracking_id, is_active
       FROM agent_products
       WHERE id = 421`
    ).first<{ tracking_id: number; is_active: number }>();

    expect(mapping).toEqual({ tracking_id: 622, is_active: 1 });
  });

  it("rejects when source and target tags are the same", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 504, "same-agent", "Same Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (631, 504, 'same-tag-20', 'US', 1, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 631,
        target_tracking_id: 631,
      },
      token
    );

    expect(response.status).toBe(400);
    expect(await readErrorMessage(response)).toBe(
      "Source and target tags must be different"
    );
  });

  it("rejects when source and target tags belong to different agents", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 505, "agent-a", "Agent A");
    await DbFactory.seedAgent(env.DB, 506, "agent-b", "Agent B");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
         (641, 505, 'agent-a-20', 'US', 1, 1),
         (642, 506, 'agent-b-20', 'US', 1, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 641,
        target_tracking_id: 642,
      },
      token
    );

    expect(response.status).toBe(400);
    expect(await readErrorMessage(response)).toBe(
      "Source and target tags must belong to the same agent"
    );
  });

  it("rejects when source and target tags are in different marketplaces", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 507, "market-agent", "Market Agent");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
         (651, 507, 'market-us-20', 'US', 1, 1),
         (652, 507, 'market-de-20', 'DE', 0, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 651,
        target_tracking_id: 652,
      },
      token
    );

    expect(response.status).toBe(400);
    const errorMessage = await readErrorMessage(response);
    expect(errorMessage).toContain("different marketplaces");
    expect(errorMessage).toContain("US vs DE");
  });

  it("rejects when the source tag does not exist", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 508, "missing-source-agent", "Missing Source");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (661, 508, 'exists-20', 'US', 1, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 9999,
        target_tracking_id: 661,
      },
      token
    );

    expect(response.status).toBe(404);
    expect(await readErrorMessage(response)).toBe(
      "Source tag not found or inactive"
    );
  });

  it("rejects when the target tag is inactive", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 509, "inactive-target-agent", "Inactive Target");
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
         (671, 509, 'active-source-20', 'US', 1, 1),
         (672, 509, 'inactive-target-20', 'US', 0, 0)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 671,
        target_tracking_id: 672,
      },
      token
    );

    expect(response.status).toBe(404);
    expect(await readErrorMessage(response)).toBe(
      "Target tag not found or inactive"
    );
  });

  it("writes an audit log entry after a successful bulk replace", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 510, "audit-agent", "Audit Agent");
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (731, 'B0BR000031', 'Audit Product', 'https://example.com/a.webp', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
         (681, 510, 'audit-old-20', 'US', 1, 1),
         (682, 510, 'audit-new-20', 'US', 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (id, agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (431, 510, 731, 681, NULL, 1)`
    ).run();

    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await fetchBulkReplaceTag(
      {
        source_tracking_id: 681,
        target_tracking_id: 682,
      },
      token
    );

    expect(response.status).toBe(200);

    const audit = await env.DB.prepare(
      `SELECT user_id, action, entity_type, entity_id, details
       FROM audit_logs
       WHERE action = 'mapping.bulk_replaced_tag'`
    ).first<{
      user_id: number | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      details: string;
    }>();

    expect(audit).toBeTruthy();
    expect(audit?.user_id).toBe(1);
    expect(audit?.entity_type).toBe("tracking_id");
    expect(audit?.entity_id).toBe("681");

    const details = JSON.parse(audit?.details ?? "{}") as Record<string, unknown>;
    expect(details).toEqual({
      sourceTrackingId: 681,
      targetTrackingId: 682,
      updated: 1,
    });
  });
});
