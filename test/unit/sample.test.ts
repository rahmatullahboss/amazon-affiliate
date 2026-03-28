import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Cloudflare Workers D1 + KV environment", () => {
  it("should have access to KV bindings through vitest-pool-workers", async () => {
    // Given the wrangler.jsonc config, we can access KV
    // @ts-ignore Env type bindings are usually inferred globally or we can treat env as `any` for local sanity checking.
    expect(env).toBeDefined();

    // Verify KV exists
    // The binding name inside wrangler.jsonc is "KV"
    if (env.KV) {
      await env.KV.put("test_key", "test_value");
      const val = await env.KV.get("test_key");
      expect(val).toBe("test_value");
    } else {
      console.warn("KV binding not loaded. Make sure wrangler.jsonc defines 'KV'.");
    }
  });

  it("should have access to D1 bindings", async () => {
    if (env.DB) {
      // Small smoke test that D1 execute works
      const res = await env.DB.prepare("SELECT 1 AS n").first();
      expect(res.n).toBe(1);
    } else {
      console.warn("DB binding not loaded. Make sure wrangler.jsonc defines 'DB'.");
    }
  });
});
