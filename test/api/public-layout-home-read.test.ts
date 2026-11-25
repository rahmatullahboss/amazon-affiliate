import { describe,it,expect } from "vitest";
import { env } from "cloudflare:workers";
import { loader,shouldRevalidate } from "../../app/routes/public-layout";

describe("public layout homepage read avoidance",()=>{
  it("does not query settings for the homepage, but reads the original social links on other routes",async()=>{
    let queries=0;
    const fakeDb={prepare(){queries++;throw Error("Unexpected homepage DB query")}};
    const home=await loader({request:new Request("https://dealsrky.com/?market=US"),params:{},context:{cloudflare:{env:{...env,DB:fakeDb},ctx:{}}}} as unknown as Parameters<typeof loader>[0]);
    expect(home).toEqual({socialLinks:null});
    expect(queries).toBe(0);
    await env.DB.prepare("UPDATE social_links_settings SET telegram_url='https://t.me/qa_home',telegram_enabled=1 WHERE id=1").run();
    const other=await loader({request:new Request("https://dealsrky.com/blog"),params:{},context:{cloudflare:{env,ctx:{}}}} as Parameters<typeof loader>[0]);
    expect(other.socialLinks?.telegram).toEqual({url:"https://t.me/qa_home",enabled:true});
  });
  it("revalidates at the homepage boundary and otherwise preserves router defaults",()=>{
    const check=(current:string,next:string,fallback:boolean)=>shouldRevalidate({currentUrl:new URL(current,"https://dealsrky.com"),nextUrl:new URL(next,"https://dealsrky.com"),defaultShouldRevalidate:fallback} as Parameters<typeof shouldRevalidate>[0]);
    expect(check("/","/blog",false)).toBe(true);
    expect(check("/blog","/",false)).toBe(true);
    expect(check("/?market=US","/?market=CA",false)).toBe(false);
    expect(check("/blog","/deals",false)).toBe(false);
    expect(check("/blog","/deals",true)).toBe(true);
  });
});
