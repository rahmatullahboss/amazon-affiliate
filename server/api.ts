import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './utils/types';
import { authMiddleware } from './middleware/auth';
import { createBlogImageResponse } from './services/blog';

// Route imports
import redirect from './routes/redirect';
import page from './routes/page';
import auth from './routes/auth';
import agents from './routes/agents';
import products from './routes/products';
import tracking from './routes/tracking';
import mappings from './routes/mappings';
import analytics from './routes/analytics';
import publicRoutes from './routes/public';
import portal from './routes/portal';
import { requireRole } from './middleware/auth';
import users from './routes/users';
import sheets from './routes/sheets';
import auditLogs from './routes/audit-logs';
import blogs from './routes/blogs';
import sheetControl from './routes/sheet-control';
import telegram from './routes/telegram';

const app = new Hono<AppEnv>();

// ─── Global Middleware ────────────────────────────────────
app.use('*', logger());
app.use('*', secureHeaders());
const csrfMiddleware = csrf();
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api/public/telegram')) {
    return next();
  }
  return csrfMiddleware(c, next);
});

// NOTE: No CORS middleware needed — same-origin single Worker!

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', (c) => {
  const warnings: string[] = [];

  // Validate required secrets
  if (!c.env.JWT_SECRET) warnings.push('JWT_SECRET not set — admin auth will fail');
  if (!c.env.AMAZON_API_KEY && !c.env.AMAZON_API_KEY_FALLBACK) {
    warnings.push('Amazon API key not set — ASIN auto-fetch disabled');
  }

  // Validate required bindings
  if (!c.env.DB) warnings.push('D1 database not bound');
  if (!c.env.KV) warnings.push('KV namespace not bound');
  if (!c.env.BLOG_IMAGES) warnings.push('BLOG_IMAGES R2 bucket not bound');

  return c.json({
    status: warnings.length > 0 ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '1.1.0',
    warnings,
  });
});

// ─── Public Routes (No Auth) ──────────────────────────────
// Redirect engine — the heart of the system
app.route('/go', redirect);

// Landing page data endpoint (consumed by bridge page SSR loader)
app.route('/api/page', page);

// Auth endpoints
app.route('/api/auth', auth);

// Direct mount for blog images to avoid sub-router wildcard/regex bugs at the Edge
app.get('/api/public/blog-images/*', async (c) => {
  return createBlogImageResponse(c.env, new URL(c.req.url).pathname);
});

// Public API endpoints for the main site
app.route('/api/public', publicRoutes);
app.route('/api/public/telegram', telegram);

// ─── Protected Routes ────────────────────────────────────
const adminContent = new Hono<AppEnv>();
adminContent.use('*', authMiddleware);
adminContent.use('*', requireRole('editor', 'admin', 'super_admin'));

const adminOnly = new Hono<AppEnv>();
adminOnly.use('*', authMiddleware);
adminOnly.use('*', requireRole('admin', 'super_admin'));

const portalApi = new Hono<AppEnv>();
portalApi.use('*', authMiddleware);
portalApi.use('*', requireRole('agent', 'admin', 'super_admin'));
portalApi.route('/', portal);

app.route('/api/portal', portalApi);

adminContent.route('/products', products);
adminContent.route('/blogs', blogs);

adminOnly.route('/agents', agents);
adminOnly.route('/users', users);
adminOnly.route('/tracking', tracking);
adminOnly.route('/mappings', mappings);
adminOnly.route('/analytics', analytics);
adminOnly.route('/sheets', sheets);
adminOnly.route('/sheet-control', sheetControl);
adminOnly.route('/audit-logs', auditLogs);

app.route('/api', adminContent);
app.route('/api', adminOnly);

// ─── Global Error Handler ─────────────────────────────────
app.onError(async (err, c) => {
  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      console.error(`[ERROR] ${err.message}`, err.stack);
    }
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status
    );
  }

  console.error(`[ERROR] ${err.message}`, err.stack);

  return c.json(
    {
      error: 'Internal Server Error',
      status: 500,
    },
    500
  );
});

// ─── 404 Handler ──────────────────────────────────────────
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      status: 404,
    },
    404
  );
});

export { app as apiApp };
