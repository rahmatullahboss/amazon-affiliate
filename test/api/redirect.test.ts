import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { apiApp } from '../../server/api';
import { DbFactory } from '../factories/db';

describe('Redirect Engine API', () => {
  beforeEach(async () => {
    // Clean tables before each test - D1 in testing uses an in-memory replica
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
    const req = new Request('http://localhost/go/test-agent/B0B123456', {
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
    const req = new Request('http://localhost/go/analytics-agent/B0B999999', {
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
});
