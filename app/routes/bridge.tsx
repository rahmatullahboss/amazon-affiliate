import type { Route } from "./+types/bridge";
import { Link, redirect } from "react-router";
import { useEffect, type MouseEvent } from "react";
import { ImageGallery } from "../components/product/ImageGallery";
import { recordView } from "../../server/services/analytics";
import {
  DynamicLinkResolutionError,
  ensureDynamicLinkByAgentSlug,
} from "../../server/services/dynamic-links";
import { getZarazAttributionPayload, setZarazContext, trackZaraz } from "../utils/zaraz";

// ─── Types ───────────────────────────────────────
interface BridgeData {
  agent: { slug: string; name: string };
  product: {
    asin: string;
    title: string;
    imageUrl: string;
    description?: string | null;
    features?: string[];
    productImages?: string[];
    aplusImages?: string[];
  };
  redirectUrl: string;
  marketplace: string;
}

// ─── Meta ────────────────────────────────────────
export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [
      { title: "Product Not Found — DealsRky" },
      { name: "description", content: "The requested product page could not be found." },
    ];
  }

  const pageData = data as BridgeData;
  return [
    { title: `${pageData.product.title} — View on Amazon` },
    {
      name: "description",
      content: `Check out ${pageData.product.title} on Amazon. Verified product with secure checkout.`,
    },
    { property: "og:title", content: pageData.product.title },
    { property: "og:description", content: `Shop ${pageData.product.title} on Amazon with confidence.` },
    { property: "og:image", content: pageData.product.imageUrl },
    { property: "og:type", content: "product" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: pageData.product.title },
    { name: "twitter:image", content: pageData.product.imageUrl },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

// ─── Server Loader (ZERO-HOP D1 ACCESS) ─────────
export async function loader({ params, context }: Route.LoaderArgs) {
  const { agent: agentSlug, asin } = params;

  if (!agentSlug || !asin) {
    throw new Response("Invalid link", { status: 400 });
  }

  const storefrontPath = `/${agentSlug}`;

  const { env, ctx } = context.cloudflare;
  const workerEnv = env as Env & { AMAZON_API_KEY_FALLBACK?: string };

  const loadBridgeRow = async () =>
    env.DB.prepare(
      `SELECT
         a.slug as agent_slug, a.name as agent_name, a.id as agent_id,
         p.asin, p.title as product_title, p.image_url, p.description, p.features,
         p.product_images, p.aplus_images, p.id as product_id,
         t.tag as tracking_tag, t.marketplace,
         ap.custom_title
       FROM agent_products ap
       JOIN agents a ON a.id = ap.agent_id
       JOIN products p ON p.id = ap.product_id
       JOIN tracking_ids t ON t.id = ap.tracking_id
       WHERE a.slug = ? AND p.asin = ?
         AND ap.is_active = 1 AND a.is_active = 1 AND p.is_active = 1 AND p.status = 'active'
       LIMIT 1`
    )
      .bind(agentSlug, asin)
      .first<{
        agent_slug: string;
        agent_name: string;
        agent_id: number;
        asin: string;
        product_title: string;
        image_url: string;
        description: string | null;
        features: string | null;
        product_images: string | null;
        aplus_images: string | null;
        product_id: number;
        tracking_tag: string;
        marketplace: string;
        custom_title: string | null;
      }>();

  let row = await loadBridgeRow();

  if (!row) {
    try {
      await ensureDynamicLinkByAgentSlug({
        db: workerEnv.DB,
        kv: workerEnv.KV,
        agentSlug,
        asin,
        apiKey: workerEnv.AMAZON_API_KEY,
        fallbackApiKeys: workerEnv.AMAZON_API_KEY_FALLBACK
          ? [workerEnv.AMAZON_API_KEY_FALLBACK]
          : [],
      });
    } catch (error) {
      if (error instanceof DynamicLinkResolutionError) {
        throw redirect(storefrontPath);
      }

      throw error;
    }

    row = await loadBridgeRow();
  }

  if (!row) {
    throw redirect(storefrontPath);
  }

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
      description: row.description,
      features: parseJsonArray(row.features),
      productImages: parseJsonArray(row.product_images),
      aplusImages: parseJsonArray(row.aplus_images),
    },
    redirectUrl: `/go/${row.agent_slug}/${row.asin}`,
    marketplace: row.marketplace,
  };

  return data;
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
  const aplusImages = data.product.aplusImages ?? [];
  const features = data.product.features ?? [];

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

      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-4 md:hidden">
              <a
                href={data.redirectUrl}
                rel="nofollow sponsored"
                onClick={handleAmazonClick("mobile")}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Continue to Amazon
              </a>
            </div>
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

            {data.product.description ? (
              <p className="mt-5 text-sm leading-7 text-gray-600">{data.product.description}</p>
            ) : null}

            <div className="mt-6 rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Amazon checkout
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                Continue to Amazon for live pricing
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                This link is tracked for the assigned agent. Final price, delivery,
                availability, and reviews are always shown on Amazon.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={data.redirectUrl}
                rel="nofollow sponsored"
                onClick={handleAmazonClick("primary")}
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                View on Amazon
              </a>
              <a
                href={data.redirectUrl}
                rel="nofollow sponsored"
                onClick={handleAmazonClick("secondary")}
                className="hidden items-center justify-center rounded-full border border-gray-300 px-6 py-3.5 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary sm:inline-flex"
              >
                Continue securely
              </a>
            </div>

            {data.product.description ? (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h2 className="text-lg font-bold text-gray-900">Product overview</h2>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {data.product.description}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        {features.length > 0 ? (
          <section className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-black text-gray-950">Key features</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {features.map((feature) => (
                <div key={feature} className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                  {feature}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {aplusImages.length > 0 ? (
          <section className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                From the manufacturer
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-950">
                Product details
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              {aplusImages.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="overflow-hidden rounded-2xl border border-gray-100"
                >
                  <img
                    src={image}
                    alt={`${data.product.title} detail ${index + 1}`}
                    className="w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-6 text-sm leading-7 text-gray-600 shadow-sm md:p-8">
          <p>
            Affiliate Disclosure: As an Amazon Associate, we earn from qualifying
            purchases. This page contains affiliate links, which means we may
            receive a commission at no additional cost to you when you click through
            and make a purchase on Amazon. Product prices and availability are
            subject to change. We encourage you to verify current pricing on Amazon.
          </p>
        </section>
      </div>
    </div>
  );
}
