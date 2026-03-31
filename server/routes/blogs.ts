import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv, BlogPostRow } from "../utils/types";
import { createBlogPostSchema, updateBlogPostSchema } from "../schemas";
import {
  buildBlogExcerpt,
  buildBlogImageKey,
  buildBlogImageUrl,
  createUniqueBlogSlug,
  estimateReadingMinutes,
} from "../services/blog";

const blogs = new Hono<AppEnv>();

function mapBlogPost(
  env: AppEnv["Bindings"],
  row: BlogPostRow
): BlogPostRow & {
  cover_image_url: string | null;
  reading_minutes: number;
  excerpt_text: string;
} {
  return {
    ...row,
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    reading_minutes: estimateReadingMinutes(row.content),
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
  };
}

blogs.get("/", async (c) => {
  const status = c.req.query("status");

  const query =
    status === "draft" || status === "published"
      ? c.env.DB.prepare(
          `SELECT *
           FROM blog_posts
           WHERE is_deleted = 0 AND status = ?
           ORDER BY
             CASE WHEN published_at IS NULL THEN 1 ELSE 0 END,
             published_at DESC,
             updated_at DESC`
        ).bind(status)
      : c.env.DB.prepare(
          `SELECT *
           FROM blog_posts
           WHERE is_deleted = 0
           ORDER BY
             CASE WHEN published_at IS NULL THEN 1 ELSE 0 END,
             published_at DESC,
             updated_at DESC`
        );

  const { results } = await query.all<BlogPostRow>();

  return c.json({
    posts: (results ?? []).map((row) => mapBlogPost(c.env, row)),
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
  const key = buildBlogImageKey(extension);

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

  return c.json({ post: mapBlogPost(c.env, row) });
});

blogs.post("/", zValidator("json", createBlogPostSchema), async (c) => {
  const payload = c.req.valid("json");
  const slug = await createUniqueBlogSlug(c.env.DB, {
    title: payload.title,
    slug: payload.slug,
  });

  const excerpt = buildBlogExcerpt(payload.content, payload.excerpt);
  const status = payload.status;
  const publishedAt =
    status === "published" ? payload.published_at || new Date().toISOString() : null;

  const result = await c.env.DB.prepare(
    `INSERT INTO blog_posts (
       title, slug, excerpt, content, cover_image_key, cover_image_alt,
       seo_title, seo_description, status, is_featured, published_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      payload.title.trim(),
      slug,
      excerpt,
      payload.content.trim(),
      payload.cover_image_key || null,
      payload.cover_image_alt?.trim() || null,
      payload.seo_title?.trim() || null,
      payload.seo_description?.trim() || null,
      status,
      payload.is_featured ? 1 : 0,
      publishedAt
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
      post: mapBlogPost(c.env, row),
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
  const nextPublishedAt =
    nextStatus === "published"
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
         seo_title = ?,
         seo_description = ?,
         status = ?,
         is_featured = ?,
         published_at = ?,
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
      payload.seo_title === undefined ? current.seo_title : payload.seo_title?.trim() || null,
      payload.seo_description === undefined
        ? current.seo_description
        : payload.seo_description?.trim() || null,
      nextStatus,
      payload.is_featured === undefined ? current.is_featured : payload.is_featured ? 1 : 0,
      nextPublishedAt,
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
    post: mapBlogPost(c.env, row),
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
