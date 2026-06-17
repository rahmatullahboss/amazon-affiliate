import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../utils/types";
import { updateSocialLinksSettingsSchema } from "../schemas";
import { writeAuditLog } from "../services/audit-log";
import {
  getSocialLinksSettings,
  toPublicSocialLinks,
  updateSocialLinksSettings,
} from "../services/social-links";

const socialLinks = new Hono<AppEnv>();

socialLinks.get("/", async (c) => {
  const settings = await getSocialLinksSettings(c.env.DB);
  return c.json({ settings, public: toPublicSocialLinks(settings) });
});

socialLinks.put("/", zValidator("json", updateSocialLinksSettingsSchema), async (c) => {
  const body = c.req.valid("json");

  const settings = await updateSocialLinksSettings(c.env.DB, {
    telegramUrl: body.telegram_url ?? "",
    telegramEnabled: Boolean(body.telegram_enabled),
    whatsappUrl: body.whatsapp_url ?? "",
    whatsappEnabled: Boolean(body.whatsapp_enabled),
    messengerUrl: body.messenger_url ?? "",
    messengerEnabled: Boolean(body.messenger_enabled),
  });

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get("userId"),
      action: "social_links.updated",
      entityType: "social_links_settings",
      entityId: 1,
      details: {
        telegram: { url: settings.telegram_url, enabled: Boolean(settings.telegram_enabled) },
        whatsapp: { url: settings.whatsapp_url, enabled: Boolean(settings.whatsapp_enabled) },
        messenger: { url: settings.messenger_url, enabled: Boolean(settings.messenger_enabled) },
      },
    })
  );

  return c.json({
    settings,
    public: toPublicSocialLinks(settings),
    message: "Social links updated.",
  });
});

export default socialLinks;
