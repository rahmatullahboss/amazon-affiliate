import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { getHomepageFeedRows } from "../../server/services/homepage-feed";
import { resolveAgentProductBySlug } from "../../server/services/dynamic-links";

describe("CPU hardening: indexed homepage and alias lookups", () => {
  it("preserves homepage ranking without a temporary sort", async () => {
    const db = env.DB;
    await db.prepare(
      "INSERT INTO agents(id,slug,name,is_active) VALUES (889801,'perf-home-agent','Performance Agent',1)"
    ).run();
    await db.prepare(
      "INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active) VALUES (889801,889801,'perf-us-20','US',1)"
    ).run();
    await db.batch([
      db.prepare(
        "INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult) VALUES (?,?,'Low Rank','/favicon.svg','US','QA','active',1,0)"
      ).bind(889801, "PERF000001"),
      db.prepare(
        "INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult) VALUES (?,?,'High Rank','/favicon.svg','US','QA','active',1,0)"
      ).bind(889802, "PERF000002"),
    ]);
    await db.batch([
      db.prepare(
        "INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active,show_on_homepage,homepage_rank,created_at) VALUES (889801,889801,889801,1,1,NULL,'2026-01-01')"
      ),
      db.prepare(
        "INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active,show_on_homepage,homepage_rank,created_at) VALUES (889801,889802,889801,1,1,1,'2026-01-01')"
      ),
    ]);

    const baseline = await db.prepare(`
      SELECT p.id
      FROM agent_products ap
      JOIN products p ON p.id=ap.product_id
      JOIN agents a ON a.id=ap.agent_id
      JOIN tracking_ids t ON t.id=ap.tracking_id
      WHERE ap.is_active=1 AND ap.show_on_homepage=1
        AND p.is_active=1 AND p.status='active' AND p.is_adult=0
        AND a.is_active=1 AND t.is_active=1
        AND t.marketplace=? AND p.marketplace=?
      ORDER BY COALESCE(ap.homepage_rank, 999999) ASC, ap.created_at DESC LIMIT ?
    `).bind("US","US",30).all<{id:number}>();
    const optimized = await getHomepageFeedRows(db, "US", 30);
    expect(optimized.map(row => row.id)).toEqual(baseline.results.map(row => row.id));
    expect(optimized.slice(0,2).map(row => row.asin)).toEqual(["PERF000002","PERF000001"]);

    const plan = await db.prepare(`
      EXPLAIN QUERY PLAN SELECT p.id FROM agent_products ap INDEXED BY idx_agent_products_homepage_rank
      JOIN products p ON p.id=ap.product_id JOIN agents a ON a.id=ap.agent_id
      JOIN tracking_ids t ON t.id=ap.tracking_id
      WHERE ap.is_active=1 AND ap.show_on_homepage=1
        AND p.is_active=1 AND p.status='active' AND p.is_adult=0
        AND a.is_active=1 AND t.is_active=1 AND t.marketplace=? AND p.marketplace=?
      ORDER BY COALESCE(ap.homepage_rank,999999),ap.created_at DESC LIMIT 30
    `).bind("US","US").all<{detail:string}>();
    const description = plan.results.map(row => row.detail).join("\n");
    expect(description).toContain("idx_agent_products_homepage_rank");
    expect(description).not.toContain("TEMP B-TREE");
  });

  it("keeps valid, missing, and mismatched alias resolutions intact with indexed ASIN-first joins", async () => {
    const db = env.DB;
    await db.prepare(
      "INSERT INTO agents(id,slug,name,is_active) VALUES (889811,'perf-alias-agent','Performance Alias Agent',1)"
    ).run();
    await db.prepare(
      "INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active) VALUES (889811,889811,'perf-alias-us-20','US',1)"
    ).run();
    await db.prepare(
      "INSERT INTO products(id,asin,title,image_url,marketplace,status,is_active,is_adult) VALUES (889811,'PERF000011','Alias QA Product','/favicon.svg','US','active',1,0)"
    ).run();
    await db.prepare(
      "INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active) VALUES (889811,889811,889811,1)"
    ).run();
    await db.prepare(
      "INSERT INTO agent_slug_aliases(agent_id,tracking_id,marketplace,slug,is_active) VALUES (889811,889811,'US','perf-qa-us-alias',1)"
    ).run();

    const resolve = (asin:string,market:string) =>
      resolveAgentProductBySlug({db,agentSlug:"perf-qa-us-alias",asin,preferredMarketplace:market});
    expect((await resolve("PERF000011","US"))?.row.asin).toBe("PERF000011");
    expect(await resolve("PERF000012","US")).toBeNull();
    expect(await resolve("PERF000011","CA")).toBeNull();

    const plan = await db.prepare(`
      EXPLAIN QUERY PLAN SELECT p.id FROM products p INDEXED BY idx_products_asin
      CROSS JOIN agent_products ap INDEXED BY idx_ap_product_active ON ap.product_id=p.id
      JOIN agents a ON a.id=ap.agent_id JOIN tracking_ids t ON t.id=ap.tracking_id
      WHERE ap.tracking_id=? AND p.asin=? AND t.marketplace=?
        AND ap.is_active=1 AND a.is_active=1 AND p.is_active=1 AND p.status='active'
      LIMIT 1
    `).bind(889811,"PERF000012","US").all<{detail:string}>();
    const description = plan.results.map(row => row.detail).join("\n");
    expect(description).toContain("idx_products_asin");
    expect(description).toContain("idx_ap_product_active");
  });
});
