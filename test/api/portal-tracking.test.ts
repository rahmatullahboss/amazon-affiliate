import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAgentToken } from "../factories/token";

describe("Portal Tracking API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  it("allows the same agent to save multiple tags for the same marketplace", async () => {
    await DbFactory.seedAgent(env.DB, 22, "multi-tag-agent", "Multi Tag Agent");
    const token = await generateAgentToken(22, "multi-tag-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    const firstResponse = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          tag: "agent-us-primary-20",
          label: "Primary",
          marketplace: "US",
        }),
      }),
      env as any,
      ctx as any
    );

    const secondResponse = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          tag: "agent-us-secondary-20",
          label: "Secondary",
          marketplace: "US",
        }),
      }),
      env as any,
      ctx as any
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    const { results } = await env.DB.prepare(
      `SELECT tag, marketplace, is_default
       FROM tracking_ids
       WHERE agent_id = ?
       ORDER BY created_at ASC`
    )
      .bind(22)
      .all<{ tag: string; marketplace: string; is_default: number }>();

    expect(results).toHaveLength(2);
    expect(results.every((row) => row.marketplace === "US")).toBe(true);
    expect(results.filter((row) => row.is_default === 1)).toHaveLength(1);
  });

  it("can switch the default tag within the same marketplace", async () => {
    await DbFactory.seedAgent(env.DB, 23, "default-switch-agent", "Default Switch Agent");
    const token = await generateAgentToken(23, "default-switch-agent", env.JWT_SECRET || "test-secret");
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as const;

    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, label, marketplace, is_default, is_active)
       VALUES
       (501, 23, 'default-switch-1-20', 'First', 'DE', 1, 1),
       (502, 23, 'default-switch-2-20', 'Second', 'DE', 0, 1)`
    ).run();

    const response = await apiApp.fetch(
      new Request("http://localhost/api/portal/tracking/502/default", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as any,
      ctx as any
    );

    expect(response.status).toBe(200);

    const { results } = await env.DB.prepare(
      `SELECT id, is_default
       FROM tracking_ids
       WHERE agent_id = ? AND marketplace = 'DE'
       ORDER BY id ASC`
    )
      .bind(23)
      .all<{ id: number; is_default: number }>();

    expect(results).toEqual([
      { id: 501, is_default: 0 },
      { id: 502, is_default: 1 },
    ]);
  });
});
