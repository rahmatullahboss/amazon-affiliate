-- Synthetic QA data. Apply only to disposable local D1.
UPDATE social_links_settings SET telegram_url='https://t.me/qa_fixture', telegram_enabled=1 WHERE id=1;
INSERT INTO categories(name,slug) VALUES ('QA Catalog','qa-catalog');
INSERT INTO agents(id,slug,name) VALUES (82001,'qa-catalog-agent','QA Catalog Agent');
INSERT INTO tracking_ids(id,agent_id,tag,marketplace) VALUES (82001,82001,'qa-fixture-us-20','US'),(82002,82001,'qa-fixture-ca-20','CA');
INSERT INTO agent_slug_aliases(agent_id,tracking_id,marketplace,slug) VALUES (82001,82001,'US','qa-catalog-us');
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<30)
INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult,created_at)
SELECT 83000+n,printf('Q%09d',n),printf('QA Product %02d',n),'/favicon.svg',
CASE WHEN n=28 THEN 'CA' ELSE 'US' END,'QA Catalog','active',CASE WHEN n=29 THEN 0 ELSE 1 END,CASE WHEN n=30 THEN 1 ELSE 0 END,'2026-11-01' FROM seq;
INSERT INTO agent_products(agent_id,product_id,tracking_id,custom_title,is_active,updated_at)
SELECT 82001,id,CASE WHEN marketplace='CA' THEN 82002 ELSE 82001 END,title,1,'2026-11-01' FROM products WHERE id BETWEEN 83001 AND 83030;
