import { Link } from "react-router";

interface ProductItem {
  id: number;
  product_id?: string;
  asin?: string;
  title: string;
  image_url: string;
  category: string;
  price: string;
  original_price?: string;
  rating?: number;
}

export function ProductCard({ item }: { item: ProductItem }) {
  const url = item.asin ? `/deals/${item.asin}` : `/deals`;

  return (
    <Link 
      to={url} 
      className="group block bg-white rounded transition hover:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] p-4 border border-gray-100/50"
    >
      {/* Product Image */}
      <div className="relative w-full aspect-square mb-4 flex items-center justify-center bg-transparent">
        <img 
          src={item.image_url} 
          alt={item.title} 
          className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="flex flex-col text-left">
        {/* Category */}
        <span className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
          {item.category || "General"}
        </span>

        {/* Title */}
        <h3 className="text-[14px] text-gray-800 font-medium leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {/* Amazon TOS Compliant: Link to check price instead of showing static price */}
        <div className="flex items-center gap-1 mt-auto pt-1">
          <span className="text-sm font-semibold text-primary group-hover:underline">
            View Deal →
          </span>
        </div>
      </div>
    </Link>
  );
}
