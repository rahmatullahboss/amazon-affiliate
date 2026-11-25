import { describe,it,expect } from "vitest";
import { env } from "cloudflare:workers";
import { getPublicProductAffiliateHrefs } from "../../server/services/public-product-affiliate";

describe("product-first public affiliate mapping",()=>{
  it("preserves active mapping priority, exact tags, marketplace and explicit primary fallback",async()=>{
    const db=env.DB;
    await db.batch([
      db.prepare("INSERT INTO agents(id,slug,name,is_active) VALUES (88101,'qa-one','QA One',1),(88102,'qa-two','QA Two',1),(88103,'qa-inactive','QA inactive',0),(88104,'qa-primary','QA Primary',1),(88105,'qa-bad','QA Bad',1)"),
      db.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active,is_site_primary) VALUES (88201,88101,'qa-one-20','US',1,0),(88202,88102,'qa-two-20','US',1,0),(88203,88103,'qa-disabled-20','US',1,0),(88204,88104,'qa-primary-20','US',1,1),(88205,88105,'qa-ca-20','CA',1,0),(88206,88105,'qa-inactive-20','US',0,0)"),
      db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,status,is_active,is_adult) VALUES (88301,'MAPQA00001','QA first','/favicon.svg','US','active',1,0),(88302,'MAPQA00002','QA fallback','/favicon.svg','US','active',1,0),(88303,'MAPQA00003','QA CA','/favicon.svg','CA','active',1,0),(88304,'MAPQA00004','QA none','/favicon.svg','UK','active',1,0)"),
      db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active,show_on_homepage,homepage_rank) VALUES (88101,88301,88201,1,1,2),(88102,88301,88202,1,1,1),(88103,88301,88203,1,1,0),(88105,88301,88205,1,1,-1),(88104,88301,88204,0,1,-2),(88105,88303,88205,1,1,1),(88101,88303,88201,1,1,0),(88103,88302,88203,1,1,0)")
    ]);
    const products=[{id:88301,asin:"MAPQA00001",marketplace:"US"},{id:88302,asin:"MAPQA00002",marketplace:"US"},{id:88303,asin:"MAPQA00003",marketplace:"CA"},{id:88304,asin:"MAPQA00004",marketplace:"UK"}];
    const sql=`SELECT ap.product_id,t.marketplace,t.tag AS tracking_tag FROM agent_products ap JOIN tracking_ids t ON t.id=ap.tracking_id JOIN agents a ON a.id=ap.agent_id JOIN products p ON p.id=ap.product_id WHERE ap.product_id IN (?,?,?,?) AND ap.is_active=1 AND a.is_active=1 AND t.is_active=1 AND p.is_active=1 AND p.status='active' AND p.is_adult=0 AND t.marketplace=p.marketplace ORDER BY ap.show_on_homepage DESC,COALESCE(ap.homepage_rank,999999) ASC,ap.updated_at DESC,ap.id DESC`;
    const optimized=sql.replace("agent_products ap JOIN tracking_ids t","agent_products ap INDEXED BY idx_ap_product_active CROSS JOIN tracking_ids t").replace(" JOIN agents a"," CROSS JOIN agents a").replace(" JOIN products p"," CROSS JOIN products p");
    const ids=products.map(p=>p.id);
    expect((await db.prepare(optimized).bind(...ids).all()).results).toEqual((await db.prepare(sql).bind(...ids).all()).results);
    const plan=(await db.prepare("EXPLAIN QUERY PLAN "+optimized).bind(...ids).all<{detail:string}>()).results.map(r=>r.detail).join("\n");
    expect(plan).toContain("idx_ap_product_active (product_id=?)");
    const hrefs=await getPublicProductAffiliateHrefs(db,products);
    const tag=(id:number)=>new URL(hrefs.get(id)!).searchParams.get("tag");
    expect(tag(88301)).toBe("qa-two-20");
    expect(tag(88302)).toBe("qa-primary-20");
    expect(tag(88303)).toBe("qa-ca-20");
    expect(hrefs.has(88304)).toBe(false);
  });
});
