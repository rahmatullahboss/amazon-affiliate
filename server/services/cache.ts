import { safeKvDelete, safeKvGetJson, safeKvGetText, safeKvPut } from "./kv-safe";

/**
 * KV Cache Service
 * Provides a unified cache layer on top of Cloudflare KV
 */
export class CacheService {
  constructor(private kv: KVNamespace) {}

  private buildScopedKey(prefix: string, agentSlug: string, asin: string, marketplace?: string): string {
    const scope = marketplace?.trim().toUpperCase();
    return scope ? `${prefix}:${agentSlug}:${scope}:${asin}` : `${prefix}:${agentSlug}:${asin}`;
  }

  async getProduct(asin: string): Promise<Record<string, unknown> | null> {
    return await safeKvGetJson<Record<string, unknown>>(this.kv, `product:${asin}`);
  }

  async setProduct(asin: string, data: Record<string, unknown>): Promise<void> {
    await safeKvPut(this.kv, `product:${asin}`, JSON.stringify(data), {
      expirationTtl: 86400,
    });
  }

  async deleteProduct(asin: string): Promise<void> {
    await safeKvDelete(this.kv, `product:${asin}`);
  }

  async getRedirectUrl(agentSlug: string, asin: string, marketplace?: string): Promise<string | null> {
    return await safeKvGetText(this.kv, this.buildScopedKey('redirect', agentSlug, asin, marketplace));
  }

  async setRedirectUrl(agentSlug: string, asin: string, url: string, marketplace?: string): Promise<void> {
    await safeKvPut(this.kv, this.buildScopedKey('redirect', agentSlug, asin, marketplace), url, {
      expirationTtl: 3600,
    });
  }

  async deleteRedirectUrl(agentSlug: string, asin: string, marketplace?: string): Promise<void> {
    const keys = new Set<string>([
      this.buildScopedKey('redirect', agentSlug, asin),
      this.buildScopedKey('redirect', agentSlug, asin, marketplace),
    ]);

    await Promise.all(Array.from(keys).map((key) => safeKvDelete(this.kv, key)));
  }

  async getPageData(agentSlug: string, asin: string, marketplace?: string): Promise<Record<string, unknown> | null> {
    return await safeKvGetJson<Record<string, unknown>>(
      this.kv,
      this.buildScopedKey('page', agentSlug, asin, marketplace)
    );
  }

  async setPageData(agentSlug: string, asin: string, data: Record<string, unknown>, marketplace?: string): Promise<void> {
    await safeKvPut(this.kv, this.buildScopedKey('page', agentSlug, asin, marketplace), JSON.stringify(data), {
      expirationTtl: 1800,
    });
  }

  async deletePageData(agentSlug: string, asin: string, marketplace?: string): Promise<void> {
    const keys = new Set<string>([
      this.buildScopedKey('page', agentSlug, asin),
      this.buildScopedKey('page', agentSlug, asin, marketplace),
    ]);

    await Promise.all(Array.from(keys).map((key) => safeKvDelete(this.kv, key)));
  }

  async getAgent(slug: string): Promise<Record<string, unknown> | null> {
    return await safeKvGetJson<Record<string, unknown>>(this.kv, `agent:${slug}`);
  }

  async setAgent(slug: string, data: Record<string, unknown>): Promise<void> {
    await safeKvPut(this.kv, `agent:${slug}`, JSON.stringify(data), {
      expirationTtl: 3600,
    });
  }

  async deleteAgent(slug: string): Promise<void> {
    await safeKvDelete(this.kv, `agent:${slug}`);
  }

  async invalidateForAgent(agentSlug: string): Promise<void> {
    await this.deleteAgent(agentSlug);
  }

  async invalidateForProduct(asin: string): Promise<void> {
    await this.deleteProduct(asin);
  }
}
