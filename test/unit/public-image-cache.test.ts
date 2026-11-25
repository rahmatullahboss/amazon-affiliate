import { describe, it, expect, vi } from "vitest";
import { canCachePublicImage, serveCachedPublicImage } from "../../server/services/public-image-cache";

const url = "https://dealsrky.com/api/public/blog-images/cover-1760000000000-abcdef123456.webp";
function fixture() {
  const tasks: Promise<unknown>[] = [];
  const ctx = {waitUntil: (p: Promise<unknown>) => {tasks.push(p);}};
  const entries = new Map<string,Response>();
  const match = vi.fn(async (key: Request | string) => entries.get(String(typeof key === "string" ? key : key.url))?.clone());
  const put = vi.fn(async (key: Request | string, value: Response) => {entries.set(typeof key === "string" ? key : key.url, value.clone());});
  const open = async () => ({match,put});
  return {ctx,tasks,match,put,open};
}
describe("bounded public image cache", () => {
  it("only admits versioned public GET images without request variants", () => {
    expect(canCachePublicImage(new Request(url))).toBe(true);
    for (const headers of [{cookie:"session=test"},{authorization:"Bearer test"},{range:"bytes=0-1"},{"if-none-match":"test"},{"cache-control":"no-cache"}]) {
      expect(canCachePublicImage(new Request(url,{headers:headers as HeadersInit}))).toBe(false);
    }
    for (const path of [url+"?x=1",url.replace("abcdef123456","legacy"),"https://dealsrky.com/admin","https://dealsrky.com/go/agent/product"]) {
      expect(canCachePublicImage(new Request(path))).toBe(false);
    }
    expect(canCachePublicImage(new Request(url,{method:"HEAD"}))).toBe(false);
  });
  it("serves a cache hit without repeating the backing read, with a bounded TTL", async () => {
    const f = fixture();
    const load = vi.fn(async () => new Response("image bytes",{headers:{"content-type":"image/webp","cache-control":"public, max-age=31536000, immutable"}}));
    const first = await serveCachedPublicImage(new Request(url),f.ctx,load,f.open);
    expect(await first.text()).toBe("image bytes");
    await Promise.all(f.tasks);
    const second = await serveCachedPublicImage(new Request(url),f.ctx,load,f.open);
    expect(await second.text()).toBe("image bytes");
    expect(second.headers.get("cache-control")).toBe("public, max-age=300");
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("does not store errors or private, variant, or non-image responses",async()=>{
    const f=fixture();
    for (const [status,headers] of [[404,{"content-type":"image/webp"}],[200,{"content-type":"text/html"}],[200,{"content-type":"image/webp","set-cookie":"a=b"}],[200,{"content-type":"image/webp","cache-control":"private"}],[200,{"content-type":"image/webp","vary":"accept"}]] as [number,HeadersInit][]) {
      await serveCachedPublicImage(new Request(url),f.ctx,async()=>new Response("body",{status,headers}),f.open);
    }
    expect(f.put).not.toHaveBeenCalled();
  });
  it("fails open to origin on cache errors and does not swallow origin errors", async()=>{
    const f=fixture();
    const response=await serveCachedPublicImage(new Request(url),f.ctx,async()=>new Response("origin"),async()=>{throw new Error("cache unavailable")});
    expect(await response.text()).toBe("origin");
    await expect(serveCachedPublicImage(new Request(url),f.ctx,async()=>{throw new Error("origin failure")},f.open)).rejects.toThrow("origin failure");
  });
});
