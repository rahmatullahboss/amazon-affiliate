import type { Route } from "./+types/home";
import { Link } from "react-router";
import { ProductCard } from "../components/home/ProductCard";
import { BlogCard } from "../components/blog/BlogCard";
import {
  filterBlogPostsForMarketplace,
  orderBlogPostsForMarketplace,
} from "../utils/blog-personalization";
import {
  buildSeoMeta,
  toSiteBrandingMeta,
} from "../utils/seo";
import {
  HOME_HERO_EYEBROW,
} from "../utils/affiliate-copy";
import {
  resolveMarketplaceContext,
  type MarketplaceSelectionSource,
  type PublicMarketplace,
} from "../utils/marketplace";
import { buildBlogExcerpt, buildBlogImageUrl, estimateReadingMinutes } from "../../server/services/blog";
import { getHomepageFeedRows } from "../../server/services/homepage-feed";
import {
  buildComparisonGroups,
  buildHomePageSections,
  getHomepageKeywordLabel,
} from "../utils/homepage";
import type { BlogPostSummary } from "../utils/blog";

interface ProductRow {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  category: string | null;
  marketplace: string | null;
  created_at: string;
  agent_slug: string | null;
  source_type: "mapping" | "fallback";
  public_href: string;
}

interface HomeLoaderData {
  products: ProductRow[];
  posts: BlogPostSummary[];
  selectedMarketplace: PublicMarketplace;
  selectionSource: MarketplaceSelectionSource;
  detectedMarketplace: PublicMarketplace | null;
  siteBranding: {
    og_site_name: string;
    og_description: string;
    og_image_url: string;
  } | null;
}

function buildHomepageProductPath(
  agentSlug: string | null,
  marketplace: string | null,
  asin: string
): string {
  if (!agentSlug || !marketplace) {
    return `/deals/${asin}`;
  }

  return `/${agentSlug}/${marketplace.toLowerCase()}/${asin}`;
}

export function meta({ data }: Route.MetaArgs) {
  const branding = toSiteBrandingMeta(
    (data as HomeLoaderData | undefined)?.siteBranding ?? undefined
  );

  return buildSeoMeta({
    title: branding.ogSiteName,
    description: branding.ogDescription,
    path: "/",
    imageUrl: branding.ogImageUrl,
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const marketplaceContext = resolveMarketplaceContext({
    searchParams: url.searchParams,
    cookieHeader: request.headers.get("cookie"),
    countryHeader: request.headers.get("cf-ipcountry"),
  });
  const selectedMarketplace = marketplaceContext.marketplace;

  const [productsResult, postsResult] = await Promise.all([
    getHomepageFeedRows(env.DB, selectedMarketplace, 44),
    env.DB.prepare(
      `SELECT *
       FROM blog_posts
       WHERE is_deleted = 0 AND status = 'published'
       ORDER BY is_featured DESC, published_at DESC, updated_at DESC
       LIMIT 7`
    ).all<
      BlogPostSummary & {
        cover_image_key: string | null;
      }
    >(),
  ]);
  const siteBranding = await env.DB.prepare(
    `SELECT og_site_name, og_description, og_image_url
     FROM site_branding_settings
     WHERE id = 1
     LIMIT 1`
  ).first<HomeLoaderData["siteBranding"]>();

  const allPosts = (postsResult.results || []).map((row) => ({
    ...row,
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
    reading_minutes: estimateReadingMinutes(row.content),
  }));
  const posts = orderBlogPostsForMarketplace(
    filterBlogPostsForMarketplace(allPosts, selectedMarketplace),
    selectedMarketplace
  );

  return {
    products: productsResult.map((product) => ({
      ...product,
      public_href: product.agent_slug
        ? buildHomepageProductPath(product.agent_slug, product.marketplace, product.asin)
        : `/deals/${product.asin}`,
    })),
    posts,
    selectedMarketplace,
    selectionSource: marketplaceContext.source,
    detectedMarketplace: marketplaceContext.detectedMarketplace,
    siteBranding,
  } satisfies HomeLoaderData;
}

const editorialHighlights = [
  {
    title: "Curated Expert Picks",
    description:
      "Every product we feature is hand-selected and reviewed for fit, quality, and buying context before it appears in our catalog.",
  },
  {
    title: "Transparent Shopping",
    description:
      "Clear specifications, direct retailer handoff, and visible affiliate disclosures help you understand exactly how each page works.",
  },
  {
    title: "Retailer Checkout Clarity",
    description: "When you find a product you like, the final retailer page shows live pricing, shipping, and checkout details.",
  },
];

const marketplaceLabels = ["US", "CA", "UK", "DE", "IT", "FR", "ES"];

const quickAccessLinks = [
  { label: "Trending Deals", to: "/deals" },
  { label: "Latest Deals", to: "/deals" },
  { label: "Top 10 Deals", to: "/deals" },
  { label: "About / Contact / Policy", to: "/about" },
];

const socialLinks = [
  { label: "Facebook", href: "/contact" },
  { label: "Instagram", href: "/contact" },
  { label: "Telegram", href: "/contact" },
  { label: "WhatsApp", href: "/contact" },
];

function getMarketplaceStatusCopy(
  source: MarketplaceSelectionSource,
  selectedMarketplace: PublicMarketplace,
  detectedMarketplace: PublicMarketplace | null
) {
  if (source === "query") {
    return `Showing ${selectedMarketplace} because you selected it on this page.`;
  }

  if (source === "cookie") {
    return `Showing ${selectedMarketplace} from your last saved marketplace choice.`;
  }

  if (source === "geo" && detectedMarketplace) {
    return `We detected ${detectedMarketplace} from your location and selected it automatically.`;
  }

  return `Showing ${selectedMarketplace} as the default marketplace for this visit.`;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { products, posts, selectedMarketplace, selectionSource, detectedMarketplace } =
    loaderData as HomeLoaderData;
  const { featuredPost, supportingPosts, primaryProducts, trendingProducts, topDealProducts } =
    buildHomePageSections({
      posts,
      products,
    });
  const comparisonGroups = buildComparisonGroups(primaryProducts);
  const statusCopy = getMarketplaceStatusCopy(
    selectionSource,
    selectedMarketplace,
    detectedMarketplace
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_34%,#f4f6f6_100%)]">
      <section className="border-b border-gray-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-primary">
              {HOME_HERO_EYEBROW}
            </p>
            <h1 className="max-w-xl text-4xl font-black leading-tight text-gray-950 md:text-6xl">
              Blog-first product research that turns traffic into informed buyers
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-gray-600 md:text-lg">
              DealsRky now leads with editorial content. Visitors discover buying guides,
              comparisons, and practical articles first, then move into marketplace-aware
              product pages when they want to evaluate a specific item.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/blog"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Read latest articles
              </Link>
              <Link
                to="/deals"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-6 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
              >
                Browse product pages
              </Link>
            </div>
          </div>

          <div className="w-full max-w-xl rounded-[2rem] border border-white/60 bg-[#0d1e1e] p-6 text-white shadow-[0_30px_80px_-35px_rgba(8,102,102,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-primary/80">
                  Supported Marketplaces
                </p>
                <h2 className="mt-2 text-2xl font-bold">Research First, Then Continue</h2>
              </div>
              <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80">
                Editorial guidance
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {marketplaceLabels.map((label) => (
                <Link
                  key={label}
                  to={`/?market=${label}`}
                  onClick={() => {
                    document.cookie = `preferred_marketplace=${encodeURIComponent(label)}; Path=/; Max-Age=31536000; SameSite=Lax`;
                  }}
                  className={`group rounded-2xl border px-4 py-4 transition-all ${
                    label === selectedMarketplace
                      ? "border-primary bg-primary/20 shadow-[0_18px_45px_-28px_rgba(255,153,0,0.65)]"
                      : "border-white/10 bg-white/5 hover:border-primary/35 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/50">
                        Marketplace
                      </p>
                      <p className="mt-2 text-xl font-bold">{label}</p>
                    </div>
                    {label === selectedMarketplace ? (
                      <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-black">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-white/70">
                    {label === selectedMarketplace
                      ? "This marketplace is currently active across the homepage feed."
                      : "Switch the page to this country’s storefront picks."}
                  </p>
                  {detectedMarketplace === label && label !== selectedMarketplace ? (
                    <div className="mt-3 inline-flex rounded-full border border-sky-300/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-sky-200">
                      Suggested for your location
                    </div>
                  ) : null}
                  {detectedMarketplace === label && label === selectedMarketplace && selectionSource === "geo" ? (
                    <div className="mt-3 inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-200">
                      Auto-selected for you
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/10 p-5">
              <p className="text-sm leading-6 text-white/85">
                {statusCopy}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Choose any country card above to instantly switch the homepage feed,
                then continue through the matching marketplace when you open a product.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickAccessLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-bold text-gray-700 transition hover:border-primary hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 lg:px-6">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="rounded-[2rem] border border-gray-200 bg-[linear-gradient(135deg,#0f2020_0%,#153f3f_55%,#1b5656_100%)] px-6 py-8 text-white shadow-[0_24px_70px_-40px_rgba(15,64,64,0.6)] md:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary/90">
                Today&apos;s Best Amazon Deals
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight md:text-5xl">
                Discover top-rated Amazon finds before everyone else
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
                Fresh picks updated daily for shoppers in the US, Canada, and Europe. Explore trending products, compare smarter, and jump to the best fit when you are ready to buy.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/deals"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  Shop Latest Deals
                </Link>
                <Link
                  to="/blog"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:border-white/50"
                >
                  See Smart Buying Guides
                </Link>
              </div>
            </div>

            <div className="mt-10 flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                  Latest 30 Products
                </p>
                <h2 className="mt-2 text-3xl font-black text-gray-950">
                  30 fresh product picks worth checking today
                </h2>
              </div>
              <Link
                to="/deals"
                className="text-sm font-bold text-primary transition-colors hover:text-primary-hover"
              >
                View all deals
              </Link>
            </div>

            {primaryProducts.length > 0 ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {primaryProducts.map((product, index) => (
                  <ProductCard
                    key={`${product.source_type}-${product.id}-${product.agent_slug ?? "default"}-primary`}
                    item={{
                      ...product,
                      title: getHomepageKeywordLabel(product.category, product.title, index),
                    }}
                    href={product.public_href}
                    variant="homepageCompact"
                    badgeLabel="Popular pick"
                    description={`Buyer-friendly pick for ${selectedMarketplace} shoppers looking for a smarter option.`}
                    primaryCtaLabel="Check Price"
                    secondaryCtaLabel="Details Check"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <h3 className="text-lg font-bold text-gray-900">Check back soon for new recommendations</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Our editors are reviewing the next batch of product pages and buying guides.
                  Please check back shortly.
                </p>
              </div>
            )}

            <div className="mt-14 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                    Quick Comparisons
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-gray-950">
                    Compare similar picks before you choose one
                  </h2>
                </div>
                <Link
                  to="/blog"
                  className="text-sm font-bold text-primary transition-colors hover:text-primary-hover"
                >
                  View buying guides
                </Link>
              </div>

              {comparisonGroups.length > 0 ? (
                <div className="mt-6 grid gap-6">
                  {comparisonGroups.map((group) => (
                    <div key={group.category} className="overflow-hidden rounded-[1.5rem] border border-gray-200">
                      <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
                          Comparison Table
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-gray-900">
                          Related {group.category} products
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {group.products.map((product, index) => (
                          <div
                            key={`${group.category}-${product.asin}`}
                            className="grid gap-4 px-5 py-4 md:grid-cols-[88px_minmax(0,1fr)_auto]"
                          >
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#f5f8f8] p-3">
                              <img
                                src={product.image_url}
                                alt={product.title || product.asin}
                                className="max-h-full max-w-full object-contain mix-blend-multiply"
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">
                                Product Image
                              </p>
                              <h4 className="mt-2 text-base font-semibold text-gray-900">
                                {product.title}
                              </h4>
                              <p className="mt-2 text-sm leading-6 text-gray-600">
                                {getHomepageKeywordLabel(product.category, product.title || product.asin, index)}
                              </p>
                            </div>
                            <div className="flex items-center">
                              <Link
                                to={product.public_href}
                                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                              >
                                Check Price
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                  Comparison tables will appear automatically when enough related products are available in the same category.
                </div>
              )}
            </div>

            <section className="mt-14">
              <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                    Fresh Articles
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-gray-950">
                    Helpful buying guides with featured images
                  </h2>
                </div>
                <Link
                  to="/blog"
                  className="text-sm font-bold text-primary transition-colors hover:text-primary-hover"
                >
                  Visit the blog
                </Link>
              </div>

              {featuredPost ? (
                <div className="mt-8 grid gap-6">
                  <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
                    <Link to={`/blog/${featuredPost.slug}`} className="block h-full bg-[#edf5f5]">
                      {featuredPost.cover_image_url ? (
                        <img
                          src={featuredPost.cover_image_url}
                          alt={featuredPost.cover_image_alt || featuredPost.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[280px] items-center justify-center bg-[linear-gradient(135deg,#103737_0%,#185757_100%)] text-white">
                          <span className="text-xs font-bold uppercase tracking-[0.35em] text-white/75">
                            Featured article
                          </span>
                        </div>
                      )}
                    </Link>

                    <div className="p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                        Featured article
                      </p>
                      <h3 className="mt-4 text-3xl font-black leading-tight text-gray-950">
                        <Link to={`/blog/${featuredPost.slug}`} className="transition-colors hover:text-primary">
                          {featuredPost.title}
                        </Link>
                      </h3>
                      <p className="mt-4 text-base leading-8 text-gray-600">
                        {featuredPost.excerpt_text || featuredPost.excerpt || ""}
                      </p>
                      <Link
                        to={`/blog/${featuredPost.slug}`}
                        className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                      >
                        Read featured article
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {supportingPosts.length > 0
                      ? supportingPosts.map((post) => <BlogCard key={post.id} post={post} />)
                      : editorialHighlights.map((item) => (
                          <article
                            key={item.title}
                            className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                          >
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                              Our Promise
                            </p>
                            <h3 className="mt-4 text-2xl font-bold text-gray-900">
                              {item.title}
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                              {item.description}
                            </p>
                          </article>
                        ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
                  <h3 className="text-lg font-bold text-gray-900">Blog articles are coming soon</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    We are preparing comparison posts, buying guides, and deeper product research pieces.
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                Trending Deals
              </p>
              <div className="mt-5 grid gap-3">
                {trendingProducts.length > 0 ? (
                  trendingProducts.map((product, index) => (
                    <Link
                      key={`${product.source_type}-${product.id}-${product.agent_slug ?? "default"}-trending`}
                      to={product.public_href}
                      className="rounded-2xl border border-gray-200 px-4 py-4 transition hover:border-primary hover:bg-primary/5"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                        {getHomepageKeywordLabel(product.category, product.title, index)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
                        {product.title}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    More trending products will show up here as soon as new listings are published.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                Email Subscription
              </p>
              <h3 className="mt-3 text-2xl font-bold text-gray-900">
                Get the best deals in your inbox
              </h3>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                Join the list for fresh product finds, trending picks, and daily deal updates designed for serious Amazon shoppers.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  Join Free Email Alerts
                </Link>
                <Link
                  to="/contact"
                  className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  Get Telegram / WhatsApp updates
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                Social Media Links
              </p>
              <div className="mt-5 grid gap-3">
                {socialLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                Marketplace Scope
              </p>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                Built for shoppers in the USA, Canada, and Europe. We avoid fixed price mentions so product recommendations stay useful across multiple Amazon marketplaces.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                Top 10 Deals Today
              </p>
              <div className="mt-5 grid gap-3">
                {topDealProducts.length > 0 ? (
                  topDealProducts.slice(0, 5).map((product) => (
                    <Link
                      key={`${product.source_type}-${product.id}-${product.agent_slug ?? "default"}-top`}
                      to={product.public_href}
                      className="rounded-2xl border border-gray-200 px-4 py-4 transition hover:border-primary hover:bg-primary/5"
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                        {product.title}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    Top deal cards will appear here when more homepage products are available.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              Original Content
            </p>
            <h2 className="mt-3 text-3xl font-black text-gray-950 md:text-5xl">
              Why Trust DealsRky? Our Methodology & Compliance
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              DealsRky is built to help you research products before you continue to Amazon. We summarize relevant details,
              compare marketplace coverage, and keep our public pages focused on clear editorial guidance instead of urgency-led sales copy.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-[2rem] bg-gray-50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-bold text-gray-900">Independent Research</h3>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                We independently research and curate all products. We do not accept payment to feature specific items in our regular catalog, ensuring unbiased recommendations.
              </p>
            </div>
            
            <div className="rounded-[2rem] bg-gray-50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-bold text-gray-900">Affiliate Disclosure</h3>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                As an Amazon Associate, we earn from qualifying purchases. This means if you click on a retailer link and make a purchase, we may earn a small commission at no additional cost to you.
              </p>
            </div>

            <div className="rounded-[2rem] bg-gray-50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-bold text-gray-900">Live Retailer Pricing</h3>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                Prices fluctuate constantly. To avoid confusion, we link directly to the retailer's checkout page so you can see the guaranteed live price and shipping details.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              Fresh Articles
            </p>
            <h2 className="mt-2 text-3xl font-black text-gray-950">
              Research-driven buying advice
            </h2>
          </div>
          <Link
            to="/blog"
            className="text-sm font-bold text-primary transition-colors hover:text-primary-hover"
          >
            Visit the blog
          </Link>
        </div>

        {posts.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <h3 className="text-lg font-bold text-gray-900">Blog articles are coming soon</h3>
            <p className="mt-2 text-sm text-gray-600">
              We are preparing comparison posts, buying guides, and deeper product research pieces.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
