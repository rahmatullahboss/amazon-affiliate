import { Hono } from 'hono';
import type { AppEnv } from '../utils/types';

const auditLogs = new Hono<AppEnv>();

auditLogs.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT
       al.id,
       al.action,
       al.entity_type,
       al.entity_id,
       al.details,
       al.created_at,
       u.username
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT 100`
  ).all<{
    id: number;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: string;
    created_at: string;
    username: string | null;
  }>();

  const logs = (results ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: safeParseDetails(row.details),
    createdAt: row.created_at,
    username: row.username,
  }));

  return c.json({ logs });
});

function safeParseDetails(details: string): Record<string, unknown> {
  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default auditLogs;
