/**
 * Bot Guard — Detects and blocks non-human traffic on redirect engine.
 *
 * Why this matters:
 * - Amazon monitors click patterns and flags suspicious bot traffic
 * - Bot clicks inflate analytics and waste KV/D1 resources
 * - Competitors can weaponize bots to get your Associates account banned
 */

// Known bot/automation user-agent patterns
const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /curl/i,
  /wget/i,
  /HeadlessChrome/i,
  /PhantomJS/i,
  /python-requests/i,
  /python-urllib/i,
  /Go-http-client/i,
  /httpie/i,
  /PostmanRuntime/i,
  /Lighthouse/i,
  /Googlebot/i,
  /Bingbot/i,
  /Slurp/i,
  /DuckDuckBot/i,
  /Baiduspider/i,
  /YandexBot/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /Applebot/i,
  /Screaming Frog/i,
  /AhrefsBot/i,
  /SemrushBot/i,
  /DotBot/i,
  /MJ12bot/i,
  /Bytespider/i,
];

/**
 * Check if the request looks like it's from a bot or automation tool.
 * Returns true if the request should be BLOCKED.
 */
export function isSuspiciousRequest(userAgent: string | undefined): boolean {
  // No user-agent at all → very suspicious
  if (!userAgent) return true;

  // User-agent too short → likely scripted
  if (userAgent.length < 15) return true;

  // Check against known bot patterns
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if this click is a duplicate (same IP + same product within 30 seconds).
 * Returns true if the click should be SKIPPED for analytics (but redirect still works).
 */
export async function isDuplicateClick(
  kv: KVNamespace,
  ipHash: string,
  asin: string
): Promise<boolean> {
  const dedupKey = `dedup:${ipHash}:${asin}`;
  const existing = await kv.get(dedupKey);

  if (existing) {
    return true; // Duplicate — skip analytics insert
  }

  // Mark this click — expires in 30 seconds
  await kv.put(dedupKey, '1', { expirationTtl: 30 });
  return false;
}
