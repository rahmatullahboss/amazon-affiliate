-- Disposable QA fixture only. 100 distinct canonical public paths.
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<100)
INSERT INTO products(id,asin,title,image_url,marketplace,category,status,is_active,is_adult,review_content,created_at)
SELECT 85000+n,printf('P%09d',n),printf('Publication QA Product %03d',n),'/favicon.svg','US',
       printf('QA Category %02d',(n-1)/10),'active',1,0,
       'Overview: Synthetic published editorial'||char(10)||'• Example feature'||char(10)||char(10)||'Details: Synthetic guide','2026-11-02'
FROM seq;
INSERT INTO agent_products(agent_id,product_id,tracking_id,custom_title,is_active,updated_at)
SELECT 82001,id,82001,title,1,'2026-11-02' FROM products WHERE id BETWEEN 85001 AND 85100;
INSERT INTO public_render_publication(path)
SELECT '/deals/'||asin FROM products WHERE id BETWEEN 85001 AND 85100;
