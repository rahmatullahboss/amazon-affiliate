import { describe, it, expect, vi } from "vitest";
import { createImmutableBuildHandler } from "../../server/utils/immutable-build-handler";

describe("immutable production route handler",()=>{
  it("constructs one handler for concurrent and later requests, with fresh request contexts", async()=>{
    const load=vi.fn(async()=>({release:"fixed"}));
    const factory=vi.fn((build:{release:string})=>async(request:Request, context:{id:string})=>new Response(build.release+" "+new URL(request.url).pathname+" "+context.id));
    const handle=createImmutableBuildHandler(load,factory);
    const results=await Promise.all([handle(new Request("https://example.test/a"),{id:"a"}),handle(new Request("https://example.test/b"),{id:"b"})]);
    expect(await Promise.all(results.map(r=>r.text()))).toEqual(["fixed /a a","fixed /b b"]);
    expect(await (await handle(new Request("https://example.test/c"),{id:"c"})).text()).toBe("fixed /c c");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("retries failed initialization and does not cache response failures",async()=>{
    let attempts=0;
    const handle=createImmutableBuildHandler(async()=>{if(++attempts===1)throw Error("load");return "build"},build=>async(fail:boolean)=>{if(fail)throw Error("request");return build});
    await expect(handle(false)).rejects.toThrow("load");
    await expect(handle(true)).rejects.toThrow("request");
    expect(await handle(false)).toBe("build");
    expect(attempts).toBe(2);
  });
});
