import type { Route } from "./+types/product-detail";
import { Link } from "react-router";
import { ProductCard } from "../components/home/ProductCard";
import { AMAZON_DOMAINS } from "../../server/utils/types";

interface ProductRow {
  id: number;
  asin: string;
  title: string;
  description: string | null;
  image_url: string;
  category: string | null;
  marketplace: string | null;
  features: string | null;
  review_content: string | null;
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
  amazonUrl: string;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Product Not Found | DealsRky" }];

  const { product } = data as ProductDetailData;

  return [
    { title: `${product.title} | DealsRky` },
    {
      name: "description",
      content:
        product.description ||
        `Review ${product.title} and continue to Amazon for the latest price and checkout.`,
    },
    { property: "og:title", content: product.title },
    { property: "og:image", content: product.image_url },
  ];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const asin = params.asin;

  const product = await env.DB.prepare(
    `
      SELECT id, asin, title, description, image_url, category, marketplace, features, review_content
      FROM products
      WHERE asin = ? AND is_active = 1 AND status = 'active'
    `
  )
    .bind(asin)
    .first<ProductRow>();

  if (!product) {
    throw new Response("Not Found", { status: 404 });
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

  const marketplace = product.marketplace || "US";
  const domain = AMAZON_DOMAINS[marketplace] || AMAZON_DOMAINS.US;
  const defaultTag = "dealsrky-20";
  const amazonUrl = `https://${domain}/dp/${asin}?tag=${defaultTag}`;

  return {
    product,
    relatedProducts: related || [],
    amazonUrl,
  } satisfies ProductDetailData;
}

function parseFeatures(raw: string | null): string[] {
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
  const { product, relatedProducts, amazonUrl } = loaderData as ProductDetailData;
  const features = parseFeatures(product.features);

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
          {product.category ? (
            <>
              <span>/</span>
              <span>{product.category}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="rounded-[1.75rem] bg-[#f5f8f8] p-6">
              <img
                src={product.image_url}
                alt={product.title}
                className="mx-auto max-h-[520px] w-full object-contain"
                loading="eager"
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-primary">
                {product.marketplace || "US"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {product.category || "General"}
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-black leading-tight text-gray-950 md:text-4xl">
              {product.title}
            </h1>

            <p className="mt-5 text-sm leading-7 text-gray-600">
              We do not display fixed prices on DealsRky. Use the Amazon button
              below to check the latest price, shipping, and availability directly
              on Amazon.
            </p>

            <div className="mt-6 rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Amazon checkout
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                Continue to Amazon for live pricing
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Pricing, delivery windows, reviews, coupons, and stock status are
                managed on Amazon.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={amazonUrl}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                View on Amazon
              </a>
              <a
                href={amazonUrl}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-6 py-3.5 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
              >
                Read Amazon reviews
              </a>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                "Direct Amazon checkout",
                "Affiliate disclosure included",
                "No stored payment data",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-gray-50 p-4 text-sm font-medium text-gray-700">
                  {item}
                </div>
              ))}
            </div>

            {product.description ? (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h2 className="text-lg font-bold text-gray-900">Product overview</h2>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {product.description}
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

        {product.review_content ? (
          <section className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-black text-gray-950">Editorial notes</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600">
              {product.review_content}
            </div>
          </section>
        ) : null}

        {relatedProducts.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                  Explore more
                </p>
                <h2 className="mt-2 text-3xl font-black text-gray-950">
                  Related products
                </h2>
              </div>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} item={relatedProduct} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
