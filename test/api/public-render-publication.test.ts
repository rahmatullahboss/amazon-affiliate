import { beforeAll, describe, expect, it } from "vitest";
import { publicationTestEnv as env, installPublicationTestSchema } from "../support/publication-schema";
beforeAll(installPublicationTestSchema);
import { publishProductBatch, readPublishedProduct } from "../../server/services/public-render-publication";
import { listDuePublicationPaths, readScopedRenderRevision } from "../../server/services/public-render-scope-revision";

const origin = "https://dealsrky.com";
const path = (n: number) => "/deals/P" + String(n).padStart(9, "0");
const req = (n: number, headers: HeadersInit = { accept: "text/html" }) => new Request(origin + path(n), { headers });
const fixture = async (n: number) => {
  // Vitest shares native storage within this test file. Reset only synthetic fixtures.
  await env.DB.prepare("DELETE FROM public_render_publication WHERE path LIKE '/deals/P%'").run();
  await env.DB.prepare("DELETE FROM products WHERE id BETWEEN 99101 AND 99200").run();
  const bucket = env.PUBLICATION_SNAPSHOTS;
  for (const object of (await bucket.list()).objects) {
    await bucket.delete(object.key);
  }
  await env.DB.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<?)
    INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult)
    SELECT 99100+n,printf('P%09d',n),printf('Publication %03d',n),'/favicon.svg','US',printf('Publication category %03d',n),'active',1,0 FROM seq`).bind(n).run();
  await env.DB.prepare("INSERT INTO public_render_publication(path) SELECT '/deals/'||asin FROM products WHERE id BETWEEN 99101 AND ?").bind(99100+n).run();
};
const html = (body: string) => new Response(body, {headers: {"content-type":"text/html", "cache-control":"no-store"}});
const common = () => ({ db: env.DB, bucket: env.PUBLICATION_SNAPSHOTS, origin, version: "qa-publication-v1" });

describe("publication-first static product documents (native D1/R2)", () => {
  it("pre-renders 100 distinct pages before visitors, never writes during a request, and skips unchanged pages", async () => {
    await fixture(100);
    const input = common();
    const renders: string[] = [];
    const render = async (request: Request) => {
      renders.push(new URL(request.url).pathname);
      return html("Document " + new URL(request.url).pathname);
    };
    expect(await readPublishedProduct({...input, request: req(1)})).toBeUndefined();
    expect((await input.bucket.list()).objects).toHaveLength(0);
    let generated = 0;
    for(let i=0;i<13;i++){
      const result=await publishProductBatch({...input,render});
      expect(result.failed).toBe(0);
      expect(result.checked).toBeLessThanOrEqual(8);
      generated+=result.generated;
    }
    expect(generated).toBe(100);
    expect(renders).toHaveLength(100);
    for(let i=1;i<=100;i++){
      const result=await readPublishedProduct({...input,request:req(i)});
      expect(result?.headers.get("X-Publication-Render")).toBe("HIT");
      expect(result?.headers.get("Cache-Control")).toContain("no-store");
      expect(await result?.text()).toBe("Document "+path(i));
    }
    expect(await readPublishedProduct({...input,request:req(101)})).toBeUndefined();
    expect(await readPublishedProduct({...input,request:req(1,{accept:"text/html",cookie:"session=x"})})).toBeUndefined();
    expect(await readPublishedProduct({...input,request:new Request(origin+path(1)+"?market=CA",{headers:{accept:"text/html"}})})).toBeUndefined();
    expect(await readPublishedProduct({...input,version:"qa-publication-v2",request:req(1)})).toBeUndefined();
    expect(await readPublishedProduct({...input,request:new Request("https://example.invalid"+path(1),{headers:{accept:"text/html"}})})).toBeUndefined();
    expect((await input.bucket.list()).objects).toHaveLength(100);
    await expect(input.db.prepare("INSERT INTO public_render_publication(path) VALUES(?)").bind(path(101)).run()).rejects.toThrow("Publication prototype enrollment limit");
    const result=await publishProductBatch({...input,render});
    expect(result).toEqual({checked:0,generated:0,unchanged:0,hidden:0,failed:0});
    expect(renders).toHaveLength(100);
    // Reconciliation still checks expired deadlines without rendering unchanged HTML.
    await input.db.prepare("UPDATE public_render_publication SET next_check_at=0").run();
    expect(await publishProductBatch({...input,render})).toEqual({checked:8,generated:0,unchanged:8,hidden:0,failed:0});
    expect(renders).toHaveLength(100);
    // New deployment identity is due even when the previous version was checked.
    const newVersion=await publishProductBatch({...input,version:"qa-publication-v2",render});
    expect(newVersion.generated).toBe(8);
    expect(renders).toHaveLength(108);
  },60000);

  it("invalidates own changes, related content, affiliate and visibility; refresh failure cannot serve old HTML", async () => {
    await fixture(3);
    const input=common();
    const db=input.db;
    await db.prepare("UPDATE products SET category='Publication category 001' WHERE id=99102").run();
    const render=async (request: Request)=> {
      const asin=new URL(request.url).pathname.split("/").at(-1);
      const row=await db.prepare("SELECT title FROM products WHERE asin=?").bind(asin).first<{title:string}>();
      return html(row?.title ?? "missing");
    };
    expect((await publishProductBatch({...input,render})).generated).toBe(3);
    const before=await readScopedRenderRevision(db,req(1));
    await db.prepare("UPDATE products SET title='Changed title' WHERE id=99102").run();
    expect(await readScopedRenderRevision(db,req(1))).not.toBe(before);
    const due = await listDuePublicationPaths(db,input.version,Date.now(),8);
    expect(due.map(x=>x.path).sort()).toEqual([path(1),path(2)]);
    expect(await readPublishedProduct({...input,request:req(1)})).toBeUndefined();
    expect(await readPublishedProduct({...input,request:req(2)})).toBeUndefined();
    expect(await (await readPublishedProduct({...input,request:req(3)}))?.text()).toBe("Publication 003");
    const failed=await publishProductBatch({...input,render:async()=>new Response("unavailable",{status:503})});
    expect(failed.failed).toBe(2);
    expect(await readPublishedProduct({...input,request:req(2)})).toBeUndefined();
    expect((await publishProductBatch({...input,render})).checked).toBe(0);
    const retry=await db.prepare("SELECT next_check_at-last_checked_at AS delay FROM public_render_publication WHERE path=?").bind(path(2)).first<{delay:number}>();
    expect(retry?.delay).toBe(5*60*1000);
    // Simulate reaching the retry deadline, preserving the original stale-data assertion.
    await db.prepare("UPDATE public_render_publication SET next_check_at=0 WHERE path IN (?,?)").bind(path(1),path(2)).run();
    expect((await publishProductBatch({...input,render})).generated).toBe(2);
    expect(await (await readPublishedProduct({...input,request:req(2)}))?.text()).toBe("Changed title");
    await db.prepare("INSERT INTO agents(id,slug,name) VALUES(99101,'publication-qa','Publication QA')").run();
    await db.prepare("INSERT INTO tracking_ids(id,agent_id,tag,marketplace) VALUES(99101,99101,'publication-qa-20','US')").run();
    expect(await readPublishedProduct({...input,request:req(3)})).toBeUndefined();
    expect((await publishProductBatch({...input,render})).generated).toBe(3);
    await db.prepare("UPDATE tracking_ids SET tag='publication-new-20' WHERE id=99101").run();
    expect(await readPublishedProduct({...input,request:req(1)})).toBeUndefined();
    await db.prepare("UPDATE products SET is_adult=1 WHERE id=99101").run();
    expect(await readPublishedProduct({...input,request:req(1)})).toBeUndefined();
    const batch=await publishProductBatch({...input,render});
    expect(batch.hidden).toBe(1);
    expect(await readPublishedProduct({...input,request:req(1)})).toBeUndefined();
    await db.prepare("DELETE FROM public_render_publication WHERE path=?").bind(path(2)).run();
    expect(await readPublishedProduct({...input,request:req(2)})).toBeUndefined();
  },60000);

  it("refreshes before expiry without serving expired documents or growing storage", async()=>{
    await fixture(1);
    const input=common();
    let renders=0;
    const render=async()=>html("Document "+(++renders));
    expect((await publishProductBatch({...input,render})).generated).toBe(1);
    const slot=(await input.bucket.list()).objects[0].key;
    const original=await input.bucket.get(slot);
    expect(Number(original?.customMetadata?.expiresAt)-Date.now()).toBeGreaterThan(71*60*60*1000);
    await original?.body.cancel();
    async function setExpiry(expiresAt:number){
      const old=await input.bucket.get(slot);
      if(!old)throw Error("Missing test fixture snapshot");
      await input.bucket.put(slot,await old.arrayBuffer(),{httpMetadata:old.httpMetadata,customMetadata:{...old.customMetadata,expiresAt:String(expiresAt)}});
      await input.db.prepare("UPDATE public_render_publication SET next_check_at=0 WHERE path=?").bind(path(1)).run();
    }
    await setExpiry(Date.now()+3*60*60*1000);
    expect(await (await readPublishedProduct({...input,request:req(1)}))?.text()).toBe("Document 1");
    expect((await publishProductBatch({...input,render})).generated).toBe(1);
    expect(await (await readPublishedProduct({...input,request:req(1)}))?.text()).toBe("Document 2");
    expect((await input.bucket.list()).objects).toHaveLength(1);
    await setExpiry(Date.now()-1000);
    expect(await readPublishedProduct({...input,request:req(1)})).toBeUndefined();
    expect((await publishProductBatch({...input,render})).generated).toBe(1);
    expect(await (await readPublishedProduct({...input,request:req(1)}))?.text()).toBe("Document 3");
  });

  it("reuses one storage slot for each deployment and document across revisions", async()=>{
    await fixture(1);
    const input=common();
    const render=async()=>html("Publication body");
    expect((await publishProductBatch({...input,render})).generated).toBe(1);
    const initial=(await input.bucket.list()).objects.map(x=>x.key);
    expect(initial).toHaveLength(1);
    for(let i=0;i<3;i++){
      await input.db.prepare("UPDATE products SET title=? WHERE id=99101").bind("Revision "+i).run();
      expect(await readPublishedProduct({...input,request:req(1)})).toBeUndefined();
      expect((await publishProductBatch({...input,render})).generated).toBe(1);
      expect((await input.bucket.list()).objects.map(x=>x.key)).toEqual(initial);
      expect(await (await readPublishedProduct({...input,request:req(1)}))?.text()).toBe("Publication body");
    }
    const next={...input,version:"qa-publication-v-next"};
    expect(await readPublishedProduct({...next,request:req(1)})).toBeUndefined();
    expect((await publishProductBatch({...next,render})).generated).toBe(1);
    expect((await input.bucket.list()).objects).toHaveLength(2);
    expect(await (await readPublishedProduct({...input,request:req(1)}))?.text()).toBe("Publication body");
    expect(await (await readPublishedProduct({...next,request:req(1)}))?.text()).toBe("Publication body");
  });

  it("matches exact request revision across marketplace variants and absent-market fallback", async()=>{
    await fixture(1);
    const input=common(),db=input.db;
    await db.prepare("UPDATE products SET created_at='2026-01-01' WHERE id=99101").run();
    await db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult,created_at) VALUES(99200,'P000000001','Canadian variant','/favicon.svg','CA','Other category','active',1,0,'2026-02-01')").run();
    for(const market of ["US","CA","UK"]){
      await db.prepare("INSERT INTO public_render_publication(path) VALUES(?)").bind(path(1)+"?market="+market).run();
    }
    async function verify(){
      const due=await listDuePublicationPaths(db,input.version,Date.now(),8);
      expect(due).toHaveLength(4);
      for(const row of due){
        const exact=await readScopedRenderRevision(db,new Request(origin+row.path));
        expect(row.current_revision).toBe(exact??"hidden");
      }
    }
    await verify();
    await db.prepare("UPDATE products SET is_adult=1 WHERE id=99200").run();
    await verify();
    await db.prepare("UPDATE products SET is_active=0 WHERE id=99101").run();
    await verify();
    const result=await publishProductBatch({...input,render:async()=>{throw Error("Hidden products must never render")}});
    expect(result.hidden).toBe(4);
  });

  it("does not publish a document if the revision changes while rendering", async()=>{
    await fixture(1);
    const input=common();
    const result=await publishProductBatch({...input,render:async()=>{
      await input.db.prepare("UPDATE products SET title='Changed during generation' WHERE id=99101").run();
      return html("Old content");
    }});
    expect(result.failed).toBe(1);
    const dirty = await input.db.prepare("SELECT last_checked_at,next_check_at FROM public_render_publication WHERE path=?").bind(path(1)).first<{last_checked_at:number;next_check_at:number}>();
    expect(dirty?.last_checked_at).toBe(0);
    expect(dirty?.next_check_at).toBe(0);
    expect((await listDuePublicationPaths(input.db,input.version,Date.now(),8)).map(x=>x.path)).toEqual([path(1)]);
    expect(await readPublishedProduct({...input,request:req(1)})).toBeUndefined();
    expect((await input.bucket.list()).objects).toHaveLength(0);
  });
});
