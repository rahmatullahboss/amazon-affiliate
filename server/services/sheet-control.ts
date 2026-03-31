import { CacheService } from "./cache";
import { parseSpreadsheetReference, readSheetRows } from "./google-sheets";
import { ensureProductRecord } from "./product-ingestion";
import {
  mapRows,
  parseSheetSyncRow,
  type ParsedSheetSyncRow,
  type SheetRowRecord,
} from "./sheet-rows";

interface GoogleCredentials {
  clientEmail: string;
  privateKey: string;
}

export interface AgentSheetSource {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_slug: string;
  sheet_url: string;
  sheet_tab_name: string | null;
  is_active: number;
  auto_approve_clean_rows: number;
  last_synced_at: string | null;
  last_sync_status: "success" | "partial" | "failed" | null;
  last_sync_message: string | null;
  created_at: string;
  updated_at: string;
  pending_rows: number;
}

export interface SheetSubmissionRowListItem {
  id: number;
  batch_id: number;
  source_id: number;
  source_sheet_url: string;
  source_sheet_tab_name: string | null;
  agent_id: number;
  agent_name: string;
  agent_slug: string;
  asin: string | null;
  marketplace: string | null;
  title: string | null;
  category: string | null;
  custom_title: string | null;
  tracking_tag: string | null;
  row_status: "active" | "inactive";
  product_status: "active" | "pending_review" | "rejected";
  validation_color: "green" | "yellow" | "red";
  validation_code: string | null;
  validation_message: string | null;
  status: "pending" | "approved" | "rejected" | "auto_approved";
  reviewed_at: string | null;
  reviewed_by_username: string | null;
  created_at: string;
}

export interface SheetControlOverview {
  sourceCount: number;
  activeSourceCount: number;
  pendingCount: number;
  approvedCount: number;
  autoApprovedCount: number;
  rejectedCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  recentBatches: Array<{
    id: number;
    source_id: number;
    agent_name: string;
    status: "success" | "partial" | "failed";
    total_rows: number;
    queued_rows: number;
    approved_rows: number;
    flagged_rows: number;
    rejected_rows: number;
    created_at: string;
  }>;
}

export interface AgentSheetSyncSummary {
  totalSources: number;
  totalRows: number;
  queuedRows: number;
  approvedRows: number;
  flaggedRows: number;
  failedSources: number;
}

interface SourceRow {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_slug: string;
  sheet_url: string;
  sheet_tab_name: string | null;
  is_active: number;
  auto_approve_clean_rows: number;
}

interface TrackingRow {
  id: number;
}

interface ProductLookupRow {
  id: number;
  status: "active" | "pending_review" | "rejected";
}

interface AgentMappingLookupRow {
  id: number;
  tracking_id: number;
  is_active: number;
  custom_title: string | null;
}

interface ValidationResult {
  color: "green" | "yellow" | "red";
  code: string | null;
  message: string | null;
  trackingId: number | null;
  existingProductId: number | null;
  existingMappingId: number | null;
}

interface SheetSubmissionRowRecord {
  id: number;
  source_id: number;
  agent_id: number;
  asin: string | null;
  marketplace: string | null;
  title: string | null;
  category: string | null;
  custom_title: string | null;
  tracking_tag: string | null;
  row_status: "active" | "inactive";
  product_status: "active" | "pending_review" | "rejected";
  status: "pending" | "approved" | "rejected" | "auto_approved";
}

export async function listAgentSheetSources(db: D1Database): Promise<AgentSheetSource[]> {
  const { results } = await db
    .prepare(
      `SELECT
         ass.id,
         ass.agent_id,
         a.name AS agent_name,
         a.slug AS agent_slug,
         ass.sheet_url,
         ass.sheet_tab_name,
         ass.is_active,
         ass.auto_approve_clean_rows,
         ass.last_synced_at,
         ass.last_sync_status,
         ass.last_sync_message,
         ass.created_at,
         ass.updated_at,
         (
           SELECT COUNT(*)
           FROM sheet_submission_rows ssr
           WHERE ssr.source_id = ass.id AND ssr.status = 'pending'
         ) AS pending_rows
       FROM agent_sheet_sources ass
       JOIN agents a ON a.id = ass.agent_id
       ORDER BY a.name ASC`
    )
    .all<AgentSheetSource>();

  return results ?? [];
}

export async function createAgentSheetSource(
  db: D1Database,
  input: {
    agentId: number;
    sheetUrl: string;
    sheetTabName: string | null;
    isActive: boolean;
    autoApproveCleanRows: boolean;
  }
): Promise<AgentSheetSource> {
  parseSpreadsheetReference(input.sheetUrl);

  const agent = await db
    .prepare(`SELECT id FROM agents WHERE id = ? LIMIT 1`)
    .bind(input.agentId)
    .first<{ id: number }>();

  if (!agent) {
    throw new Error("Agent not found.");
  }

  try {
    await db
      .prepare(
        `INSERT INTO agent_sheet_sources (
           agent_id,
           sheet_url,
           sheet_tab_name,
           is_active,
           auto_approve_clean_rows
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        input.agentId,
        input.sheetUrl,
        input.sheetTabName,
        input.isActive ? 1 : 0,
        input.autoApproveCleanRows ? 1 : 0
      )
      .run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new Error("This agent already has a sheet source configured.");
    }
    throw error;
  }

  const source = await db
    .prepare(
      `SELECT id
       FROM agent_sheet_sources
       WHERE agent_id = ?
       LIMIT 1`
    )
    .bind(input.agentId)
    .first<{ id: number }>();

  if (!source) {
    throw new Error("Sheet source creation failed unexpectedly.");
  }

  return getAgentSheetSourceById(db, source.id);
}

export async function updateAgentSheetSource(
  db: D1Database,
  input: {
    id: number;
    sheetUrl?: string;
    sheetTabName?: string | null;
    isActive?: boolean;
    autoApproveCleanRows?: boolean;
  }
): Promise<AgentSheetSource> {
  const current = await getAgentSheetSourceById(db, input.id);
  if (!current) {
    throw new Error("Sheet source not found.");
  }

  const nextSheetUrl = input.sheetUrl ?? current.sheet_url;
  parseSpreadsheetReference(nextSheetUrl);

  await db
    .prepare(
      `UPDATE agent_sheet_sources
       SET sheet_url = ?,
           sheet_tab_name = ?,
           is_active = ?,
           auto_approve_clean_rows = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      nextSheetUrl,
      input.sheetTabName !== undefined ? input.sheetTabName : current.sheet_tab_name,
      input.isActive !== undefined ? (input.isActive ? 1 : 0) : current.is_active,
      input.autoApproveCleanRows !== undefined
        ? input.autoApproveCleanRows
          ? 1
          : 0
        : current.auto_approve_clean_rows,
      input.id
    )
    .run();

  return getAgentSheetSourceById(db, input.id);
}

export async function getSheetControlOverview(db: D1Database): Promise<SheetControlOverview> {
  const [sourceResult, statusResult, batchResult] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS source_count,
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_source_count
         FROM agent_sheet_sources`
      )
      .first<{ source_count: number; active_source_count: number }>(),
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
           SUM(CASE WHEN status = 'auto_approved' THEN 1 ELSE 0 END) AS auto_approved_count,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
           SUM(CASE WHEN validation_color = 'green' THEN 1 ELSE 0 END) AS green_count,
           SUM(CASE WHEN validation_color = 'yellow' THEN 1 ELSE 0 END) AS yellow_count,
           SUM(CASE WHEN validation_color = 'red' THEN 1 ELSE 0 END) AS red_count
         FROM sheet_submission_rows`
      )
      .first<{
        pending_count: number;
        approved_count: number;
        auto_approved_count: number;
        rejected_count: number;
        green_count: number;
        yellow_count: number;
        red_count: number;
      }>(),
    db
      .prepare(
        `SELECT
           ssb.id,
           ssb.source_id,
           a.name AS agent_name,
           ssb.status,
           ssb.total_rows,
           ssb.queued_rows,
           ssb.approved_rows,
           ssb.flagged_rows,
           ssb.rejected_rows,
           ssb.created_at
         FROM sheet_submission_batches ssb
         JOIN agent_sheet_sources ass ON ass.id = ssb.source_id
         JOIN agents a ON a.id = ass.agent_id
         ORDER BY ssb.created_at DESC
         LIMIT 8`
      )
      .all<SheetControlOverview["recentBatches"][number]>(),
  ]);

  return {
    sourceCount: sourceResult?.source_count ?? 0,
    activeSourceCount: sourceResult?.active_source_count ?? 0,
    pendingCount: statusResult?.pending_count ?? 0,
    approvedCount: statusResult?.approved_count ?? 0,
    autoApprovedCount: statusResult?.auto_approved_count ?? 0,
    rejectedCount: statusResult?.rejected_count ?? 0,
    greenCount: statusResult?.green_count ?? 0,
    yellowCount: statusResult?.yellow_count ?? 0,
    redCount: statusResult?.red_count ?? 0,
    recentBatches: batchResult.results ?? [],
  };
}

export async function listSheetSubmissionRows(
  db: D1Database,
  filters?: {
    status?: "pending" | "approved" | "rejected" | "auto_approved" | "all";
    validationColor?: "green" | "yellow" | "red" | "all";
    sourceId?: number;
    agentId?: number;
  }
): Promise<SheetSubmissionRowListItem[]> {
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];

  if (filters?.status && filters.status !== "all") {
    conditions.push("ssr.status = ?");
    bindings.push(filters.status);
  }

  if (filters?.validationColor && filters.validationColor !== "all") {
    conditions.push("ssr.validation_color = ?");
    bindings.push(filters.validationColor);
  }

  if (filters?.sourceId) {
    conditions.push("ssr.source_id = ?");
    bindings.push(filters.sourceId);
  }

  if (filters?.agentId) {
    conditions.push("ssr.agent_id = ?");
    bindings.push(filters.agentId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { results } = await db
    .prepare(
      `SELECT
         ssr.id,
         ssr.batch_id,
         ssr.source_id,
         ass.sheet_url AS source_sheet_url,
         ass.sheet_tab_name AS source_sheet_tab_name,
         ssr.agent_id,
         a.name AS agent_name,
         a.slug AS agent_slug,
         ssr.asin,
         ssr.marketplace,
         ssr.title,
         ssr.category,
         ssr.custom_title,
         ssr.tracking_tag,
         ssr.row_status,
         ssr.product_status,
         ssr.validation_color,
         ssr.validation_code,
         ssr.validation_message,
         ssr.status,
         ssr.reviewed_at,
         reviewer.username AS reviewed_by_username,
         ssr.created_at
       FROM sheet_submission_rows ssr
       JOIN agent_sheet_sources ass ON ass.id = ssr.source_id
       JOIN agents a ON a.id = ssr.agent_id
       LEFT JOIN users reviewer ON reviewer.id = ssr.reviewed_by_user_id
       ${whereClause}
       ORDER BY
         CASE ssr.status
           WHEN 'pending' THEN 0
           WHEN 'rejected' THEN 1
           WHEN 'approved' THEN 2
           WHEN 'auto_approved' THEN 3
           ELSE 4
         END ASC,
         CASE ssr.validation_color
           WHEN 'red' THEN 0
           WHEN 'yellow' THEN 1
           ELSE 2
         END ASC,
         ssr.created_at DESC`
    )
    .bind(...bindings)
    .all<SheetSubmissionRowListItem>();

  return results ?? [];
}

export async function syncAgentSheetSources(input: {
  db: D1Database;
  kv: KVNamespace;
  credentials: GoogleCredentials;
  apiKey?: string;
  fallbackApiKeys?: string[];
  triggeredByUserId?: number;
  sourceId?: number;
}): Promise<AgentSheetSyncSummary> {
  const sources = await loadSourceRows(input.db, input.sourceId);

  const summary: AgentSheetSyncSummary = {
    totalSources: sources.length,
    totalRows: 0,
    queuedRows: 0,
    approvedRows: 0,
    flaggedRows: 0,
    failedSources: 0,
  };

  for (const source of sources) {
    try {
      const sourceSummary = await syncSingleAgentSheetSource({
        ...input,
        source,
      });
      summary.totalRows += sourceSummary.totalRows;
      summary.queuedRows += sourceSummary.queuedRows;
      summary.approvedRows += sourceSummary.approvedRows;
      summary.flaggedRows += sourceSummary.flaggedRows;
    } catch (error) {
      summary.failedSources += 1;

      await input.db
        .prepare(
          `UPDATE agent_sheet_sources
           SET last_synced_at = CURRENT_TIMESTAMP,
               last_sync_status = 'failed',
               last_sync_message = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(
          error instanceof Error ? error.message : "Agent sheet sync failed.",
          source.id
        )
        .run();
    }
  }

  return summary;
}

export async function approveSheetSubmissionRow(input: {
  db: D1Database;
  kv: KVNamespace;
  submissionId: number;
  reviewedByUserId?: number;
  apiKey?: string;
  fallbackApiKeys?: string[];
  statusOverride?: "approved" | "auto_approved";
}): Promise<SheetSubmissionRowListItem> {
  const row = await input.db
    .prepare(
      `SELECT
         id,
         source_id,
         agent_id,
         asin,
         marketplace,
         title,
         category,
         custom_title,
         tracking_tag,
         row_status,
         product_status,
         status
       FROM sheet_submission_rows
       WHERE id = ?
       LIMIT 1`
    )
    .bind(input.submissionId)
    .first<SheetSubmissionRowRecord>();

  if (!row) {
    throw new Error("Submission row not found.");
  }

  if (row.status === "rejected") {
    throw new Error("Rejected rows cannot be approved.");
  }

  const source = await getSourceIdentity(input.db, row.source_id);
  if (!source) {
    throw new Error("Sheet source not found.");
  }

  if (!row.asin || !row.marketplace) {
    throw new Error("Submission row is missing ASIN or marketplace.");
  }

  const existingState = await getExistingProductState(
    input.db,
    row.agent_id,
    row.asin,
    row.marketplace
  );

  let trackingId = existingState.activeTrackingId;
  let productId = existingState.product?.id ?? null;
  let agentProductId = existingState.agentMapping?.id ?? null;

  if (row.row_status === "inactive") {
    if (!existingState.agentMapping || !existingState.product) {
      throw new Error("There is no live mapping to deactivate for this ASIN.");
    }

    await input.db
      .prepare(
        `UPDATE agent_products
         SET is_active = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(existingState.agentMapping.id)
      .run();

    trackingId = existingState.agentMapping.tracking_id;
    productId = existingState.product.id;
    agentProductId = existingState.agentMapping.id;
  } else {
    const resolvedTracking = await resolveTrackingId(
      input.db,
      row.agent_id,
      row.marketplace,
      row.tracking_tag
    );

    if (!resolvedTracking) {
      throw new Error("No active tracking ID is available for this submission.");
    }

    if (
      existingState.agentMapping &&
      existingState.agentMapping.tracking_id !== resolvedTracking.id
    ) {
      throw new Error(
        "This submission would override an existing live tracking ID. Review the mapping manually."
      );
    }

    const product = await ensureProductRecord({
      db: input.db,
      asin: row.asin,
      marketplace: row.marketplace,
      apiKey: input.apiKey,
      fallbackApiKeys: input.fallbackApiKeys,
      title: row.title ?? undefined,
      category: row.category ?? undefined,
      status: "active",
      updateExistingFromInput: true,
      requireRealProductData: true,
    });

    productId = product.id;
    trackingId = resolvedTracking.id;

    const existingMapping = await input.db
      .prepare(
        `SELECT id, tracking_id
         FROM agent_products
         WHERE agent_id = ? AND product_id = ?
         LIMIT 1`
      )
      .bind(row.agent_id, product.id)
      .first<AgentMappingLookupRow>();

    if (!existingMapping) {
      const result = await input.db
        .prepare(
          `INSERT INTO agent_products (
             agent_id,
             product_id,
             tracking_id,
             custom_title,
             is_active
           ) VALUES (?, ?, ?, ?, 1)`
        )
        .bind(row.agent_id, product.id, resolvedTracking.id, row.custom_title ?? null)
        .run();

      agentProductId = Number(result.meta.last_row_id);
    } else {
      await input.db
        .prepare(
          `UPDATE agent_products
           SET custom_title = ?,
               is_active = 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(row.custom_title ?? existingMapping.custom_title ?? null, existingMapping.id)
        .run();

      agentProductId = existingMapping.id;
    }
  }

  await input.db
    .prepare(
      `UPDATE sheet_submission_rows
       SET status = ?,
           product_id = ?,
           tracking_id = ?,
           agent_product_id = ?,
           reviewed_by_user_id = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      input.statusOverride ?? "approved",
      productId,
      trackingId,
      agentProductId,
      input.reviewedByUserId ?? null,
      input.submissionId
    )
    .run();

  const cache = new CacheService(input.kv);
  await cache.deletePageData(source.agent_slug, row.asin);
  await cache.deleteRedirectUrl(source.agent_slug, row.asin);
  await cache.invalidateForProduct(row.asin);

  const updated = await listSheetSubmissionRows(input.db, { status: "all" });
  const submission = updated.find((entry) => entry.id === input.submissionId);

  if (!submission) {
    throw new Error("Updated submission row could not be loaded.");
  }

  return submission;
}

export async function rejectSheetSubmissionRow(input: {
  db: D1Database;
  submissionId: number;
  reviewedByUserId?: number;
  notes?: string | null;
}): Promise<SheetSubmissionRowListItem> {
  const current = await input.db
    .prepare(
      `SELECT id, validation_message
       FROM sheet_submission_rows
       WHERE id = ?
       LIMIT 1`
    )
    .bind(input.submissionId)
    .first<{ id: number; validation_message: string | null }>();

  if (!current) {
    throw new Error("Submission row not found.");
  }

  const nextMessage =
    input.notes && input.notes.trim().length > 0
      ? [current.validation_message, input.notes.trim()].filter(Boolean).join(" | ")
      : current.validation_message;

  await input.db
    .prepare(
      `UPDATE sheet_submission_rows
       SET status = 'rejected',
           validation_message = ?,
           reviewed_by_user_id = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(nextMessage ?? null, input.reviewedByUserId ?? null, input.submissionId)
    .run();

  const updated = await listSheetSubmissionRows(input.db, { status: "all" });
  const submission = updated.find((entry) => entry.id === input.submissionId);

  if (!submission) {
    throw new Error("Updated submission row could not be loaded.");
  }

  return submission;
}

async function syncSingleAgentSheetSource(input: {
  db: D1Database;
  kv: KVNamespace;
  source: SourceRow;
  credentials: GoogleCredentials;
  apiKey?: string;
  fallbackApiKeys?: string[];
  triggeredByUserId?: number;
}): Promise<{
  totalRows: number;
  queuedRows: number;
  approvedRows: number;
  flaggedRows: number;
}> {
  const batchId = await startBatch(input.db, input.source.id, input.triggeredByUserId);

  try {
    const reference = parseSpreadsheetReference(input.source.sheet_url);
    const values = await readSheetRows({
      credentials: input.credentials,
      spreadsheetId: reference.spreadsheetId,
      gid: reference.gid,
      sheetTabName: input.source.sheet_tab_name,
    });

    const rowRecords = mapRows(values, { dedupe: false });
    const parsedRows = rowRecords.map((row) =>
      parseSheetSyncRow(row, "US")
    );
    const duplicateCounts = getDuplicateKeyCounts(parsedRows);

    let queuedRows = 0;
    let approvedRows = 0;
    let flaggedRows = 0;

    for (let index = 0; index < rowRecords.length; index += 1) {
      const rawRow = rowRecords[index];
      const parsedRow = parsedRows[index];

      const validation = await validateSubmissionRow({
        db: input.db,
        agentId: input.source.agent_id,
        rawRow,
        parsedRow,
        duplicateCounts,
        apiKeyAvailable:
          Boolean(input.apiKey && input.apiKey.trim()) ||
          Boolean(input.fallbackApiKeys && input.fallbackApiKeys.length > 0),
      });

      const insertResult = await input.db
        .prepare(
          `INSERT INTO sheet_submission_rows (
             batch_id,
             source_id,
             agent_id,
             asin,
             marketplace,
             title,
             category,
             custom_title,
             tracking_tag,
             row_status,
             product_status,
             raw_payload,
             validation_color,
             validation_code,
             validation_message,
             status,
             product_id,
             tracking_id,
             agent_product_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          batchId,
          input.source.id,
          input.source.agent_id,
          parsedRow?.asin ?? null,
          parsedRow?.marketplace ?? null,
          parsedRow?.title ?? null,
          parsedRow?.category ?? null,
          parsedRow?.customTitle ?? null,
          parsedRow?.trackingTag ?? null,
          parsedRow?.rowStatus ?? "active",
          parsedRow?.productStatus ?? "active",
          JSON.stringify(rawRow),
          validation.color,
          validation.code,
          validation.message,
          "pending",
          validation.existingProductId,
          validation.trackingId,
          validation.existingMappingId
        )
        .run();

      const submissionId = Number(insertResult.meta.last_row_id);

      if (validation.color === "green" && input.source.auto_approve_clean_rows === 1) {
        try {
          await approveSheetSubmissionRow({
            db: input.db,
            kv: input.kv,
            submissionId,
            reviewedByUserId: input.triggeredByUserId,
            apiKey: input.apiKey,
            fallbackApiKeys: input.fallbackApiKeys,
            statusOverride: "auto_approved",
          });
          approvedRows += 1;
        } catch (error) {
          flaggedRows += 1;
          await input.db
            .prepare(
              `UPDATE sheet_submission_rows
               SET validation_color = 'red',
                   validation_code = 'approval_failed',
                   validation_message = ?,
                   status = 'pending',
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            )
            .bind(
              error instanceof Error ? error.message : "Automatic approval failed.",
              submissionId
            )
            .run();
        }
      } else {
        queuedRows += 1;
        if (validation.color !== "green") {
          flaggedRows += 1;
        }
      }
    }

    await finishBatch({
      db: input.db,
      batchId,
      status: flaggedRows > 0 ? "partial" : "success",
      totalRows: rowRecords.length,
      queuedRows,
      approvedRows,
      flaggedRows,
      rejectedRows: 0,
    });

    await input.db
      .prepare(
        `UPDATE agent_sheet_sources
         SET last_synced_at = CURRENT_TIMESTAMP,
             last_sync_status = ?,
             last_sync_message = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        flaggedRows > 0 ? "partial" : "success",
        `Processed ${rowRecords.length} rows. Pending ${queuedRows}, auto-approved ${approvedRows}, flagged ${flaggedRows}.`,
        input.source.id
      )
      .run();

    return {
      totalRows: rowRecords.length,
      queuedRows,
      approvedRows,
      flaggedRows,
    };
  } catch (error) {
    await finishBatch({
      db: input.db,
      batchId,
      status: "failed",
      totalRows: 0,
      queuedRows: 0,
      approvedRows: 0,
      flaggedRows: 0,
      rejectedRows: 0,
      errorMessage: error instanceof Error ? error.message : "Agent sheet sync failed.",
    });
    throw error;
  }
}

async function validateSubmissionRow(input: {
  db: D1Database;
  agentId: number;
  rawRow: SheetRowRecord;
  parsedRow: ParsedSheetSyncRow | null;
  duplicateCounts: Map<string, number>;
  apiKeyAvailable: boolean;
}): Promise<ValidationResult> {
  if (!input.parsedRow) {
    return {
      color: "yellow",
      code: "invalid_asin",
      message: "ASIN is missing or invalid in this row.",
      trackingId: null,
      existingProductId: null,
      existingMappingId: null,
    };
  }

  const rowKey = `${input.parsedRow.asin}:${input.parsedRow.marketplace}`;
  if ((input.duplicateCounts.get(rowKey) ?? 0) > 1) {
    return {
      color: "red",
      code: "duplicate_asin",
      message: "Same ASIN appears multiple times in this sheet for the same marketplace.",
      trackingId: null,
      existingProductId: null,
      existingMappingId: null,
    };
  }

  const existingState = await getExistingProductState(
    input.db,
    input.agentId,
    input.parsedRow.asin,
    input.parsedRow.marketplace
  );

  if (input.parsedRow.rowStatus === "inactive") {
    if (!existingState.agentMapping || !existingState.product) {
      return {
        color: "yellow",
        code: "missing_live_mapping",
        message: "This row wants to hide a mapping that does not exist live yet.",
        trackingId: existingState.activeTrackingId,
        existingProductId: existingState.product?.id ?? null,
        existingMappingId: existingState.agentMapping?.id ?? null,
      };
    }

    return {
      color: "green",
      code: null,
      message: "Live mapping can be hidden safely.",
      trackingId: existingState.agentMapping.tracking_id,
      existingProductId: existingState.product.id,
      existingMappingId: existingState.agentMapping.id,
    };
  }

  const tracking = await resolveTrackingId(
    input.db,
    input.agentId,
    input.parsedRow.marketplace,
    input.parsedRow.trackingTag
  );

  if (!tracking) {
    return {
      color: "yellow",
      code: "missing_tracking_id",
      message: "No active tracking ID is configured for this agent and marketplace.",
      trackingId: null,
      existingProductId: existingState.product?.id ?? null,
      existingMappingId: existingState.agentMapping?.id ?? null,
    };
  }

  if (
    existingState.agentMapping &&
    existingState.agentMapping.tracking_id !== tracking.id
  ) {
    return {
      color: "red",
      code: "tracking_override_locked",
      message: "Live mapping already uses another tracking ID. Manual review is required.",
      trackingId: tracking.id,
      existingProductId: existingState.product?.id ?? null,
      existingMappingId: existingState.agentMapping.id,
    };
  }

  if (existingState.product?.status === "rejected") {
    return {
      color: "red",
      code: "rejected_product_blocked",
      message: "Product is currently rejected in the live catalog and needs admin approval.",
      trackingId: tracking.id,
      existingProductId: existingState.product.id,
      existingMappingId: existingState.agentMapping?.id ?? null,
    };
  }

  if (!existingState.product && !input.apiKeyAvailable) {
    return {
      color: "yellow",
      code: "product_fetch_unavailable",
      message: "Product does not exist live and no Amazon API key is available to create it.",
      trackingId: tracking.id,
      existingProductId: null,
      existingMappingId: null,
    };
  }

  return {
    color: "green",
    code: null,
    message: "Ready for live mapping.",
    trackingId: tracking.id,
    existingProductId: existingState.product?.id ?? null,
    existingMappingId: existingState.agentMapping?.id ?? null,
  };
}

async function getAgentSheetSourceById(
  db: D1Database,
  sourceId: number
): Promise<AgentSheetSource> {
  const source = await db
    .prepare(
      `SELECT
         ass.id,
         ass.agent_id,
         a.name AS agent_name,
         a.slug AS agent_slug,
         ass.sheet_url,
         ass.sheet_tab_name,
         ass.is_active,
         ass.auto_approve_clean_rows,
         ass.last_synced_at,
         ass.last_sync_status,
         ass.last_sync_message,
         ass.created_at,
         ass.updated_at,
         (
           SELECT COUNT(*)
           FROM sheet_submission_rows ssr
           WHERE ssr.source_id = ass.id AND ssr.status = 'pending'
         ) AS pending_rows
       FROM agent_sheet_sources ass
       JOIN agents a ON a.id = ass.agent_id
       WHERE ass.id = ?
       LIMIT 1`
    )
    .bind(sourceId)
    .first<AgentSheetSource>();

  if (!source) {
    throw new Error("Sheet source not found.");
  }

  return source;
}

async function loadSourceRows(db: D1Database, sourceId?: number): Promise<SourceRow[]> {
  const query = sourceId
    ? `SELECT
         ass.id,
         ass.agent_id,
         a.name AS agent_name,
         a.slug AS agent_slug,
         ass.sheet_url,
         ass.sheet_tab_name,
         ass.is_active,
         ass.auto_approve_clean_rows
       FROM agent_sheet_sources ass
       JOIN agents a ON a.id = ass.agent_id
       WHERE ass.id = ? AND ass.is_active = 1`
    : `SELECT
         ass.id,
         ass.agent_id,
         a.name AS agent_name,
         a.slug AS agent_slug,
         ass.sheet_url,
         ass.sheet_tab_name,
         ass.is_active,
         ass.auto_approve_clean_rows
       FROM agent_sheet_sources ass
       JOIN agents a ON a.id = ass.agent_id
       WHERE ass.is_active = 1
       ORDER BY a.name ASC`;

  const statement = db.prepare(query);
  const result = sourceId
    ? await statement.bind(sourceId).all<SourceRow>()
    : await statement.all<SourceRow>();

  return result.results ?? [];
}

async function getSourceIdentity(
  db: D1Database,
  sourceId: number
): Promise<{ agent_slug: string } | null> {
  return db
    .prepare(
      `SELECT a.slug AS agent_slug
       FROM agent_sheet_sources ass
       JOIN agents a ON a.id = ass.agent_id
       WHERE ass.id = ?
       LIMIT 1`
    )
    .bind(sourceId)
    .first<{ agent_slug: string }>();
}

async function getExistingProductState(
  db: D1Database,
  agentId: number,
  asin: string,
  marketplace: string
): Promise<{
  product: ProductLookupRow | null;
  agentMapping: AgentMappingLookupRow | null;
  activeTrackingId: number | null;
}> {
  const product = await db
    .prepare(
      `SELECT id, status
       FROM products
       WHERE asin = ? AND marketplace = ?
       LIMIT 1`
    )
    .bind(asin, marketplace)
    .first<ProductLookupRow>();

  const agentMapping = product
    ? await db
        .prepare(
          `SELECT id, tracking_id, is_active, custom_title
           FROM agent_products
           WHERE agent_id = ? AND product_id = ?
           LIMIT 1`
        )
        .bind(agentId, product.id)
        .first<AgentMappingLookupRow>()
    : null;

  return {
    product: product ?? null,
    agentMapping: agentMapping ?? null,
    activeTrackingId: agentMapping?.tracking_id ?? null,
  };
}

async function resolveTrackingId(
  db: D1Database,
  agentId: number,
  marketplace: string,
  trackingTag: string | null
): Promise<TrackingRow | null> {
  if (trackingTag) {
    return db
      .prepare(
        `SELECT id
         FROM tracking_ids
         WHERE agent_id = ? AND marketplace = ? AND tag = ? AND is_active = 1
         LIMIT 1`
      )
      .bind(agentId, marketplace, trackingTag)
      .first<TrackingRow>();
  }

  return db
    .prepare(
      `SELECT id
       FROM tracking_ids
       WHERE agent_id = ? AND marketplace = ? AND is_active = 1
       ORDER BY is_default DESC, created_at ASC
       LIMIT 1`
    )
    .bind(agentId, marketplace)
    .first<TrackingRow>();
}

function getDuplicateKeyCounts(parsedRows: Array<ParsedSheetSyncRow | null>): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of parsedRows) {
    if (!row) {
      continue;
    }

    const key = `${row.asin}:${row.marketplace}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

async function startBatch(
  db: D1Database,
  sourceId: number,
  triggeredByUserId?: number
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO sheet_submission_batches (
         source_id,
         status,
         triggered_by_user_id
       ) VALUES (?, 'success', ?)`
    )
    .bind(sourceId, triggeredByUserId ?? null)
    .run();

  return Number(result.meta.last_row_id);
}

async function finishBatch(input: {
  db: D1Database;
  batchId: number;
  status: "success" | "partial" | "failed";
  totalRows: number;
  queuedRows: number;
  approvedRows: number;
  flaggedRows: number;
  rejectedRows: number;
  errorMessage?: string;
}): Promise<void> {
  await input.db
    .prepare(
      `UPDATE sheet_submission_batches
       SET status = ?,
           total_rows = ?,
           queued_rows = ?,
           approved_rows = ?,
           flagged_rows = ?,
           rejected_rows = ?,
           error_message = ?,
           finished_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      input.status,
      input.totalRows,
      input.queuedRows,
      input.approvedRows,
      input.flaggedRows,
      input.rejectedRows,
      input.errorMessage ?? null,
      input.batchId
    )
    .run();
}
