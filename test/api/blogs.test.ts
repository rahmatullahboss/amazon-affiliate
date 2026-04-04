import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateEditorToken } from "../factories/token";

describe("Blogs API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM users").run();
    await env.DB.prepare("DELETE FROM blog_posts").run();
  });

  it("creates and updates blog CTA fields for editor-managed posts", async () => {
    await DbFactory.seedAdmin(env.DB);
    await env.DB.prepare(
      `INSERT INTO users (id, username, password_hash, role, is_active)
       VALUES (2, 'editor', 'hash', 'editor', 1)`
    ).run();

    const token = await generateEditorToken("editor", env.JWT_SECRET || "test-secret");
    const ctx = { waitUntil: () => undefined } as never;

    const createResponse = await apiApp.fetch(
      new Request("http://localhost/api/blogs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          title: "Desk Setup Guide",
          slug: "desk-setup-guide",
          excerpt: "Short desk setup summary",
          content:
            "This is a practical article about building a better desk setup with enough body text to pass validation.\n\nIt also explains how to compare accessories before buying.",
          cta_label: "View on Amazon",
          cta_url: "https://www.amazon.com/dp/B0TEST1234?tag=test-20",
          cta_disclosure:
            "Affiliate link. As an Amazon Associate, DealsRky earns from qualifying purchases.",
          status: "published",
          is_featured: false,
        }),
      }),
      env as never,
      ctx
    );

    expect(createResponse.status).toBe(201);

    const createPayload = (await createResponse.json()) as {
      post: {
        id: number;
        cta_label: string | null;
        cta_url: string | null;
        cta_disclosure: string | null;
      };
    };

    expect(createPayload.post.cta_label).toBe("View on Amazon");
    expect(createPayload.post.cta_url).toBe("https://www.amazon.com/dp/B0TEST1234?tag=test-20");
    expect(createPayload.post.cta_disclosure).toContain("Amazon Associate");

    const updateResponse = await apiApp.fetch(
      new Request(`http://localhost/api/blogs/${createPayload.post.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          cta_label: "Check on Amazon",
          cta_url: "https://www.amazon.co.uk/dp/B0TEST1234?tag=testuk-21",
          cta_disclosure: "Affiliate link for Amazon UK.",
        }),
      }),
      env as never,
      ctx
    );

    expect(updateResponse.status).toBe(200);

    const updatePayload = (await updateResponse.json()) as {
      post: {
        cta_label: string | null;
        cta_url: string | null;
        cta_disclosure: string | null;
      };
    };

    expect(updatePayload.post.cta_label).toBe("Check on Amazon");
    expect(updatePayload.post.cta_url).toBe("https://www.amazon.co.uk/dp/B0TEST1234?tag=testuk-21");
    expect(updatePayload.post.cta_disclosure).toBe("Affiliate link for Amazon UK.");
  });
});
