import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { importAmazonReportSchema } from '../schemas';
import {
  getAnalyticsOverview,
  getAgentAnalytics,
  importAmazonReport,
} from '../services/analytics';
import { writeAuditLog } from '../services/audit-log';

const analytics = new Hono<AppEnv>();

/**
 * GET /api/analytics/overview — Dashboard stats
 */
analytics.get('/overview', async (c) => {
  const overview = await getAnalyticsOverview(c.env.DB);
  return c.json(overview);
});

/**
 * GET /api/analytics/reports — Recently imported Amazon reports
 */
analytics.get('/reports', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT
       ar.id,
       ar.marketplace,
       ar.report_type,
       ar.period_start,
       ar.period_end,
       ar.source_file_name,
       ar.imported_at,
       u.username as imported_by_username,
       COUNT(ac.id) as conversions_count
     FROM amazon_reports ar
     LEFT JOIN users u ON u.id = ar.imported_by_user_id
     LEFT JOIN amazon_conversions ac ON ac.report_id = ar.id
     GROUP BY ar.id
     ORDER BY ar.imported_at DESC
     LIMIT 20`
  ).all();

  return c.json({ reports: results ?? [] });
});

/**
 * POST /api/analytics/reports/import — Import an Amazon report CSV/TSV
 */
analytics.post('/reports/import', zValidator('json', importAmazonReportSchema), async (c) => {
  const payload = c.req.valid('json');
  const result = await importAmazonReport(c.env.DB, {
    marketplace: payload.marketplace,
    sourceFileName: payload.source_file_name,
    csvContent: payload.csv_content,
    reportType: payload.report_type,
    periodStart: payload.period_start,
    periodEnd: payload.period_end,
    importedByUserId: c.get('userId'),
  });

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'amazon_report.imported',
      entityType: 'amazon_report',
      entityId: result.reportId,
      details: {
        marketplace: payload.marketplace,
        sourceFileName: payload.source_file_name,
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
      },
    })
  );

  return c.json({
    reportId: result.reportId,
    importedRows: result.importedRows,
    skippedRows: result.skippedRows,
    message: 'Amazon report imported successfully',
  }, 201);
});

/**
 * GET /api/analytics/agent/:id — Per-agent analytics
 */
analytics.get('/agent/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid agent ID' }, 400);
  const stats = await getAgentAnalytics(c.env.DB, id);
  return c.json(stats);
});

/**
 * GET /api/analytics/product/:id — Per-product analytics
 */
analytics.get('/product/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400);

  const [totalClicks, totalViews, agentBreakdown, dailyClicks] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM clicks WHERE product_id = ?')
      .bind(id).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM page_views WHERE product_id = ?')
      .bind(id).first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT a.name, a.slug, COUNT(c.id) as clicks
       FROM clicks c JOIN agents a ON a.id = c.agent_id
       WHERE c.product_id = ? GROUP BY c.agent_id ORDER BY clicks DESC`
    ).bind(id).all(),
    c.env.DB.prepare(
      `SELECT date(clicked_at) as day, COUNT(*) as clicks
       FROM clicks WHERE product_id = ? AND clicked_at >= date('now', '-30 days')
       GROUP BY day ORDER BY day`
    ).bind(id).all(),
  ]);

  return c.json({
    totalClicks: totalClicks?.count ?? 0,
    totalViews: totalViews?.count ?? 0,
    agentBreakdown: agentBreakdown?.results ?? [],
    dailyClicks: dailyClicks?.results ?? [],
  });
});

export default analytics;
