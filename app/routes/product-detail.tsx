import type { Route } from "./+types/product-detail";
import { ProductCard } from "../components/home/ProductCard";
import { AMAZON_DOMAINS } from "../../server/utils/types";

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Product Not Found — DealsRky" }];
  const d = data as any;
  return [
    { title: `${d.product.title} - DealsRky` },
    { name: "description", content: d.product.description || `Buy ${d.product.title} on Amazon.` },
    { property: "og:title", content: d.product.title },
    { property: "og:image", content: d.product.image_url },
  ];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const asin = params.asin;

  const product = await env.DB.prepare(`
    SELECT * FROM products WHERE asin = ? AND is_active = 1
  `).bind(asin).first();

  if (!product) {
    throw new Response("Not Found", { status: 404 });
  }

  const { results: related } = await env.DB.prepare(`
    SELECT * FROM products 
    WHERE category = ? AND asin != ? AND is_active = 1 
    LIMIT 4
  `).bind(product.category, asin).all();

  const marketplace = (product.marketplace as string) || 'US';
  const domain = AMAZON_DOMAINS[marketplace] || AMAZON_DOMAINS.US;
  // Amazon TOS: Always include tracking tag for commission attribution
  const DEFAULT_TAG = 'dealsrky-20';
  const amazonUrl = `https://${domain}/dp/${asin}?tag=${DEFAULT_TAG}`;

  return { product, relatedProducts: related || [], amazonUrl };
}

export default function ProductDetail({ loaderData }: Route.ComponentProps) {
  const data = loaderData as any;
  const { product, relatedProducts, amazonUrl } = data;

  let features: string[] = [];
  try {
    if (product.features) features = JSON.parse(product.features);
  } catch { /* ignore */ }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb Area */}
      <div className="bg-white border-b border-gray-200 py-4 shadow-sm">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <a href="/" className="hover:text-primary transition-colors">Home</a>
            <span>/</span>
            <a href="/deals" className="hover:text-primary transition-colors">Shop</a>
            <span>/</span>
            {product.category && (
              <>
                <a href={`/category/${product.category.toLowerCase().replace(/[&\s]+/g, '-')}`} className="hover:text-primary transition-colors">
                  {product.category}
                </a>
                <span>/</span>
              </>
            )}
            <span className="text-gray-800 truncate font-medium">{product.title}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 md:p-10 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            
            {/* Image (Left) */}
            <div className="flex items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-lg min-h-[400px]">
              <img 
                src={product.image_url} 
                alt={product.title} 
                className="max-h-[500px] w-full object-contain"
                loading="eager"
              />
            </div>

            {/* Info (Right) */}
            <div className="flex flex-col">
              {/* Category Badge */}
              <div className="mb-4">
                <span className="text-xs uppercase tracking-wider font-bold text-primary bg-primary/10 px-3 py-1 rounded">
                  {product.category || "General"}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-snug mb-4">
                {product.title}
              </h1>

              {/* Reviews — Amazon TOS: no fake ratings, link to real reviews */}
              <div className="flex items-center gap-2 mb-6 text-sm">
                <a href={amazonUrl} target="_blank" rel="noopener noreferrer nofollow sponsored"
                   className="text-primary hover:underline font-medium">
                  📝 Read Customer Reviews on Amazon →
                </a>
              </div>

              {/* Price — Amazon TOS: NEVER display static/cached prices */}
              <div className="bg-gray-50 border-l-4 border-primary p-4 rounded-r mb-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-xl font-bold text-primary">
                    See latest price on Amazon
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Prices and availability are subject to change
                </div>
              </div>

              {/* Buy Button */}
              <div className="mb-8 relative">
                 <a 
                   href={amazonUrl}
                   target="_blank"
                   rel="noopener noreferrer nofollow sponsored"
                   className="block w-full text-center bg-primary hover:bg-primary-hover text-white font-black uppercase tracking-wide py-4 rounded shadow-md shadow-primary/40 transition-transform active:scale-[0.98]"
                 >
                   View Deal on Amazon <span className="ml-2">→</span>
                 </a>
                 <div className="text-center text-[11px] text-gray-400 mt-3 flex justify-center items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                    Secure checkout direct via Amazon
                 </div>
              </div>

              {/* Short Description */}
              {product.description && (
                <div className="text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-6">
                  {product.description}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Features / Details Box */}
        {features.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
             <div className="border-b border-gray-100 px-6 py-4">
                 <h2 className="text-lg font-bold text-gray-800">Product Features</h2>
             </div>
             <div className="p-6">
                 <ul className="space-y-3">
                   {features.map((f: string, i: number) => (
                     <li key={i} className="flex gap-3 text-gray-700 text-sm">
                       <span className="text-[#2c9cb4] flex-shrink-0">✓</span>
                       <span>{f}</span>
                     </li>
                   ))}
                 </ul>
             </div>
          </div>
        )}

        {/* Review Content */}
        {product.review_content && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
             <div className="border-b border-gray-100 px-6 py-4">
                 <h2 className="text-lg font-bold text-gray-800">Our Detailed Review</h2>
             </div>
             <div className="p-6 text-gray-700 text-sm leading-relaxed whitespace-pre-line prose max-w-none">
                 {product.review_content}
             </div>
          </div>
        )}

        {/* Related */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-black text-gray-800 border-b border-gray-200 pb-2 mb-6">Related Deals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p: any) => (
                <ProductCard key={p.id} item={p} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
