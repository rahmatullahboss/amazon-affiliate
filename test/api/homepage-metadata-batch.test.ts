import { describe,it,expect } from "vitest";
import { env } from "cloudflare:workers";
import { loader } from "../../app/routes/home";
import { PUBLIC_BLOG_CARD_COLUMNS,toPublicBlogCard,type PublicBlogCardRow } from "../../server/services/public-blog-card";
import { filterBlogPostsForMarketplace,orderBlogPostsForMarketplace } from "../../app/utils/blog-personalization";

describe("homepage metadata read batch",()=>{
 it("matches original independent read projections, ordering, marketplace and branding",async()=>{
  const db=env.DB;
  await db.batch([
   db.prepare("INSERT OR REPLACE INTO site_branding_settings(id,og_site_name,og_description,og_image_url) VALUES(1,'QA brand','QA description','https://example.com/brand.webp')"),
   db.prepare("INSERT INTO blog_posts(title,slug,content,status,is_deleted,is_featured,generation_source,generation_topic,generation_marketplace,published_at) VALUES ('QA general','qa-home-general','General body','published',0,1,'manual',NULL,NULL,'2026-11-24'),('QA US','qa-home-us','US body','published',0,0,'ai','automated_comparison','US','2026-11-23'),('QA CA','qa-home-ca','CA body','published',0,0,'ai','automated_comparison','CA','2026-11-22'),('QA draft','qa-home-draft','Draft body','draft',0,1,'manual',NULL,NULL,'2026-11-25'),('QA deleted','qa-home-deleted','Deleted body','published',1,1,'manual',NULL,NULL,'2026-11-25')")
  ]);
  for(const marketplace of ["US","CA"] as const){
   const original=await db.prepare(`SELECT ${PUBLIC_BLOG_CARD_COLUMNS} FROM blog_posts WHERE is_deleted=0 AND status='published' ORDER BY is_featured DESC,published_at DESC,updated_at DESC LIMIT 7`).all<PublicBlogCardRow>();
   const comparisons=await db.prepare(`SELECT ${PUBLIC_BLOG_CARD_COLUMNS} FROM blog_posts WHERE is_deleted=0 AND status='published' AND generation_topic='automated_comparison' AND generation_marketplace=? ORDER BY published_at DESC,id DESC LIMIT 2`).bind(marketplace).all<PublicBlogCardRow>();
   const branding=await db.prepare("SELECT og_site_name,og_description,og_image_url FROM site_branding_settings WHERE id=1 LIMIT 1").first();
   const result=await loader({request:new Request("https://dealsrky.com/?market="+marketplace),params:{},context:{cloudflare:{env,ctx:{}}}} as Parameters<typeof loader>[0]);
   expect(result.posts).toEqual(orderBlogPostsForMarketplace(filterBlogPostsForMarketplace(original.results.map(r=>toPublicBlogCard(env,r)),marketplace),marketplace));
   expect(result.comparisonPosts).toEqual(comparisons.results.map(r=>toPublicBlogCard(env,r)));
   expect(result.siteBranding).toEqual(branding);
  }
 });
});
