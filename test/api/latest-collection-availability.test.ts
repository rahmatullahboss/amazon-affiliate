import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { getLatestCollectionResult } from "../../server/services/collection-feed";
import { loader as homeLoader } from "../../app/routes/home";
import { loader as collectionLoader } from "../../app/routes/collection";

describe("Latest listing provenance availability", () => {
  it("fresh migrated D1 does not break the Home or Latest loader and never invents freshness", async () => {
    const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name='sheet_listing_activity' AND type='table'").first();
    expect(table).toBeNull();
    await env.DB.prepare("INSERT INTO products(asin,title,image_url,marketplace,status,is_active,is_adult) VALUES ('P000000001','Recent item','https://example.com/p.webp','US','active',1,0)").run();
    expect(await getLatestCollectionResult(env.DB,"US")).toEqual({rows:[],available:false});
    const context = {cloudflare:{env,ctx:{}}};
    const home = await homeLoader({request:new Request("https://dealsrky.com/?market=US"),params:{},context} as Parameters<typeof homeLoader>[0]);
    expect(home.allProducts.some(p=>p.asin==="P000000001")).toBe(true);
    expect(home.latestProducts).toEqual([]);
    expect(home.latestAvailable).toBe(false);
    const latest = await collectionLoader({request:new Request("https://dealsrky.com/collections/latest?market=US"),params:{kind:"latest"},context} as Parameters<typeof collectionLoader>[0]);
    expect(latest.available).toBe(false);
    expect(latest.products).toEqual([]);
  });
  it("keeps the existing provenance semantics when the table is present", async () => {
    // Test-only schema fixture, not a production migration.
    await env.DB.prepare("CREATE TABLE sheet_listing_activity(asin TEXT,marketplace TEXT,is_present INTEGER,row_status TEXT,published_revision INTEGER,revision INTEGER,published_at TEXT)").run();
    await env.DB.prepare("CREATE INDEX idx_sheet_listing_activity_latest ON sheet_listing_activity(marketplace, published_at DESC) WHERE is_present=1 AND row_status='active'").run();
    try {
      for (const asin of ["P000000011","P000000012","P000000013","P000000014"]) {
        await env.DB.prepare("INSERT INTO products(asin,title,image_url,marketplace,status,is_active,is_adult) VALUES (?,?, 'https://example.com/p.webp','CA','active',1,0)").bind(asin,asin).run();
      }
      await env.DB.prepare("INSERT INTO sheet_listing_activity VALUES ('P000000011','CA',1,'active',2,2,datetime('now')),('P000000012','CA',1,'active',1,2,datetime('now')),('P000000013','CA',0,'active',1,1,datetime('now'))").run();
      const result=await getLatestCollectionResult(env.DB,"CA");
      expect(result.available).toBe(true);
      expect(result.rows.map(p=>p.asin).sort()).toEqual(["P000000011","P000000014"]);
    } finally {
      await env.DB.prepare("DROP TABLE sheet_listing_activity").run();
    }
  });
  it("preserves exact bounded ordering across published, pending, removed, stale and non-sheet rows", async () => {
    const db=env.DB;
    await db.prepare("CREATE TABLE sheet_listing_activity(asin TEXT,marketplace TEXT,is_present INTEGER,row_status TEXT,published_revision INTEGER,revision INTEGER,published_at TEXT)").run();
    await db.prepare("CREATE INDEX idx_sheet_listing_activity_latest ON sheet_listing_activity(marketplace, published_at DESC) WHERE is_present=1 AND row_status='active'").run();
    try {
      const batch:D1PreparedStatement[]=[];
      for(let i=0;i<84;i++){
        const asin="L"+String(i).padStart(9,"0"),market=i%3===0?"CA":"US";
        batch.push(db.prepare("INSERT INTO products(asin,title,image_url,marketplace,status,is_active,is_adult,updated_at) VALUES (?,?, '/favicon.svg',?,?,?,?,datetime('now',?))").bind(asin,asin,market,i%11===0?"inactive":"active",i%13===0?0:1,i%17===0?1:0,"-"+(i%8)+" hours"));
        if(i%5!==0){
          batch.push(db.prepare("INSERT INTO sheet_listing_activity VALUES (?,?,?,?,?,?,datetime('now',?))").bind(asin,market,i%7===0?0:1,i%9===0?"inactive":"active",i%4===0?1:2,2,i%6===0?"-80 hours":"-"+(i%8)+" hours"));
          if(i%10===1)batch.push(db.prepare("INSERT INTO sheet_listing_activity VALUES (?,?,1,'active',2,2,datetime('now','-2 hours'))").bind(asin,market));
        }
      }
      await db.batch(batch);
      const original=`WITH sheet_provenance AS (SELECT asin,marketplace,MAX(CASE WHEN is_present=1 AND row_status='active' AND published_revision=revision THEN published_at ELSE NULL END) AS last_published FROM sheet_listing_activity GROUP BY asin,marketplace) SELECT p.id,p.asin,p.title,p.image_url,p.category,p.marketplace FROM products p LEFT JOIN sheet_provenance sa ON sa.asin=p.asin AND sa.marketplace=p.marketplace WHERE p.is_active=1 AND p.status='active' AND p.is_adult=0 AND p.marketplace=? AND ((sa.asin IS NOT NULL AND sa.last_published>=datetime('now','-72 hours')) OR (sa.asin IS NULL AND p.updated_at>=datetime('now','-72 hours'))) ORDER BY COALESCE(sa.last_published,p.updated_at) DESC,p.id DESC LIMIT ?`;
      for(const market of ["US","CA","UK"])for(const limit of [1,6,30,60]){
        const old=(await db.prepare(original).bind(market,limit).all()).results;
        expect(await getLatestCollectionResult(db,market,limit)).toEqual({rows:old,available:true});
      }
    }finally{await db.prepare("DROP TABLE sheet_listing_activity").run()}
  });
  it("does not hide unrelated database errors", async () => {
    const db = {prepare:()=>({bind:()=>({all:async()=>{throw new Error("database unavailable");}})})} as unknown as D1Database;
    await expect(getLatestCollectionResult(db,"US")).rejects.toThrow("database unavailable");
  });
});
