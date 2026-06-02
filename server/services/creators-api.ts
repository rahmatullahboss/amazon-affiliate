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

interface CreatorsImageRef {
  url?: string | null;
}

interface CreatorsProductPayload {
  title?: string | null;
  mainImage?: CreatorsImageRef | null;
  category?: string | null;
  description?: string | null;
  features?: string[] | null;
  images?: CreatorsImageRef[] | null;
  aplusImages?: CreatorsImageRef[] | null;
}

function extractImageUrls(
  images: CreatorsImageRef[] | null | undefined
): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((image) => image?.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

export function mapCreatorsProductResponse(
  payload: unknown
): AmazonProductData {
  const product = (payload ?? {}) as CreatorsProductPayload;
  return {
    title: product.title?.trim() ?? "",
    imageUrl: product.mainImage?.url?.trim() ?? "",
    category: product.category?.trim() || null,
    description: product.description?.trim() || null,
    features: Array.isArray(product.features) ? product.features : [],
    productImages: extractImageUrls(product.images),
    aplusImages: extractImageUrls(product.aplusImages),
  };
}

export { AmazonProductFetchError, createAmazonProductFetchError };
