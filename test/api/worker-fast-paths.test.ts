import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../../workers/app";

describe("Worker optimized dispatch", () => {
  it("serves robots and Hono health through the original Worker entrypoint", async () => {
    const ctx = {waitUntil: () => undefined} as never;
    const robots = await worker.fetch(new Request("https://dealsrky.com/robots.txt"), env as never, ctx);
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain("Sitemap: https://dealsrky.com/sitemap.xml");
    const health = await worker.fetch(new Request("https://dealsrky.com/api/health"), env as never, ctx);
    expect(health.status).toBe(200);
    expect(await health.json()).toHaveProperty("status");
  });
  it("reads public R2 image bytes and caches only the versioned image", async () => {
    const key = "perf-test-1760000000000-abcdef123456.webp";
    const bytes = new Uint8Array([1,2,3,4]);
    await env.BLOG_IMAGES.put(key, bytes, {httpMetadata:{contentType:"image/webp"}});
    const tasks: Promise<unknown>[] = [];
    const ctx = {waitUntil: (p: Promise<unknown>) => tasks.push(p)} as never;
    const url = "https://dealsrky.com/api/public/blog-images/"+key;
    try {
      const first = await worker.fetch(new Request(url),env as never,ctx);
      expect(first.status).toBe(200);
      expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes);
      await Promise.all(tasks);
      const hit = await worker.fetch(new Request(url),env as never,ctx);
      expect(hit.status).toBe(200);
      expect(new Uint8Array(await hit.arrayBuffer())).toEqual(bytes);
      expect(hit.headers.get("cache-control")).toBe("public, max-age=300");
      const bypass = await worker.fetch(new Request(url,{headers:{cookie:"preferred_marketplace=US"}}),env as never,ctx);
      expect(bypass.headers.get("cache-control")).toContain("immutable");
      await bypass.arrayBuffer();
    } finally {
      await env.BLOG_IMAGES.delete(key);
      await (await caches.open("dealsrky-public-images-v1")).delete(new Request(url));
    }
  });
});
