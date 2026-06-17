import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../utils/types";
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

webhooks.post("/sheet-sync", async (c) => {
  const secret = c.env.SHEET_WEBHOOK_SECRET;
  if (!secret) {
    throw new HTTPException(503, { message: "Webhook secret not configured." });
  }

  const provided = c.req.header("X-Webhook-Secret");
  if (provided !== secret) {
    throw new HTTPException(401, { message: "Invalid webhook secret." });
  }

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

export default webhooks;
