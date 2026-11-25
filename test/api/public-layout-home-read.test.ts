import { describe,it,expect } from "vitest";
import { env } from "cloudflare:workers";
import { loader } from "../../app/routes/public-layout";

describe("public layout homepage social link parity",()=>{
  it("preserves configured header social links on homepage and other public routes",async()=>{
    await env.DB.prepare("UPDATE social_links_settings SET telegram_url='https://t.me/qa_home',telegram_enabled=1 WHERE id=1").run();
    for(const path of ["/?market=US","/blog","/deals"]){
      const result=await loader({request:new Request("https://dealsrky.com"+path),params:{},context:{cloudflare:{env,ctx:{}}}} as Parameters<typeof loader>[0]);
      expect(result.socialLinks?.telegram).toEqual({url:"https://t.me/qa_home",enabled:true});
    }
  });
});
