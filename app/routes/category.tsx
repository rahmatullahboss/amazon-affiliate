import type { Route } from "./+types/category";
import { ProductCard } from "../components/home/ProductCard";

export function meta({ data }: Route.MetaArgs) {
  const d = data as any;
  return [
    { title: `${d?.categoryName || 'Category'} Deals — DealsRky` },
    { name: "description", content: `Browse the best ${d?.categoryName || ''} deals curated by DealsRky.` },
  ];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;

  const category = await env.DB.prepare(`
    SELECT name, description FROM categories WHERE slug = ? AND is_active = 1
  `).bind(slug).first<{ name: string; description: string | null }>();

  if (!category) {
    throw new Response("Category Not Found", { status: 404 });
  }

  const { results: products } = await env.DB.prepare(`
    SELECT * FROM products WHERE category = ? AND is_active = 1 ORDER BY created_at DESC
  `).bind(category.name).all();

  return {
    categoryName: category.name,
    categoryDescription: category.description,
    products: products || []
  };
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as any;

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Category Header */}
      <div className="bg-[#2c9cb4]/5 border-b border-gray-200 py-10 mb-8">
        <div className="container mx-auto px-4 text-center">
          {/* Breadcrumb */}
          <nav className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
            <a href="/" className="hover:text-[#2c9cb4] transition-colors">Home</a>
            <span>›</span>
            <a href="/deals" className="hover:text-[#2c9cb4] transition-colors">Categories</a>
            <span>›</span>
            <span className="text-gray-800 font-medium">{data.categoryName}</span>
          </nav>

          <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-2">{data.categoryName} Deals</h1>
          {data.categoryDescription && (
            <p className="text-gray-600 max-w-lg mx-auto text-sm md:text-base mb-2">
              {data.categoryDescription}
            </p>
          )}
          <p className="text-[#2c9cb4] font-medium text-sm">{data.products.length} product{data.products.length !== 1 ? 's' : ''} available</p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {data.products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.products.map((p: any) => <ProductCard key={p.id} item={p} />)}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-lg shadow-sm">
            <span className="text-4xl block mb-2">📦</span>
            <h3 className="text-lg font-bold text-gray-800">No Products Yet</h3>
            <p className="text-gray-500 text-sm mb-6">We're actively curating deals for this category. Check back soon!</p>
            <a 
              href="/deals" 
              className="inline-flex items-center bg-gray-100 hover:bg-[#2c9cb4] text-gray-700 hover:text-white font-semibold py-3 px-8 rounded-full border border-gray-200 transition-colors"
            >
              Back to All Deals
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
