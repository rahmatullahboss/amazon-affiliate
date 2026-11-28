import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { loader } from "../../app/routes/product-detail";

describe("product detail loader: preserve marketplace visibility while reducing hidden work", () => {
  it("serializes only related cards the user can select and preserves exact approved affiliate tags", async () => {
    const db = env.DB;
    await db.prepare("INSERT INTO agents(id,slug,name,is_active) VALUES (991100,'qa-ssr-filter','SSR Filter Agent',1)").run();
    await db.batch([
      db.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active) VALUES (991201,991100,'qa-filter-us-20','US',1)"),
      db.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active) VALUES (991202,991100,'qa-filter-de-21','DE',1)"),
      db.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active) VALUES (991203,991100,'qa-filter-ca-20','CA',1)"),
    ]);
    await db.batch([
      db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,is_active,status,is_adult,created_at) VALUES (991001,'RLYQA00001','QA US Main','/favicon.svg','US','SSR QA Mixed',1,'active',0,'2026-11-18')"),
      db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,is_active,status,is_adult,created_at) VALUES (991002,'RLYQA00001','QA DE Main','/favicon.svg','DE','SSR QA Mixed',1,'active',0,'2026-11-17')"),
      db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,is_active,status,is_adult,created_at) VALUES (991003,'RLYQA00003','QA CA Related Hidden','/favicon.svg','CA','SSR QA Mixed',1,'active',0,'2026-11-16')"),
      db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,is_active,status,is_adult,created_at) VALUES (991004,'RLYQA00004','QA US Related','/favicon.svg','US','SSR QA Mixed',1,'active',0,'2026-11-15')"),
      db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,is_active,status,is_adult,created_at) VALUES (991005,'RLYQA00005','QA DE Related','/favicon.svg','DE','SSR QA Mixed',1,'active',0,'2026-11-14')"),
    ]);
    await db.batch([
      db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active) VALUES (991100,991001,991201,1)"),
      db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active) VALUES (991100,991002,991202,1)"),
      db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active) VALUES (991100,991003,991203,1)"),
      db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active) VALUES (991100,991004,991201,1)"),
      db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active) VALUES (991100,991005,991202,1)"),
    ]);

    const data = await loader({
      params: { asin: "RLYQA00001" },
      request: new Request("https://dealsrky.com/deals/RLYQA00001?market=DE"),
      context: { cloudflare: { env } },
    } as never);

    expect(data.product.marketplace).toBe("DE");
    expect(data.canonicalPath).toBe("/deals/RLYQA00001");
    expect(data.availableMarketplaces).toEqual(["DE", "US"]);
    expect(data.relatedProducts.map(product => product.id)).toEqual([991004, 991005]);
    expect(data.relatedAmazonUrls[991003]).toBeUndefined();
    expect(data.relatedAmazonUrls[991004]).toContain("qa-filter-us-20");
    expect(data.relatedAmazonUrls[991005]).toContain("qa-filter-de-21");
    expect(data.amazonUrlsByMarketplace.US).toContain("qa-filter-us-20");
    expect(data.amazonUrlsByMarketplace.DE).toContain("qa-filter-de-21");
  });
});
