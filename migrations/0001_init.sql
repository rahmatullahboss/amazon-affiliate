-- ============================================
-- Dealsrky Bridge — D1 Database Schema
-- Multi-marketplace, 30-40 agents, 4000+ orders/month
-- ============================================

-- Admin users for dashboard access
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agents (affiliates who share links)
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products (Amazon ASINs)
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asin TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  marketplace TEXT NOT NULL DEFAULT 'US',
  category TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(asin, marketplace)
);

-- Tracking IDs (Amazon associate tags per agent per marketplace)
CREATE TABLE IF NOT EXISTS tracking_ids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  tag TEXT UNIQUE NOT NULL,
  label TEXT,
  marketplace TEXT NOT NULL DEFAULT 'US',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Agent-Product Mappings (which agent sells which product with which tag)
CREATE TABLE IF NOT EXISTS agent_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  tracking_id INTEGER NOT NULL,
  custom_title TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, product_id),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (tracking_id) REFERENCES tracking_ids(id)
);

-- Click tracking
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  tracking_tag TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Page view tracking
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- Performance Indexes (Enterprise Scale)
-- ============================================

-- Core lookup paths
CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_products_asin ON products(asin, marketplace) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_tracking_agent ON tracking_ids(agent_id, marketplace) WHERE is_active = 1;

-- Mapping lookups (most critical for redirect performance)
CREATE INDEX IF NOT EXISTS idx_ap_agent_product ON agent_products(agent_id, product_id) WHERE is_active = 1;

-- Analytics queries
CREATE INDEX IF NOT EXISTS idx_clicks_agent ON clicks(agent_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_product ON clicks(product_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_date ON clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_views_agent ON page_views(agent_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_views_product ON page_views(product_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_views_date ON page_views(viewed_at);
