import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './utils/types';
import { authMiddleware } from './middleware/auth';

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

const app = new Hono<AppEnv>();

// ─── Global Middleware ────────────────────────────────────
app.use('*', logger());

// NOTE: No CORS middleware needed — same-origin single Worker!

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', (c) => {
  const warnings: string[] = [];

  // Validate required secrets
  if (!c.env.JWT_SECRET) warnings.push('JWT_SECRET not set — admin auth will fail');
  if (!c.env.AMAZON_API_KEY) warnings.push('AMAZON_API_KEY not set — ASIN auto-fetch disabled');

  // Validate required bindings
  if (!c.env.DB) warnings.push('D1 database not bound');
  if (!c.env.KV) warnings.push('KV namespace not bound');

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

// Public API endpoints for the main site
app.route('/api/public', publicRoutes);

// ─── Protected Routes (Admin Only) ───────────────────────
const admin = new Hono<AppEnv>();
admin.use('*', authMiddleware);
admin.use('*', requireRole('admin', 'super_admin'));

const portalApi = new Hono<AppEnv>();
portalApi.use('*', authMiddleware);
portalApi.use('*', requireRole('agent', 'admin', 'super_admin'));
portalApi.route('/', portal);

app.route('/api/portal', portalApi);

admin.route('/agents', agents);
admin.route('/users', users);
admin.route('/products', products);
admin.route('/tracking', tracking);
admin.route('/mappings', mappings);
admin.route('/analytics', analytics);
admin.route('/sheets', sheets);
admin.route('/audit-logs', auditLogs);

app.route('/api', admin);

// ─── Global Error Handler ─────────────────────────────────
app.onError(async (err, c) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status
    );
  }

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
