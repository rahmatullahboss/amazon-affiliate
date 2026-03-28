import { beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import type { AppEnv } from '../server/utils/types';

beforeAll(async () => {
  if (!env.DB) return;
  
  try {
    // Dynamically import all migration files
    const migrationsGlob = import.meta.glob('../migrations/*.sql', { eager: true, query: '?raw', import: 'default' });
    
    // Sort by filename to ensure correct order
    const migrationKeys = Object.keys(migrationsGlob).sort();

    for (const key of migrationKeys) {
      const schema = migrationsGlob[key] as string;
      const cleanSchema = schema
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

      const statements = cleanSchema
        .split(';')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      for (const stmt of statements) {
        // D1 simulated in-memory might need to execute statement by statement
        await (env.DB as any).prepare(stmt).run();
      }
    }
  } catch (err) {
    console.error('Failed to run D1 migrations during test setup:', err);
    throw err;
  }
});
