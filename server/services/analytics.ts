/**
 * Analytics Service — click, page view, and imported Amazon conversion tracking.
 */

import type { AnalyticsOverview } from "../utils/types";

interface ClickEvent {
  agentId: number;
  productId: number;
  trackingTag: string;
  ipHash: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
}

interface ViewEvent {
  agentId: number;
  productId: number;
  ipHash: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
}

interface ImportedConversionRow {
  tracking_tag: string;
  asin: string | null;
  ordered_items: number;
  shipped_items: number;
  revenue_amount: number;
  commission_amount: number;
  raw_date: string | null;
}

interface ImportAmazonReportInput {
  marketplace: string;
  sourceFileName: string;
  csvContent: string;
  reportType: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  importedByUserId?: number;
}

interface ImportAmazonReportResult {
  reportId: number;
  importedRows: number;
  skippedRows: number;
}

interface AgentAnalytics {
  totalClicks: number;
  totalViews: number;
  conversionRate: string;
  totalOrderedItems: number;
  totalRevenue: number;
  totalCommission: number;
  recentClicks: Array<{ tracking_tag: string; country: string | null; clicked_at: string }>;
  productBreakdown: Array<{ asin: string; title: string; clicks: number }>;
}

type CsvRecord = Record<string, string>;

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const hashIp = async (ip: string, salt?: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (salt || "dealsrky-dev-salt-change-in-production"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
};

export const recordClick = async (db: D1Database, event: ClickEvent): Promise<void> => {
  try {
    await db
      .prepare(
        `INSERT INTO clicks (agent_id, product_id, tracking_tag, ip_hash, user_agent, referer, country)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.agentId,
        event.productId,
        event.trackingTag,
        event.ipHash,
        event.userAgent,
        event.referer,
        event.country
      )
      .run();
  } catch (error) {
    console.error("[Analytics] Failed to record click:", error);
  }
};

export const recordView = async (db: D1Database, event: ViewEvent): Promise<void> => {
  try {
    await db
      .prepare(
        `INSERT INTO page_views (agent_id, product_id, ip_hash, user_agent, referer, country)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.agentId,
        event.productId,
        event.ipHash,
        event.userAgent,
        event.referer,
        event.country
      )
      .run();
  } catch (error) {
    console.error("[Analytics] Failed to record view:", error);
  }
};

export const getAnalyticsOverview = async (db: D1Database): Promise<AnalyticsOverview> => {
  const [
    totalClicks,
    totalViews,
    clicksToday,
    viewsToday,
    clicksWeek,
    viewsWeek,
    topAgents,
    topProducts,
    salesTotals,
    topAgentsByCommission,
    recentReports,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM clicks").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM page_views").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM clicks WHERE clicked_at >= date('now')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM page_views WHERE viewed_at >= date('now')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM clicks WHERE clicked_at >= date('now', '-7 days')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM page_views WHERE viewed_at >= date('now', '-7 days')").first<{ count: number }>(),
    db.prepare(
      `SELECT a.name, a.slug, COUNT(c.id) as clicks
       FROM clicks c
       JOIN agents a ON a.id = c.agent_id
       GROUP BY c.agent_id
       ORDER BY clicks DESC
       LIMIT 10`
    ).all<{ name: string; slug: string; clicks: number }>(),
    db.prepare(
      `SELECT p.asin, p.title, COUNT(c.id) as clicks
       FROM clicks c
       JOIN products p ON p.id = c.product_id
       GROUP BY c.product_id
       ORDER BY clicks DESC
       LIMIT 10`
    ).all<{ asin: string; title: string; clicks: number }>(),
    db.prepare(
      `SELECT
         COALESCE(SUM(ordered_items), 0) as totalOrderedItems,
         COALESCE(SUM(revenue_amount), 0) as totalRevenue,
         COALESCE(SUM(commission_amount), 0) as totalCommission
       FROM amazon_conversions`
    ).first<{ totalOrderedItems: number; totalRevenue: number; totalCommission: number }>(),
    db.prepare(
      `SELECT
         a.name,
         a.slug,
         COALESCE(SUM(ac.ordered_items), 0) as orderedItems,
         COALESCE(SUM(ac.revenue_amount), 0) as revenueAmount,
         COALESCE(SUM(ac.commission_amount), 0) as commissionAmount
       FROM amazon_conversions ac
       JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
       JOIN agents a ON a.id = t.agent_id
       GROUP BY a.id
       ORDER BY commissionAmount DESC, revenueAmount DESC
       LIMIT 10`
    ).all<{
      name: string;
      slug: string;
      orderedItems: number;
      revenueAmount: number;
      commissionAmount: number;
    }>(),
    db.prepare(
      `SELECT
         ar.id,
         ar.marketplace,
         ar.source_file_name as sourceFileName,
         ar.imported_at as importedAt,
         u.username as importedByUsername,
         COUNT(ac.id) as conversionsCount
       FROM amazon_reports ar
       LEFT JOIN users u ON u.id = ar.imported_by_user_id
       LEFT JOIN amazon_conversions ac ON ac.report_id = ar.id
       GROUP BY ar.id
       ORDER BY ar.imported_at DESC
       LIMIT 10`
    ).all<{
      id: number;
      marketplace: string;
      sourceFileName: string;
      importedAt: string;
      importedByUsername: string | null;
      conversionsCount: number;
    }>(),
  ]);

  return {
    totalClicks: totalClicks?.count ?? 0,
    totalViews: totalViews?.count ?? 0,
    clicksToday: clicksToday?.count ?? 0,
    viewsToday: viewsToday?.count ?? 0,
    clicksThisWeek: clicksWeek?.count ?? 0,
    viewsThisWeek: viewsWeek?.count ?? 0,
    totalOrderedItems: salesTotals?.totalOrderedItems ?? 0,
    totalRevenue: salesTotals?.totalRevenue ?? 0,
    totalCommission: salesTotals?.totalCommission ?? 0,
    topAgents: topAgents?.results ?? [],
    topProducts: topProducts?.results ?? [],
    topAgentsByCommission: topAgentsByCommission?.results ?? [],
    recentReports: recentReports?.results ?? [],
  };
};

export const getAgentAnalytics = async (
  db: D1Database,
  agentId: number
): Promise<AgentAnalytics> => {
  const [totalClicks, totalViews, recentClicks, productBreakdown, salesTotals] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM clicks WHERE agent_id = ?")
      .bind(agentId)
      .first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM page_views WHERE agent_id = ?")
      .bind(agentId)
      .first<{ count: number }>(),
    db.prepare(
      `SELECT c.tracking_tag, c.country, c.clicked_at
       FROM clicks c
       WHERE c.agent_id = ?
       ORDER BY c.clicked_at DESC
       LIMIT 50`
    )
      .bind(agentId)
      .all<{ tracking_tag: string; country: string | null; clicked_at: string }>(),
    db.prepare(
      `SELECT p.asin, p.title, COUNT(c.id) as clicks
       FROM clicks c
       JOIN products p ON p.id = c.product_id
       WHERE c.agent_id = ?
       GROUP BY c.product_id
       ORDER BY clicks DESC`
    )
      .bind(agentId)
      .all<{ asin: string; title: string; clicks: number }>(),
    db.prepare(
      `SELECT
         COALESCE(SUM(ac.ordered_items), 0) as totalOrderedItems,
         COALESCE(SUM(ac.revenue_amount), 0) as totalRevenue,
         COALESCE(SUM(ac.commission_amount), 0) as totalCommission
       FROM amazon_conversions ac
       JOIN tracking_ids t ON t.tag = ac.tracking_tag AND t.marketplace = ac.marketplace
       WHERE t.agent_id = ?`
    )
      .bind(agentId)
      .first<{ totalOrderedItems: number; totalRevenue: number; totalCommission: number }>(),
  ]);

  return {
    totalClicks: totalClicks?.count ?? 0,
    totalViews: totalViews?.count ?? 0,
    conversionRate:
      totalViews?.count && totalClicks?.count
        ? numberFormatter.format((totalClicks.count / totalViews.count) * 100)
        : "0.00",
    totalOrderedItems: salesTotals?.totalOrderedItems ?? 0,
    totalRevenue: salesTotals?.totalRevenue ?? 0,
    totalCommission: salesTotals?.totalCommission ?? 0,
    recentClicks: recentClicks?.results ?? [],
    productBreakdown: productBreakdown?.results ?? [],
  };
};

export const importAmazonReport = async (
  db: D1Database,
  input: ImportAmazonReportInput
): Promise<ImportAmazonReportResult> => {
  const parsedRows = parseAmazonReportRows(input.csvContent);
  const importedRows = parsedRows.validRows.length;
  const skippedRows = parsedRows.skippedRows;

  const reportResult = await db
    .prepare(
      `INSERT INTO amazon_reports (
         marketplace,
         report_type,
         period_start,
         period_end,
         source_file_name,
         imported_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.marketplace,
      input.reportType,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.sourceFileName,
      input.importedByUserId ?? null
    )
    .run();

  const reportId = Number(reportResult.meta.last_row_id);

  for (const row of parsedRows.validRows) {
    await db
      .prepare(
        `INSERT INTO amazon_conversions (
           report_id,
           tracking_tag,
           marketplace,
           asin,
           ordered_items,
           shipped_items,
           revenue_amount,
           commission_amount,
           raw_date
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        reportId,
        row.tracking_tag,
        input.marketplace,
        row.asin,
        row.ordered_items,
        row.shipped_items,
        row.revenue_amount,
        row.commission_amount,
        row.raw_date
      )
      .run();
  }

  return {
    reportId,
    importedRows,
    skippedRows,
  };
};

function parseAmazonReportRows(csvContent: string): {
  validRows: ImportedConversionRow[];
  skippedRows: number;
} {
  const lines = csvContent
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { validRows: [], skippedRows: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const records = lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    return headers.reduce<CsvRecord>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });

  const validRows: ImportedConversionRow[] = [];
  let skippedRows = 0;

  for (const record of records) {
    const trackingTag = getRecordValue(record, [
      "tracking_id",
      "tracking_tag",
      "associate_tracking_id",
      "tracking",
    ]);

    if (!trackingTag) {
      skippedRows += 1;
      continue;
    }

    validRows.push({
      tracking_tag: trackingTag,
      asin: getRecordValue(record, ["asin", "product_asin"]) || null,
      ordered_items: parseNumber(getRecordValue(record, ["ordered_items", "items_ordered"])),
      shipped_items: parseNumber(getRecordValue(record, ["shipped_items", "items_shipped"])),
      revenue_amount: parseCurrency(
        getRecordValue(record, [
          "revenue_amount",
          "shipped_items_revenue",
          "ordered_items_revenue",
          "revenue",
          "sales",
        ])
      ),
      commission_amount: parseCurrency(
        getRecordValue(record, [
          "commission_amount",
          "earnings",
          "advertising_fees",
          "commission",
        ])
      ),
      raw_date: getRecordValue(record, ["date", "day", "summary_date"]) || null,
    });
  }

  return { validRows, skippedRows };
}

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.includes(";")) return ";";
  return ",";
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getRecordValue(record: CsvRecord, keys: string[]): string {
  for (const key of keys) {
    if (record[key] && record[key].length > 0) {
      return record[key];
    }
  }
  return "";
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
