import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../utils/types';
import { updateSheetSyncConfigSchema } from '../schemas';
import {
  getSheetSyncConfig,
  getSheetSyncLogs,
  mirrorProductsToSheet,
  syncProductsFromSheet,
  updateSheetSyncConfig,
} from '../services/sheet-sync';
import { writeAuditLog } from '../services/audit-log';

const sheets = new Hono<AppEnv>();

sheets.get('/config', async (c) => {
  const [config, logs] = await Promise.all([
    getSheetSyncConfig(c.env.DB),
    getSheetSyncLogs(c.env.DB),
  ]);

  return c.json({ config, logs });
});

sheets.put('/config', zValidator('json', updateSheetSyncConfigSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = await updateSheetSyncConfig(c.env.DB, {
    sheetUrl: payload.sheet_url ?? null,
    sheetTabName: payload.sheet_tab_name ?? null,
    defaultMarketplace: payload.default_marketplace,
    isActive: payload.is_active,
  });

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'sheet.config.updated',
      entityType: 'sheet_sync_config',
      entityId: 1,
      details: {
        sheetUrl: payload.sheet_url ?? null,
        sheetTabName: payload.sheet_tab_name ?? null,
        defaultMarketplace: payload.default_marketplace,
        isActive: payload.is_active,
      },
    })
  );

  return c.json({ config, message: 'Sheet sync configuration updated' });
});

sheets.post('/sync/import', async (c) => {
  const config = await getSheetSyncConfig(c.env.DB);
  if (!config.is_active) {
    throw new HTTPException(409, { message: 'Sheet sync is disabled' });
  }
  if (!c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new HTTPException(503, {
      message: 'Google Sheets API credentials are not configured',
    });
  }

  const summary = await syncProductsFromSheet({
    db: c.env.DB,
    kv: c.env.KV,
    apiKey: c.env.AMAZON_API_KEY,
    fallbackApiKeys: c.env.AMAZON_API_KEY_FALLBACK ? [c.env.AMAZON_API_KEY_FALLBACK] : [],
    config,
    credentials: {
      clientEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
    triggeredByUserId: c.get('userId'),
  });

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'sheet.import.completed',
      entityType: 'sheet_sync',
      entityId: 'import',
      details: { ...summary },
    })
  );

  return c.json({
    summary,
    message: `Imported ${summary.createdCount} new products and updated ${summary.updatedCount} existing products.`,
  });
});

sheets.post('/sync/export', async (c) => {
  const config = await getSheetSyncConfig(c.env.DB);
  if (!c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new HTTPException(503, {
      message: 'Google Sheets API credentials are not configured',
    });
  }
  const summary = await mirrorProductsToSheet({
    db: c.env.DB,
    config,
    credentials: {
      clientEmail: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
    triggeredByUserId: c.get('userId'),
  });

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get('userId'),
      action: 'sheet.export.completed',
      entityType: 'sheet_sync',
      entityId: 'export',
      details: { ...summary },
    })
  );

  return c.json({
    summary,
    message: `Mirrored ${summary.totalRows} products to Google Sheets.`,
  });
});

export default sheets;
