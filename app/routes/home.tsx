import type { Route } from "./+types/home";
import { Link } from "react-router";
import { ProductCard } from "../components/home/ProductCard";
import { BlogCard } from "../components/blog/BlogCard";
import { MarketplaceSelector } from "../components/MarketplaceSelector";
import {
  buildSeoMeta,
  toSiteBrandingMeta,
} from "../utils/seo";
import {
  HOME_HERO_EYEBROW,
  HOME_HERO_TITLE,
} from "../utils/affiliate-copy";
import { resolvePreferredMarketplace, type PublicMarketplace } from "../utils/marketplace";
import { buildBlogExcerpt, buildBlogImageUrl, estimateReadingMinutes } from "../../server/services/blog";
import type { BlogPostSummary } from "../utils/blog";

interface ProductRow {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  category: string | null;
  marketplace: string | null;
  created_at: string;
}

interface HomeLoaderData {
  products: ProductRow[];
  posts: BlogPostSummary[];
  selectedMarketplace: PublicMarketplace;
  siteBranding: {
    og_site_name: string;
    og_description: string;
    og_image_url: string;
  } | null;
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
  const selectedMarketplace = resolvePreferredMarketplace({
    searchParams: url.searchParams,
    cookieHeader: request.headers.get("cookie"),
    countryHeader: request.headers.get("cf-ipcountry"),
  });

  const [productsResult, postsResult] = await Promise.all([
    env.DB.prepare(
      `
        SELECT id, asin, title, image_url, category, marketplace, created_at
        FROM products
        WHERE is_active = 1 AND status = 'active' AND marketplace = ?
        ORDER BY created_at DESC
        LIMIT 36
      `
    ).bind(selectedMarketplace).all<ProductRow>(),
    env.DB.prepare(
      `SELECT *
       FROM blog_posts
       WHERE is_deleted = 0 AND status = 'published'
       ORDER BY is_featured DESC, published_at DESC, updated_at DESC
       LIMIT 3`
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

  const posts = (postsResult.results || []).map((row) => ({
    ...row,
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
    reading_minutes: estimateReadingMinutes(row.content),
  }));

  return {
    products: productsResult.results || [],
    posts,
    selectedMarketplace,
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

export default function Home({ loaderData }: Route.ComponentProps) {
  const { products, posts, selectedMarketplace } = loaderData as HomeLoaderData;
  const featuredProducts = products.slice(0, 6);
  const latestProducts = products.slice(6, 12);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_34%,#f4f6f6_100%)]">
      <section className="border-b border-gray-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-primary">
              {HOME_HERO_EYEBROW}
            </p>
            <h1 className="max-w-xl text-4xl font-black leading-tight text-gray-950 md:text-6xl">
              {HOME_HERO_TITLE}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-gray-600 md:text-lg">
              DealsRky publishes concise buying guidance, curated recommendations,
              and marketplace-aware product pages so you can compare options before
              continuing to Amazon for current pricing and checkout.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/deals"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Browse curated picks
              </Link>
              <Link
                to="/disclosure"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-6 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
              >
                Read affiliate disclosure
              </Link>
            </div>
            <div className="mt-5">
              <MarketplaceSelector
                selectedMarketplace={selectedMarketplace}
                label="Showing products for"
              />
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
               <div
                  key={label}
                  className={`rounded-2xl border px-4 py-4 ${
                    label === selectedMarketplace
                      ? "border-primary/50 bg-primary/15"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">
                    Marketplace
                  </p>
                  <p className="mt-2 text-xl font-bold">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/10 p-5">
              <p className="text-sm leading-6 text-white/85">
                Use DealsRky to review product context and compare marketplace
                availability before you continue to Amazon.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {editorialHighlights.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Our Promise
              </p>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              Editor's picks
            </p>
            <h2 className="mt-2 text-3xl font-black text-gray-950">
              Recent recommendations worth reviewing
            </h2>
          </div>
          <Link
            to="/deals"
            className="text-sm font-bold text-primary transition-colors hover:text-primary-hover"
          >
            View full catalog
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} item={product} />
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
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="grid gap-8 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-black text-gray-950">
              Simple path from product research to the final retailer page
            </h2>
            <div className="mt-8 grid gap-5">
              {[
                "We review catalog data, product positioning, and marketplace availability before publishing a page.",
                "You browse concise research notes, comparisons, and recommendation summaries without clutter.",
                "When you are ready, continue to Amazon to review live pricing, shipping, and final checkout details.",
              ].map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl bg-gray-50 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-gray-700">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-[#edf4f4] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              Fresh catalog
            </p>
            <h3 className="mt-3 text-2xl font-bold text-gray-900">Recently published</h3>
            <div className="mt-6 grid gap-4">
              {latestProducts.length > 0 ? (
                latestProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/deals/${product.asin}`}
                    className="rounded-2xl border border-white bg-white p-4 transition-transform hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                      {product.marketplace || "US"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
                      {product.title}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                  No recent products yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="rounded-[2.5rem] bg-gray-900 px-6 py-16 text-center text-white sm:px-12 sm:py-20 lg:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
            Featured guide
          </p>
          <h2 className="mt-4 text-3xl font-black md:text-5xl">
            Start with practical buying guides, not rush-driven deals
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-300">
            DealsRky works best when you use product pages and articles for research first, then continue to Amazon for the latest price, delivery details, reviews, and checkout.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/blog"
              className="rounded-full bg-primary px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Read the Buying Guide
            </Link>
            <Link
              to="/deals"
              className="rounded-full border border-gray-600 px-8 py-4 text-sm font-bold text-white transition-colors hover:border-gray-400 hover:text-white"
            >
              Browse curated picks
            </Link>
          </div>
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
