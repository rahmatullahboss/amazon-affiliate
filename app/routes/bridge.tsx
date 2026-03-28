import type { Route } from "./+types/bridge";
import "./bridge.css";
import { recordView } from "../../server/services/analytics";

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
    { title: `${pageData.product.title} — Buy on Amazon` },
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

  const { env, ctx } = context.cloudflare;

  // Direct D1 access — no HTTP fetch, no network hop, sub-millisecond
  const row = await env.DB.prepare(
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

  if (!row) {
    throw new Response("Product not found", { status: 404 });
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
    : [data.product.imageUrl];
  const aplusImages = data.product.aplusImages ?? [];
  const features = data.product.features ?? [];

  return (
    <div className="bridge-page">
      {/* Header */}
      <header className="bridge-header">
        <div className="bridge-logo">
          <span className="bridge-logo-icon">D</span>
          <span>DealsRky</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="bridge-main">
        <article className="product-card">
          {/* Product Image */}
          <div className="product-image-container">
            <span className="product-badge">Amazon Verified</span>
            <img
              src={data.product.imageUrl}
              alt={data.product.title}
              className="product-image"
              loading="eager"
              fetchPriority="high"
              width="400"
              height="400"
            />
          </div>

          {/* Product Info */}
          <div className="product-info">
            <h1 className="product-title">{data.product.title}</h1>
            {data.product.description ? (
              <p className="product-description">{data.product.description}</p>
            ) : null}
            {features.length > 0 ? (
              <ul className="feature-list">
                {features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Buy Button */}
          <div className="buy-button-container">
            <a
              href={data.redirectUrl}
              className="buy-button"
              rel="noopener noreferrer nofollow sponsored"
              id="buy-on-amazon-btn"
            >
              <span className="buy-button-icon">🛒</span>
              <span className="buy-button-text">
                <span className="buy-button-label">Buy on Amazon</span>
                <span className="buy-button-subtitle">Fast &amp; Secure Checkout</span>
              </span>
            </a>
          </div>

          {/* Trust Signals */}
          <div className="trust-signals">
            <div className="trust-item">
              <span className="trust-icon">✓</span>
              <span>Amazon Verified</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon">✓</span>
              <span>Secure Checkout</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon">✓</span>
              <span>Fast Delivery</span>
            </div>
          </div>
        </article>

        {galleryImages.length > 1 ? (
          <section className="bridge-section">
            <h2 className="bridge-section-title">Product images</h2>
            <div className="image-grid">
              {galleryImages.map((image, index) => (
                <div key={`${image}-${index}`} className="gallery-card">
                  <img
                    src={image}
                    alt={`${data.product.title} image ${index + 1}`}
                    className="gallery-image"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {aplusImages.length > 0 ? (
          <section className="bridge-section">
            <h2 className="bridge-section-title">More product details</h2>
            <div className="aplus-stack">
              {aplusImages.map((image, index) => (
                <div key={`${image}-${index}`} className="aplus-card">
                  <img
                    src={image}
                    alt={`${data.product.title} detail ${index + 1}`}
                    className="aplus-image"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {/* Affiliate Disclosure — REQUIRED by Amazon Associates TOS */}
      <footer className="bridge-footer">
        <p className="affiliate-disclosure">
          Affiliate Disclosure: As an Amazon Associate, we earn from qualifying
          purchases. This page contains affiliate links, which means we may
          receive a commission at no additional cost to you when you click through
          and make a purchase on Amazon. Product prices and availability are
          subject to change. We encourage you to verify current pricing on Amazon.
        </p>
      </footer>
    </div>
  );
}
