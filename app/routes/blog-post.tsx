import type { Route } from "./+types/blog-post";
import { Link } from "react-router";
import {
  buildBlogExcerpt,
  buildBlogImageUrl,
  estimateReadingMinutes,
  resolveBlogAmazonCtaUrl,
} from "../../server/services/blog";
import {
  buildMarketplaceAwareDealsHref,
  filterBlogPostsForMarketplace,
  orderBlogPostsForMarketplace,
} from "../utils/blog-personalization";
import {
  AMAZON_DESTINATION_NOTE,
  AMAZON_PRIMARY_CTA_LABEL,
  BROWSE_PICKS_LABEL,
  INLINE_AFFILIATE_DISCLOSURE,
} from "../utils/affiliate-copy";
import { resolvePreferredMarketplace } from "../utils/marketplace";
import type { PublicMarketplace } from "../utils/marketplace";
import { buildCanonicalUrl, PUBLIC_SITE_URL } from "../utils/seo";
import { buildBlogContentHtml, formatBlogDate } from "../utils/blog";

interface BlogPostData {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  excerpt_text: string;
  content: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  cta_label: string | null;
  cta_url: string | null;
  cta_disclosure: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
  generation_source: "manual" | "ai";
  generation_focus_asin: string | null;
  generation_marketplace: string | null;
  preferredMarketplace: PublicMarketplace;
  featuredProduct: {
    asin: string;
    title: string;
    imageUrl: string | null;
    marketplace: string;
  } | null;
  directAmazonUrl: string | null;
  relatedPosts: Array<{
    id: number;
    title: string;
    slug: string;
    generation_source: "manual" | "ai";
    generation_marketplace: string | null;
    is_featured: number;
    published_at: string | null;
    updated_at: string;
  }>;
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

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;
  const url = new URL(request.url);
  const preferredMarketplace = resolvePreferredMarketplace({
    searchParams: url.searchParams,
    cookieHeader: request.headers.get("cookie"),
    countryHeader: request.headers.get("cf-ipcountry"),
  });

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
      cta_label: string | null;
      cta_url: string | null;
      cta_disclosure: string | null;
      seo_title: string | null;
      seo_description: string | null;
      published_at: string | null;
      updated_at: string;
      generation_source: "manual" | "ai";
      generation_focus_asin: string | null;
      generation_marketplace: string | null;
    }>();

  if (!row) {
    throw new Response("Article not found", { status: 404 });
  }

  const { results: relatedRows } = await env.DB.prepare(
    `SELECT id, title, slug, generation_source, generation_marketplace, is_featured, published_at, updated_at
     FROM blog_posts
     WHERE is_deleted = 0
       AND status = 'published'
       AND slug != ?
     ORDER BY published_at DESC, updated_at DESC
     LIMIT 12`
  )
    .bind(slug)
    .all<BlogPostData["relatedPosts"][number]>();

  const featuredProduct =
    row.generation_focus_asin && row.generation_marketplace
      ? await env.DB.prepare(
          `SELECT asin, title, image_url, marketplace
           FROM products
           WHERE asin = ?
             AND marketplace = ?
             AND is_active = 1
             AND status = 'active'
           LIMIT 1`
        )
          .bind(row.generation_focus_asin, row.generation_marketplace)
          .first<{
            asin: string;
            title: string;
            image_url: string | null;
            marketplace: string;
          }>()
      : null;

  const isMarketplaceAligned =
    !row.generation_marketplace ||
    row.generation_marketplace.trim().toUpperCase() === preferredMarketplace;

  const directAmazonUrl = isMarketplaceAligned
    ? await resolveBlogAmazonCtaUrl({
        db: env.DB,
        ctaUrl: row.cta_url,
        preferredMarketplace,
        generationFocusAsin: row.generation_focus_asin,
        generationMarketplace: row.generation_marketplace,
      })
    : null;

  return {
    ...row,
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
    reading_minutes: estimateReadingMinutes(row.content),
    preferredMarketplace,
    featuredProduct: featuredProduct
      ? {
          asin: featuredProduct.asin,
          title: featuredProduct.title,
          imageUrl: featuredProduct.image_url,
          marketplace: featuredProduct.marketplace,
        }
      : null,
    directAmazonUrl,
    relatedPosts: orderBlogPostsForMarketplace(
      filterBlogPostsForMarketplace(relatedRows ?? [], preferredMarketplace),
      preferredMarketplace
    ).slice(0, 3),
  } satisfies BlogPostData;
}

export default function BlogPostPage({ loaderData }: Route.ComponentProps) {
  const post = loaderData as BlogPostData;
  const contentHtml = buildBlogContentHtml(post.content);
  const articleUrl = buildCanonicalUrl(`/blog/${post.slug}`);
  const amazonCtaHref = post.directAmazonUrl;
  const showMarketplaceProductBlocks =
    !post.generation_marketplace ||
    post.generation_marketplace.trim().toUpperCase() === post.preferredMarketplace;
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
          <div
            className="prose prose-lg max-w-none prose-p:my-5 prose-p:leading-8 prose-h2:mt-10 prose-h2:mb-4 prose-h3:mt-8 prose-h3:mb-3 prose-ul:my-6 prose-li:my-1 prose-headings:text-gray-950 prose-p:text-gray-700 prose-a:text-primary prose-strong:text-gray-950"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>

        {showMarketplaceProductBlocks && post.featuredProduct?.imageUrl ? (
          <div className="mt-8 rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-gray-50 md:w-56 md:shrink-0">
                <img
                  src={post.featuredProduct.imageUrl}
                  alt={post.cover_image_alt || post.featuredProduct.title}
                  className="h-56 w-full object-cover md:h-44"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
                  Featured product
                </p>
                <h2 className="mt-3 text-2xl font-black text-gray-950">
                  {post.featuredProduct.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  This article was generated around our {post.featuredProduct.marketplace} catalog entry for this product,
                  so you can compare the buying angle with the actual listing before deciding.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {amazonCtaHref ? (
                    <a
                      href={amazonCtaHref}
                      rel="nofollow sponsored"
                      className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                    >
                      {post.cta_label || AMAZON_PRIMARY_CTA_LABEL}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showMarketplaceProductBlocks && post.cta_url && amazonCtaHref ? (
          <div className="mt-8 rounded-[1.75rem] border border-primary/20 bg-primary/5 p-6">
            <h2 className="text-2xl font-black text-gray-950">Ready to check this on Amazon?</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {AMAZON_DESTINATION_NOTE}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={amazonCtaHref}
                rel="nofollow sponsored"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                {post.cta_label || AMAZON_PRIMARY_CTA_LABEL}
              </a>
            </div>
            <p className="mt-3 text-xs leading-6 text-gray-500">
              {post.cta_disclosure || INLINE_AFFILIATE_DISCLOSURE}
            </p>
          </div>
        ) : null}

        <div className="mt-10 rounded-[1.75rem] border border-primary/20 bg-primary/5 p-6">
          <h2 className="text-2xl font-black text-gray-950">Browse more smart picks</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Continue exploring our curated deal pages and product breakdowns for more practical buying guidance.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to={buildMarketplaceAwareDealsHref("/deals", post.preferredMarketplace)}
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              {BROWSE_PICKS_LABEL}
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center justify-center rounded-full border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
            >
              More articles
            </Link>
          </div>
        </div>

        {post.relatedPosts.length > 0 ? (
          <div className="mt-10 rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-gray-950">
              More {post.preferredMarketplace} buying guides
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              These articles are prioritized for shoppers browsing from the same marketplace region.
            </p>
            <div className="mt-6 space-y-4">
              {post.relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  to={`/blog/${relatedPost.slug}`}
                  className="block rounded-2xl border border-gray-200 px-5 py-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
                    {relatedPost.generation_marketplace || "Global"} article
                  </p>
                  <h3 className="mt-2 text-lg font-black text-gray-950">{relatedPost.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
