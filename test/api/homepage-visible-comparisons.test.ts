import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { loader } from "../../app/routes/home";
import { buildComparisonGroups,buildHomePageSections } from "../../app/utils/homepage";
import { getHomepageFeedRows } from "../../server/services/homepage-feed";
import { getPublicProductAffiliateHrefs, createAmazonAffiliateHref } from "../../server/services/public-product-affiliate";

describe("homepage visible comparison projection",()=>{
  it("retains original comparison groups, product links and six-card ranking previews without serializing unused feed rows",async()=>{
    const db=env.DB;
    await db.batch([
      db.prepare("INSERT INTO agents(id,slug,name,is_active) VALUES (89601,'qa-home','QA Home',1)"),
      db.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active,is_site_primary) VALUES (89602,89601,'qa-home-20','US',1,0)")
    ]);
    const batch:D1PreparedStatement[]=[];
    for(let i=0;i<44;i++){
      const id=89700+i,asin="H"+String(i).padStart(9,"0");
      batch.push(db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult) VALUES (?,?,?,'/favicon.svg','US',?,'active',1,0)").bind(id,asin,"Home QA "+i,"Category "+Math.floor(i/4)));
      batch.push(db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active,show_on_homepage,homepage_rank) VALUES (89601,?,89602,1,1,?)").bind(id,i));
    }
    await db.batch(batch);
    const oldFeed=await getHomepageFeedRows(db,"US",44);
    const original=buildComparisonGroups(buildHomePageSections({posts:[],products:oldFeed}).primaryProducts);
    const hrefs=await getPublicProductAffiliateHrefs(db,oldFeed);
    const expected=original.map(group=>({category:group.category,products:group.products.map(product=>({...product,public_href:product.agent_slug?`/${product.agent_slug}/${product.marketplace!.toLowerCase()}/${product.asin}`:`/deals/${product.asin}`,direct_amazon_url:createAmazonAffiliateHref(product.asin,product.marketplace,product.tracking_tag)??hrefs.get(product.id)??null}))}));
    const result=await loader({request:new Request("https://dealsrky.com/?market=US"),params:{},context:{cloudflare:{env,ctx:{}}}} as Parameters<typeof loader>[0]);
    expect(oldFeed).toHaveLength(44);
    expect(result.comparisonGroups).toEqual(expected);
    expect(result.comparisonGroups.flatMap(g=>g.products)).toHaveLength(9);
    expect(result).not.toHaveProperty("products");
    expect(result.topProducts).toEqual(result.trendingProducts);
    expect(result.topProducts.length).toBeLessThanOrEqual(6);
    expect(JSON.stringify(result.comparisonGroups).length).toBeLessThan(JSON.stringify(oldFeed).length);
  });
});
