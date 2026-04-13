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

  it("creates a scheduled post with a future publish time", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateEditorToken("editor", env.JWT_SECRET || "test-secret");
    const ctx = { waitUntil: () => undefined } as never;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/blogs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          title: "Scheduled Desk Setup Guide",
          slug: "scheduled-desk-setup-guide",
          content:
            "This scheduled article contains enough body text to pass validation and wait for a future publish time.\n\nIt explains what readers should compare before choosing accessories and how to review options carefully before buying.",
          status: "scheduled",
          scheduled_for: "2099-04-13T06:00:00.000Z",
        }),
      }),
      env as never,
      ctx
    );

    expect(response.status).toBe(201);

    const row = await env.DB.prepare(
      `SELECT status, scheduled_for
       FROM blog_posts
       WHERE slug = ?`
    )
      .bind("scheduled-desk-setup-guide")
      .first<{ status: string; scheduled_for: string | null }>();

    expect(row?.status).toBe("draft");
    expect(row?.scheduled_for).toBe("2099-04-13T06:00:00.000Z");

    const listResponse = await apiApp.fetch(
      new Request("http://localhost/api/blogs?status=scheduled", {
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      env as never,
      ctx
    );

    expect(listResponse.status).toBe(200);
    const listPayload = (await listResponse.json()) as {
      posts: Array<{ slug: string; status: string }>;
    };
    expect(listPayload.posts.some((post) => post.slug === "scheduled-desk-setup-guide")).toBe(true);
    expect(listPayload.posts.find((post) => post.slug === "scheduled-desk-setup-guide")?.status).toBe("scheduled");
  });

  it("rejects scheduled posts without a future publish time", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateEditorToken("editor", env.JWT_SECRET || "test-secret");
    const ctx = { waitUntil: () => undefined } as never;

    const response = await apiApp.fetch(
      new Request("http://localhost/api/blogs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          title: "Invalid scheduled post",
          slug: "invalid-scheduled-post",
          content:
            "This scheduled article contains enough body text to pass validation but is missing the required schedule metadata.\n\nThat should cause the API to reject it.",
          status: "scheduled",
        }),
      }),
      env as never,
      ctx
    );

    expect(response.status).toBe(400);
  });
});
