import type { D1Database } from '@cloudflare/workers-types';

export const DbFactory = {
  async seedAdmin(db: D1Database) {
    await db
      .prepare(
        `INSERT INTO admin_users (id, username, password_hash, role) VALUES (1, 'admin', 'hash', 'admin') ON CONFLICT DO NOTHING`
      )
      .run();
  },

  async seedAgent(db: D1Database, id: number, slug: string, name: string) {
    await db
      .prepare(`INSERT INTO agents (id, slug, name) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`)
      .bind(id, slug, name)
      .run();
  },

  async seedProduct(db: D1Database, id: number, asin: string) {
    await db
      .prepare(
        `INSERT INTO products (id, asin, title, image_url, marketplace) VALUES (?, ?, 'Test Product', 'http://img.com', 'US') ON CONFLICT DO NOTHING`
      )
      .bind(id, asin)
      .run();
  },

  async seedTrackingId(db: D1Database, id: number, agentId: number, tag: string) {
    await db
      .prepare(
        `INSERT INTO tracking_ids (id, agent_id, tag, marketplace) VALUES (?, ?, ?, 'US') ON CONFLICT DO NOTHING`
      )
      .bind(id, agentId, tag)
      .run();
  },

  async seedTrackingIdsFallback(db: D1Database, id: number, agentId: number, tag: string) {
    await db
      .prepare(
        `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default) VALUES (?, ?, ?, 'US', 1) ON CONFLICT DO NOTHING`
      )
      .bind(id, agentId, tag)
      .run();
  },

  async seedAgentProduct(
    db: D1Database,
    agentId: number,
    productId: number,
    trackingId: number
  ) {
    await db
      .prepare(
        `INSERT INTO agent_products (agent_id, product_id, tracking_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`
      )
      .bind(agentId, productId, trackingId)
      .run();
  },
};
