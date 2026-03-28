/**
 * KV Cache Service
 * Provides a unified cache layer on top of Cloudflare KV
 */
export class CacheService {
  constructor(private kv: KVNamespace) {}

  async getProduct(asin: string): Promise<Record<string, unknown> | null> {
    const data = await this.kv.get(`product:${asin}`, 'json');
    return data as Record<string, unknown> | null;
  }

  async setProduct(asin: string, data: Record<string, unknown>): Promise<void> {
    await this.kv.put(`product:${asin}`, JSON.stringify(data), {
      expirationTtl: 86400,
    });
  }

  async deleteProduct(asin: string): Promise<void> {
    await this.kv.delete(`product:${asin}`);
  }

  async getRedirectUrl(agentSlug: string, asin: string): Promise<string | null> {
    return await this.kv.get(`redirect:${agentSlug}:${asin}`);
  }

  async setRedirectUrl(agentSlug: string, asin: string, url: string): Promise<void> {
    await this.kv.put(`redirect:${agentSlug}:${asin}`, url, {
      expirationTtl: 3600,
    });
  }

  async deleteRedirectUrl(agentSlug: string, asin: string): Promise<void> {
    await this.kv.delete(`redirect:${agentSlug}:${asin}`);
  }

  async getPageData(agentSlug: string, asin: string): Promise<Record<string, unknown> | null> {
    const data = await this.kv.get(`page:${agentSlug}:${asin}`, 'json');
    return data as Record<string, unknown> | null;
  }

  async setPageData(agentSlug: string, asin: string, data: Record<string, unknown>): Promise<void> {
    await this.kv.put(`page:${agentSlug}:${asin}`, JSON.stringify(data), {
      expirationTtl: 1800,
    });
  }

  async deletePageData(agentSlug: string, asin: string): Promise<void> {
    await this.kv.delete(`page:${agentSlug}:${asin}`);
  }

  async getAgent(slug: string): Promise<Record<string, unknown> | null> {
    const data = await this.kv.get(`agent:${slug}`, 'json');
    return data as Record<string, unknown> | null;
  }

  async setAgent(slug: string, data: Record<string, unknown>): Promise<void> {
    await this.kv.put(`agent:${slug}`, JSON.stringify(data), {
      expirationTtl: 3600,
    });
  }

  async deleteAgent(slug: string): Promise<void> {
    await this.kv.delete(`agent:${slug}`);
  }

  async invalidateForAgent(agentSlug: string): Promise<void> {
    await this.deleteAgent(agentSlug);
  }

  async invalidateForProduct(asin: string): Promise<void> {
    await this.deleteProduct(asin);
  }
}
