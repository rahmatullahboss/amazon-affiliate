import { beforeAll, describe, expect, it } from "vitest";
import { publicationTestEnv as env, installPublicationTestSchema } from "../support/publication-schema";
beforeAll(installPublicationTestSchema);
import { prepareDuePublicationPaths, readScopedRenderRevision } from "../../server/services/public-render-scope-revision";
import { publishProductBatch } from "../../server/services/public-render-publication";

// Native disposable D1: compare identical bulk title updates with the prototype
// triggers installed, and with only those prototype triggers removed. This
// file has its own isolated test storage; never run against a deployed DB.
describe("publication migration native cost", () => {
  it("measures 4700 catalog rows and 100 enrolled paths without weakening revisions", async () => {
    const db=env.DB;
    await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<4700)
      INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult)
      SELECT 120000+n,printf('Z%09d',n),'Catalog '||n,'/favicon.svg','US',
        printf('Cost category %02d',(n-1)%47),'active',1,0 FROM seq`).run();
    await db.prepare("INSERT INTO public_render_publication(path) SELECT '/deals/'||asin FROM products WHERE id BETWEEN 120001 AND 120100").run();
    const request=new Request("https://dealsrky.com/deals/Z000000001",{headers:{accept:"text/html"}});
    const originalRevision=await readScopedRenderRevision(db,request);
    expect(originalRevision).toBeTruthy();
    const measure=async(label:string,sql:string)=>{
      const start=performance.now();
      const result=await db.prepare(sql).run();
      return {label,wallMs:Math.round((performance.now()-start)*100)/100,
        rowsRead:result.meta.rows_read,rowsWritten:result.meta.rows_written,changes:result.meta.changes};
    };
    const installedSmall=await measure("installed-100","UPDATE products SET title=title||' update A' WHERE id BETWEEN 120001 AND 120100");
    expect(await readScopedRenderRevision(db,request)).not.toBe(originalRevision);
    const installedAll=await measure("installed-4700","UPDATE products SET title=title||' update B' WHERE id BETWEEN 120001 AND 124700");
    const noop=await measure("installed-noop-4700","UPDATE products SET title=title WHERE id BETWEEN 120001 AND 124700");
    const input={db,bucket:env.PUBLICATION_SNAPSHOTS,origin:"https://dealsrky.com",version:"qa-cost",render:async()=>new Response("Synthetic HTML",{headers:{"content-type":"text/html"}})};
    for(let i=0;i<13;i++)expect((await publishProductBatch(input)).failed).toBe(0);
    const idleCount=await db.prepare("SELECT COUNT(*) AS n FROM public_render_publication").all();
    const idleDue=await prepareDuePublicationPaths(db,input.version,Date.now(),8).all();
    expect(idleDue.results).toHaveLength(0);
    const idleRead=idleCount.meta.rows_read+idleDue.meta.rows_read;
    expect(idleDue.meta.rows_written).toBe(0);
    console.log("PUBLICATION_IDLE_D1_COST "+JSON.stringify({enrolled:100,countRowsRead:idleCount.meta.rows_read,dueRowsRead:idleDue.meta.rows_read,totalRowsRead:idleRead,rowsWritten:idleDue.meta.rows_written}));
    // Remove only the prototype's own triggers for the synthetic baseline.
    const triggers=await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND (name LIKE 'public_render_scope_%' OR name LIKE 'public_render_publication_%') ORDER BY name").all<{name:string}>();
    expect(triggers.results.length).toBe(16);
    for(const {name} of triggers.results){
      expect(name).toMatch(/^public_render_(scope|publication)_[a-z_]+$/);
      await db.prepare('DROP TRIGGER "'+name+'"').run();
    }
    const baseSmall=await measure("baseline-100","UPDATE products SET title=title||' update C' WHERE id BETWEEN 120001 AND 120100");
    const baseAll=await measure("baseline-4700","UPDATE products SET title=title||' update D' WHERE id BETWEEN 120001 AND 124700");
    // Native D1 meta.changes includes trigger effects. Assert the original
    // product writes separately, and retain actual total changes as evidence.
    const updated=await db.prepare("SELECT COUNT(*) AS n FROM products WHERE id BETWEEN 120001 AND 124700 AND title LIKE '% update B% update D'").first<{n:number}>();
    expect(updated?.n).toBe(4700);
    expect(installedSmall.changes).toBeGreaterThanOrEqual(100);
    expect(installedAll.changes).toBeGreaterThanOrEqual(4700);
    expect(baseSmall.changes).toBeGreaterThanOrEqual(100);
    expect(baseAll.changes).toBeGreaterThanOrEqual(4700);
    console.log("PUBLICATION_MIGRATION_COST "+JSON.stringify({catalog:4700,enrolled:100,installedSmall,installedAll,noop,baseSmall,baseAll}));
  },120000);
});
