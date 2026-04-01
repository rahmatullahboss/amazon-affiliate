import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../utils/types";
import {
  createAgentSheetSourceSchema,
  discoverAgentSheetTabsSchema,
  reviewSheetSubmissionSchema,
  triggerAgentSheetSyncSchema,
  updateAgentSheetSourceSchema,
} from "../schemas";
import { writeAuditLog } from "../services/audit-log";
import {
  approveSheetSubmissionRow,
  createAgentSheetSources,
  getSheetControlOverview,
  listAgentSheetSources,
  listSheetSubmissionRows,
  normalizeSheetTabSelections,
  rejectSheetSubmissionRow,
  syncAgentSheetSources,
  updateAgentSheetSource,
} from "../services/sheet-control";
import { listSpreadsheetTabs, parseSpreadsheetReference } from "../services/google-sheets";

const router = new Hono<AppEnv>();

router.get("/overview", async (c) => {
  const [overview, sources] = await Promise.all([
    getSheetControlOverview(c.env.DB),
    listAgentSheetSources(c.env.DB),
  ]);

  return c.json({ overview, sources });
});

router.get("/sources", async (c) => {
  const sources = await listAgentSheetSources(c.env.DB);
  return c.json({ sources });
});

router.post("/discover-tabs", zValidator("json", discoverAgentSheetTabsSchema), async (c) => {
  if (!c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new HTTPException(503, {
      message: "Google Sheets API credentials are not configured.",
    });
  }

  const body = c.req.valid("json");
  const reference = parseSpreadsheetReference(body.sheet_url);
  const tabs = await listSpreadsheetTabs({
    credentials: {
      clientEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
    spreadsheetId: reference.spreadsheetId,
  });

  return c.json({
    spreadsheet_id: reference.spreadsheetId,
    tabs: tabs.map((tab) => ({ gid: tab.sheetId, title: tab.title })),
  });
});

router.post("/sources", zValidator("json", createAgentSheetSourceSchema), async (c) => {
  const body = c.req.valid("json");

  try {
    const sources = await createAgentSheetSources(c.env.DB, {
      agentId: body.agent_id,
      sheetUrl: body.sheet_url,
      selections: body.selected_tabs?.length
        ? normalizeSheetTabSelections(body.selected_tabs)
        : [{ sheetTabName: body.sheet_tab_name ?? null, sheetGid: null }],
      isActive: body.is_active,
      autoApproveCleanRows: body.auto_approve_clean_rows,
    });

    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        userId: c.get("userId"),
        action: "sheet_control.source.created",
        entityType: "agent_sheet_source",
        entityId: sources[0]?.id ?? body.agent_id,
        details: {
          agentId: body.agent_id,
          sheetUrl: body.sheet_url,
          sheetTabs: sources.map((source) => source.sheet_tab_name),
          autoApproveCleanRows: body.auto_approve_clean_rows,
        },
      })
    );

    return c.json(
      {
        source: sources[0] ?? null,
        sources,
        message:
          sources.length === 1
            ? "Agent sheet source created."
            : `Created ${sources.length} sheet sources.`,
      },
      201
    );
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Failed to create sheet source.",
    });
  }
});

router.put("/sources/:id", zValidator("json", updateAgentSheetSourceSchema), async (c) => {
  const sourceId = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(sourceId) || sourceId <= 0) {
    throw new HTTPException(400, { message: "Invalid source ID." });
  }

  const body = c.req.valid("json");

  try {
    const source = await updateAgentSheetSource(c.env.DB, {
      id: sourceId,
      sheetUrl: body.sheet_url,
      sheetTabName: body.sheet_tab_name,
      isActive: body.is_active,
      autoApproveCleanRows: body.auto_approve_clean_rows,
    });

    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        userId: c.get("userId"),
        action: "sheet_control.source.updated",
        entityType: "agent_sheet_source",
        entityId: source.id,
        details: {
          sheetUrl: source.sheet_url,
          sheetTabName: source.sheet_tab_name,
          isActive: source.is_active === 1,
          autoApproveCleanRows: source.auto_approve_clean_rows === 1,
        },
      })
    );

    return c.json({ source, message: "Agent sheet source updated." });
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Failed to update sheet source.",
    });
  }
});

router.post("/sync", zValidator("json", triggerAgentSheetSyncSchema), async (c) => {
  const body = c.req.valid("json");
  if (!c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new HTTPException(503, {
      message: "Google Sheets API credentials are not configured.",
    });
  }

  const summary = await syncAgentSheetSources({
    db: c.env.DB,
    kv: c.env.KV,
    sourceId: body.source_id,
    apiKey: c.env.AMAZON_API_KEY,
    fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
    triggeredByUserId: c.get("userId"),
    credentials: {
      clientEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
  });

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get("userId"),
      action: "sheet_control.sync.completed",
      entityType: "sheet_submission_batch",
      entityId: body.source_id ?? "all",
      details: {
        totalSources: summary.totalSources,
        totalRows: summary.totalRows,
        queuedRows: summary.queuedRows,
        approvedRows: summary.approvedRows,
        flaggedRows: summary.flaggedRows,
        failedSources: summary.failedSources,
      },
    })
  );

  return c.json({
    summary,
    message: `Processed ${summary.totalSources} source(s), queued ${summary.queuedRows}, auto-approved ${summary.approvedRows}, flagged ${summary.flaggedRows}.`,
  });
});

router.get("/submissions", async (c) => {
  const status = c.req.query("status") || "all";
  const validationColor = c.req.query("validationColor") || "all";
  const sourceId = Number.parseInt(c.req.query("sourceId") || "", 10);
  const agentId = Number.parseInt(c.req.query("agentId") || "", 10);

  const submissions = await listSheetSubmissionRows(c.env.DB, {
    status:
      status === "all" ||
      status === "pending" ||
      status === "approved" ||
      status === "rejected" ||
      status === "auto_approved"
        ? status
        : "all",
    validationColor:
      validationColor === "all" ||
      validationColor === "green" ||
      validationColor === "yellow" ||
      validationColor === "red"
        ? validationColor
        : "all",
    sourceId: Number.isNaN(sourceId) ? undefined : sourceId,
    agentId: Number.isNaN(agentId) ? undefined : agentId,
  });

  return c.json({ submissions });
});

router.post(
  "/submissions/:id/approve",
  zValidator("json", reviewSheetSubmissionSchema),
  async (c) => {
    const submissionId = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(submissionId) || submissionId <= 0) {
      throw new HTTPException(400, { message: "Invalid submission ID." });
    }

    try {
      const submission = await approveSheetSubmissionRow({
        db: c.env.DB,
        kv: c.env.KV,
        submissionId,
        reviewedByUserId: c.get("userId"),
        apiKey: c.env.AMAZON_API_KEY,
        fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
      });

      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          userId: c.get("userId"),
          action: "sheet_control.submission.approved",
          entityType: "sheet_submission_row",
          entityId: submission.id,
          details: {
            asin: submission.asin,
            agentId: submission.agent_id,
            validationColor: submission.validation_color,
          },
        })
      );

      return c.json({ submission, message: "Submission approved and applied live." });
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Failed to approve submission.",
      });
    }
  }
);

router.post(
  "/submissions/:id/reject",
  zValidator("json", reviewSheetSubmissionSchema),
  async (c) => {
    const submissionId = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(submissionId) || submissionId <= 0) {
      throw new HTTPException(400, { message: "Invalid submission ID." });
    }

    const body = c.req.valid("json");

    try {
      const submission = await rejectSheetSubmissionRow({
        db: c.env.DB,
        submissionId,
        reviewedByUserId: c.get("userId"),
        notes: body.notes ?? null,
      });

      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          userId: c.get("userId"),
          action: "sheet_control.submission.rejected",
          entityType: "sheet_submission_row",
          entityId: submission.id,
          details: {
            asin: submission.asin,
            agentId: submission.agent_id,
            notes: body.notes ?? null,
          },
        })
      );

      return c.json({ submission, message: "Submission rejected." });
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Failed to reject submission.",
      });
    }
  }
);

export default router;
