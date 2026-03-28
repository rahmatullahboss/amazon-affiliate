/**
 * Analytics Service — Click and page view tracking
 */

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

export const hashIp = async (ip: string, salt?: string): Promise<string> => {
  const encoder = new TextEncoder();
  // Salt from environment variable, fallback for dev only
  const data = encoder.encode(ip + (salt || 'dealsrky-dev-salt-change-in-production'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
};

export const recordClick = async (db: D1Database, event: ClickEvent): Promise<void> => {
  try {
    await db
      .prepare(
        `INSERT INTO clicks (agent_id, product_id, tracking_tag, ip_hash, user_agent, referer, country)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(event.agentId, event.productId, event.trackingTag, event.ipHash, event.userAgent, event.referer, event.country)
      .run();
  } catch (error) {
    console.error('[Analytics] Failed to record click:', error);
  }
};

export const recordView = async (db: D1Database, event: ViewEvent): Promise<void> => {
  try {
    await db
      .prepare(
        `INSERT INTO page_views (agent_id, product_id, ip_hash, user_agent, referer, country)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(event.agentId, event.productId, event.ipHash, event.userAgent, event.referer, event.country)
      .run();
  } catch (error) {
    console.error('[Analytics] Failed to record view:', error);
  }
};

export const getAnalyticsOverview = async (db: D1Database) => {
  const [totalClicks, totalViews, clicksToday, viewsToday, clicksWeek, viewsWeek, topAgents, topProducts] =
    await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM clicks').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM page_views').first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM clicks WHERE clicked_at >= date('now')").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM page_views WHERE viewed_at >= date('now')").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM clicks WHERE clicked_at >= date('now', '-7 days')").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM page_views WHERE viewed_at >= date('now', '-7 days')").first<{ count: number }>(),
      db.prepare(
        `SELECT a.name, a.slug, COUNT(c.id) as clicks
         FROM clicks c JOIN agents a ON a.id = c.agent_id
         GROUP BY c.agent_id ORDER BY clicks DESC LIMIT 10`
      ).all<{ name: string; slug: string; clicks: number }>(),
      db.prepare(
        `SELECT p.asin, p.title, COUNT(c.id) as clicks
         FROM clicks c JOIN products p ON p.id = c.product_id
         GROUP BY c.product_id ORDER BY clicks DESC LIMIT 10`
      ).all<{ asin: string; title: string; clicks: number }>(),
    ]);

  return {
    totalClicks: totalClicks?.count ?? 0,
    totalViews: totalViews?.count ?? 0,
    clicksToday: clicksToday?.count ?? 0,
    viewsToday: viewsToday?.count ?? 0,
    clicksThisWeek: clicksWeek?.count ?? 0,
    viewsThisWeek: viewsWeek?.count ?? 0,
    topAgents: topAgents?.results ?? [],
    topProducts: topProducts?.results ?? [],
  };
};

export const getAgentAnalytics = async (db: D1Database, agentId: number) => {
  const [totalClicks, totalViews, recentClicks, productBreakdown] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM clicks WHERE agent_id = ?').bind(agentId).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM page_views WHERE agent_id = ?').bind(agentId).first<{ count: number }>(),
    db.prepare(
      `SELECT c.tracking_tag, c.country, c.clicked_at FROM clicks c
       WHERE c.agent_id = ? ORDER BY c.clicked_at DESC LIMIT 50`
    ).bind(agentId).all(),
    db.prepare(
      `SELECT p.asin, p.title, COUNT(c.id) as clicks FROM clicks c
       JOIN products p ON p.id = c.product_id WHERE c.agent_id = ?
       GROUP BY c.product_id ORDER BY clicks DESC`
    ).bind(agentId).all(),
  ]);

  return {
    totalClicks: totalClicks?.count ?? 0,
    totalViews: totalViews?.count ?? 0,
    conversionRate:
      totalViews?.count && totalClicks?.count
        ? ((totalClicks.count / totalViews.count) * 100).toFixed(2)
        : '0.00',
    recentClicks: recentClicks?.results ?? [],
    productBreakdown: productBreakdown?.results ?? [],
  };
};
