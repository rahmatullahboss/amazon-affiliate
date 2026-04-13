import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv, BlogPostRow } from "../utils/types";
import { createBlogPostSchema, updateBlogPostSchema } from "../schemas";
import {
  buildBlogExcerpt,
  buildBlogImageKey,
  buildBlogImageUrl,
  buildStoredImageKey,
  createUniqueBlogSlug,
  deriveBlogStatus,
  estimateReadingMinutes,
  resolveBlogAmazonCtaUrl,
} from "../services/blog";
import { generateScheduledBlogDraft } from "../services/blog-generation";

const blogs = new Hono<AppEnv>();

function mapBlogPost(
  env: AppEnv["Bindings"],
  row: BlogPostRow
): BlogPostRow & {
  cover_image_url: string | null;
  reading_minutes: number;
  excerpt_text: string;
  resolved_cta_url: string | null;
} {
  return {
    ...row,
    status: deriveBlogStatus(row),
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    reading_minutes: estimateReadingMinutes(row.content),
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
    resolved_cta_url: null,
  };
}

function validateScheduledFields(input: {
  status: "draft" | "scheduled" | "published";
  scheduledFor: string | null | undefined;
}) {
  if (input.status !== "scheduled") {
    return;
  }

  if (!input.scheduledFor) {
    throw new HTTPException(400, {
      message: "Scheduled posts require a future publish time.",
    });
  }

  const scheduledAt = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    throw new HTTPException(400, {
      message: "Scheduled publish time must be in the future.",
    });
  }
}

blogs.get("/", async (c) => {
  const status = c.req.query("status");

  const query =
    status === "scheduled"
      ? c.env.DB.prepare(
          `SELECT *
           FROM blog_posts
           WHERE is_deleted = 0
             AND status = 'draft'
             AND scheduled_for IS NOT NULL
             AND datetime(scheduled_for) > datetime('now')
           ORDER BY datetime(scheduled_for) ASC, updated_at DESC`
        )
      : status === "draft"
        ? c.env.DB.prepare(
            `SELECT *
             FROM blog_posts
             WHERE is_deleted = 0
               AND status = 'draft'
               AND (scheduled_for IS NULL OR datetime(scheduled_for) <= datetime('now'))
             ORDER BY updated_at DESC, published_at DESC`
          )
        : status === "published"
          ? c.env.DB.prepare(
              `SELECT *
               FROM blog_posts
               WHERE is_deleted = 0 AND status = 'published'
               ORDER BY published_at DESC, updated_at DESC`
            )
      : c.env.DB.prepare(
          `SELECT *
           FROM blog_posts
           WHERE is_deleted = 0
           ORDER BY
             CASE
               WHEN status = 'draft' AND scheduled_for IS NOT NULL AND datetime(scheduled_for) > datetime('now') THEN 0
               WHEN status = 'draft' THEN 1
               ELSE 2
             END,
             updated_at DESC`
        );

  const { results } = await query.all<BlogPostRow>();

  const posts = await Promise.all(
    (results ?? []).map(async (row) => ({
      ...mapBlogPost(c.env, row),
      resolved_cta_url: await resolveBlogAmazonCtaUrl({
        db: c.env.DB,
        ctaUrl: row.cta_url,
        generationFocusAsin: row.generation_focus_asin,
        generationMarketplace: row.generation_marketplace,
      }),
    }))
  );

  return c.json({ posts });
});

blogs.post("/generate-ai-draft", async (c) => {
  const result = await generateScheduledBlogDraft(c.env);

  if (result.status === "success") {
    return c.json(
      {
        message: "AI blog draft generated and added to the approval queue.",
        result,
      },
      201
    );
  }

  if (result.status === "skipped") {
    return c.json({
      message: result.reason || "AI blog generation skipped for this run.",
      result,
    });
  }

  throw new HTTPException(502, {
    message: result.reason || "AI blog generation failed.",
  });
});

blogs.post("/upload-image", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "Image file is required" });
  }

  if (!file.type.startsWith("image/")) {
    throw new HTTPException(400, { message: "Only image uploads are supported" });
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new HTTPException(400, { message: "Compressed image must be 5MB or smaller" });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const key = buildStoredImageKey("blog", extension);

  await c.env.BLOG_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return c.json({
    key,
    url: buildBlogImageUrl(c.env, key),
    contentType: file.type,
    size: file.size,
  });
});

blogs.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new HTTPException(400, { message: "Invalid blog post ID" });
  }

  const row = await c.env.DB.prepare(
    `SELECT *
     FROM blog_posts
     WHERE id = ? AND is_deleted = 0`
  )
    .bind(id)
    .first<BlogPostRow>();

  if (!row) {
    throw new HTTPException(404, { message: "Blog post not found" });
  }

  return c.json({
    post: {
      ...mapBlogPost(c.env, row),
      resolved_cta_url: await resolveBlogAmazonCtaUrl({
        db: c.env.DB,
        ctaUrl: row.cta_url,
        generationFocusAsin: row.generation_focus_asin,
        generationMarketplace: row.generation_marketplace,
      }),
    },
  });
});

blogs.post("/", zValidator("json", createBlogPostSchema), async (c) => {
  const payload = c.req.valid("json");
  const slug = await createUniqueBlogSlug(c.env.DB, {
    title: payload.title,
    slug: payload.slug,
  });

  const excerpt = buildBlogExcerpt(payload.content, payload.excerpt);
  const status = payload.status;
  const scheduledFor = status === "scheduled" ? payload.scheduled_for || null : null;
  validateScheduledFields({ status, scheduledFor });
  const storedStatus = status === "scheduled" ? "draft" : status;
  const publishedAt =
    storedStatus === "published" ? payload.published_at || new Date().toISOString() : null;

  const result = await c.env.DB.prepare(
    `INSERT INTO blog_posts (
       title, slug, excerpt, content, cover_image_key, cover_image_alt,
       cta_label, cta_url, cta_disclosure,
       seo_title, seo_description, status, is_featured, published_at, scheduled_for, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      payload.title.trim(),
      slug,
      excerpt,
      payload.content.trim(),
      payload.cover_image_key || null,
      payload.cover_image_alt?.trim() || null,
      payload.cta_label?.trim() || null,
      payload.cta_url?.trim() || null,
      payload.cta_disclosure?.trim() || null,
      payload.seo_title?.trim() || null,
      payload.seo_description?.trim() || null,
      storedStatus,
      payload.is_featured ? 1 : 0,
      publishedAt,
      scheduledFor
    )
    .run();

  const id = result.meta.last_row_id;
  const row = await c.env.DB.prepare(
    `SELECT *
     FROM blog_posts
     WHERE id = ?`
  )
    .bind(id)
    .first<BlogPostRow>();

  if (!row) {
    throw new HTTPException(500, { message: "Blog post was created but could not be loaded" });
  }

  return c.json(
    {
      post: {
        ...mapBlogPost(c.env, row),
        resolved_cta_url: await resolveBlogAmazonCtaUrl({
          db: c.env.DB,
          ctaUrl: row.cta_url,
          generationFocusAsin: row.generation_focus_asin,
          generationMarketplace: row.generation_marketplace,
        }),
      },
      message: "Blog post created successfully",
    },
    201
  );
});

blogs.put("/:id", zValidator("json", updateBlogPostSchema), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new HTTPException(400, { message: "Invalid blog post ID" });
  }

  const current = await c.env.DB.prepare(
    `SELECT *
     FROM blog_posts
     WHERE id = ? AND is_deleted = 0`
  )
    .bind(id)
    .first<BlogPostRow>();

  if (!current) {
    throw new HTTPException(404, { message: "Blog post not found" });
  }

  const payload = c.req.valid("json");
  const nextTitle = payload.title?.trim() || current.title;
  const slug =
    payload.title !== undefined || payload.slug !== undefined
      ? await createUniqueBlogSlug(c.env.DB, {
          title: nextTitle,
          slug: payload.slug === undefined ? current.slug : payload.slug,
          excludeId: id,
        })
      : current.slug;

  const nextContent = payload.content?.trim() || current.content;
  const nextExcerpt =
    payload.excerpt !== undefined || payload.content !== undefined
      ? buildBlogExcerpt(nextContent, payload.excerpt ?? current.excerpt)
      : current.excerpt;
  const nextStatus = payload.status || current.status;
  const storedNextStatus = nextStatus === "scheduled" ? "draft" : nextStatus;
  const nextScheduledFor =
    nextStatus === "scheduled"
      ? payload.scheduled_for === undefined
        ? current.scheduled_for
        : payload.scheduled_for
      : null;
  validateScheduledFields({ status: nextStatus, scheduledFor: nextScheduledFor });
  const nextPublishedAt =
    storedNextStatus === "published"
      ? payload.published_at || current.published_at || new Date().toISOString()
      : null;

  await c.env.DB.prepare(
    `UPDATE blog_posts
     SET title = ?,
         slug = ?,
         excerpt = ?,
         content = ?,
         cover_image_key = ?,
         cover_image_alt = ?,
         cta_label = ?,
         cta_url = ?,
         cta_disclosure = ?,
         seo_title = ?,
         seo_description = ?,
         status = ?,
         is_featured = ?,
         published_at = ?,
         scheduled_for = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      nextTitle,
      slug,
      nextExcerpt,
      nextContent,
      payload.cover_image_key === undefined ? current.cover_image_key : payload.cover_image_key,
      payload.cover_image_alt === undefined
        ? current.cover_image_alt
        : payload.cover_image_alt?.trim() || null,
      payload.cta_label === undefined ? current.cta_label : payload.cta_label?.trim() || null,
      payload.cta_url === undefined ? current.cta_url : payload.cta_url?.trim() || null,
      payload.cta_disclosure === undefined
        ? current.cta_disclosure
        : payload.cta_disclosure?.trim() || null,
      payload.seo_title === undefined ? current.seo_title : payload.seo_title?.trim() || null,
      payload.seo_description === undefined
        ? current.seo_description
        : payload.seo_description?.trim() || null,
      storedNextStatus,
      payload.is_featured === undefined ? current.is_featured : payload.is_featured ? 1 : 0,
      nextPublishedAt,
      nextScheduledFor,
      id
    )
    .run();

  const row = await c.env.DB.prepare(
    `SELECT *
     FROM blog_posts
     WHERE id = ?`
  )
    .bind(id)
    .first<BlogPostRow>();

  if (!row) {
    throw new HTTPException(500, { message: "Blog post was updated but could not be loaded" });
  }

  return c.json({
    post: {
      ...mapBlogPost(c.env, row),
      resolved_cta_url: await resolveBlogAmazonCtaUrl({
        db: c.env.DB,
        ctaUrl: row.cta_url,
        generationFocusAsin: row.generation_focus_asin,
        generationMarketplace: row.generation_marketplace,
      }),
    },
    message: "Blog post updated successfully",
  });
});

blogs.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new HTTPException(400, { message: "Invalid blog post ID" });
  }

  const row = await c.env.DB.prepare(
    `SELECT id
     FROM blog_posts
     WHERE id = ? AND is_deleted = 0`
  )
    .bind(id)
    .first<{ id: number }>();

  if (!row) {
    throw new HTTPException(404, { message: "Blog post not found" });
  }

  await c.env.DB.prepare(
    `UPDATE blog_posts
     SET is_deleted = 1,
         deleted_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(id)
    .run();

  return c.json({ message: "Blog post archived successfully" });
});

export default blogs;
