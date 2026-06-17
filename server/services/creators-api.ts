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

interface CreatorsTokenResponse {
  access_token: string;
  expires_in: number;
}

const TOKEN_REFRESH_BUFFER_MS = 60_000;

export async function getCreatorsAccessToken(
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  const cacheKey = `${clientId}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (response.status === 401 || response.status === 403) {
    throw createAmazonProductFetchError({
      asin: "",
      marketplace: "US",
      code: "unauthorized",
    });
  }

  if (!response.ok) {
    throw createAmazonProductFetchError({
      asin: "",
      marketplace: "US",
      code: "upstream_error",
      status: response.status,
    });
  }

  const payload = (await response.json()) as Partial<CreatorsTokenResponse>;
  if (typeof payload.access_token !== "string" || typeof payload.expires_in !== "number") {
    throw createAmazonProductFetchError({
      asin: "",
      marketplace: "US",
      code: "invalid_response",
    });
  }

  const token = payload.access_token;
  const expiresAt = now + payload.expires_in * 1000;
  tokenCache.set(cacheKey, { token, expiresAt });
  return token;
}

export async function fetchCreatorsProduct(
  input: CreatorsApiInput
): Promise<AmazonProductData> {
  const scope = input.scope ?? "creatorsapi::read";
  const baseUrl = getCreatorsRegionBaseUrl(input.marketplace);
  const url = `${baseUrl}/products/${encodeURIComponent(input.asin)}?marketplace=${encodeURIComponent(input.marketplace)}`;

  const performFetch = async (accessToken: string) => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "not_found",
      });
    }
    if (response.status === 429) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "rate_limited",
      });
    }
    if (response.status === 401 || response.status === 403) {
      return { kind: "unauthorized" as const, response };
    }
    if (response.status >= 500) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "upstream_error",
      });
    }
    if (!response.ok) {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "upstream_error",
        status: response.status,
      });
    }
    return { kind: "ok" as const, response };
  };

  let accessToken = await getCreatorsAccessToken(
    input.lwaClientId,
    input.lwaClientSecret,
    scope
  );

  let result = await performFetch(accessToken);
  if (result.kind === "unauthorized") {
    const cacheKey = `${input.lwaClientId}:${scope}`;
    tokenCache.delete(cacheKey);
    accessToken = await getCreatorsAccessToken(
      input.lwaClientId,
      input.lwaClientSecret,
      scope
    );
    result = await performFetch(accessToken);
    if (result.kind === "unauthorized") {
      throw createAmazonProductFetchError({
        asin: input.asin,
        marketplace: input.marketplace,
        code: "unauthorized",
      });
    }
  }

  try {
    const payload = (await result.response.json()) as unknown;
    return mapCreatorsProductResponse(payload);
  } catch {
    throw createAmazonProductFetchError({
      asin: input.asin,
      marketplace: input.marketplace,
      code: "invalid_response",
    });
  }
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
