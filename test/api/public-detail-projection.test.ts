import { describe,it,expect } from "vitest";
import { env } from "cloudflare:workers";
import { loader as productLoader } from "../../app/routes/product-detail";
import { loader as blogLoader } from "../../app/routes/blog-post";
import { buildBlogExcerpt, estimateReadingMinutes } from "../../server/services/blog";

describe("public detail projections",()=>{
  it("preserves selected product, gallery, editorial text and affiliate mapping without unused A+ image data",async()=>{
    const db=env.DB;
    await db.batch([
      db.prepare("INSERT INTO agents(id,slug,name,is_active) VALUES (90101,'qa-detail','Detail QA',1)"),
      db.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace,is_active) VALUES (90102,90101,'qa-detail-20','US',1)"),
      db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult,review_content,product_images,aplus_images) VALUES (90103,'DETAILQA01','Detail QA','/favicon.svg','US','Tools','active',1,0,?,?,?)").bind("Summary: Original editorial","[\"https://example.com/gallery.webp\"]","[\"https://example.com/unused-aplus.webp\"]"),
      db.prepare("INSERT INTO agent_products(agent_id,product_id,tracking_id,is_active) VALUES (90101,90103,90102,1)")
    ]);
    const result=await productLoader({request:new Request("https://dealsrky.com/deals/DETAILQA01?market=US"),params:{asin:"DETAILQA01"},context:{cloudflare:{env,ctx:{}}}} as Parameters<typeof productLoader>[0]);
    expect(result.product).toMatchObject({id:90103,review_content:"Summary: Original editorial",product_images:"[\"https://example.com/gallery.webp\"]"});
    expect(result.product).not.toHaveProperty("aplus_images");
    expect(result.availableMarketplaces).toEqual(["US"]);
    expect(new URL(result.amazonUrlsByMarketplace.US).searchParams.get("tag")).toBe("qa-detail-20");
  });
  it("preserves article content, SEO, CTA metadata, reading time and publication gate without extra DB fields",async()=>{
    const db=env.DB,content="## Original article\n\nThis is the published body.";
    await db.prepare("INSERT INTO blog_posts(id,title,slug,content,excerpt,seo_title,seo_description,status,is_deleted,cta_label,cta_disclosure,generation_source,generation_provider,generation_topic,published_at) VALUES (90201,'Original title','qa-public-article',?,'Original excerpt','SEO title','SEO description','published',0,'Shop original','Original disclosure','ai','internal-provider','internal-topic',datetime('now'))").bind(content).run();
    const args={request:new Request("https://dealsrky.com/blog/qa-public-article?market=US"),params:{slug:"qa-public-article"},context:{cloudflare:{env,ctx:{}}}} as Parameters<typeof blogLoader>[0];
    const result=await blogLoader(args);
    expect(result).toMatchObject({id:90201,content,title:"Original title",seo_title:"SEO title",seo_description:"SEO description",cta_label:"Shop original",cta_disclosure:"Original disclosure",excerpt_text:buildBlogExcerpt(content,"Original excerpt"),reading_minutes:estimateReadingMinutes(content)});
    for(const key of ["generation_provider","generation_topic","cover_image_key","is_deleted","deleted_at","created_at"])expect(result).not.toHaveProperty(key);
    await db.prepare("UPDATE blog_posts SET is_deleted=1 WHERE id=90201").run();
    await expect(blogLoader(args)).rejects.toMatchObject({status:404});
  });
});
