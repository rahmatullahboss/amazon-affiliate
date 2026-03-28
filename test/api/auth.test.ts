import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { apiApp } from '../../server/api';
import { generateAdminToken, generateAgentToken } from '../factories/token';

describe('Authentication API', () => {
  beforeEach(async () => {
    // Reset test DB/KV if necessary
  });

  it('P0-003: Prevents Agents from accessing /admin/* routes', async () => {
    // 1. Generate an Agent Token
    const jwtSecret = env.JWT_SECRET || 'test-secret';
    const agentToken = await generateAgentToken(5, 'test-agent', jwtSecret);

    // 2. Perform Request to Admin Route
    const req = new Request('http://localhost/api/users', {
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    });
    
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as any;
    const res = await apiApp.fetch(req, env as any, ctx);

    // 3. Assert Unauthorized or Forbidden (403)
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.message || body.error).toContain('Insufficient permissions');
  });

  it('Allows Admin to access /admin/* routes', async () => {
    // 1. Generate an Admin Token
    const jwtSecret = env.JWT_SECRET || 'test-secret';
    const adminToken = await generateAdminToken(jwtSecret);

    // 2. Perform Request to Admin Route (Users listing)
    const req = new Request('http://localhost/api/users', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    
    const ctx = { passThroughOnException: () => {}, waitUntil: () => {} } as any;
    const res = await apiApp.fetch(req, env as any, ctx);

    // 3. Assert Success (2xx status)
    expect(res.status).toBe(200);
  });
});
