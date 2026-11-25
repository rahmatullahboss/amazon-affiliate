export const CATALOG_PAGE_SIZE = 24;

export function catalogPagination(search: URLSearchParams, total: number) {
  const raw = search.get("page") ?? "1";
  const requested = /^[0-9]+$/.test(raw) ? Number(raw) : 1;
  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { page, totalPages, total, limit: CATALOG_PAGE_SIZE, offset: (page - 1) * CATALOG_PAGE_SIZE };
}

export function catalogPageHref(path: string, market: string, page: number) {
  const params = new URLSearchParams({ market });
  if (page > 1) params.set("page", String(page));
  return `${path}?${params}`;
}
