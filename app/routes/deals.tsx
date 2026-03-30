import type { Route } from "./+types/deals";
import { ProductCard } from "../components/home/ProductCard";
import { buildSeoMeta } from "../utils/seo";

export function meta({}: Route.MetaArgs) {
  return buildSeoMeta({
    title: "All Deals — DealsRky",
    description: "Browse all curated Amazon deals on DealsRky.",
    path: "/deals",
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = 12;
  const offset = (page - 1) * limit;

  const [productsResult, countResult, categoriesResult] = await Promise.all([
    env.DB.prepare(`
      SELECT * FROM products WHERE is_active = 1 AND status = 'active' ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all(),
    env.DB.prepare(`
      SELECT COUNT(*) as total FROM products WHERE is_active = 1 AND status = 'active'
    `).first<{ total: number }>(),
    env.DB.prepare(`
      SELECT name, slug FROM categories WHERE is_active = 1 ORDER BY display_order ASC
    `).all()
  ]);

  return {
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
  const data = loaderData as { products: any[]; categories: any[]; pagination: any };

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Page Header */}
      <div className="bg-primary/5 border-b border-gray-200 py-10 mb-8">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-2">Shop All Deals</h1>
          <p className="text-gray-600 max-w-lg mx-auto text-sm md:text-base">
            Find the best hand-picked products, updated daily.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        
        <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar (Categories) */}
            <div className="w-full md:w-1/4">
               <div className="bg-white border md:sticky md:top-24 border-gray-200 rounded-lg p-5 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Categories</h3>
                  <div className="space-y-2">
                    <a href="/deals" className="block text-sm font-bold text-primary hover:text-primary-hover">» All Deals</a>
                    {data.categories.map((cat: any) => (
                      <a 
                        key={cat.slug} 
                        href={`/category/${cat.slug}`}
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
                  <span className="text-sm font-medium text-gray-600">Showing {data.products.length} results</span>
                  <div className="text-sm text-gray-500">Sorted by: <strong className="text-gray-800">Latest</strong></div>
               </div>

                {data.products.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.products.map((p: any) => <ProductCard key={p.id} item={p} />)}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span className="text-4xl block mb-2">🔍</span>
                    <h3 className="font-bold text-gray-800">No Products Found</h3>
                    <p className="text-gray-500 text-sm">We're updating our inventory. Please check back later.</p>
                  </div>
                )}

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    {data.pagination.page > 1 && (
                      <a href={`?page=${data.pagination.page - 1}`} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium">
                        Previous
                      </a>
                    )}
                    <span className="px-4 py-2 bg-primary text-white rounded shadow-sm text-sm font-bold">
                      {data.pagination.page}
                    </span>
                    {data.pagination.page < data.pagination.totalPages && (
                      <a href={`?page=${data.pagination.page + 1}`} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium">
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
