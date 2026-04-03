export interface SiteBrandingSettings {
  id: number;
  og_site_name: string;
  og_description: string;
  og_image_url: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SITE_BRANDING = {
  ogSiteName: "DealsRky Product Picks",
  ogDescription:
    "Browse curated product pages, compare featured picks, and continue to the final retailer page with a clear preview.",
  ogImageUrl: "https://dealsrky.com/dealsrky-logo.svg",
} as const;

export async function getSiteBrandingSettings(
  db: D1Database
): Promise<SiteBrandingSettings> {
  const existing = await db
    .prepare(
      `SELECT
         id,
         og_site_name,
         og_description,
         og_image_url,
         created_at,
         updated_at
       FROM site_branding_settings
       WHERE id = 1`
    )
    .first<SiteBrandingSettings>();

  if (existing) {
    return existing;
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO site_branding_settings (
         id,
         og_site_name,
         og_description,
         og_image_url
       ) VALUES (1, ?, ?, ?)`
    )
    .bind(
      DEFAULT_SITE_BRANDING.ogSiteName,
      DEFAULT_SITE_BRANDING.ogDescription,
      DEFAULT_SITE_BRANDING.ogImageUrl
    )
    .run();

  return getSiteBrandingSettings(db);
}

export async function updateSiteBrandingSettings(
  db: D1Database,
  input: {
    ogSiteName: string;
    ogDescription: string;
    ogImageUrl: string;
  }
): Promise<SiteBrandingSettings> {
  await db
    .prepare(
      `UPDATE site_branding_settings
       SET og_site_name = ?,
           og_description = ?,
           og_image_url = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    )
    .bind(input.ogSiteName, input.ogDescription, input.ogImageUrl)
    .run();

  return getSiteBrandingSettings(db);
}

export const DEFAULT_SITE_BRANDING_SETTINGS = DEFAULT_SITE_BRANDING;
