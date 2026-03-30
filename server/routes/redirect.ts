import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../utils/types';
import { buildAmazonUrl } from '../utils/types';
import { recordClick, hashIp } from '../services/analytics';
import { checkRedirectRateLimit, incrementRateLimitCounters } from '../middleware/rate-limit';
import { isSuspiciousRequest, isDuplicateClick } from '../middleware/bot-guard';
import { safeKvGetJson, safeKvPut } from '../services/kv-safe';
import {
  DynamicLinkResolutionError,
  ensureDynamicLinkByAgentSlug,
  ensureDynamicLinkByTrackingTag,
} from '../services/dynamic-links';

const redirect = new Hono<AppEnv>();

// Cached redirect context — includes IDs for analytics
interface RedirectContext {
  amazonUrl: string;
  agentId: number;
  productId: number;
  trackingTag: string;
}

function createNoindexRedirect(targetUrl: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: targetUrl,
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * GET /go/:agentSlug/:asin — Instant redirect to Amazon
 *
 * This is the PERFORMANCE-CRITICAL path.
 * Flow: Bot Check → Rate Limit → KV cache → D1 fallback → 302 redirect
 * Target: < 5ms response time (cache hit)
 *
 * Anti-ban protections:
 * 1. Bot detection — blocks bots/scrapers from inflating clicks
 * 2. Rate limiting — 60/min per IP, 10K/hr per agent
 * 3. Click deduplication — same IP+product within 30s = skip analytics
 */
redirect.get('/t/:trackingTag/:asin', async (c) => {
  const trackingTag = c.req.param('trackingTag');
  const asin = c.req.param('asin');

  if (!trackingTag || !asin) {
    throw new HTTPException(400, { message: 'Missing tracking tag or ASIN' });
  }

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
  const userAgent = c.req.header('user-agent') || '';

  if (isSuspiciousRequest(userAgent)) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  const rateCheck = await checkRedirectRateLimit(c.env.KV, ip, trackingTag);
  if (!rateCheck.allowed) {
    throw new HTTPException(429, { message: 'Too many requests. Please try again later.' });
  }

  let ctx: RedirectContext;
  let resolvedAgentSlug = trackingTag;
  let resolvedAsin = asin;

  try {
    const resolved = await ensureDynamicLinkByTrackingTag({
      db: c.env.DB,
      kv: c.env.KV,
      trackingTag,
      asin,
      apiKey: c.env.AMAZON_API_KEY,
      fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
    });

    ctx = {
      amazonUrl: resolved.amazonUrl,
      agentId: resolved.agentId,
      productId: resolved.productId,
      trackingTag: resolved.trackingTag,
    };
    resolvedAgentSlug = resolved.agentSlug;
    resolvedAsin = resolved.asin;
  } catch (error) {
    if (error instanceof DynamicLinkResolutionError) {
      throw new HTTPException(error.status, { message: error.message });
    }

    throw error;
  }

  c.executionCtx.waitUntil(
    recordRedirectClickAsync(c, {
      agentSlug: resolvedAgentSlug,
      asin: resolvedAsin,
      context: ctx,
    })
  );

  return createNoindexRedirect(ctx.amazonUrl);
});

redirect.get('/:agentSlug/:asin', async (c) => {
  const agentSlug = c.req.param('agentSlug');
  const asin = c.req.param('asin');

  if (!agentSlug || !asin) {
    throw new HTTPException(400, { message: 'Missing agent or ASIN' });
  }

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
  const userAgent = c.req.header('user-agent') || '';

  // ─── Anti-Ban Layer 1: Bot Detection ───────────────────
  if (isSuspiciousRequest(userAgent)) {
    // Don't reveal we detected a bot — just return a generic 403
    throw new HTTPException(403, { message: 'Access denied' });
  }

  // ─── Anti-Ban Layer 2: Rate Limiting ───────────────────
  const rateCheck = await checkRedirectRateLimit(c.env.KV, ip, agentSlug);
  if (!rateCheck.allowed) {
    throw new HTTPException(429, { message: 'Too many requests. Please try again later.' });
  }

  // ─── Core Redirect Logic ──────────────────────────────
  const cacheKey = `redirect:${agentSlug}:${asin}`;
  let ctx: RedirectContext | null = null;

  // 1. Try KV cache first (sub-millisecond)
  const cached = await safeKvGetJson<RedirectContext>(c.env.KV, cacheKey);
  if (cached) {
    ctx = cached;
  }

  if (!ctx) {
    const row = await c.env.DB.prepare(
      `SELECT p.asin, t.tag, t.marketplace, a.id as agent_id, p.id as product_id
       FROM agent_products ap
       JOIN agents a ON a.id = ap.agent_id
       JOIN products p ON p.id = ap.product_id
       JOIN tracking_ids t ON t.id = ap.tracking_id
       WHERE a.slug = ? AND p.asin = ?
         AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
       LIMIT 1`
    )
      .bind(agentSlug, asin)
      .first<{ asin: string; tag: string; marketplace: string; agent_id: number; product_id: number }>();

    if (!row) {
      try {
        const resolved = await ensureDynamicLinkByAgentSlug({
          db: c.env.DB,
          kv: c.env.KV,
          agentSlug,
          asin,
          apiKey: c.env.AMAZON_API_KEY,
          fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
        });

        ctx = {
          amazonUrl: resolved.amazonUrl,
          agentId: resolved.agentId,
          productId: resolved.productId,
          trackingTag: resolved.trackingTag,
        };
      } catch (error) {
        if (error instanceof DynamicLinkResolutionError) {
          throw new HTTPException(error.status, { message: error.message });
        }

        throw error;
      }
    } else {
      ctx = {
        amazonUrl: buildAmazonUrl(row.asin, row.tag, row.marketplace),
        agentId: row.agent_id,
        productId: row.product_id,
        trackingTag: row.tag,
      };

      // 3. Warm cache for next hit (cache the FULL context, not just URL)
      c.executionCtx.waitUntil(
        safeKvPut(c.env.KV, cacheKey, JSON.stringify(ctx), { expirationTtl: 3600 })
      );
    }
  }

  // ─── Anti-Ban Layer 3: Click Analytics & Dedup ────────
  c.executionCtx.waitUntil(recordRedirectClickAsync(c, { agentSlug, asin, context: ctx }));

  // 5. 302 redirect — user goes to Amazon
  return createNoindexRedirect(ctx.amazonUrl);
});

async function recordRedirectClickAsync(
  c: {
    req: { header: (name: string) => string | undefined; raw: Request };
    env: { DB: D1Database; KV: KVNamespace };
  },
  input: { agentSlug: string; asin: string; context: RedirectContext }
): Promise<void> {
  try {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';

    await incrementRateLimitCounters(c.env.KV, ip, input.agentSlug);

    const ipHash = ip ? await hashIp(ip) : null;
    if (ipHash) {
      const isDupe = await isDuplicateClick(c.env.KV, ipHash, input.asin);
      if (isDupe) {
        return;
      }
    }

    await recordClick(c.env.DB, {
      agentId: input.context.agentId,
      productId: input.context.productId,
      trackingTag: input.context.trackingTag,
      ipHash,
      userAgent: c.req.header('user-agent') || null,
      referer: c.req.header('referer') || null,
      country: (c.req.raw as unknown as { cf?: { country?: string } }).cf?.country || null,
    });
  } catch (e) {
    console.error('[Redirect] Analytics error:', e);
  }
}

export default redirect;
