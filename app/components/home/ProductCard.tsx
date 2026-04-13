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

type ProductCardVariant = "default" | "homepageCompact";

interface ProductCardProps {
  item: ProductItem;
  href?: string;
  variant?: ProductCardVariant;
  badgeLabel?: string;
  description?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
}

export function ProductCard({
  item,
  href,
  variant = "default",
  badgeLabel,
  description,
  primaryCtaLabel = "Open product page",
  secondaryCtaLabel,
}: ProductCardProps) {
  const url = href || (item.asin ? `/deals/${item.asin}` : `/deals`);

  if (variant === "homepageCompact") {
    return (
      <article className="group rounded-[1.5rem] border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-30px_rgba(11,128,128,0.35)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
            {item.marketplace || "US"}
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            {badgeLabel || "Amazon"}
          </span>
        </div>

        <Link to={url} className="block">
          <div className="relative mb-4 flex aspect-square w-full items-center justify-center rounded-[1.2rem] bg-[#f5f8f8] p-4">
            <img
              src={item.image_url}
              alt={item.title}
              className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </Link>

        <span className="block text-[11px] uppercase tracking-[0.22em] text-gray-500">
          {item.category || "General"}
        </span>

        <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-gray-900">
          {item.title}
        </h3>

        {description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">{description}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <Link
            to={url}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            {primaryCtaLabel}
          </Link>
          {secondaryCtaLabel ? (
            <Link
              to={url}
              className="text-sm font-semibold text-gray-600 transition-colors hover:text-primary"
            >
              {secondaryCtaLabel}
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

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
            {primaryCtaLabel} →
          </span>
        </div>
      </div>
    </Link>
  );
}
