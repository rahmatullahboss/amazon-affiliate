import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../utils/types";
import { safeKvGetJson, safeKvPut } from "../services/kv-safe";
import {
  getSocialLinksSettings,
  toPublicSocialLinks,
} from "../services/social-links";

const router = new Hono<AppEnv>();
const AGENT_APP_DOWNLOAD_URL =
  "https://github.com/rahmatullahboss/amazon-affiliate/releases/latest/download/app-release.apk";
const SOCIAL_LINKS_CACHE_KEY = "public:social-links";
const SOCIAL_LINKS_CACHE_TTL = 300;

// Get all active categories
router.get("/categories", async (c) => {
  const cacheKey = "public:categories";

  // Try cache first (1 hour)
  const cached = await safeKvGetJson<unknown[]>(c.env.KV, cacheKey);
  if (cached) {
    return c.json(cached);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC"
  ).all();

  await safeKvPut(c.env.KV, cacheKey, JSON.stringify(results), { expirationTtl: 3600 });
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

router.get("/downloads/agent-app.apk", async (c) => {
  const downloadResponse = await fetch(AGENT_APP_DOWNLOAD_URL, {
    redirect: "follow",
    headers: {
      "user-agent": "DealsRky-App-Download",
      accept: "application/vnd.android.package-archive,application/octet-stream,*/*",
    },
  });

  if (!downloadResponse.ok || !downloadResponse.body) {
    throw new HTTPException(502, {
      message: "Could not fetch the latest Android app package right now.",
    });
  }

  const headers = new Headers(downloadResponse.headers);
  headers.set("content-type", "application/vnd.android.package-archive");
  headers.set("content-disposition", 'attachment; filename="app-release.apk"');
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("x-robots-tag", "noindex, nofollow");

  return new Response(downloadResponse.body, {
    status: 200,
    headers,
  });
});

router.get("/social-links", async (c) => {
  const cached = await safeKvGetJson<{
    telegram: { url: string; enabled: boolean } | null;
    whatsapp: { url: string; enabled: boolean } | null;
    messenger: { url: string; enabled: boolean } | null;
  }>(c.env.KV, SOCIAL_LINKS_CACHE_KEY);

  if (cached) {
    return c.json(cached);
  }

  const settings = await getSocialLinksSettings(c.env.DB);
  const payload = toPublicSocialLinks(settings);

  await safeKvPut(c.env.KV, SOCIAL_LINKS_CACHE_KEY, JSON.stringify(payload), {
    expirationTtl: SOCIAL_LINKS_CACHE_TTL,
  });

  return c.json(payload);
});



export default router;
