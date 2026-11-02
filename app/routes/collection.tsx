import type { Route } from "./+types/collection";
import { Link } from "react-router";
import { MarketplaceSelector } from "../components/MarketplaceSelector";
import { ProductCard } from "../components/home/ProductCard";
import { AdBanner } from "../components/AdBanner";
import { isCollectionKind, getCollectionRows, type CollectionKind, type CollectionProductRow } from "../../server/services/collection-feed";
import { getPublicProductAffiliateHrefs } from "../../server/services/public-product-affiliate";
import { resolvePreferredMarketplace, type PublicMarketplace } from "../utils/marketplace";
import { buildSeoMeta } from "../utils/seo";

const LABELS: Record<CollectionKind, string> = {
  featured: "Featured Picks",
  trending: "Trending by Recent Clicks",
  latest: "Latest Updated Products",
  "top-10": "Top 10 by Recent Clicks",
};
interface CollectionData {
  kind: CollectionKind;
  marketplace: PublicMarketplace;
  products: Array<CollectionProductRow & { amazonHref: string | null }>;
}

export function meta({ data }: Route.MetaArgs) {
  const result = data as CollectionData | undefined;
  const label = result ? LABELS[result.kind] : "Product Collections";
  return buildSeoMeta({
    title: `${label} | DealsRky`,
    description: `Browse ${label.toLowerCase()} in your selected marketplace. Popularity represents recent tracked product clicks, not confirmed sales.`,
    path: `/collections/${result?.kind || "featured"}`,
  });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  if (!isCollectionKind(params.kind)) {
    throw new Response("Collection Not Found", { status: 404 });
  }
  const url = new URL(request.url);
  const marketplace = resolvePreferredMarketplace({
    searchParams: url.searchParams,
    cookieHeader: request.headers.get("cookie"),
    countryHeader: request.headers.get("cf-ipcountry"),
  });
  const db = context.cloudflare.env.DB;
  const products = await getCollectionRows(db, marketplace, params.kind);
  const affiliateLinks = await getPublicProductAffiliateHrefs(db, products);
  return {
    kind: params.kind,
    marketplace,
    products: products.map((product) => ({
      ...product,
      amazonHref: affiliateLinks.get(product.id) ?? null,
    })),
  } satisfies CollectionData;
}

export default function CollectionPage({ loaderData }: Route.ComponentProps) {
  const { kind, marketplace, products } = loaderData as CollectionData;
  return (
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
      <nav className="mb-4 flex flex-wrap gap-2 text-xs font-semibold text-gray-600" aria-label="Collections">
        <Link to="/" className="hover:text-primary">Home</Link>
        {(["featured", "trending", "latest", "top-10"] as const).map((entry) => (
          <Link key={entry} to={`/collections/${entry}?market=${marketplace}`}
            aria-current={kind === entry ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 ${kind === entry ? "bg-primary text-white" : "bg-gray-100 hover:text-primary"}`}>
            {LABELS[entry]}
          </Link>
        ))}
      </nav>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">{LABELS[kind]}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {kind === "featured" ? "Only products featured within the last 72 hours" :
             kind === "latest" ? "Products added or refreshed in the last 72 hours" :
             "Ranked by the site's tracked product clicks in the past 7 days—not Amazon sales"}
          </p>
        </div>
        <MarketplaceSelector selectedMarketplace={marketplace} label="Country" />
      </div>
      <AdBanner placement="collection-before-grid" />
      {products.length ? (
        <div className="grid grid-cols-4 gap-2 sm:gap-3 xl:grid-cols-6">
          {products.map((p) => <ProductCard key={p.id} item={p} href={`/deals/${p.asin}?market=${marketplace}`} primaryHref={p.amazonHref ?? undefined} variant="homepageCompact" />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h2 className="font-bold text-gray-900">No qualifying products yet</h2>
          <p className="mt-2 text-sm text-gray-600">This collection will update as eligible products or tracked activity become available.</p>
          <Link to={`/deals?market=${marketplace}`} className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">Browse all deals</Link>
        </div>
      )}
      <AdBanner placement="collection-before-footer" />
    </main>
  );
}
