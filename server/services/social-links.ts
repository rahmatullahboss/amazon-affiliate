export interface SocialLinksSettings {
  id: number;
  telegram_url: string;
  telegram_enabled: number;
  whatsapp_url: string;
  whatsapp_enabled: number;
  messenger_url: string;
  messenger_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface SocialLinksPublic {
  telegram: { url: string; enabled: boolean } | null;
  whatsapp: { url: string; enabled: boolean } | null;
  messenger: { url: string; enabled: boolean } | null;
}

const DEFAULT_SOCIAL_LINKS = {
  telegramUrl: '',
  telegramEnabled: 0,
  whatsappUrl: '',
  whatsappEnabled: 0,
  messengerUrl: '',
  messengerEnabled: 0,
} as const;

export async function getSocialLinksSettings(
  db: D1Database
): Promise<SocialLinksSettings> {
  const existing = await db
    .prepare(
      `SELECT
         id,
         telegram_url,
         telegram_enabled,
         whatsapp_url,
         whatsapp_enabled,
         messenger_url,
         messenger_enabled,
         created_at,
         updated_at
       FROM social_links_settings
       WHERE id = 1`
    )
    .first<SocialLinksSettings>();

  if (existing) {
    return existing;
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO social_links_settings (
         id,
         telegram_url,
         telegram_enabled,
         whatsapp_url,
         whatsapp_enabled,
         messenger_url,
         messenger_enabled
       ) VALUES (1, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      DEFAULT_SOCIAL_LINKS.telegramUrl,
      DEFAULT_SOCIAL_LINKS.telegramEnabled,
      DEFAULT_SOCIAL_LINKS.whatsappUrl,
      DEFAULT_SOCIAL_LINKS.whatsappEnabled,
      DEFAULT_SOCIAL_LINKS.messengerUrl,
      DEFAULT_SOCIAL_LINKS.messengerEnabled
    )
    .run();

  const row = await db
    .prepare(
      `SELECT
         id,
         telegram_url,
         telegram_enabled,
         whatsapp_url,
         whatsapp_enabled,
         messenger_url,
         messenger_enabled,
         created_at,
         updated_at
       FROM social_links_settings
       WHERE id = 1`
    )
    .first<SocialLinksSettings>();

  if (!row) {
    throw new Error('Failed to initialize social links settings');
  }

  return row;
}

export async function updateSocialLinksSettings(
  db: D1Database,
  input: {
    telegramUrl: string;
    telegramEnabled: boolean;
    whatsappUrl: string;
    whatsappEnabled: boolean;
    messengerUrl: string;
    messengerEnabled: boolean;
  }
): Promise<SocialLinksSettings> {
  await db
    .prepare(
      `UPDATE social_links_settings
       SET telegram_url = ?,
           telegram_enabled = ?,
           whatsapp_url = ?,
           whatsapp_enabled = ?,
           messenger_url = ?,
           messenger_enabled = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    )
    .bind(
      input.telegramUrl,
      input.telegramEnabled ? 1 : 0,
      input.whatsappUrl,
      input.whatsappEnabled ? 1 : 0,
      input.messengerUrl,
      input.messengerEnabled ? 1 : 0
    )
    .run();

  return getSocialLinksSettings(db);
}

export function toPublicSocialLinks(
  settings: SocialLinksSettings
): SocialLinksPublic {
  return {
    telegram:
      settings.telegram_enabled && settings.telegram_url
        ? { url: settings.telegram_url, enabled: true }
        : null,
    whatsapp:
      settings.whatsapp_enabled && settings.whatsapp_url
        ? { url: settings.whatsapp_url, enabled: true }
        : null,
    messenger:
      settings.messenger_enabled && settings.messenger_url
        ? { url: settings.messenger_url, enabled: true }
        : null,
  };
}

export const DEFAULT_SOCIAL_LINKS_SETTINGS = DEFAULT_SOCIAL_LINKS;
