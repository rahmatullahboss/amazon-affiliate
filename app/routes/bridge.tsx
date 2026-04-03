import type { Route } from "./+types/bridge";
import { Link, redirect } from "react-router";
import { useEffect, type MouseEvent } from "react";
import { ImageGallery } from "../components/product/ImageGallery";
import { recordView } from "../../server/services/analytics";
import {
  DynamicLinkResolutionError,
  ensureDynamicLinkByAgentSlug,
  hasAgentMarketplaceCandidate,
  resolveAgentProductBySlug,
} from "../../server/services/dynamic-links";
import {
  AMAZON_DESTINATION_NOTE,
  AMAZON_PRIMARY_CTA_LABEL,
  AMAZON_SECONDARY_CTA_LABEL,
  INLINE_AFFILIATE_DISCLOSURE,
} from "../utils/affiliate-copy";
import { getProductEditorialSections } from "../utils/product-detail";
import {
  buildCanonicalRedirectPath,
  normalizeMarketplaceHint,
} from "../../server/utils/url";
import { getZarazAttributionPayload, setZarazContext, trackZaraz } from "../utils/zaraz";
import {
  buildCanonicalUrl,
  DEFAULT_OG_IMAGE_URL,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
} from "../utils/seo";

// ─── Types ───────────────────────────────────────
interface BridgeData {
  agent: { slug: string; name: string };
  product: {
    asin: string;
    title: string;
    imageUrl: string;
    reviewContent?: string | null;
    productImages?: string[];
    aplusImages?: string[];
  };
  redirectUrl: string;
  marketplace: string;
}

function buildEditorialExcerpt(reviewContent: string | null, title: string): string {
  const firstMeaningfulLine = reviewContent
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("•"));

  if (firstMeaningfulLine) {
    return firstMeaningfulLine;
  }

  return `Continue to the final retailer page for the latest price, delivery details, and checkout for ${title}.`;
}

// ─── Meta ────────────────────────────────────────
export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [
      { title: DEFAULT_SITE_TITLE },
      { name: "description", content: DEFAULT_SITE_DESCRIPTION },
      { property: "og:title", content: DEFAULT_SITE_TITLE },
      { property: "og:description", content: DEFAULT_SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildCanonicalUrl("/") },
      { property: "og:site_name", content: DEFAULT_SITE_TITLE },
      { property: "og:image", content: DEFAULT_OG_IMAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: DEFAULT_SITE_TITLE },
      { name: "twitter:description", content: DEFAULT_SITE_DESCRIPTION },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE_URL },
    ];
  }

  const pageData = data as BridgeData;
  const canonicalPath = `/${pageData.agent.slug}/${pageData.marketplace.toLowerCase()}/${pageData.product.asin}`;
  return [
    { title: `${pageData.product.title} — Product Overview` },
    {
      name: "description",
      content: buildEditorialExcerpt(pageData.product.reviewContent ?? null, pageData.product.title),
    },
    { property: "og:title", content: pageData.product.title },
    { property: "og:description", content: buildEditorialExcerpt(pageData.product.reviewContent ?? null, pageData.product.title) },
    { property: "og:image", content: pageData.product.imageUrl },
    { property: "og:type", content: "product" },
    { property: "og:url", content: buildCanonicalUrl(canonicalPath) },
    { property: "og:site_name", content: DEFAULT_SITE_TITLE },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: pageData.product.title },
    { name: "twitter:description", content: buildEditorialExcerpt(pageData.product.reviewContent ?? null, pageData.product.title) },
    { name: "twitter:image", content: pageData.product.imageUrl },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

// ─── Server Loader (ZERO-HOP D1 ACCESS) ─────────
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { agent: agentSlug, asin, country } = params;

  if (!agentSlug || !asin) {
    throw new Response("Invalid link", { status: 400 });
  }

  const storefrontPath = `/${agentSlug}`;
  const countryMarketplace = country ? normalizeMarketplaceHint(country) : null;

  if (country && !countryMarketplace) {
    throw new Response("Product page not found", { status: 404 });
  }

  const preferredMarketplace =
    countryMarketplace ?? normalizeMarketplaceHint(new URL(request.url).searchParams.get("m"));

  const { env, ctx } = context.cloudflare;
  const workerEnv = env as Env & { AMAZON_API_KEY_FALLBACK?: string };

const loadBridgeResolution = async () => {
    const directResolution = await resolveAgentProductBySlug({
      db: env.DB,
      agentSlug,
      asin,
      preferredMarketplace,
    });

    if (directResolution) {
      return directResolution;
    }

    if (
      preferredMarketplace &&
      !(await hasAgentMarketplaceCandidate(env.DB, agentSlug, preferredMarketplace))
    ) {
      throw new Response("Product page not found", { status: 404 });
    }

    try {
      await ensureDynamicLinkByAgentSlug({
        db: workerEnv.DB,
        kv: workerEnv.KV,
        agentSlug,
        asin,
        preferredMarketplace,
        apiKey: workerEnv.AMAZON_API_KEY,
        fallbackApiKeys: workerEnv.AMAZON_API_KEY_FALLBACK
          ? [workerEnv.AMAZON_API_KEY_FALLBACK]
          : [],
      });
    } catch (error) {
      if (error instanceof DynamicLinkResolutionError) {
        if (error.status === 404) {
          throw new Response("Product page not found", { status: 404 });
        }

        throw redirect(storefrontPath);
      }

      throw error;
    }

    return await resolveAgentProductBySlug({
      db: env.DB,
      agentSlug,
      asin,
      preferredMarketplace,
    });
  };

  let resolution = await loadBridgeResolution();

  if (!resolution) {
    throw redirect(storefrontPath);
  }

  if (!country) {
    const canonicalLocation = buildCanonicalBridgeRedirectLocation(
      request.url,
      `/${resolution.row.agent_slug}/${resolution.resolvedMarketplace.toLowerCase()}/${resolution.row.asin}`
    );

    throw redirect(canonicalLocation);
  }

  const { row } = resolution;

  // Record page view asynchronously with waitUntil (zero impact on render)
  ctx.waitUntil(
    (async () => {
      try {
        await recordView(env.DB, {
          agentId: row.agent_id,
          productId: row.product_id,
          ipHash: null,
          userAgent: null,
          referer: null,
          country: null,
        });
      } catch (e) {
        console.error("[Bridge] View tracking error:", e);
      }
    })()
  );

  const data: BridgeData = {
    agent: { slug: row.agent_slug, name: row.agent_name },
    product: {
      asin: row.asin,
      title: row.custom_title || row.product_title,
      imageUrl: row.image_url,
      reviewContent: row.review_content ?? null,
      productImages: parseJsonArray(row.product_images),
      aplusImages: parseJsonArray(row.aplus_images),
    },
    redirectUrl: buildCanonicalRedirectPath(row.agent_slug, row.asin, row.marketplace),
    marketplace: row.marketplace,
  };

  return data;
}

function buildCanonicalBridgeRedirectLocation(requestUrl: string, pathname: string): string {
  const url = new URL(requestUrl);
  url.pathname = pathname;
  url.searchParams.delete("m");
  return `${url.pathname}${url.search}${url.hash}`;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

// ─── Component ───────────────────────────────────
export default function BridgePage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as BridgeData;
  const galleryImages = data.product.productImages?.length
    ? data.product.productImages
    : [];
  const editorialSections = getProductEditorialSections(data.product.reviewContent ?? null);
  useEffect(() => {
    const context = {
      page_type: "bridge",
      agent_slug: data.agent.slug,
      agent_name: data.agent.name,
      asin: data.product.asin,
      marketplace: data.marketplace,
    };

    setZarazContext(context);
    void trackZaraz("bridge_view", {
      ...context,
      ...getZarazAttributionPayload(),
    });
  }, [
    data.agent.name,
    data.agent.slug,
    data.marketplace,
    data.product.asin,
  ]);

  const handleAmazonClick =
    (ctaPlacement: "mobile" | "primary" | "secondary") =>
    (event: MouseEvent<HTMLAnchorElement>) => {
      const isModifiedClick =
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey;

      const eventPayload = {
        page_type: "bridge",
        cta_placement: ctaPlacement,
        destination: "amazon",
        agent_slug: data.agent.slug,
        agent_name: data.agent.name,
        asin: data.product.asin,
        marketplace: data.marketplace,
        ...getZarazAttributionPayload(),
      };

      if (isModifiedClick) {
        void trackZaraz("amazon_click", eventPayload);
        return;
      }

      event.preventDefault();

      let hasNavigated = false;
      const navigateToAmazon = () => {
        if (hasNavigated) {
          return;
        }

        hasNavigated = true;
        window.location.assign(data.redirectUrl);
      };

      const fallbackTimer = window.setTimeout(navigateToAmazon, 150);

      void trackZaraz("amazon_click", eventPayload).finally(() => {
        window.clearTimeout(fallbackTimer);
        navigateToAmazon();
      });
    };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_25%,#f4f6f6_100%)]">
      <div className="border-b border-gray-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-4 text-sm text-gray-500 lg:px-6">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <span>/</span>
          <Link to="/deals" className="hover:text-primary">
            Deals
          </Link>
          <span>/</span>
          <span>{data.product.asin}</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 pb-28 lg:px-6 lg:pb-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <ImageGallery
              mainImage={data.product.imageUrl}
              galleryImages={galleryImages}
              title={data.product.title}
            />
          </section>

          <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-primary">
                {data.marketplace}
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-black leading-tight text-gray-950 md:text-4xl">
              {data.product.title}
            </h1>

            {data.product.reviewContent ? (
              <div className="mt-5 rounded-[1.5rem] border border-gray-200 bg-gray-50/80 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                  Editorial Summary
                </p>
                <div className="mt-4 space-y-4">
                  {editorialSections.map((section, index) => (
                    <div
                      key={`${section.heading}-${index}`}
                      className="rounded-2xl border border-gray-200 bg-white/90 p-4"
                    >
                      <p className="text-sm font-bold text-gray-900">{section.heading}</p>
                      {section.body ? (
                        <p className="mt-2 text-sm leading-7 text-gray-700">{section.body}</p>
                      ) : null}
                      {section.bullets.length > 0 ? (
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Retail checkout
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                Continue for live pricing
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                This link is tracked for the assigned agent. Final price, delivery,
                availability, and reviews are always shown on the retailer page.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={data.redirectUrl}
                rel="nofollow sponsored"
                onClick={handleAmazonClick("primary")}
                className="hidden items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover sm:inline-flex"
              >
                {AMAZON_PRIMARY_CTA_LABEL}
              </a>
              <a
                href={data.redirectUrl}
                rel="nofollow sponsored"
                onClick={handleAmazonClick("secondary")}
                className="hidden items-center justify-center rounded-full border border-gray-300 px-6 py-3.5 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary sm:inline-flex"
              >
                {AMAZON_SECONDARY_CTA_LABEL}
              </a>
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              {AMAZON_DESTINATION_NOTE}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              {INLINE_AFFILIATE_DISCLOSURE}
            </p>

          </section>
        </div>

        <section className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-6 text-sm leading-7 text-gray-600 shadow-sm md:p-8">
          <p>
            Affiliate Disclosure: As an Amazon Associate, we earn from qualifying purchases. This page contains affiliate links, which means we may
            receive a commission at no additional cost to you when you click through
            and make a purchase on the retailer page. Product prices and availability are
            subject to change. Always verify current pricing before buying.
          </p>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <a
          href={data.redirectUrl}
          rel="nofollow sponsored"
          onClick={handleAmazonClick("mobile")}
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          {AMAZON_PRIMARY_CTA_LABEL}
        </a>
      </div>
    </div>
  );
}
