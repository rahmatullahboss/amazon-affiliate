import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../utils/types';
import { getPublicSlugForTracking } from '../services/public-slugs';

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number; type: 'private' | string };
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface MappedProductRow {
  asin: string;
  title: string;
  image_url: string;
  marketplace: string;
  order_requirement: string | null;
  tracking_id: number;
  tracking_marketplace: string;
}

const PAGE_SIZE = 6;
const MARKETPLACES = ['US', 'CA', 'UK', 'DE', 'IT', 'FR', 'ES'];
const telegram = new Hono<AppEnv>();

function ensureWebhookSecret(env: AppEnv['Bindings'], header: string | undefined) {
  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    return;
  }
  if (!header || header !== env.TELEGRAM_WEBHOOK_SECRET) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
}

async function sendTelegram(
  token: string,
  method: 'sendMessage' | 'sendPhoto',
  body: Record<string, unknown>
) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new HTTPException(502, { message: 'Telegram API error' });
  }
}

function parseMarketplace(value?: string): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return MARKETPLACES.includes(normalized) ? normalized : null;
}

function buildAgentProductLink(input: {
  baseUrl: string;
  publicSlug: string;
  marketplace: string;
  asin: string;
}): string {
  const country = input.marketplace.toLowerCase();
  return `${input.baseUrl.replace(/\/+$/, '')}/${input.publicSlug}/${country}/${input.asin}`;
}

async function resolveMappedProduct(input: {
  db: D1Database;
  agentId: number;
  asin: string;
  marketplace?: string | null;
}): Promise<MappedProductRow | null> {
  const hasMarket = Boolean(input.marketplace);
  const query = `
    SELECT
      p.asin,
      p.title,
      p.image_url,
      p.marketplace,
      p.order_requirement,
      ap.tracking_id,
      t.marketplace as tracking_marketplace
    FROM agent_products ap
    JOIN products p ON p.id = ap.product_id
    JOIN tracking_ids t ON t.id = ap.tracking_id
    WHERE ap.agent_id = ?
      AND ap.is_active = 1
      AND p.is_active = 1
      AND p.status = 'active'
      AND p.asin = ?
      ${hasMarket ? 'AND p.marketplace = ?' : ''}
    ORDER BY p.created_at DESC
    LIMIT 1
  `;

  const bindings = hasMarket
    ? [input.agentId, input.asin, input.marketplace]
    : [input.agentId, input.asin];

  const result = await input.db.prepare(query).bind(...bindings).first<MappedProductRow>();
  return result ?? null;
}

async function resolveMappedProducts(input: {
  db: D1Database;
  agentId: number;
  marketplace?: string | null;
  page: number;
}): Promise<MappedProductRow[]> {
  const hasMarket = Boolean(input.marketplace);
  const offset = (Math.max(1, input.page) - 1) * PAGE_SIZE;
  const query = `
    SELECT
      p.asin,
      p.title,
      p.image_url,
      p.marketplace,
      p.order_requirement,
      ap.tracking_id,
      t.marketplace as tracking_marketplace
    FROM agent_products ap
    JOIN products p ON p.id = ap.product_id
    JOIN tracking_ids t ON t.id = ap.tracking_id
    WHERE ap.agent_id = ?
      AND ap.is_active = 1
      AND p.is_active = 1
      AND p.status = 'active'
      ${hasMarket ? 'AND p.marketplace = ?' : ''}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const bindings = hasMarket
    ? [input.agentId, input.marketplace, PAGE_SIZE, offset]
    : [input.agentId, PAGE_SIZE, offset];

  const result = await input.db.prepare(query).bind(...bindings).all<MappedProductRow>();
  return result.results ?? [];
}

telegram.post('/webhook', async (c) => {
  ensureWebhookSecret(c.env, c.req.header('x-telegram-bot-api-secret-token'));
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new HTTPException(503, { message: 'Bot not configured' });

  const update = await c.req.json<TelegramUpdate>();
  const message = update.message;
  const callback = update.callback_query;
  const chatId = message?.chat?.id ?? callback?.message?.chat?.id;
  const text = message?.text?.trim() ?? '';

  if (!chatId) {
    return c.json({ ok: true });
  }

  if (message && message.chat.type !== 'private') {
    await sendTelegram(token, 'sendMessage', {
      chat_id: chatId,
      text: 'Please message me in a private chat to access products.',
    });
    return c.json({ ok: true });
  }

  if (text.startsWith('/start')) {
    const [, code] = text.split(/\s+/);
    if (!code) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Send /start CODE to bind your account.',
      });
      return c.json({ ok: true });
    }

    const agent = await c.env.DB.prepare(
      'SELECT id, name FROM agents WHERE telegram_bind_code = ? AND is_active = 1'
    )
      .bind(code)
      .first<{ id: number; name: string }>();
    if (!agent) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Invalid code. Please ask admin for a new code.',
      });
      return c.json({ ok: true });
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM agents WHERE telegram_chat_id = ?'
    )
      .bind(String(chatId))
      .first<{ id: number }>();
    if (existing && existing.id !== agent.id) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'This chat is already bound to another agent.',
      });
      return c.json({ ok: true });
    }

    await c.env.DB.prepare(
      `UPDATE agents
       SET telegram_chat_id = ?, telegram_bind_code = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(String(chatId), agent.id)
      .run();

    await sendTelegram(token, 'sendMessage', {
      chat_id: chatId,
      text: `Connected. Welcome ${agent.name}. Send /products to see your list.`,
    });

    return c.json({ ok: true });
  }

  if (text.startsWith('/products')) {
    const parts = text.split(/\s+/);
    const marketplace = parseMarketplace(parts[1]);
    const page = Number.parseInt(parts[2] ?? '1', 10) || 1;

    const agent = await c.env.DB.prepare(
      'SELECT id, name, slug FROM agents WHERE telegram_chat_id = ? AND is_active = 1'
    )
      .bind(String(chatId))
      .first<{ id: number; name: string; slug: string }>();
    if (!agent) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Not bound yet. Ask admin for a code and send /start CODE.',
      });
      return c.json({ ok: true });
    }

    const rows = await resolveMappedProducts({
      db: c.env.DB,
      agentId: agent.id,
      marketplace,
      page,
    });

    if (!rows.length) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'No approved products available yet.',
      });
      return c.json({ ok: true });
    }

    const list = rows
      .map((row) => `• ${row.title} (${row.marketplace}) — /product ${row.asin} ${row.marketplace}`)
      .join('\n');

    await sendTelegram(token, 'sendMessage', {
      chat_id: chatId,
      text: `Approved products:\n${list}\n\nUse /product ASIN COUNTRY to see details.`,
    });
    return c.json({ ok: true });
  }

  if (text.startsWith('/product')) {
    const parts = text.split(/\s+/);
    const asin = parts[1]?.toUpperCase();
    const marketplace = parseMarketplace(parts[2]);

    if (!asin || asin.length !== 10) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Usage: /product ASIN COUNTRY',
      });
      return c.json({ ok: true });
    }

    const agent = await c.env.DB.prepare(
      'SELECT id, name, slug FROM agents WHERE telegram_chat_id = ? AND is_active = 1'
    )
      .bind(String(chatId))
      .first<{ id: number; name: string; slug: string }>();
    if (!agent) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Not bound yet. Ask admin for a code and send /start CODE.',
      });
      return c.json({ ok: true });
    }

    const row = await resolveMappedProduct({
      db: c.env.DB,
      agentId: agent.id,
      asin,
      marketplace,
    });

    if (!row) {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: 'No approved product found for that ASIN.',
      });
      return c.json({ ok: true });
    }

    const publicSlug = await getPublicSlugForTracking({
      db: c.env.DB,
      agentId: agent.id,
      trackingId: row.tracking_id,
      marketplace: row.tracking_marketplace,
      fallbackSlug: agent.slug,
    });

    const baseUrl = c.env.PUBLIC_APP_URL || 'https://dealsrky.com';
    const productLink = buildAgentProductLink({
      baseUrl,
      publicSlug,
      marketplace: row.marketplace,
      asin: row.asin,
    });

    const orderRequirement = row.order_requirement
      ? `Order requirement: ${row.order_requirement}`
      : 'Order requirement: Not specified.';

    const caption = `${row.title}\nCountry: ${row.marketplace}\n${orderRequirement}`;

    try {
      if (row.image_url) {
        await sendTelegram(token, 'sendPhoto', {
          chat_id: chatId,
          photo: row.image_url,
          caption,
          reply_markup: {
            inline_keyboard: [[{ text: 'Get Order Link', url: productLink }]],
          },
        });
      } else {
        await sendTelegram(token, 'sendMessage', {
          chat_id: chatId,
          text: `${caption}\n${productLink}`,
          reply_markup: {
            inline_keyboard: [[{ text: 'Get Order Link', url: productLink }]],
          },
        });
      }
    } catch {
      await sendTelegram(token, 'sendMessage', {
        chat_id: chatId,
        text: `${caption}\n${productLink}`,
        reply_markup: {
          inline_keyboard: [[{ text: 'Get Order Link', url: productLink }]],
        },
      });
    }

    return c.json({ ok: true });
  }

  await sendTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: 'Commands: /products or /product ASIN COUNTRY',
  });

  return c.json({ ok: true });
});

export default telegram;
