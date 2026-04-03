import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { getMonthlyRevenueAnalytics } from "../../server/services/analytics";

describe("Analytics service", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM amazon_conversions").run();
    await env.DB.prepare("DELETE FROM amazon_reports").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  it("returns monthly revenue summary and per-agent monthly breakdown", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES
        (401, 'alpha', 'Alpha', 1),
        (402, 'beta', 'Beta', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active) VALUES
        (501, 401, 'alpha-us-20', 'US', 1, 1),
        (502, 402, 'beta-us-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO amazon_reports (
         id, marketplace, report_type, period_start, period_end, source_file_name, imported_by_user_id
       ) VALUES
         (601, 'US', 'tracking_summary', '2026-04-01', '2026-04-30', 'apr.csv', NULL),
         (602, 'US', 'tracking_summary', '2026-03-01', '2026-03-31', 'mar.csv', NULL)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO amazon_conversions (
         report_id, tracking_tag, marketplace, asin, ordered_items, shipped_items, revenue_amount, commission_amount, raw_date
       ) VALUES
         (601, 'alpha-us-20', 'US', 'B0APR001', 3, 3, 120.50, 12.05, '2026-04-10'),
         (601, 'beta-us-20', 'US', 'B0APR002', 1, 1, 80.00, 8.00, '2026-04-11'),
         (602, 'alpha-us-20', 'US', 'B0MAR001', 2, 2, 50.00, 5.00, '2026-03-12')`
    ).run();

    const analytics = await getMonthlyRevenueAnalytics(env.DB, "2026-04-15");

    expect(analytics.summary).toEqual({
      thisMonthRevenue: 200.5,
      thisMonthOrders: 4,
      thisMonthCommission: 20.05,
      lifetimeRevenue: 250.5,
      lifetimeCommission: 25.05,
    });

    expect(analytics.monthlyRevenueTrend).toEqual([
      {
        month: "2026-03",
        revenueAmount: 50,
        orderedItems: 2,
        commissionAmount: 5,
      },
      {
        month: "2026-04",
        revenueAmount: 200.5,
        orderedItems: 4,
        commissionAmount: 20.05,
      },
    ]);

    expect(analytics.agentMonthlyBreakdown).toEqual([
      {
        month: "2026-04",
        agentId: 401,
        agentName: "Alpha",
        agentSlug: "alpha",
        orderedItems: 3,
        revenueAmount: 120.5,
        commissionAmount: 12.05,
      },
      {
        month: "2026-04",
        agentId: 402,
        agentName: "Beta",
        agentSlug: "beta",
        orderedItems: 1,
        revenueAmount: 80,
        commissionAmount: 8,
      },
      {
        month: "2026-03",
        agentId: 401,
        agentName: "Alpha",
        agentSlug: "alpha",
        orderedItems: 2,
        revenueAmount: 50,
        commissionAmount: 5,
      },
    ]);
  });
});
