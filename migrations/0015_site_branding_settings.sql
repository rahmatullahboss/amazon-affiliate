CREATE TABLE IF NOT EXISTS site_branding_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  og_site_name TEXT NOT NULL DEFAULT 'DealsRky Product Picks',
  og_description TEXT NOT NULL DEFAULT 'Browse curated product pages, compare featured picks, and continue to the final retailer page with a clear preview.',
  og_image_url TEXT NOT NULL DEFAULT 'https://dealsrky.com/dealsrky-logo.svg',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_branding_settings (
  id,
  og_site_name,
  og_description,
  og_image_url
) VALUES (
  1,
  'DealsRky Product Picks',
  'Browse curated product pages, compare featured picks, and continue to the final retailer page with a clear preview.',
  'https://dealsrky.com/dealsrky-logo.svg'
);
