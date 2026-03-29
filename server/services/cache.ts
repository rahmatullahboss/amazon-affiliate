import { safeKvDelete, safeKvGetJson, safeKvGetText, safeKvPut } from "./kv-safe";

/**
 * KV Cache Service
 * Provides a unified cache layer on top of Cloudflare KV
 */
export class CacheService {
  constructor(private kv: KVNamespace) {}

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

  async getRedirectUrl(agentSlug: string, asin: string): Promise<string | null> {
    return await safeKvGetText(this.kv, `redirect:${agentSlug}:${asin}`);
  }

  async setRedirectUrl(agentSlug: string, asin: string, url: string): Promise<void> {
    await safeKvPut(this.kv, `redirect:${agentSlug}:${asin}`, url, {
      expirationTtl: 3600,
    });
  }

  async deleteRedirectUrl(agentSlug: string, asin: string): Promise<void> {
    await safeKvDelete(this.kv, `redirect:${agentSlug}:${asin}`);
  }

  async getPageData(agentSlug: string, asin: string): Promise<Record<string, unknown> | null> {
    return await safeKvGetJson<Record<string, unknown>>(this.kv, `page:${agentSlug}:${asin}`);
  }

  async setPageData(agentSlug: string, asin: string, data: Record<string, unknown>): Promise<void> {
    await safeKvPut(this.kv, `page:${agentSlug}:${asin}`, JSON.stringify(data), {
      expirationTtl: 1800,
    });
  }

  async deletePageData(agentSlug: string, asin: string): Promise<void> {
    await safeKvDelete(this.kv, `page:${agentSlug}:${asin}`);
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
