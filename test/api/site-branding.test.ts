import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

describe("Site branding API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM admin_users").run();
    await env.DB.prepare("DELETE FROM site_branding_settings").run();
    await env.DB.prepare(
      `INSERT INTO site_branding_settings (id, og_site_name, og_description, og_image_url)
       VALUES (1, 'Amazon RKY Tag Store', 'Default description', 'https://example.com/default.jpg')`
    ).run();
  });

  afterEach(() => {});

  it("updates site branding settings", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/site-branding", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          og_site_name: "Amazon RKY Tag House",
          og_description: "Updated site description",
          og_image_url: "https://example.com/updated.jpg",
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const row = await env.DB
      .prepare(
        `SELECT og_site_name, og_description, og_image_url
         FROM site_branding_settings
         WHERE id = 1`
      )
      .first<{
        og_site_name: string;
        og_description: string;
        og_image_url: string;
      }>();

    expect(row).toEqual({
      og_site_name: "Amazon RKY Tag House",
      og_description: "Updated site description",
      og_image_url: "https://example.com/updated.jpg",
    });
  });
});
