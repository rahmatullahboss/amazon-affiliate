import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";

const queries = [
  {index:"idx_products_visible_asin_created",sql:`SELECT id,asin,title,image_url,category,marketplace,review_content,product_images,aplus_images FROM products WHERE asin=? AND is_active=1 AND status='active' AND is_adult=0 ORDER BY created_at DESC,id DESC`,args:["INDEXQA001"]},
  {index:"idx_products_visible_category_created",sql:`SELECT id,asin,title,image_url,category,marketplace FROM products WHERE category=? AND asin!=? AND is_active=1 AND status='active' AND is_adult=0 ORDER BY created_at DESC LIMIT 12`,args:["Index QA","INDEXQA001"]},
  {index:"idx_products_visible_created",sql:`SELECT id,asin,title,image_url,category,marketplace FROM products WHERE asin!=? AND is_active=1 AND status='active' AND is_adult=0 ORDER BY created_at DESC LIMIT 12`,args:["INDEXQA001"]},
];
describe("product detail indexes on real migrated D1",()=>{
  it("uses narrow index searches and preserves original cross-market results",async()=>{
    const db=env.DB;
    const batch:D1PreparedStatement[]=[];
    for(let i=0;i<40;i++){
      const asin=i<2?"INDEXQA001":"I"+String(i).padStart(9,"0");
      batch.push(db.prepare(`INSERT INTO products(asin,title,image_url,marketplace,category,is_active,status,is_adult,created_at) VALUES (?,?, '/favicon.svg',?,?,?,?,?,datetime('2026-01-01',?))`).bind(asin,"Index QA "+i,i%2?"CA":"US",i<20?"Index QA":"Other QA",i===3?0:1,i===4?"inactive":"active",i===5?1:0,"+"+i+" minutes"));
    }
    await db.batch(batch);
    for(const query of queries){
      const plan=async(phase:string)=>(await db.prepare("EXPLAIN QUERY PLAN "+query.sql+" /* "+phase+" */").bind(...query.args).all<{detail:string}>()).results.map(x=>x.detail).join("\n");
      const after=await plan("after");
      expect(after).toContain(query.index);
      expect(after).not.toContain("TEMP B-TREE");
      const rows=(await db.prepare(query.sql+" /* indexed */").bind(...query.args).all()).results;
      expect(rows.length).toBeGreaterThan(0);
      await db.prepare("DROP INDEX "+query.index).run();
      const before=await plan("before");
      expect(before).not.toContain(query.index);
      const old=(await db.prepare(query.sql+" /* baseline */").bind(...query.args).all()).results;
      expect(rows).toEqual(old);
    }
  });
});
