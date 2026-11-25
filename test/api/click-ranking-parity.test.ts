import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { getCollectionRows, getHomepageRankingRows } from "../../server/services/collection-feed";

describe("date-first click ranking on real migrated D1", () => {
  it("matches original ranking across markets, visibility, ties, stale clicks and limits", async () => {
    const db = env.DB;
    await db.prepare("INSERT INTO agents(id,slug,name) VALUES (79101,'ranking-qa','Ranking QA')").run();
    const inserts: D1PreparedStatement[] = [];
    for (let i=1; i<=16; i++) {
      const market=i===13?"CA":"US";
      inserts.push(db.prepare("INSERT INTO products(id,asin,title,image_url,marketplace,status,is_active,is_adult) VALUES (?,?,?,?,?,'active',?,?)").bind(79200+i,"R"+String(i).padStart(9,"0"),"Ranking "+i,"/favicon.svg",market,i===14?0:1,i===15?1:0));
      for (let click=0;click<(i===14||i===15?9:i%3+1);click++) {
        inserts.push(db.prepare("INSERT INTO clicks(agent_id,product_id,tracking_tag,clicked_at) VALUES (79101,?, 'qa-tag-20',datetime('now',?))").bind(79200+i,i===16?"-8 days":"-1 day"));
      }
    }
    await db.batch(inserts);
    const original = (market:string,limit:number) => db.prepare(`
      SELECT p.id,p.asin,p.title,p.image_url,p.category,p.marketplace,COUNT(c.id) AS activity_count
      FROM clicks c JOIN products p ON p.id=c.product_id
      WHERE p.is_active=1 AND p.status='active' AND p.is_adult=0 AND p.marketplace=?
        AND c.clicked_at>=datetime('now','-7 days')
      GROUP BY p.id HAVING COUNT(c.id)>0
      ORDER BY activity_count DESC,p.id DESC LIMIT ?
    `).bind(market,limit).all();
    for (const market of ["US","CA","UK"]) {
      for (const [kind,limit] of [["top-10",10],["trending",30],["trending",6]] as const) {
        expect(await getCollectionRows(db,market,kind,limit)).toEqual((await original(market,limit)).results);
      }
    }
    const home=await getHomepageRankingRows(db,"US");
    expect(home.topRows).toHaveLength(10);
    expect(home.trendingRows).toEqual(home.topRows.slice(0,6));
    expect(home.topRows.every(row=>![79214,79215,79216].includes(row.id))).toBe(true);
  });
});
