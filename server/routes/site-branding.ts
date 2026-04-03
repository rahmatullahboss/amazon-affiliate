import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../utils/types";
import { updateSiteBrandingSettingsSchema } from "../schemas";
import { writeAuditLog } from "../services/audit-log";
import {
  getSiteBrandingSettings,
  updateSiteBrandingSettings,
} from "../services/site-branding";

const siteBranding = new Hono<AppEnv>();

siteBranding.get("/", async (c) => {
  const settings = await getSiteBrandingSettings(c.env.DB);
  return c.json({ settings });
});

siteBranding.put("/", zValidator("json", updateSiteBrandingSettingsSchema), async (c) => {
  const body = c.req.valid("json");
  const settings = await updateSiteBrandingSettings(c.env.DB, {
    ogSiteName: body.og_site_name,
    ogDescription: body.og_description,
    ogImageUrl: body.og_image_url,
  });

  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      userId: c.get("userId"),
      action: "site_branding.updated",
      entityType: "site_branding_settings",
      entityId: 1,
      details: {
        ogSiteName: settings.og_site_name,
        ogDescription: settings.og_description,
        ogImageUrl: settings.og_image_url,
      },
    })
  );

  return c.json({ settings, message: "Site branding settings updated." });
});

export default siteBranding;
