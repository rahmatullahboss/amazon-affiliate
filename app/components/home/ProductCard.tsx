import { Link } from "react-router";

interface ProductItem {
  id: number;
  product_id?: string;
  asin?: string;
  title: string;
  image_url: string;
  category: string | null;
  price?: string | null;
  original_price?: string | null;
  rating?: number | null;
  marketplace?: string | null;
}

interface ProductCardProps {
  item: ProductItem;
  href?: string;
}

export function ProductCard({ item, href }: ProductCardProps) {
  const url = href || (item.asin ? `/deals/${item.asin}` : `/deals`);

  return (
    <Link 
      to={url} 
      className="group block rounded-[1.75rem] border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-30px_rgba(11,128,128,0.35)]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
          {item.marketplace || "US"}
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
          Amazon
        </span>
      </div>

      <div className="relative mb-5 flex aspect-square w-full items-center justify-center rounded-[1.4rem] bg-[#f5f8f8] p-5">
        <img 
          src={item.image_url} 
          alt={item.title} 
          className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      <div className="flex flex-col text-left">
        <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-gray-500">
          {item.category || "General"}
        </span>

        <h3 className="line-clamp-3 text-base font-semibold leading-6 text-gray-900 transition-colors group-hover:text-primary">
          {item.title}
        </h3>

        <div className="mt-5 flex items-center gap-1 pt-1">
          <span className="text-sm font-semibold text-primary group-hover:underline">
            Open product page →
          </span>
        </div>
      </div>
    </Link>
  );
}
