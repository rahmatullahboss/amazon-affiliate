import { describe, it, expect } from "vitest";
import { getPublicProductAffiliateHrefs } from "../../server/services/public-product-affiliate";

describe("affiliate lookup batching",()=>{
  it("queries repeated IDs once across batch boundaries, preserves fallback and final product identity",async()=>{
    const queries:number[][]=[];
    const db={prepare(sql:string){return {bind(...args:unknown[]){return {async all(){
      if(sql.includes("FROM agent_products ap")){
        queries.push(args as number[]);
        return {results:[{product_id:12,marketplace:"US",tracking_tag:"qa-original-20"}]};
      }
      return {results:[{marketplace:"US",tracking_tag:"qa-primary-20"}]};
    }}}}}} as unknown as D1Database;
    const input=Array.from({length:161},(_,i)=>({id:i%2?12:13,asin:i%2?"QA00000012":"QA00000013",marketplace:"US"}));
    const links=await getPublicProductAffiliateHrefs(db,input);
    expect(queries).toEqual([[13,12]]);
    expect(new URL(links.get(12)!).searchParams.get("tag")).toBe("qa-original-20");
    expect(new URL(links.get(13)!).searchParams.get("tag")).toBe("qa-primary-20");
  });
});
