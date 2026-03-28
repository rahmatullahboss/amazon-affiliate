-- migrations/0002_product_content.sql

-- Add content fields to products for review pages
ALTER TABLE products ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN features TEXT DEFAULT '';     -- JSON array ["feature1", "feature2"]
ALTER TABLE products ADD COLUMN rating REAL DEFAULT 4.5;
ALTER TABLE products ADD COLUMN review_content TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN price TEXT DEFAULT '';        -- Display price
ALTER TABLE products ADD COLUMN original_price TEXT DEFAULT '';  -- Strikethrough price

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '',           -- Icon name or emoji
  image_url TEXT DEFAULT '',
  product_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insert default categories to match WordPress site
INSERT INTO categories (name, slug, icon, display_order) VALUES
('Air Conditioner', 'air-conditioner', 'ac_unit', 1),
('Audio & Video', 'audio-video', 'speaker', 2),
('Gadgets', 'gadgets', 'devices', 3),
('Home Appliances', 'home-appliances', 'home', 4),
('Kitchen', 'kitchen', 'kitchen', 5),
('Refrigerator', 'refrigerator', 'kitchen', 6),
('PCs & Laptop', 'pcs-laptop', 'computer', 7);
