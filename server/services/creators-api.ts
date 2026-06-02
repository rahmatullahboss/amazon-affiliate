import type { Marketplace } from "../schemas";
import type { AmazonProductData } from "./product-ingestion";
import {
  AmazonProductFetchError,
  createAmazonProductFetchError,
} from "./product-ingestion";

export interface CreatorsApiInput {
  asin: string;
  marketplace: Marketplace;
  lwaClientId: string;
  lwaClientSecret: string;
  scope?: string;
}

export interface CreatorsTokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CreatorsTokenCacheEntry>();

export function clearCreatorsTokenCacheForTests(): void {
  tokenCache.clear();
}

export function getCreatorsRegionBaseUrl(marketplace: Marketplace): string {
  if (marketplace === "US" || marketplace === "CA") {
    return "https://creatorsapi-na.amazon.com";
  }
  return "https://creatorsapi-eu.amazon.com";
}

export async function getCreatorsAccessToken(
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  void clientId;
  void clientSecret;
  void scope;
  throw new Error("not implemented");
}

export async function fetchCreatorsProduct(
  input: CreatorsApiInput
): Promise<AmazonProductData> {
  void input;
  throw new Error("not implemented");
}

export function mapCreatorsProductResponse(
  payload: unknown
): AmazonProductData {
  void payload;
  throw new Error("not implemented");
}

export { AmazonProductFetchError, createAmazonProductFetchError };
