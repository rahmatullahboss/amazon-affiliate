import type { Route } from "./+types/category";
import { Link } from "react-router";
import { ProductCard } from "../components/home/ProductCard";
import { buildSeoMeta } from "../utils/seo";

interface CategoryProduct {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  category: string | null;
  description?: string | null;
  price?: string | null;
  original_price?: string | null;
  rating?: number | null;
}

interface CategoryPageData {
  categoryName: string;
  categorySlug: string;
  products: CategoryProduct[];
}

export function meta({ data }: Route.MetaArgs) {
  const categoryData = data as CategoryPageData | undefined;
  const categoryName = categoryData?.categoryName || "Category";
  const categorySlug = categoryData?.categorySlug || "category";

  return buildSeoMeta({
    title: `${categoryName} Deals — DealsRky`,
    description: `Browse the best ${categoryName} deals curated by DealsRky.`,
    path: `/category/${categorySlug}`,
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;

  // NOTE: categories table does NOT have a `description` column — only name, slug, icon, image_url, etc.
  const category = await env.DB.prepare(`
    SELECT name, slug FROM categories WHERE slug = ? AND is_active = 1
  `).bind(slug).first<{ name: string; slug: string }>();

  if (!category) {
    throw new Response("Category Not Found", { status: 404 });
  }

  const { results: products } = await env.DB.prepare(`
    SELECT id, asin, title, image_url, category, description, price, original_price, rating
    FROM products
    WHERE category = ? AND is_active = 1 AND status = 'active'
    ORDER BY created_at DESC
  `).bind(category.name).all<CategoryProduct>();

  return {
    categoryName: category.name,
    categorySlug: category.slug,
    products: products || []
  } satisfies CategoryPageData;
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as CategoryPageData;

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Category Header */}
      <div className="bg-primary/5 border-b border-gray-200 py-10 mb-8">
        <div className="container mx-auto px-4 text-center">
          {/* Breadcrumb */}
          <nav className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <span>›</span>
            <Link to="/deals" className="hover:text-primary transition-colors">Categories</Link>
            <span>›</span>
            <span className="text-gray-800 font-medium">{data.categoryName}</span>
          </nav>

          <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-2">{data.categoryName} Deals</h1>
          <p className="text-primary font-medium text-sm">{data.products.length} product{data.products.length !== 1 ? 's' : ''} available</p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {data.products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.products.map((product) => <ProductCard key={product.id} item={product} />)}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-lg shadow-sm">
            <span className="text-4xl block mb-2">📦</span>
            <h3 className="text-lg font-bold text-gray-800">No Products Yet</h3>
            <p className="text-gray-500 text-sm mb-6">We're actively curating deals for this category. Check back soon!</p>
            <Link
              to="/deals"
              className="inline-flex items-center bg-gray-100 hover:bg-primary text-gray-700 hover:text-white font-semibold py-3 px-8 rounded-full border border-gray-200 transition-colors"
            >
              Back to All Deals
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
