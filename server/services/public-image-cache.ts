// Only versioned public image reads are eligible. Never cache HTML, redirects,
 // API errors, authenticated requests, range or conditional requests.
export function canCachePublicImage(request: Request): boolean {
  const url = new URL(request.url);
  return request.method === "GET" &&
    !url.search &&
    /^\/api\/public\/blog-images\/[a-zA-Z0-9_-]+-\d+-[a-f0-9]{12}\.(webp|png|jpg|jpeg|gif|avif)$/.test(url.pathname) &&
    !["authorization", "cookie", "range", "if-none-match", "if-modified-since", "if-match", "if-unmodified-since"].some(name => request.headers.has(name)) &&
    !/no-cache|no-store|max-age\s*=\s*0/i.test(request.headers.get("cache-control") ?? "");
}

type ImageCache = Pick<Cache, "match" | "put">;

export async function serveCachedPublicImage(
  request: Request,
  ctx: Pick<ExecutionContext, "waitUntil">,
  load: () => Promise<Response>,
  openCache: () => Promise<ImageCache> = () => caches.open("dealsrky-public-images-v1"),
): Promise<Response> {
  if (!canCachePublicImage(request)) return load();
  let cache: ImageCache;
  const key = new Request(request.url);
  try {
    cache = await openCache();
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch {
    return load();
  }
  const response = await load();
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !/^image\/(webp|png|jpeg|gif|avif)(?:;|$)/i.test(type) ||
    response.headers.has("set-cookie") || response.headers.has("vary") ||
    /private|no-store|no-cache/i.test(response.headers.get("cache-control") ?? "")) return response;
  // Keep a short edge TTL rather than extending the existing browser cache policy.
  const copy = response.clone();
  const headers = new Headers(copy.headers);
  headers.set("cache-control", "public, max-age=300");
  const stored = new Response(copy.body, { status: copy.status, headers });
  ctx.waitUntil(Promise.resolve().then(() => cache.put(key, stored)).catch(() => undefined));
  return response;
}
