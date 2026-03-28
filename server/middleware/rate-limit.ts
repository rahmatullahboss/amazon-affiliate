/**
 * Rate Limiting Middleware for Redirect Engine
 * Uses Cloudflare KV with TTL-based auto-expiry.
 *
 * Limits:
 * - 60 redirects per IP per minute (prevents click flooding)
 * - 10,000 redirects per agent per hour (prevents abuse)
 */

export async function checkRedirectRateLimit(
  kv: KVNamespace,
  ip: string,
  agentSlug: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Skip rate limiting for empty IPs (shouldn't happen on Cloudflare)
  if (!ip) return { allowed: true };

  // 1. Per-IP limit: 60 requests per minute
  const ipKey = `rl:ip:${ip}`;
  const ipCount = parseInt((await kv.get(ipKey)) || '0');

  if (ipCount >= 60) {
    return { allowed: false, reason: 'IP rate limit exceeded (60/min)' };
  }

  // 2. Per-Agent limit: 10,000 requests per hour
  const agentKey = `rl:agent:${agentSlug}`;
  const agentCount = parseInt((await kv.get(agentKey)) || '0');

  if (agentCount >= 10_000) {
    return { allowed: false, reason: 'Agent rate limit exceeded (10000/hr)' };
  }

  // Increment counters asynchronously (don't block response)
  // These run in the background via waitUntil()
  return { allowed: true };
}

/**
 * Increment rate limit counters — call via waitUntil() for non-blocking
 */
export async function incrementRateLimitCounters(
  kv: KVNamespace,
  ip: string,
  agentSlug: string
): Promise<void> {
  const ipKey = `rl:ip:${ip}`;
  const agentKey = `rl:agent:${agentSlug}`;

  const [ipCount, agentCount] = await Promise.all([
    kv.get(ipKey),
    kv.get(agentKey),
  ]);

  await Promise.all([
    kv.put(ipKey, String(parseInt(ipCount || '0') + 1), {
      expirationTtl: 60, // 1 minute window
    }),
    kv.put(agentKey, String(parseInt(agentCount || '0') + 1), {
      expirationTtl: 3600, // 1 hour window
    }),
  ]);
}
