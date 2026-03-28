import { Hono } from 'hono';
import type { AppEnv } from '../utils/types';
import { getAnalyticsOverview, getAgentAnalytics } from '../services/analytics';

const analytics = new Hono<AppEnv>();

/**
 * GET /api/analytics/overview — Dashboard stats
 */
analytics.get('/overview', async (c) => {
  const overview = await getAnalyticsOverview(c.env.DB);
  return c.json(overview);
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
