import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../utils/types";
import {
  syncAdminSheetRows,
  type AdminSheetSyncRowInput,
} from "../services/admin-sheet-row-sync";
import { syncAgentSheetSources } from "../services/sheet-control";
import { getSheetSyncConfig, syncProductsFromSheet } from "../services/sheet-sync";

type WebhookEnv = AppEnv & {
  SHEET_WEBHOOK_SECRET?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  AMAZON_API_KEY?: string;
  AMAZON_API_KEY_FALLBACK?: string;
  LWA_CLIENT_ID?: string;
  LWA_CLIENT_SECRET?: string;
  LWA_CREATORS_SCOPE?: string;
};

const webhooks = new Hono<WebhookEnv>();

webhooks.post("/sheet-row-sync", async (c) => {
  ensureSheetWebhookSecret(c.env.SHEET_WEBHOOK_SECRET, c.req.header("X-Webhook-Secret"));

  const payload = await c.req.json<unknown>().catch(() => null);
  const rows = parseAdminSheetRows(payload);
  const result = await syncAdminSheetRows({
    db: c.env.DB,
    kv: c.env.KV,
    publicAppUrl: c.env.PUBLIC_APP_URL,
    rows,
    apiKey: c.env.AMAZON_API_KEY,
    fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK
      ? [c.env.AMAZON_API_KEY_FALLBACK]
      : [],
    serpApiToken: c.env.SERPAPI_TOKEN,
    zyteApiKey: c.env.ZYTE_API_KEY,
    lwaClientId: c.env.LWA_CLIENT_ID,
    lwaClientSecret: c.env.LWA_CLIENT_SECRET,
    lwaScope: c.env.LWA_CREATORS_SCOPE,
  });

  const failedCount = result.results.filter((row) => row.status === "failed").length;
  return c.json({
    status: failedCount > 0 ? "partial" : "ok",
    results: result.results,
  });
});

webhooks.post("/sheet-sync", async (c) => {
  ensureSheetWebhookSecret(c.env.SHEET_WEBHOOK_SECRET, c.req.header("X-Webhook-Secret"));

  if (!c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new HTTPException(503, { message: "Google Sheets API credentials not configured." });
  }

  const credentials = {
    clientEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  };

  const baseInput = {
    db: c.env.DB,
    kv: c.env.KV,
    apiKey: c.env.AMAZON_API_KEY,
    fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK
      ? [c.env.AMAZON_API_KEY_FALLBACK]
      : [],
    serpApiToken: c.env.SERPAPI_TOKEN,
    zyteApiKey: c.env.ZYTE_API_KEY,
    lwaClientId: c.env.LWA_CLIENT_ID,
    lwaClientSecret: c.env.LWA_CLIENT_SECRET,
    lwaScope: c.env.LWA_CREATORS_SCOPE,
    credentials,
  };

  const errors: string[] = [];

  try {
    await syncAgentSheetSources(baseInput);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Agent sheet sync failed";
    console.error(`[WEBHOOK] Agent sheet sync failed: ${msg}`, error);
    errors.push(msg);
  }

  try {
    const config = await getSheetSyncConfig(c.env.DB);
    if (config.is_active && config.sheet_url) {
      await syncProductsFromSheet({ ...baseInput, config });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Sheet sync failed";
    console.error(`[WEBHOOK] Sheet sync failed: ${msg}`, error);
    errors.push(msg);
  }

  if (errors.length > 0) {
    return c.json({ status: "partial", errors }, 200);
  }

  return c.json({ status: "ok", message: "Sheet sync triggered successfully." });
});

function ensureSheetWebhookSecret(secret: string | undefined, provided: string | undefined): void {
  if (!secret) {
    throw new HTTPException(503, { message: "Webhook secret not configured." });
  }
  if (provided !== secret) {
    throw new HTTPException(401, { message: "Invalid webhook secret." });
  }
}

function parseAdminSheetRows(payload: unknown): AdminSheetSyncRowInput[] {
  if (!payload || typeof payload !== "object" || !("rows" in payload)) {
    throw new HTTPException(400, { message: "Request body must contain rows." });
  }

  const rawRows = (payload as { rows?: unknown }).rows;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new HTTPException(400, { message: "At least one row is required." });
  }
  if (rawRows.length > 100) {
    throw new HTTPException(400, { message: "A maximum of 100 rows can be synced per request." });
  }

  return rawRows.map((rawRow, index) => {
    if (!rawRow || typeof rawRow !== "object") {
      throw new HTTPException(400, { message: `Row ${index + 1} must be an object.` });
    }

    const row = rawRow as Record<string, unknown>;
    return {
      rowNumber:
        typeof row.rowNumber === "number" && Number.isInteger(row.rowNumber)
          ? row.rowNumber
          : index + 2,
      asin: typeof row.asin === "string" ? row.asin : "",
      marketplace: typeof row.marketplace === "string" ? row.marketplace : "",
      trackingTag: typeof row.trackingTag === "string" ? row.trackingTag : null,
      previousResolvedTrackingTag:
        typeof row.previousResolvedTrackingTag === "string"
          ? row.previousResolvedTrackingTag
          : null,
      previousAgentSlug:
        typeof row.previousAgentSlug === "string" ? row.previousAgentSlug : null,
      customTitle: typeof row.customTitle === "string" ? row.customTitle : null,
      forceUpdateExisting: row.forceUpdateExisting === true,
    };
  });
}

export default webhooks;
