import type { Route } from "./+types/deals";
import { ProductCard } from "../components/home/ProductCard";
import { MarketplaceSelector } from "../components/MarketplaceSelector";
import { DEALS_PAGE_TITLE } from "../utils/affiliate-copy";
import { resolvePreferredMarketplace, type PublicMarketplace } from "../utils/marketplace";
import { buildSeoMeta } from "../utils/seo";

interface DealsProduct {
  id: number;
  asin?: string;
  title: string;
  image_url: string;
  category: string | null;
  marketplace?: string | null;
}

interface DealsCategory {
  name: string;
  slug: string;
}

interface DealsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function meta({}: Route.MetaArgs) {
  return buildSeoMeta({
    title: "Curated Product Picks — DealsRky",
    description: "Browse marketplace-aware product recommendations on DealsRky.",
    path: "/deals",
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
  
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = 12;
  const offset = (page - 1) * limit;

  const [productsResult, countResult, categoriesResult] = await Promise.all([
    env.DB.prepare(`
      SELECT * FROM products
      WHERE is_active = 1 AND status = 'active' AND marketplace = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(selectedMarketplace, limit, offset).all<DealsProduct>(),
    env.DB.prepare(`
      SELECT COUNT(*) as total FROM products WHERE is_active = 1 AND status = 'active' AND marketplace = ?
    `).bind(selectedMarketplace).first<{ total: number }>(),
    env.DB.prepare(`
      SELECT name, slug FROM categories WHERE is_active = 1 ORDER BY display_order ASC
    `).all<DealsCategory>()
  ]);

  return {
    selectedMarketplace,
    products: productsResult.results || [],
    categories: categoriesResult.results || [],
    pagination: {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit),
    }
  };
}

export default function DealsPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as {
    products: DealsProduct[];
    categories: DealsCategory[];
    pagination: DealsPagination;
    selectedMarketplace: PublicMarketplace;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Page Header */}
      <div className="bg-primary/5 border-b border-gray-200 py-10 mb-8">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-2">
            {DEALS_PAGE_TITLE}
          </h1>
          <p className="text-gray-600 max-w-lg mx-auto text-sm md:text-base">
            Explore marketplace-aware recommendations and use each product page
            for research before continuing to Amazon.
          </p>
          <div className="mt-5 flex justify-center">
            <MarketplaceSelector
              selectedMarketplace={data.selectedMarketplace}
              label="Showing only"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        
        <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar (Categories) */}
            <div className="w-full md:w-1/4">
               <div className="bg-white border md:sticky md:top-24 border-gray-200 rounded-lg p-5 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Categories</h3>
                  <div className="space-y-2">
                    <a href={`/deals?market=${data.selectedMarketplace}`} className="block text-sm font-bold text-primary hover:text-primary-hover">» All Picks</a>
                    {data.categories.map((cat) => (
                      <a 
                        key={cat.slug} 
                        href={`/category/${cat.slug}?market=${data.selectedMarketplace}`}
                        className="block text-sm text-gray-600 hover:text-primary transition-colors"
                      >
                        {cat.name}
                      </a>
                    ))}
                  </div>
               </div>
            </div>

            {/* Product Grid Area */}
            <div className="w-full md:w-3/4">
               <div className="flex justify-between items-center mb-6 bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                  <span className="text-sm font-medium text-gray-600">Showing {data.products.length} results in {data.selectedMarketplace}</span>
                  <div className="text-sm text-gray-500">Sorted by: <strong className="text-gray-800">Latest</strong></div>
               </div>

                {data.products.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.products.map((p) => <ProductCard key={p.id} item={p} />)}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span className="text-4xl block mb-2">🔍</span>
                    <h3 className="font-bold text-gray-800">No curated picks available yet</h3>
                    <p className="text-gray-500 text-sm">We are reviewing the next batch of public product pages. Please check back soon.</p>
                  </div>
                )}

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    {data.pagination.page > 1 && (
                      <a href={`?market=${data.selectedMarketplace}&page=${data.pagination.page - 1}`} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium">
                        Previous
                      </a>
                    )}
                    <span className="px-4 py-2 bg-primary text-white rounded shadow-sm text-sm font-bold">
                      {data.pagination.page}
                    </span>
                    {data.pagination.page < data.pagination.totalPages && (
                      <a href={`?market=${data.selectedMarketplace}&page=${data.pagination.page + 1}`} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium">
                        Next
                      </a>
                    )}
                  </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
