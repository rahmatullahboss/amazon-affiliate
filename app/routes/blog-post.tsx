import type { Route } from "./+types/blog-post";
import { Link } from "react-router";
import { buildBlogExcerpt, buildBlogImageUrl, estimateReadingMinutes } from "../../server/services/blog";
import { buildCanonicalUrl, PUBLIC_SITE_URL } from "../utils/seo";
import { formatBlogDate, splitBlogContent } from "../utils/blog";

interface BlogPostData {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  excerpt_text: string;
  content: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Article Not Found — DealsRky" }];
  }

  const post = data as BlogPostData;
  const title = post.seo_title || `${post.title} — DealsRky`;
  const description = post.seo_description || post.excerpt_text;
  const canonical = buildCanonicalUrl(`/blog/${post.slug}`);

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonical },
    { name: "twitter:card", content: post.cover_image_url ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
  ];

  if (post.cover_image_url) {
    meta.push(
      { property: "og:image", content: new URL(post.cover_image_url, PUBLIC_SITE_URL).toString() },
      { name: "twitter:image", content: new URL(post.cover_image_url, PUBLIC_SITE_URL).toString() }
    );
  }

  if (post.published_at) {
    meta.push({ property: "article:published_time", content: post.published_at });
  }

  return meta;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;

  const row = await env.DB.prepare(
    `SELECT *
     FROM blog_posts
     WHERE slug = ? AND is_deleted = 0 AND status = 'published'
     LIMIT 1`
  )
    .bind(slug)
    .first<{
      id: number;
      title: string;
      slug: string;
      excerpt: string | null;
      content: string;
      cover_image_key: string | null;
      cover_image_alt: string | null;
      seo_title: string | null;
      seo_description: string | null;
      published_at: string | null;
      updated_at: string;
    }>();

  if (!row) {
    throw new Response("Article not found", { status: 404 });
  }

  return {
    ...row,
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
    reading_minutes: estimateReadingMinutes(row.content),
  } satisfies BlogPostData;
}

export default function BlogPostPage({ loaderData }: Route.ComponentProps) {
  const post = loaderData as BlogPostData;
  const paragraphs = splitBlogContent(post.content);
  const articleUrl = buildCanonicalUrl(`/blog/${post.slug}`);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo_description || post.excerpt_text,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: articleUrl,
    image: post.cover_image_url ? [new URL(post.cover_image_url, PUBLIC_SITE_URL).toString()] : undefined,
    publisher: {
      "@type": "Organization",
      name: "DealsRky",
      url: PUBLIC_SITE_URL,
    },
  };

  return (
    <article className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_30%,#f4f6f6_100%)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-primary">Blog</Link>
          <span>/</span>
          <span className="text-gray-700">{post.title}</span>
        </nav>

        <header className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">
            DealsRky Editorial
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-gray-950 md:text-6xl">
            {post.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {post.excerpt_text}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-gray-500">
            <span>{formatBlogDate(post.published_at)}</span>
            <span>•</span>
            <span>{post.reading_minutes} min read</span>
          </div>
        </header>

        {post.cover_image_url ? (
          <div className="mt-10 overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
            <img
              src={post.cover_image_url}
              alt={post.cover_image_alt || post.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="mt-10 rounded-[2rem] border border-gray-200 bg-white p-7 shadow-sm md:p-10">
          <div className="prose prose-lg max-w-none prose-p:leading-8 prose-headings:text-gray-950 prose-p:text-gray-700">
            {paragraphs.map((paragraph, index) => (
              <p key={`${post.id}-${index}`} className="mb-6 text-base leading-8 text-gray-700 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-[1.75rem] border border-primary/20 bg-primary/5 p-6">
          <h2 className="text-2xl font-black text-gray-950">Browse more smart picks</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Continue exploring our curated deal pages and product breakdowns for more Amazon buying guidance.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/deals"
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Browse deals
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center justify-center rounded-full border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
            >
              More articles
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
