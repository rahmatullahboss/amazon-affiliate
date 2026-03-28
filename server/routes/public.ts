import { Hono } from "hono";
import type { AppEnv } from "../utils/types";

const router = new Hono<AppEnv>();

// Get all active categories
router.get("/categories", async (c) => {
  const cacheKey = "public:categories";

  // Try cache first (1 hour)
  const cached = await c.env.KV.get(cacheKey, "json");
  if (cached) {
    return c.json(cached);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC"
  ).all();

  await c.env.KV.put(cacheKey, JSON.stringify(results), { expirationTtl: 3600 });
  return c.json(results);
});

// Get featured products for homepage
router.get("/products/featured", async (c) => {
  // We'll get 8 active products for the homepage
  const { results } = await c.env.DB.prepare(`
    SELECT 
      id, asin, title, image_url, category, 
      price, original_price, rating, description 
    FROM products 
    WHERE is_active = 1 AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 8
  `).all();

  return c.json(results);
});

// Get products by category
router.get("/products/category/:slug", async (c) => {
  const slug = c.req.param("slug");

  const { results } = await c.env.DB.prepare(`
    SELECT 
      p.id, p.asin, p.title, p.image_url, p.category, 
      p.price, p.original_price, p.rating, p.description 
    FROM products p
    JOIN categories c ON p.category = c.name
    WHERE p.is_active = 1 AND p.status = 'active' AND c.slug = ?
    ORDER BY p.created_at DESC
  `).bind(slug).all();

  return c.json(results);
});

// Get all products (paginated) - for /deals page
router.get("/products", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "12")));
  const offset = (page - 1) * limit;

  const { results } = await c.env.DB.prepare(`
    SELECT 
      id, asin, title, image_url, category, 
      price, original_price, rating, description 
    FROM products 
    WHERE is_active = 1 AND status = 'active'
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  // Get total count
  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM products WHERE is_active = 1 AND status = 'active'"
  ).first<{ total: number }>();

  return c.json({
    data: results,
    pagination: {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit),
    }
  });
});

export default router;
