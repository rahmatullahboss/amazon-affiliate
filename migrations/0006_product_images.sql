-- migrations/0006_product_images.sql
-- Add multi-image gallery and A+ content image columns

ALTER TABLE products ADD COLUMN product_images TEXT DEFAULT '';   -- JSON array of gallery image URLs
ALTER TABLE products ADD COLUMN aplus_images TEXT DEFAULT '';     -- JSON array of A+ content banner URLs
