import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";

describe("Telegram webhook", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  it("binds agent via /start CODE", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO agents (id, name, slug, telegram_bind_code, is_active)
       VALUES (10, 'Agent One', 'agent-one', 'ABC12345', 1)`
    ).run();

    (env as unknown as { TELEGRAM_BOT_TOKEN?: string }).TELEGRAM_BOT_TOKEN = "test-token";

    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );

    try {
      const response = await apiApp.fetch(
        new Request("http://localhost/api/public/telegram/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost",
          },
          body: JSON.stringify({
            update_id: 1,
            message: {
              message_id: 1,
              chat: { id: 999, type: "private" },
              text: "/start ABC12345",
            },
          }),
        }),
        env as never,
        { waitUntil: () => undefined } as never
      );

      expect(response.status).toBe(200);
      const agent = await env.DB.prepare(
        "SELECT telegram_chat_id, telegram_bind_code FROM agents WHERE id = 10"
      ).first<{ telegram_chat_id: string | null; telegram_bind_code: string | null }>();
      expect(agent?.telegram_chat_id).toBe("999");
      expect(agent?.telegram_bind_code).toBeNull();
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });
});
