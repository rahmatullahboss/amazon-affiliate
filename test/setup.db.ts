import { beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import type { AppEnv } from '../server/utils/types';

beforeAll(async () => {
  if (!env.DB) return;

  if (!env.JWT_SECRET) {
    (env as unknown as { JWT_SECRET?: string }).JWT_SECRET = 'test-secret';
  }
  
  try {
    // Use Wrangler's migration parser, which preserves complete trigger bodies.
    const migrations = (env as unknown as { TEST_MIGRATIONS: { name: string; queries: string[] }[] }).TEST_MIGRATIONS;
    for (const migration of migrations) {
      for (const stmt of migration.queries) {
        await env.DB.prepare(stmt).run();
      }
    }
  } catch (err) {
    console.error('Failed to run D1 migrations during test setup:', err);
    throw err;
  }
});
