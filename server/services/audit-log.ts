interface AuditLogInput {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown>;
}

export async function writeAuditLog(
  db: D1Database,
  input: AuditLogInput
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      input.userId ?? null,
      input.action,
      input.entityType,
      input.entityId !== undefined && input.entityId !== null ? String(input.entityId) : null,
      JSON.stringify(input.details ?? {})
    )
    .run();
}
