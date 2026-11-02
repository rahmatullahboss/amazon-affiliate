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
  primaryHref?: string;
  variant?: ProductCardVariant;
  badgeLabel?: string;
  description?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
}

export function ProductCard({
  item,
  href,
  primaryHref,
  variant = "default",
  badgeLabel,
  description,
  primaryCtaLabel = "Open product page",
  secondaryCtaLabel,
}: ProductCardProps) {
  const url = href || (item.asin ? `/deals/${item.asin}` : `/deals`);
  const primaryUrl = primaryHref || url;

  if (variant === "homepageCompact") {
    return (
      <article className="group flex h-full min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-1.5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-30px_rgba(11,128,128,0.35)] sm:rounded-[1.5rem] sm:p-4">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-1 sm:mb-3 sm:gap-3">
          <span className="text-[9px] font-bold uppercase tracking-normal text-gray-400 sm:text-[11px] sm:tracking-[0.22em]">
            {item.marketplace || "US"}
          </span>
          <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary sm:inline">
            {badgeLabel || "Amazon"}
          </span>
        </div>

        <Link to={url} className="block">
          <div className="relative mb-1.5 flex aspect-square w-full min-w-0 items-center justify-center rounded-lg bg-[#f5f8f8] p-1 sm:mb-4 sm:rounded-[1.2rem] sm:p-4">
            <img
              src={item.image_url}
              alt={item.title}
              className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </Link>

        <span className="hidden text-[11px] uppercase tracking-[0.22em] text-gray-500 sm:block">
          {item.category || "General"}
        </span>

        <h3 className="mt-1 line-clamp-3 min-w-0 break-words text-[11px] font-semibold leading-tight text-gray-900 sm:mt-2 sm:line-clamp-2 sm:text-base sm:leading-6">
          {item.title}
        </h3>

        {description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">{description}</p>
        ) : null}

        <div className="mt-auto flex min-w-0 items-center gap-1 pt-2 sm:mt-4 sm:gap-3 sm:pt-0">
          <Link
            to={primaryUrl}
            className="inline-flex min-w-0 w-full items-center justify-center rounded-md bg-primary px-1 py-1.5 text-center text-[10px] font-bold leading-tight text-white transition-colors hover:bg-primary-hover sm:rounded-full sm:px-4 sm:py-2 sm:text-sm"
          >
            <span className="sm:hidden">{primaryHref ? "Amazon" : "Details"}</span><span className="hidden sm:inline">{primaryCtaLabel}</span>
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
