import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { apiApp } from '../../server/api';
import { DbFactory } from '../factories/db';

vi.mock('../../app/components/product/ImageGallery', () => ({
  ImageGallery: () => null,
}));

vi.mock('react', () => ({
  useEffect: () => undefined,
}));

vi.mock('react-router', () => ({
  Link: () => null,
  redirect: (location: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: location },
    }),
}));

vi.mock('react/jsx-dev-runtime', () => ({
  Fragment: Symbol.for('react.fragment'),
  jsxDEV: () => null,
}));

vi.mock('react/jsx-runtime', () => ({
  Fragment: Symbol.for('react.fragment'),
  jsx: () => null,
  jsxs: () => null,
}));

import { loader as bridgeLoader } from '../../app/routes/bridge';
import { loader as trackingShortcutLoader } from '../../app/routes/tracking-shortcut';

describe('Redirect Engine API', () => {
  beforeEach(async () => {
    // Clean tables before each test - D1 in testing uses an in-memory replica
    await env.DB.prepare('DELETE FROM agent_slug_aliases').run();
    await env.DB.prepare('DELETE FROM page_views').run();
    await env.DB.prepare('DELETE FROM clicks').run();
    await env.DB.prepare('DELETE FROM agent_products').run();
    await env.DB.prepare('DELETE FROM tracking_ids').run();
    await env.DB.prepare('DELETE FROM products').run();
    await env.DB.prepare('DELETE FROM agents').run();

    // Reset fallback cache
    await env.KV.delete('default_tracking_id');
  });

  it('P0-001: Injects valid tracking_id based on Agent Slug and ASIN', async () => {
    // 1. Seed DB
    const agentId = 5;
    const productId = 10;
    const trackingId = 15;
    await DbFactory.seedAgent(env.DB, agentId, 'test-agent', 'Test Agent');
    await DbFactory.seedProduct(env.DB, productId, 'B0B123456');
    await DbFactory.seedTrackingId(env.DB, trackingId, agentId, 'test-tag-20');
    await DbFactory.seedAgentProduct(env.DB, agentId, productId, trackingId);

    // 2. Perform Request to Redirect route
    const req = new Request('http://localhost/go/test-agent/us/B0B123456', {
      headers: { 
        'CF-IPCountry': 'US',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
    });
    
    const waitPromises: Promise<any>[] = [];
    const ctx = {
      passThroughOnException: () => {},
      waitUntil: (p: Promise<any>) => waitPromises.push(p),
    } as any;

    const res = await apiApp.fetch(req, env as any, ctx);
    await Promise.all(waitPromises);

    // 3. Assert Response
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('amazon.com/dp/B0B123456');
    expect(location).toContain('tag=test-tag-20');
  });

  it('P0-002: Handles deleted/invalid Agent Slugs by falling back to Admin ID', async () => {
    // 1. Seed Fallback Tag (Admin typically has agent_id=1)
    await DbFactory.seedAgent(env.DB, 1, 'admin-agent', 'Admin');
    await DbFactory.seedProduct(env.DB, 10, 'B0B123456');
    await DbFactory.seedTrackingIdsFallback(env.DB, 15, 1, 'default-admin-20');

    // 2. Perform Request with an invalid agent slug
    const req = new Request('http://localhost/go/does-not-exist/B0B123456', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const waitPromises: Promise<any>[] = [];
    const ctx = { 
      waitUntil: (p: Promise<any>) => waitPromises.push(p), 
      passThroughOnException: () => {} 
    } as any;

    const res = await apiApp.fetch(req, env as any, ctx);
    await Promise.all(waitPromises);

    // 3. Assert Fallback occurs
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('tag=default-admin-20');
  });

  it('P1-003: Creates records in page_views and clicks correctly', async () => {
    const agentId = 5;
    const productId = 10;
    await DbFactory.seedAgent(env.DB, agentId, 'analytics-agent', 'Analytics');
    await DbFactory.seedProduct(env.DB, productId, 'B0B999999');
    await DbFactory.seedTrackingId(env.DB, 15, agentId, 'track-20');
    // Important: we need the mapping connecting them!
    await DbFactory.seedAgentProduct(env.DB, agentId, productId, 15);

    // Make an API call to the tracking sync route directly, or check that redirect creates it.
    // In our system, the client typically reports clicks/views via `/api/public/events` 
    // BUT the redirect engine (`/go/`) also creates click records depending on implementation.
    
    // Let's test the native Redirect `/go/` click registering first:
    const req = new Request('http://localhost/go/analytics-agent/us/B0B999999', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const waitPromises: Promise<any>[] = [];
    const ctx = {
      waitUntil: (p: Promise<any>) => waitPromises.push(p),
      passThroughOnException: () => {},
    } as any;

    const res = await apiApp.fetch(req, env as any, ctx);
    
    // Cloudflare Workers use `ctx.waitUntil` for analytics. We must await them in tests.
    await Promise.all(waitPromises);

    expect(res.status).toBe(302);

    // Query D1 to verify the redirect was recorded
    const { results: clickResults } = await env.DB.prepare('SELECT * FROM clicks').all();
    
    // Depending on logic, it either records in `clicks` or `page_views`.
    expect(clickResults.length).toBeGreaterThanOrEqual(1);
    expect((clickResults[0] as any).product_id).toBe(productId);
    expect((clickResults[0] as any).tracking_tag).toContain('track-20');
  });

  it('P1-004: Creates an agent-product mapping from tracking tag shortcut redirect', async () => {
    const agentId = 8;
    const productId = 19;
    const trackingId = 27;

    await DbFactory.seedAgent(env.DB, agentId, 'shortcut-agent', 'Shortcut Agent');
    await DbFactory.seedProduct(env.DB, productId, 'B0C1234567');
    await DbFactory.seedTrackingId(env.DB, trackingId, agentId, 'shortcut-tag-20');

    const req = new Request('http://localhost/go/t/shortcut-tag-20/B0C1234567', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const waitPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => waitPromises.push(promise),
      passThroughOnException: () => {},
    } as const;

    const res = await apiApp.fetch(req, env as any, ctx as any);
    await Promise.all(waitPromises);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('tag=shortcut-tag-20');

    const mapping = await env.DB.prepare(
      'SELECT agent_id, product_id, tracking_id FROM agent_products WHERE agent_id = ? AND product_id = ?'
    )
      .bind(agentId, productId)
      .first<{ agent_id: number; product_id: number; tracking_id: number }>();

    expect(mapping).not.toBeNull();
    expect(mapping?.tracking_id).toBe(trackingId);
  });

  it('P0-015: Redirects tracking shortcuts to the canonical country-coded bridge path', async () => {
    const agentId = 51;

    await DbFactory.seedAgent(env.DB, agentId, 'shortcut-country-agent', 'Shortcut Country Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (5101, 'B0SHORT123', 'Shortcut Product', 'http://img.com/sc.jpg', 'FR', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (5102, ?, 'shortcut-country-fr-21', 'FR', 1, 1)`
    )
      .bind(agentId)
      .run();

    const result = await trackingShortcutLoader({
      request: new Request('http://localhost/t/shortcut-country-fr-21/B0SHORT123'),
      params: {
        trackingTag: 'shortcut-country-fr-21',
        asin: 'B0SHORT123',
      },
      context: {
        cloudflare: {
          env: env as unknown,
          ctx: {
            waitUntil: () => undefined,
          },
        },
      },
    } as never);

    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe('/shortcut-country-agent/fr/B0SHORT123');
  });

  it('P1-005: Falls back on old agent link and auto-creates the missing mapping', async () => {
    const agentId = 11;
    const productId = 25;
    const trackingId = 31;

    await DbFactory.seedAgent(env.DB, agentId, 'legacy-agent', 'Legacy Agent');
    await DbFactory.seedProduct(env.DB, productId, 'B0LEGACY12');
    await env.DB.prepare(
      `UPDATE products SET marketplace = 'US', status = 'active' WHERE id = ?`
    )
      .bind(productId)
      .run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (?, ?, ?, 'US', 1, 1)`
    )
      .bind(trackingId, agentId, 'legacy-tag-20')
      .run();

    const legacyReq = new Request('http://localhost/go/legacy-agent/B0LEGACY12', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const waitPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => waitPromises.push(promise),
      passThroughOnException: () => {},
    } as const;

    const legacyRes = await apiApp.fetch(legacyReq, env as any, ctx as any);
    await Promise.all(waitPromises);

    expect(legacyRes.status).toBe(302);
    expect(legacyRes.headers.get('Location')).toBe('/go/legacy-agent/us/B0LEGACY12');

    waitPromises.length = 0;

    const canonicalReq = new Request('http://localhost/go/legacy-agent/us/B0LEGACY12', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const res = await apiApp.fetch(canonicalReq, env as any, ctx as any);
    await Promise.all(waitPromises);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('tag=legacy-tag-20');

    const mapping = await env.DB.prepare(
      'SELECT agent_id, product_id, tracking_id FROM agent_products WHERE agent_id = ? AND product_id = ?'
    )
      .bind(agentId, productId)
      .first<{ agent_id: number; product_id: number; tracking_id: number }>();

    expect(mapping).not.toBeNull();
    expect(mapping?.tracking_id).toBe(trackingId);
  });

  it('P0-006: Respects marketplace query when the same ASIN exists in multiple marketplaces', async () => {
    const agentId = 15;

    await DbFactory.seedAgent(env.DB, agentId, 'multi-market-agent', 'Multi Market Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (301, 'B0MULTI123', 'DE Product', 'http://img.com/de.jpg', 'DE', 'active', 1),
       (302, 'B0MULTI123', 'IT Product', 'http://img.com/it.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (401, ?, 'agent-de-21', 'DE', 1, 1),
       (402, ?, 'agent-it-21', 'IT', 0, 1)`
    )
      .bind(agentId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
       (?, 301, 401, 1),
       (?, 302, 402, 1)`
    )
      .bind(agentId, agentId)
      .run();

    const req = new Request('http://localhost/go/multi-market-agent/it/B0MULTI123', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const waitPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => waitPromises.push(promise),
      passThroughOnException: () => {},
    } as const;

    const res = await apiApp.fetch(req, env as any, ctx as any);
    await Promise.all(waitPromises);

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('amazon.it/dp/B0MULTI123');
    expect(location).toContain('tag=agent-it-21');
  });

  it('P0-007: Uses the country path segment as authoritative input for the bridge loader', async () => {
    const agentId = 21;
    const productIdDe = 901;
    const productIdUs = 902;
    const trackingIdDe = 903;
    const trackingIdUs = 904;

    await DbFactory.seedAgent(env.DB, agentId, 'canonical-agent', 'Canonical Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (?, 'B0CANON123', 'Canonical DE Product', 'http://img.com/de.jpg', 'DE', 'active', 1),
       (?, 'B0CANON123', 'Canonical US Product', 'http://img.com/us.jpg', 'US', 'active', 1)`
    )
      .bind(productIdDe, productIdUs)
      .run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (?, ?, 'canonical-de-21', 'DE', 1, 1),
       (?, ?, 'canonical-us-21', 'US', 0, 1)`
    )
      .bind(trackingIdDe, agentId, trackingIdUs, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
       (?, ?, ?, 1),
       (?, ?, ?, 1)`
    )
      .bind(agentId, productIdDe, trackingIdDe, agentId, productIdUs, trackingIdUs)
      .run();

    const waitPromises: Promise<unknown>[] = [];
    const loaderResult = (await bridgeLoader({
      request: new Request('http://localhost/canonical-agent/de/B0CANON123?m=US'),
      params: {
        agent: 'canonical-agent',
        country: 'de',
        asin: 'B0CANON123',
      },
      context: {
        cloudflare: {
          env: env as unknown,
          ctx: {
            waitUntil: (promise: Promise<unknown>) => {
              waitPromises.push(promise);
            },
          },
        },
      },
    } as never)) as { marketplace: string; redirectUrl: string };

    await Promise.all(waitPromises);

    expect(loaderResult.marketplace).toBe('DE');
    expect(loaderResult.redirectUrl).toBe('/go/canonical-agent/de/B0CANON123');

    const pageWaitPromises: Promise<unknown>[] = [];
    const pageRes = await apiApp.fetch(
      new Request('http://localhost/api/page/canonical-agent/de/B0CANON123?m=US'),
      env as any,
      {
        waitUntil: (promise: Promise<unknown>) => pageWaitPromises.push(promise),
      } as any
    );

    await Promise.all(pageWaitPromises);

    expect(pageRes.status).toBe(200);
    const pageJson = (await pageRes.json()) as { marketplace: string; amazonUrl: string };
    expect(pageJson.marketplace).toBe('DE');
    expect(pageJson.amazonUrl).toContain('amazon.de/dp/B0CANON123');
  });

  it('P0-008: Rejects an unsupported country path instead of resolving another marketplace', async () => {
    const agentId = 22;

    await DbFactory.seedAgent(env.DB, agentId, 'reject-agent', 'Reject Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (1001, 'B0REJECT123', 'Reject DE Product', 'http://img.com/reject-de.jpg', 'DE', 'active', 1),
       (1002, 'B0REJECT123', 'Reject US Product', 'http://img.com/reject-us.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (1003, ?, 'reject-de-21', 'DE', 1, 1),
       (1004, ?, 'reject-us-21', 'US', 0, 1)`
    )
      .bind(agentId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
       (?, 1001, 1003, 1),
       (?, 1002, 1004, 1)`
    )
      .bind(agentId, agentId)
      .run();

    const error = await bridgeLoader({
      request: new Request('http://localhost/reject-agent/zz/B0REJECT123?m=US'),
      params: {
        agent: 'reject-agent',
        country: 'zz',
        asin: 'B0REJECT123',
      },
      context: {
        cloudflare: {
          env: env as unknown,
          ctx: {
            waitUntil: () => undefined,
          },
        },
      },
    } as never).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(404);
  });

  it('P0-009: Redirects legacy bridge URLs to the canonical country-coded path using the default mapping', async () => {
    const agentId = 23;

    await DbFactory.seedAgent(env.DB, agentId, 'legacy-bridge-agent', 'Legacy Bridge Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (1101, 'B0LEGACY123', 'Legacy DE Product', 'http://img.com/legacy-de.jpg', 'DE', 'active', 1),
       (1102, 'B0LEGACY123', 'Legacy IT Product', 'http://img.com/legacy-it.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (1103, ?, 'legacy-de-21', 'DE', 1, 1),
       (1104, ?, 'legacy-it-21', 'IT', 0, 1)`
    )
      .bind(agentId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
       (?, 1101, 1103, 1),
       (?, 1102, 1104, 1)`
    )
      .bind(agentId, agentId)
      .run();

    const result = await bridgeLoader({
      request: new Request('http://localhost/legacy-bridge-agent/B0LEGACY123'),
      params: {
        agent: 'legacy-bridge-agent',
        asin: 'B0LEGACY123',
      },
      context: {
        cloudflare: {
          env: env as unknown,
          ctx: {
            waitUntil: () => undefined,
          },
        },
      },
    } as never).catch((value: unknown) => value);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('Location')).toBe('/legacy-bridge-agent/de/B0LEGACY123');
  });

  it('P0-010: Preserves non-canonical query params when redirecting a legacy bridge URL', async () => {
    const agentId = 24;

    await DbFactory.seedAgent(env.DB, agentId, 'query-bridge-agent', 'Query Bridge Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (1201, 'B0QUERY123', 'Query DE Product', 'http://img.com/query-de.jpg', 'DE', 'active', 1),
       (1202, 'B0QUERY123', 'Query IT Product', 'http://img.com/query-it.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (1203, ?, 'query-de-21', 'DE', 1, 1),
       (1204, ?, 'query-it-21', 'IT', 0, 1)`
    )
      .bind(agentId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
       (?, 1201, 1203, 1),
       (?, 1202, 1204, 1)`
    )
      .bind(agentId, agentId)
      .run();

    const result = await bridgeLoader({
      request: new Request('http://localhost/query-bridge-agent/B0QUERY123?m=IT&utm_source=newsletter&fbclid=abc123'),
      params: {
        agent: 'query-bridge-agent',
        asin: 'B0QUERY123',
      },
      context: {
        cloudflare: {
          env: env as unknown,
          ctx: {
            waitUntil: () => undefined,
          },
        },
      },
    } as never).catch((value: unknown) => value);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);

    const location = new URL((result as Response).headers.get('Location') ?? '', 'http://localhost');
    expect(location.pathname).toBe('/query-bridge-agent/it/B0QUERY123');
    expect(location.searchParams.get('utm_source')).toBe('newsletter');
    expect(location.searchParams.get('fbclid')).toBe('abc123');
    expect(location.searchParams.has('m')).toBe(false);
  });

  it('P0-016: Resolves alias slugs to the linked marketplace-specific tracking tag', async () => {
    const agentId = 60;
    const productId = 6001;
    const trackingId = 6002;

    await DbFactory.seedAgent(env.DB, agentId, 'alias-parent-agent', 'Alias Parent Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (?, 'B0ALIAS600', 'Alias Route Product', 'http://img.com/alias-route.jpg', 'IT', 'active', 1)`
    )
      .bind(productId)
      .run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (?, ?, 'alias-it-21', 'IT', 1, 1)`
    )
      .bind(trackingId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (?, ?, ?, 1)`
    )
      .bind(agentId, productId, trackingId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_slug_aliases (id, agent_id, tracking_id, marketplace, slug, is_active)
       VALUES (2, ?, ?, 'IT', 'alias-parent-agent-it', 1)`
    )
      .bind(agentId, trackingId)
      .run();

    const waitPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => waitPromises.push(promise),
      passThroughOnException: () => {},
    } as const;

    const res = await apiApp.fetch(
      new Request('http://localhost/go/alias-parent-agent-it/it/B0ALIAS600', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }),
      env as any,
      ctx as any
    );
    await Promise.all(waitPromises);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('amazon.it/dp/B0ALIAS600');
    expect(res.headers.get('Location')).toContain('tag=alias-it-21');
  });

  it('P0-011: Returns not found when a valid marketplace is unavailable for the legacy bridge URL', async () => {
    const agentId = 25;

    await DbFactory.seedAgent(env.DB, agentId, 'missing-market-agent', 'Missing Market Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (1301, 'B0MISS123', 'Missing DE Product', 'http://img.com/missing-de.jpg', 'DE', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (1302, ?, 'missing-de-21', 'DE', 1, 1)`
    )
      .bind(agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (?, 1301, 1302, 1)`
    )
      .bind(agentId)
      .run();

    const result = await bridgeLoader({
      request: new Request('http://localhost/missing-market-agent/B0MISS123?m=IT'),
      params: {
        agent: 'missing-market-agent',
        asin: 'B0MISS123',
      },
      context: {
        cloudflare: {
          env: env as unknown,
          ctx: {
            waitUntil: () => undefined,
          },
        },
      },
    } as never).catch((value: unknown) => value);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(404);
  });

  it('P0-012: Returns not found when the marketplace exists but live fetch cannot resolve the ASIN there', async () => {
    const agentId = 26;

    await DbFactory.seedAgent(env.DB, agentId, 'live-fetch-agent', 'Live Fetch Agent');
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (1401, ?, 'live-fetch-it-21', 'IT', 1, 1),
       (1402, ?, 'live-fetch-us-21', 'US', 0, 1)`
    )
      .bind(agentId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (1403, 'B0LIVE1234', 'Live Fetch US Product', 'http://img.com/live-us.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (?, 1403, 1402, 1)`
    )
      .bind(agentId)
      .run();

    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    try {
      const result = await bridgeLoader({
        request: new Request('http://localhost/live-fetch-agent/it/B0LIVE1234'),
        params: {
          agent: 'live-fetch-agent',
          country: 'it',
          asin: 'B0LIVE1234',
        },
        context: {
          cloudflare: {
            env: env as unknown,
            ctx: {
              waitUntil: () => undefined,
            },
          },
        },
      } as never).catch((value: unknown) => value);

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(404);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  it('P0-013: Redirects legacy go URLs to the canonical country-coded go path using the default mapping', async () => {
    const agentId = 27;

    await DbFactory.seedAgent(env.DB, agentId, 'legacy-go-agent', 'Legacy Go Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (1501, 'B0LEGGO123', 'Legacy Go DE Product', 'http://img.com/go-de.jpg', 'DE', 'active', 1),
       (1502, 'B0LEGGO123', 'Legacy Go IT Product', 'http://img.com/go-it.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (1503, ?, 'legacy-go-de-21', 'DE', 1, 1),
       (1504, ?, 'legacy-go-it-21', 'IT', 0, 1)`
    )
      .bind(agentId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
       (?, 1501, 1503, 1),
       (?, 1502, 1504, 1)`
    )
      .bind(agentId, agentId)
      .run();

    const waitPromises: Promise<unknown>[] = [];
    const result = await apiApp.fetch(
      new Request('http://localhost/go/legacy-go-agent/B0LEGGO123', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }),
      env as any,
      {
        waitUntil: (promise: Promise<unknown>) => waitPromises.push(promise),
        passThroughOnException: () => {},
      } as any
    );
    await Promise.all(waitPromises);

    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe('/go/legacy-go-agent/de/B0LEGGO123');

    const { results } = await env.DB.prepare('SELECT id FROM clicks').all<{ id: number }>();
    expect(results).toHaveLength(0);
  });

  it('P0-014: Preserves non-canonical query params when redirecting a legacy go URL', async () => {
    const agentId = 28;

    await DbFactory.seedAgent(env.DB, agentId, 'query-go-agent', 'Query Go Agent');
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES
       (1601, 'B0QUERYGO12', 'Query Go DE Product', 'http://img.com/query-go-de.jpg', 'DE', 'active', 1),
       (1602, 'B0QUERYGO12', 'Query Go IT Product', 'http://img.com/query-go-it.jpg', 'IT', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES
       (1603, ?, 'query-go-de-21', 'DE', 1, 1),
       (1604, ?, 'query-go-it-21', 'IT', 0, 1)`
    )
      .bind(agentId, agentId)
      .run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
       (?, 1601, 1603, 1),
       (?, 1602, 1604, 1)`
    )
      .bind(agentId, agentId)
      .run();

    const waitPromises: Promise<unknown>[] = [];
    const result = await apiApp.fetch(
      new Request('http://localhost/go/query-go-agent/B0QUERYGO12?m=IT&utm_source=newsletter&fbclid=abc123', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }),
      env as any,
      {
        waitUntil: (promise: Promise<unknown>) => waitPromises.push(promise),
        passThroughOnException: () => {},
      } as any
    );
    await Promise.all(waitPromises);

    expect(result.status).toBe(302);

    const location = new URL(result.headers.get('Location') ?? '', 'http://localhost');
    expect(location.pathname).toBe('/go/query-go-agent/it/B0QUERYGO12');
    expect(location.searchParams.get('utm_source')).toBe('newsletter');
    expect(location.searchParams.get('fbclid')).toBe('abc123');
    expect(location.searchParams.has('m')).toBe(false);

    const { results } = await env.DB.prepare('SELECT id FROM clicks').all<{ id: number }>();
    expect(results).toHaveLength(0);
  });
});
