import type { Route } from "./+types/product-detail";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { ProductCard } from "../components/home/ProductCard";
import { ImageGallery } from "../components/product/ImageGallery";
import {
  getInitialPublicMarketplace,
  getProductEditorialSections,
  getProductDetailTitleClass,
  getPublicProductPageCallout,
} from "../utils/product-detail";
import {
  AMAZON_DESTINATION_NOTE,
  AMAZON_PRIMARY_CTA_LABEL,
  INLINE_AFFILIATE_DISCLOSURE,
} from "../utils/affiliate-copy";
import { buildSeoMeta } from "../utils/seo";
import { getZarazAttributionPayload, setZarazContext, trackZaraz } from "../utils/zaraz";
import { buildAmazonUrl } from "../../server/utils/types";

interface ProductRow {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  category: string | null;
  marketplace: string | null;
  review_content: string | null;
  product_images: string | null;
  aplus_images: string | null;
}

interface RelatedProductRow {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  category: string | null;
  marketplace: string | null;
}

interface ProductDetailData {
  product: ProductRow;
  relatedProducts: RelatedProductRow[];
  canonicalPath: string;
  availableMarketplaces: string[];
  amazonUrlsByMarketplace: Record<string, string>;
}

function buildEditorialExcerpt(reviewContent: string | null, title: string): string {
  const firstMeaningfulLine = reviewContent
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("•"));

  if (firstMeaningfulLine) {
    return firstMeaningfulLine;
  }

  return `Explore ${title} and continue to the final retailer page for the latest price, delivery details, and checkout.`;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Product Not Found | DealsRky" }];

  const { product } = data as ProductDetailData;

  return buildSeoMeta({
    title: `${product.title} | DealsRky`,
    description: buildEditorialExcerpt(product.review_content, product.title),
    path: (data as ProductDetailData).canonicalPath,
    imageUrl: product.image_url,
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const asin = params.asin;

  const { results: productMatches } = await env.DB
    .prepare(
      `
        SELECT id, asin, title, image_url, category, marketplace, review_content, product_images, aplus_images
        FROM products
        WHERE asin = ? AND is_active = 1 AND status = 'active'
        ORDER BY created_at DESC, id DESC
      `
    )
    .bind(asin)
    .all<ProductRow>();

  const product = productMatches[0] ?? null;

  if (!product) {
    throw new Response("Not Found", { status: 404 });
  }

  const availableMarketplaces = Array.from(
    new Set(
      productMatches
        .map((item) => item.marketplace?.trim().toUpperCase() || null)
        .filter((item): item is string => item !== null && item.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right));

  const amazonUrlsByMarketplace: Record<string, string> = {};

  if (availableMarketplaces.length > 0) {
    const placeholders = availableMarketplaces.map(() => "?").join(", ");
    const { results: trackingRows } = await env.DB
      .prepare(
        `
          SELECT marketplace, tag
          FROM tracking_ids
          WHERE is_active = 1
            AND is_site_primary = 1
            AND marketplace IN (${placeholders})
          ORDER BY marketplace ASC, id DESC
        `
      )
      .bind(...availableMarketplaces)
      .all<{ marketplace: string | null; tag: string }>();

    for (const trackingRow of trackingRows ?? []) {
      const marketplace = trackingRow.marketplace?.trim().toUpperCase() || null;
      if (!marketplace || amazonUrlsByMarketplace[marketplace]) {
        continue;
      }

      amazonUrlsByMarketplace[marketplace] = buildAmazonUrl(
        asin,
        trackingRow.tag,
        marketplace
      );
    }
  }

  const relatedQuery =
    product.category && product.category.trim().length > 0
      ? env.DB.prepare(
          `
            SELECT id, asin, title, image_url, category, marketplace
            FROM products
            WHERE category = ? AND asin != ? AND is_active = 1 AND status = 'active'
            LIMIT 4
          `
        ).bind(product.category, asin)
      : env.DB.prepare(
          `
            SELECT id, asin, title, image_url, category, marketplace
            FROM products
            WHERE asin != ? AND is_active = 1 AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 4
          `
        ).bind(asin);

  const { results: related } = await relatedQuery.all<RelatedProductRow>();

  return {
    product,
    relatedProducts: related || [],
    canonicalPath: `/deals/${asin}`,
    availableMarketplaces,
    amazonUrlsByMarketplace,
  } satisfies ProductDetailData;
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

export default function ProductDetail({ loaderData }: Route.ComponentProps) {
  const { product, relatedProducts, availableMarketplaces, amazonUrlsByMarketplace } = loaderData as ProductDetailData;
  const galleryImages = parseJsonArray(product.product_images);
  const publicProductCallout = getPublicProductPageCallout();
  const editorialSections = getProductEditorialSections(product.review_content);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(
    getInitialPublicMarketplace(availableMarketplaces, product.marketplace)
  );
  const selectedAmazonUrl = selectedMarketplace
    ? amazonUrlsByMarketplace[selectedMarketplace] || null
    : null;
  const filteredRelatedProducts = selectedMarketplace
    ? relatedProducts.filter((relatedProduct) => relatedProduct.marketplace === selectedMarketplace)
    : relatedProducts;
  useEffect(() => {
    const context = {
      page_type: "product_detail",
      asin: product.asin,
      marketplace: product.marketplace || "US",
      category: product.category || "general",
    };

    setZarazContext(context);
    void trackZaraz("product_detail_view", {
      ...context,
      ...getZarazAttributionPayload(),
    });
  }, [product.asin, product.category, product.marketplace]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_25%,#f4f6f6_100%)]">
      <div className="border-b border-gray-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-4 text-sm text-gray-500 lg:px-6">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <span>/</span>
          <Link to="/deals" className="hover:text-primary">
            Deals
          </Link>
          {product.category ? (
            <>
              <span>/</span>
              <span>{product.category}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 pb-28 lg:px-6 lg:pb-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:items-start">
          <section className="min-w-0 overflow-hidden rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6 md:p-8">
            <ImageGallery
              mainImage={product.image_url}
              galleryImages={galleryImages}
              title={product.title}
            />
          </section>

          <section className="min-w-0 rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-primary">
                {product.marketplace || "US"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {product.category || "General"}
              </span>
            </div>

            <h1 className={getProductDetailTitleClass(product.title)}>
              {product.title}
            </h1>

            {product.review_content ? (
              <div className="mt-4 rounded-[1.5rem] border border-gray-200 bg-gray-50/80 p-5 md:mt-5">
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
            ) : (
              <p className="mt-4 text-sm leading-7 text-gray-600 md:mt-5">
                We do not display fixed prices on DealsRky. Use the retailer link
                below to check the latest price, shipping, and availability directly
                on the final product page.
              </p>
            )}

            <div className="mt-6 rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                {publicProductCallout.eyebrow}
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {publicProductCallout.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {publicProductCallout.body}
              </p>
            </div>

            {availableMarketplaces.length > 0 ? (
              <div className="mt-6">
                {availableMarketplaces.length > 1 ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">
                      Choose marketplace
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {availableMarketplaces.map((marketplace) => {
                        const isSelected = marketplace === selectedMarketplace;

                        return (
                          <button
                            key={marketplace}
                            type="button"
                            onClick={() => setSelectedMarketplace(marketplace)}
                            className={
                              isSelected
                                ? "inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-primary-hover"
                                : "inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-700 transition-colors hover:border-primary hover:text-primary"
                            }
                          >
                            {marketplace}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {selectedAmazonUrl ? (
                  <div className="mt-4">
                    <a
                      href={selectedAmazonUrl}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                      rel="nofollow sponsored"
                    >
                      {AMAZON_PRIMARY_CTA_LABEL}
                    </a>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {AMAZON_DESTINATION_NOTE}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      {INLINE_AFFILIATE_DISCLOSURE}
                    </p>
                  </div>
                ) : selectedMarketplace ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    No active site-primary Amazon tag is configured for the selected {selectedMarketplace} marketplace yet.
                  </div>
                ) : null}
              </div>
            ) : null}

          </section>
        </div>

        {selectedMarketplace ? (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                  Explore more
                </p>
                <h2 className="mt-2 text-3xl font-black text-gray-950">
                  {selectedMarketplace} related products
                </h2>
              </div>
            </div>

            {filteredRelatedProducts.length > 0 ? (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {filteredRelatedProducts.map((relatedProduct) => (
                  <ProductCard key={relatedProduct.id} item={relatedProduct} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[1.75rem] border border-dashed border-gray-300 bg-white/70 p-8 text-sm leading-7 text-gray-600">
                No related products available for {selectedMarketplace} marketplace yet.
              </div>
            )}
          </section>
        ) : null}
      </div>

    </div>
  );
}
