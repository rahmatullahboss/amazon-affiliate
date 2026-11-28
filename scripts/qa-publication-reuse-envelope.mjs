import { evaluatePublicationCpuCase } from "./publication-admission-policy.mjs";

// Read-only, aggregate Cloudflare telemetry: estimate the *upper bound* of
// anonymous publication reuse. Never emit URL, ASIN, IP, header values or UAs.
const currentVersion = "ff485906-3a68-47d4-9cf3-2fef33f8e82d";
const endpoint = "https://api.cloudflare.com/client/v4/accounts/474078d5f990169d7dadf4e1df83214a/workers/observability/telemetry/query";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw Error("Missing Cloudflare telemetry token");
const from = process.argv[2] ? Date.parse(process.argv[2]) : Date.now() - 4 * 60 * 60 * 1000;
const to = process.argv[3] ? Date.parse(process.argv[3]) : Date.now();
if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 4 * 60 * 60 * 1000) {
  throw Error("Expected bounded <=4-hour interval");
}
const middle = from + Math.floor((to - from) / 2);
const requests = [];
let calls = 0;
let truncated = 0;
let missingHeaders = 0;
let nonDocument = 0;
let excludedQa = 0;
const cap = 48;

async function collect(a, b) {
  if (++calls > cap) throw Error("Telemetry call budget exceeded");
  const body = {
    queryId: "dealsrky-publication-reuse-aggregate",
    timeframe: { from: a, to: b },
    view: "events",
    parameters: {
      filters: [
        { key: "$workers.scriptName", operation: "eq", type: "string", value: "dealsrky-bridge" },
        { key: "$workers.cpuTimeMs", operation: "exists", type: "number" },
      ],
      limit: 100,
    },
    ignoreSeries: true,
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw Error("Observability query " + response.status);
  const events = payload.result?.events?.events ?? [];
  if (events.length >= 50 && b - a > 60000) {
    const m = Math.floor((a + b) / 2);
    await collect(a, m);
    await collect(m + 1, b);
    return;
  }
  if (events.length >= 50) truncated++;
  for (const event of events) {
    const worker = event.$workers ?? {};
    if (worker.scriptVersion?.id !== currentVersion || !Number.isFinite(worker.cpuTimeMs)) continue;
    const req = worker.event?.request ?? {};
    let url;
    try { url = new URL(req.url ?? req.path ?? "", "https://dealsrky.com"); } catch { continue; }
    if (!new RegExp("^/deals/[A-Z0-9]{10}$").test(url.pathname)) continue;
    if (url.searchParams.has("__cpuqa") || /DealsRkyReleaseQA/i.test(String(req.headers?.["user-agent"] ?? ""))) {
      excludedQa++;
      continue;
    }
    if (req.method && req.method !== "GET") { nonDocument++; continue; }
    const variant = url.search;
    if (variant && !new RegExp("^[?]market=(?:US|CA|UK|DE|IT|FR|ES)$").test(variant)) { nonDocument++; continue; }
    if (!req.headers || typeof req.headers !== "object") {
      missingHeaders++;
    } else {
      const headers = new Headers(req.headers);
      if (headers.get("accept") && !headers.get("accept").includes("text/html")) { nonDocument++; continue; }
      if (["cookie", "authorization", "range"].some(k => headers.has(k))) { nonDocument++; continue; }
    }
    const tRaw = event.timestamp ?? event.$metadata?.timestamp ?? worker.eventTimestamp;
    const time = typeof tRaw === "number" ? (tRaw < 1e12 ? tRaw * 1000 : tRaw) : Date.parse(tRaw);
    requests.push({
      key: url.pathname + variant,
      time: Number.isFinite(time) ? time : (a + b) / 2,
      cpu: worker.cpuTimeMs,
    });
  }
}

await collect(from, middle - 1);
await collect(middle, to);
const counts = new Map();
const firstHalf = new Set(), secondHalf = new Set();
for (const request of requests) {
  counts.set(request.key, (counts.get(request.key) ?? 0) + 1);
  (request.time < middle ? firstHalf : secondHalf).add(request.key);
}
const ranked = [...counts.values()].sort((a, b) => b - a);
const requestsAtTop100 = ranked.slice(0, 100).reduce((a, b) => a + b, 0);
const repeats = ranked.reduce((a, b) => a + Math.max(0, b - 1), 0);
const top100Repeats = ranked.slice(0, 100).reduce((a, b) => a + Math.max(0, b - 1), 0);
const overlap = [...secondHalf].filter(key => firstHalf.has(key)).length;
const firstHalfRequests = requests.filter(row => row.time < middle);
const secondHalfRequests = requests.filter(row => row.time >= middle);
const heldoutCoveredRequests = secondHalfRequests.filter(row => firstHalf.has(row.key));
const cpu = requests.reduce((a, b) => a + b.cpu, 0);
console.log(JSON.stringify({
  source: "read-only sampled Worker observability",
  version: currentVersion,
  from: new Date(from).toISOString(),
  to: new Date(to).toISOString(),
  calls,
  truncatedMinuteSlices: truncated,
  missingHeaders,
  ineligibleNonDocument: nonDocument,
  excludedQa,
  sampledEligibleProductExecutions: requests.length,
  distinctExactUrlVariants: counts.size,
  repeatedExactUrlVariants: ranked.filter(n => n > 1).length,
  maximumRepeatedExecutions: repeats,
  maximumRepeatedExecutionsAfter100UrlEnrollment: top100Repeats,
  observedExecutionsAt100MostPopularUrls: requestsAtTop100,
  crossHalfExactUrlOverlap: overlap,
  firstHalfRequests: firstHalfRequests.length,
  firstHalfDistinct: firstHalf.size,
  secondHalfRequests: secondHalfRequests.length,
  secondHalfDistinct: secondHalf.size,
  heldoutRequestCoverageByFirstHalfUrls: heldoutCoveredRequests.length,
  heldoutCoveredSampledCpuMs: heldoutCoveredRequests.reduce((sum, item) => sum + item.cpu, 0),
  sampledProductCpuMs: cpu,
  eligibleMeanCpuMs: requests.length ? cpu / requests.length : null,
  admissionCpuOnly: evaluatePublicationCpuCase({
    preregisteredUrls: firstHalf.size,
    heldoutRequests: secondHalfRequests.length,
    heldoutCoveredRequests: heldoutCoveredRequests.length,
    coveredRequestCpuMs: heldoutCoveredRequests.reduce((sum, item) => sum + item.cpu, 0),
    observedMeanSsrCpuMs: requests.length ? cpu / requests.length : 0,
  }),
  caveats: "This is a sampled telemetry upper bound, not actual cache hit rate. Assumes snapshots ready and unchanged; does not include D1/R2 reads, publication generation, background polling, stale revisions or deploy churn. No request IDs/URLs are output."
}));
