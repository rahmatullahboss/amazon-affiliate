import { describe, expect, it } from "vitest";
import { getAllProductRows, getCollectionRows, getHomepageRankingRows, isCollectionKind } from "../../server/services/collection-feed";

describe("independent product collections", () => {
  function mockDb(rows: unknown[] = []) {
    const statements: string[] = [];
    const binds: unknown[][] = [];
    const database = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind(...args: unknown[]) {
            binds.push(args);
            return {
              async all() { return { results: rows }; },
            };
          },
        };
      },
    } as unknown as D1Database;
    return { database, statements, binds };
  }

  it("shows the full active marketplace catalog in the All Products row", async () => {
    const fixture = mockDb();
    await getAllProductRows(fixture.database, "CA", 6);
    expect(fixture.statements[0]).toContain("FROM products p");
    expect(fixture.statements[0]).toContain("p.is_active = 1");
    expect(fixture.statements[0]).toContain("p.status = 'active'");
    expect(fixture.statements[0]).toContain("p.is_adult = 0");
    expect(fixture.statements[0]).toContain("ORDER BY p.updated_at DESC");
    expect(fixture.binds).toEqual([["CA", 6]]);
  });

  it("recognizes only the four dedicated collection types", () => {
    for (const k of ["featured", "latest", "trending", "top-10"]) {
      expect(isCollectionKind(k)).toBe(true);
    }
    expect(isCollectionKind("admin")).toBe(false);
    expect(isCollectionKind(undefined)).toBe(false);
  });

  it("caps Featured and Latest at 72h with active nonadult products", async () => {
    const fixture = mockDb();
    await getCollectionRows(fixture.database, "US", "featured", 999);
    await getCollectionRows(fixture.database, "UK", "latest", 20);
    expect(fixture.statements[0]).toContain("ap.created_at >= datetime('now', '-72 hours')");
    expect(fixture.statements[1]).toContain("p.updated_at >= datetime('now', '-72 hours')");
    expect(fixture.statements.every((sql) => sql.includes("p.is_adult = 0"))).toBe(true);
    expect(fixture.binds).toEqual([["US", 60], ["UK", 20]]);
  });

  it("shares a single ranked snapshot for both homepage click-based rows", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, activity_count: 10 - i }));
    const fixture = mockDb(rows);
    const result = await getHomepageRankingRows(fixture.database, "CA");
    expect(fixture.statements).toHaveLength(1);
    expect(fixture.binds).toEqual([["CA", 10]]);
    expect(result.topRows).toEqual(rows);
    expect(result.trendingRows).toEqual(rows.slice(0, 6));
    const empty = mockDb();
    expect(await getHomepageRankingRows(empty.database, "US")).toEqual({ topRows: [], trendingRows: [] });
  });

  it("ranks Trending and Top 10 by real tracked clicks, never random order or invented sales", async () => {
    const fixture = mockDb();
    await getCollectionRows(fixture.database, "US", "trending", 30);
    await getCollectionRows(fixture.database, "US", "top-10", 30);
    expect(fixture.statements[0]).toContain("COUNT(*) AS activity_count");
    expect(fixture.statements[0]).toContain("clicks INDEXED BY idx_clicks_date");
    expect(fixture.statements[0]).toContain("recent r CROSS JOIN products p");
    expect(fixture.statements[0]).toContain("ORDER BY activity_count DESC");
    expect(fixture.statements[1]).toContain("clicked_at >= datetime('now', '-7 days')");
    expect(fixture.binds[1]).toEqual(["US", 10]);
  });
});
