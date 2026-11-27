import { createPublicRenderKey, isPublicProductRenderEligible } from "./public-product-render-cache";
import { listDuePublicationPaths, readScopedRenderRevision } from "./public-render-scope-revision";
import { createRenderSnapshotStore } from "./public-render-snapshot-store";

type PublicationInput = {
  db: D1Database;
  bucket: R2Bucket;
  version: string;
  origin: string;
};
const validVersion = (version: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(version);
const validPath = (path: string) => /^\/deals\/[A-Z0-9]{10}(?:\?market=(?:US|CA|UK|DE|IT|FR|ES))?$/.test(path);
const requestFor = (origin: string, path: string) => new Request(new URL(path, origin), { headers: { accept: "text/html" } });

// Visitor path: read-only. Never create a snapshot or schedule regeneration.
// The current primary-D1 revision also verifies eligibility and enrollment.
export async function readPublishedProduct(input: PublicationInput & { request: Request }): Promise<Response | undefined> {
  if (!validVersion(input.version) || !isPublicProductRenderEligible(input.request) ||
      new URL(input.request.url).origin !== input.origin) return undefined;
  try {
    const revision = await readScopedRenderRevision(input.db, input.request);
    if (!revision) return undefined;
    const store = createRenderSnapshotStore(input.bucket, { durable: true });
    const saved = await store.match(createPublicRenderKey(input.request, input.version, revision));
    if (!saved) return undefined;
    const headers = new Headers(saved.headers);
    // Never allow a downstream cache to bypass the D1 visibility gate.
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("X-Publication-Render", "HIT");
    return new Response(saved.body, { status: 200, headers });
  } catch {
    return undefined;
  }
}

const RECONCILE_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;

// Bounded scheduled publication, independent of visitor demand.
// Prototype cap: at most 100 explicitly enrolled paths, eight examined per run.
// Unchanged documents reuse their stored revision without invoking React.
export async function publishProductBatch(input: PublicationInput & {
  render: (request: Request) => Promise<Response>;
  limit?: number;
}) {
  const result = { checked: 0, generated: 0, unchanged: 0, hidden: 0, failed: 0 };
  if (!validVersion(input.version)) return result;
  const count = await input.db.prepare("SELECT COUNT(*) AS n FROM public_render_publication").first<{ n: number }>();
  if (!count || count.n > 100) throw new Error("Publication prototype enrollment exceeds 100 paths");
  const limit = Math.min(8, Math.max(1, Math.floor(input.limit ?? 8)));
  if (!Number.isFinite(limit)) throw new Error("Invalid publication batch size");
  const results = await listDuePublicationPaths(input.db,input.version,Date.now(),limit);
  const store = createRenderSnapshotStore(input.bucket, { durable: true });
  for (const { path, dirty_token, current_revision } of results) {
    result.checked++;
    let delay = RETRY_MS;
    try {
      if (!validPath(path)) { result.failed++; continue; }
      const request = requestFor(input.origin, path);
      const revision = await readScopedRenderRevision(input.db, request);
      if (!revision) { result.hidden++; delay = RECONCILE_MS; continue; }
      const key = createPublicRenderKey(request, input.version, revision);
      // Refresh before expiry so the six-hour reconciliation interval cannot
      // leave a valid unchanged page without a snapshot until the next check.
      if (await store.has(key, RECONCILE_MS + 15 * 60 * 1000)) {
        result.unchanged++;
        delay = RECONCILE_MS;
        continue;
      }
      const response = await input.render(request);
      if (response.status !== 200 || !response.body ||
          !/^text\/html(?:;|$)/i.test(response.headers.get("content-type") ?? "") ||
          ["set-cookie", "vary", "location"].some(name => response.headers.has(name))) {
        await response.body?.cancel();
        result.failed++;
        continue;
      }
      if (await readScopedRenderRevision(input.db, request) !== revision) {
        await response.body.cancel();
        result.failed++;
        continue;
      }
      await store.put(key, response);
      // A concurrent mutation cannot be promoted as a current snapshot.
      if (await readScopedRenderRevision(input.db, request) !== revision) { result.failed++; continue; }
      if (!await store.has(key)) { result.failed++; continue; }
      result.generated++;
      delay = RECONCILE_MS;
    } catch {
      result.failed++;
    } finally {
      // A concurrent mutation remains due because the persisted revision
      // is the one selected before generation, never a newer revision.
      // Enrollment CAS also protects remove/re-enroll races.
      const current = validPath(path) ? (await readScopedRenderRevision(input.db,requestFor(input.origin,path)) ?? "hidden") : "invalid";
      if (current === current_revision) {
        const checked = Date.now();
        await input.db.prepare("UPDATE public_render_publication SET last_checked_at=?,next_check_at=?,checked_version=?,checked_revision=? WHERE path=? AND dirty_token=?")
          .bind(checked, checked + delay, input.version, current_revision, path, dirty_token).run();
      }
    }
  }
  return result;
}
