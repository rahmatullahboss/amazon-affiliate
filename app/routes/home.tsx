import type { Route } from "./+types/home";
import { Link } from "react-router";
import { ProductCard } from "../components/home/ProductCard";

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
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "DealsRky | Curated Amazon Finds" },
    {
      name: "description",
      content:
        "Browse curated Amazon product picks, review pages, and quick-buy landing pages designed for fast, transparent shopping.",
    },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  const { results } = await env.DB.prepare(
    `
      SELECT id, asin, title, image_url, category, marketplace, created_at
      FROM products
      WHERE is_active = 1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 12
    `
  ).all<ProductRow>();

  return {
    products: results || [],
  } satisfies HomeLoaderData;
}

const editorialHighlights = [
  {
    title: "Fast bridge pages",
    description: "Clean product pages that send buyers to Amazon without extra friction.",
  },
  {
    title: "Transparent affiliate flow",
    description: "Affiliate disclosures, direct Amazon checkout, and no fake pricing.",
  },
  {
    title: "Fresh catalog intake",
    description: "Products can be added from the in-house portal and published quickly.",
  },
];

const marketplaceLabels = ["US", "CA", "UK", "DE", "IT", "FR", "ES"];

export default function Home({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData as HomeLoaderData;
  const featuredProducts = products.slice(0, 6);
  const latestProducts = products.slice(6, 12);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_34%,#f4f6f6_100%)]">
      <section className="border-b border-gray-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-primary">
              Amazon affiliate storefront
            </p>
            <h1 className="max-w-xl text-4xl font-black leading-tight text-gray-950 md:text-6xl">
              Curated product pages built for faster Amazon buying.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-gray-600 md:text-lg">
              DealsRky is a lightweight affiliate site for curated Amazon finds.
              We publish clean product pages, keep disclosures visible, and send
              buyers straight to Amazon for checkout.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/deals"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Browse latest products
              </Link>
              <Link
                to="/disclosure"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-6 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
              >
                Read affiliate disclosure
              </Link>
            </div>
          </div>

          <div className="w-full max-w-xl rounded-[2rem] border border-white/60 bg-[#0d1e1e] p-6 text-white shadow-[0_30px_80px_-35px_rgba(8,102,102,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-primary/80">
                  Coverage
                </p>
                <h2 className="mt-2 text-2xl font-bold">Marketplace-ready setup</h2>
              </div>
              <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80">
                Live catalog
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {marketplaceLabels.map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
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
                Buyers land on a product page, review the item context, then use a
                direct CTA to continue on Amazon. No cart clone, no fake checkout,
                no static pricing.
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
                Core system
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
              Featured now
            </p>
            <h2 className="mt-2 text-3xl font-black text-gray-950">
              New additions worth checking
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
            <h3 className="text-lg font-bold text-gray-900">No products published yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              Once admins or agents add ASINs through the system, published items will
              appear here automatically.
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
              Simple path from product curation to Amazon checkout
            </h2>
            <div className="mt-8 grid gap-5">
              {[
                "A product enters the catalog through the admin panel or agent portal.",
                "DealsRky creates a clean product page and optional agent-specific landing link.",
                "Every buyer click is sent through a tracked Amazon redirect route.",
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
    </div>
  );
}
