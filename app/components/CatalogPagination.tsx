import { Link } from "react-router";
import { catalogPageHref } from "../utils/catalog-pagination";

export function CatalogPagination({ path, market, page, totalPages }: {
  path: string; market: string; page: number; totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const linkClass = "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50";
  return (
    <nav aria-label="Product pages" className="mt-10 flex flex-wrap items-center justify-center gap-3">
      {page > 1 && <Link className={linkClass} to={catalogPageHref(path, market, page - 1)}>Previous</Link>}
      <span aria-current="page" className="text-sm font-bold text-gray-700">Page {page} of {totalPages}</span>
      {page < totalPages && <Link className={linkClass} to={catalogPageHref(path, market, page + 1)}>Next</Link>}
    </nav>
  );
}
