import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { loader as categoryLoader } from "../../app/routes/category";
import { loader as agentLoader } from "../../app/routes/agent-storefront";
import { catalogPagination, catalogPageHref } from "../../app/utils/catalog-pagination";

describe("bounded public catalog loaders", () => {
  beforeAll(async () => {
    await env.DB.prepare("INSERT INTO categories(name,slug) VALUES ('Pagination fixture','pagination-fixture')").run();
    await env.DB.prepare("INSERT INTO agents(id,slug,name) VALUES (82001,'pagination-agent','Pagination Agent'),(82002,'other-pagination-agent','Other')").run();
    await env.DB.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace) VALUES (82001,82001,'pagination-us-20','US'),(82002,82002,'other-pagination-20','US'),(82003,82001,'pagination-ca-20','CA')").run();
    await env.DB.prepare("INSERT INTO agent_slug_aliases(agent_id,tracking_id,marketplace,slug) VALUES (82001,82001,'US','pagination-us')").run();
    for (let i = 1; i <= 30; i++) {
      const market = i === 28 ? "CA" : "US";
      await env.DB.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult,created_at) VALUES (?,?,?,?,?,'Pagination fixture','active',?,?, '2026-11-01')").bind(83000+i, "P"+String(i).padStart(9,"0"), "Product "+i, "https://example.com/product.jpg", market, i === 29 ? 0 : 1, i === 30 ? 1 : 0).run();
      await env.DB.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,custom_title,is_active,updated_at) VALUES (?,?,?,?,1,'2026-11-01')").bind(i === 27 ? 82002 : 82001, 83000+i, i === 27 ? 82002 : i === 28 ? 82003 : 82001, "Custom "+i).run();
    }
  });
  const context = {cloudflare:{env,ctx:{}}};
  const category = (search: string) => categoryLoader({request:new Request("https://dealsrky.com/category/pagination-fixture?"+search),params:{slug:"pagination-fixture"},context} as Parameters<typeof categoryLoader>[0]);
  const agent = (search: string, slug = "pagination-us") => agentLoader({request:new Request("https://dealsrky.com/"+slug+"?"+search),params:{agent:slug},context} as Parameters<typeof agentLoader>[0]);

  it("returns bounded, stable, nonoverlapping category pages with exact total and visibility", async () => {
    const first = await category("market=US");
    const second = await category("market=US&page=2");
    expect(first.pagination.total).toBe(27);
    expect(first.products).toHaveLength(24);
    expect(second.products.map(p=>p.id)).toEqual([83003,83002,83001]);
    expect(new Set([...first.products,...second.products].map(p=>p.id)).size).toBe(27);
    expect(first.products.every(p=>p.marketplace==="US")).toBe(true);
    expect(first.products[0]).not.toHaveProperty("description");
    expect((await category("market=CA")).products.map(p=>p.id)).toEqual([83028]);
    expect((await category("market=US&page=999999")).pagination.page).toBe(2);
  });
  it("retains agent and alias marketplace boundaries and custom titles across pages", async () => {
    const first = await agent("market=CA");
    const second = await agent("page=2");
    expect(first.selectedMarketplace).toBe("US");
    expect(first.agent.publicSlug).toBe("pagination-us");
    expect(first.pagination.total).toBe(26);
    expect(first.products).toHaveLength(24);
    expect(second.products.map(p=>p.id)).toEqual([83002,83001]);
    expect(first.products[0].title).toBe("Custom 26");
    expect(new Set([...first.products,...second.products].map(p=>p.id)).size).toBe(26);
    expect((await agent("market=CA","pagination-agent")).products.map(p=>p.id)).toEqual([83028]);
  });
  it("normalizes malformed pages and retains marketplace in navigation", () => {
    for (const page of ["-1","0","1.5","junk","1e4","9007199254740993"]) {
      expect(catalogPagination(new URLSearchParams({page}), 50).page).toBe(1);
    }
    expect(catalogPagination(new URLSearchParams("page=9"),0)).toMatchObject({page:1,total:0,offset:0});
    expect(catalogPageHref("/pagination-us","US",2)).toBe("/pagination-us?market=US&page=2");
    expect(catalogPageHref("/pagination-us","US",1)).toBe("/pagination-us?market=US");
  });
});
