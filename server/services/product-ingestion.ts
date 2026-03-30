import { AMAZON_DOMAINS } from "../utils/types";

interface AmazonProductData {
  title: string;
  imageUrl: string;
  category: string | null;
  description: string | null;
  features: string[];
  productImages: string[];
  aplusImages: string[];
}

interface ProductRecord {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  marketplace: string;
  category: string | null;
  status?: string;
  description?: string | null;
  features?: string | null;
  review_content?: string | null;
  product_images?: string | null;
  aplus_images?: string | null;
}

interface EnsureProductInput {
  db: D1Database;
  asin: string;
  marketplace: string;
  apiKey?: string;
  fallbackApiKeys?: string[];
  title?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  description?: string | null;
  features?: string[] | null;
  productImages?: string[] | null;
  aplusImages?: string[] | null;
  status?: string;
  updateExistingFromInput?: boolean;
  requireRealProductData?: boolean;
}

interface ParsedSheetProductRow {
  asin: string;
  marketplace: string;
  title: string | null;
  imageUrl: string | null;
  category: string | null;
  status: string;
}

export type AmazonProductFetchErrorCode =
  | "api_not_configured"
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  | "upstream_error"
  | "invalid_response"
  | "network_error";

export class AmazonProductFetchError extends Error {
  readonly code: AmazonProductFetchErrorCode;
  readonly asin: string;
  readonly marketplace: string;
  readonly status: number | null;

  constructor(input: {
    code: AmazonProductFetchErrorCode;
    asin: string;
    marketplace: string;
    message: string;
    status?: number | null;
  }) {
    super(input.message);
    this.name = "AmazonProductFetchError";
    this.code = input.code;
    this.asin = input.asin;
    this.marketplace = input.marketplace;
    this.status = input.status ?? null;
  }
}

const VALID_ASIN_REGEX = /^B[0-9A-Z]{9}$/;
const AMAZON_ASIN_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /[?&]asin=([A-Z0-9]{10})(?:[&#]|$)/i,
];

export function normalizeAsin(rawAsin: string): string {
  return rawAsin.trim().toUpperCase();
}

export function isValidAsin(asin: string): boolean {
  return VALID_ASIN_REGEX.test(normalizeAsin(asin));
}

export function extractAsinFromInput(rawInput: string): string | null {
  const normalized = normalizeAsin(rawInput);
  if (isValidAsin(normalized)) {
    return normalized;
  }

  for (const pattern of AMAZON_ASIN_PATTERNS) {
    const match = rawInput.match(pattern);
    const extracted = match?.[1]?.toUpperCase() || "";
    if (isValidAsin(extracted)) {
      return extracted;
    }
  }

  return null;
}

export function buildFallbackImageUrl(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/I/${asin}._AC_SL1500_.jpg`;
}

function toRapidApiCountryCode(marketplace: string): string {
  if (marketplace === "UK") {
    return "GB";
  }

  return marketplace;
}

function getMarketplaceDomain(marketplace: string): string {
  return AMAZON_DOMAINS[marketplace] || AMAZON_DOMAINS.US;
}

function getFetchErrorPriority(code: AmazonProductFetchErrorCode): number {
  switch (code) {
    case "not_found":
    case "invalid_response":
      return 5;
    case "rate_limited":
      return 4;
    case "upstream_error":
    case "network_error":
      return 3;
    case "unauthorized":
      return 2;
    case "api_not_configured":
      return 1;
  }
}

function pickPreferredFetchError(
  current: AmazonProductFetchError | null,
  candidate: AmazonProductFetchError
): AmazonProductFetchError {
  if (!current) {
    return candidate;
  }

  return getFetchErrorPriority(candidate.code) >= getFetchErrorPriority(current.code)
    ? candidate
    : current;
}

function createAmazonProductFetchError(input: {
  asin: string;
  marketplace: string;
  code: AmazonProductFetchErrorCode;
  status?: number | null;
}): AmazonProductFetchError {
  const domain = getMarketplaceDomain(input.marketplace);

  switch (input.code) {
    case "api_not_configured":
      return new AmazonProductFetchError({
        ...input,
        message: "Amazon product API is not configured.",
      });
    case "not_found":
      return new AmazonProductFetchError({
        ...input,
        message: `ASIN was detected, but no live product data was returned from ${domain}. Check whether the product is available in that marketplace.`,
      });
    case "rate_limited":
      return new AmazonProductFetchError({
        ...input,
        message: "The Amazon data provider is temporarily rate limited. Please retry shortly.",
      });
    case "unauthorized":
      return new AmazonProductFetchError({
        ...input,
        message: "Amazon product API credentials were rejected by the provider.",
      });
    case "upstream_error":
      return new AmazonProductFetchError({
        ...input,
        message: "The Amazon data provider returned an unexpected server error.",
      });
    case "invalid_response":
      return new AmazonProductFetchError({
        ...input,
        message: `Amazon returned an incomplete response for ${domain}. The product may be unavailable in that marketplace.`,
      });
    case "network_error":
      return new AmazonProductFetchError({
        ...input,
        message: "Could not reach the Amazon data provider.",
      });
  }
}

function mapResponseStatusToFetchErrorCode(status: number): AmazonProductFetchErrorCode {
  if (status === 401 || status === 403) {
    return "unauthorized";
  }

  if (status === 404) {
    return "not_found";
  }

  if (status === 429) {
    return "rate_limited";
  }

  return "upstream_error";
}

export function getAmazonProductFetchErrorMessage(error: unknown): string {
  if (!(error instanceof AmazonProductFetchError)) {
    return "Could not fetch live product data for this ASIN. Try another ASIN or ask admin to review it.";
  }

  const marketplaceDomain = getMarketplaceDomain(error.marketplace);

  switch (error.code) {
    case "api_not_configured":
      return "Amazon product API is not configured. Product link generation needs live product data.";
    case "not_found":
    case "invalid_response":
      return `ASIN was detected, but no live product data came back from ${marketplaceDomain}. Check whether the product is live in that marketplace, then retry or choose the correct country.`;
    case "rate_limited":
      return "Amazon data provider is temporarily rate limited. Please wait a minute and retry.";
    case "unauthorized":
      return "Amazon product API credentials were rejected. Ask admin to review the API setup.";
    case "upstream_error":
    case "network_error":
      return "Could not reach the live Amazon data service right now. Please retry shortly.";
  }
}

function buildEditorialReviewContent(input: {
  title: string;
  category: string | null;
  description: string | null;
  features: string[];
}): string | null {
  const lines: string[] = [];
  const cleanDescription = input.description?.trim() || "";
  const primaryFeatures = input.features
    .map((feature) => feature.trim())
    .filter((feature) => feature.length > 0)
    .slice(0, 4);

  if (cleanDescription) {
    lines.push(cleanDescription);
  } else if (primaryFeatures.length > 0) {
    lines.push(
      `${input.title} is positioned as a practical ${input.category?.toLowerCase() || "Amazon"} pick with a focus on the features highlighted below.`
    );
  }

  if (primaryFeatures.length > 0) {
    lines.push("What stands out:");
    for (const feature of primaryFeatures) {
      lines.push(`• ${feature}`);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  lines.push(
    "Check Amazon for the latest pricing, delivery details, and customer review context before ordering."
  );

  return lines.join("\n");
}

export async function fetchAmazonProductData(
  apiKey: string,
  asin: string,
  marketplace: string
): Promise<AmazonProductData> {
  const apiCountryCode = toRapidApiCountryCode(marketplace);
  let response: Response;

  try {
    response = await fetch(
      `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=${apiCountryCode}`,
      {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
        },
      }
    );
  } catch {
    throw createAmazonProductFetchError({
      asin,
      marketplace,
      code: "network_error",
    });
  }

  if (!response.ok) {
    throw createAmazonProductFetchError({
      asin,
      marketplace,
      code: mapResponseStatusToFetchErrorCode(response.status),
      status: response.status,
    });
  }

  let result: {
    data?: {
      product_title?: string;
      product_photo?: string;
      product_photos?: string[];
      product_category?: string;
      product_description?: string;
      about_product?: string[];
      aplus_images?: string[];
    };
  };

  try {
    result = (await response.json()) as {
      data?: {
        product_title?: string;
        product_photo?: string;
        product_photos?: string[];
        product_category?: string;
        product_description?: string;
        about_product?: string[];
        aplus_images?: string[];
      };
    };
  } catch {
    throw createAmazonProductFetchError({
      asin,
      marketplace,
      code: "invalid_response",
      status: response.status,
    });
  }

  if (!result.data?.product_title) {
    throw createAmazonProductFetchError({
      asin,
      marketplace,
      code: "invalid_response",
      status: response.status,
    });
  }

  return {
    title: result.data.product_title.substring(0, 500),
    imageUrl: result.data.product_photo || buildFallbackImageUrl(asin),
    category: result.data.product_category || null,
    description: result.data.product_description?.substring(0, 2000) || null,
    features: result.data.about_product?.slice(0, 6) || [],
    productImages: result.data.product_photos?.slice(0, 8) || [],
    aplusImages: result.data.aplus_images?.slice(0, 6) || [],
  };
}

export function resolveAmazonApiKeys(input: {
  primaryApiKey?: string;
  fallbackApiKeys?: string[];
}): string[] {
  return [input.primaryApiKey, ...(input.fallbackApiKeys ?? [])]
    .map((value) => value?.trim() || "")
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}

export async function fetchAmazonProductDataWithFallback(input: {
  asin: string;
  marketplace: string;
  primaryApiKey?: string;
  fallbackApiKeys?: string[];
}): Promise<AmazonProductData> {
  const apiKeys = resolveAmazonApiKeys(input);
  if (apiKeys.length === 0) {
    throw createAmazonProductFetchError({
      asin: input.asin,
      marketplace: input.marketplace,
      code: "api_not_configured",
    });
  }

  let preferredError: AmazonProductFetchError | null = null;

  for (const apiKey of apiKeys) {
    try {
      return await fetchAmazonProductData(apiKey, input.asin, input.marketplace);
    } catch (error) {
      if (error instanceof AmazonProductFetchError) {
        preferredError = pickPreferredFetchError(preferredError, error);
        continue;
      }

      throw error;
    }
  }

  throw preferredError ?? createAmazonProductFetchError({
    asin: input.asin,
    marketplace: input.marketplace,
    code: "upstream_error",
  });
}

export async function ensureProductRecord(input: EnsureProductInput): Promise<ProductRecord> {
  const asin = normalizeAsin(input.asin);
  const marketplace = input.marketplace;
  const status = input.status || "active";

  let product = await input.db
    .prepare(
      `SELECT id, asin, title, image_url, marketplace, category, status, description, features, review_content, product_images, aplus_images
       FROM products
       WHERE asin = ? AND marketplace = ?`
    )
    .bind(asin, marketplace)
    .first<ProductRecord>();

  const explicitTitle = input.title?.trim() || null;
  const explicitImageUrl = input.imageUrl?.trim() || null;
  const explicitCategory = input.category?.trim() || null;
  const explicitDescription = input.description?.trim() || null;
  const explicitFeatures = input.features?.length ? JSON.stringify(input.features) : null;
  const explicitProductImages = input.productImages?.length ? JSON.stringify(input.productImages) : null;
  const explicitAplusImages = input.aplusImages?.length ? JSON.stringify(input.aplusImages) : null;

  if (!product) {
    let fetched: AmazonProductData | null = null;

    if (!explicitTitle || !explicitImageUrl) {
      if (input.apiKey) {
        fetched = await fetchAmazonProductDataWithFallback({
          asin,
          marketplace,
          primaryApiKey: input.apiKey,
          fallbackApiKeys: input.fallbackApiKeys,
        });
      } else if (input.requireRealProductData) {
        throw createAmazonProductFetchError({
          asin,
          marketplace,
          code: "api_not_configured",
        });
      }
    }

    const title = explicitTitle || fetched?.title || `Product ${asin}`;
    const imageUrl = explicitImageUrl || fetched?.imageUrl || buildFallbackImageUrl(asin);
    const category = explicitCategory ?? fetched?.category ?? null;
    const description = explicitDescription ?? fetched?.description ?? null;
    const resolvedFeatures =
      input.features?.length ? input.features : fetched?.features?.length ? fetched.features : [];
    const features =
      explicitFeatures ?? (resolvedFeatures.length ? JSON.stringify(resolvedFeatures) : null);
    const productImages = explicitProductImages ?? (fetched?.productImages?.length ? JSON.stringify(fetched.productImages) : null);
    const aplusImages = explicitAplusImages ?? (fetched?.aplusImages?.length ? JSON.stringify(fetched.aplusImages) : null);
    const reviewContent = buildEditorialReviewContent({
      title,
      category,
      description,
      features: resolvedFeatures,
    });

    await input.db
      .prepare(
        `INSERT INTO products (
           asin,
           title,
           image_url,
           marketplace,
           category,
           description,
           features,
           review_content,
           product_images,
           aplus_images,
           status,
           fetched_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        asin,
        title,
        imageUrl,
        marketplace,
        category,
        description,
        features,
        reviewContent,
        productImages,
        aplusImages,
        status,
        fetched ? new Date().toISOString() : null
      )
      .run();

    product = await input.db
      .prepare(
        `SELECT id, asin, title, image_url, marketplace, category, status, description, features, review_content, product_images, aplus_images
         FROM products
         WHERE asin = ? AND marketplace = ?`
      )
      .bind(asin, marketplace)
      .first<ProductRecord>();
  } else if (input.updateExistingFromInput) {
    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (explicitTitle) {
      updates.push("title = ?");
      values.push(explicitTitle);
    }
    if (explicitImageUrl) {
      updates.push("image_url = ?");
      values.push(explicitImageUrl);
    }
    if (input.category !== undefined) {
      updates.push("category = ?");
      values.push(explicitCategory);
    }
    if (input.description !== undefined) {
      updates.push("description = ?");
      values.push(explicitDescription);
    }
    if (input.features !== undefined) {
      updates.push("features = ?");
      values.push(explicitFeatures);
    }
    if (
      input.description !== undefined ||
      input.features !== undefined ||
      input.title !== undefined ||
      input.category !== undefined
    ) {
      const resolvedReviewContent = buildEditorialReviewContent({
        title: explicitTitle || product.title,
        category:
          input.category !== undefined
            ? explicitCategory
            : product.category ?? null,
        description:
          input.description !== undefined
            ? explicitDescription
            : product.description ?? null,
        features:
          input.features !== undefined
            ? input.features ?? []
            : (() => {
                try {
                  const parsed = JSON.parse(product.features || "[]") as unknown;
                  return Array.isArray(parsed)
                    ? parsed.filter((item): item is string => typeof item === "string")
                    : [];
                } catch {
                  return [];
                }
              })(),
      });
      updates.push("review_content = ?");
      values.push(resolvedReviewContent);
    }
    if (input.productImages !== undefined) {
      updates.push("product_images = ?");
      values.push(explicitProductImages);
    }
    if (input.aplusImages !== undefined) {
      updates.push("aplus_images = ?");
      values.push(explicitAplusImages);
    }
    if (input.status) {
      updates.push("status = ?");
      values.push(status);
    }

    if (updates.length > 0) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
      await input.db
        .prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...values, product.id)
        .run();

      product = await input.db
        .prepare(
          `SELECT id, asin, title, image_url, marketplace, category, status, description, features, review_content, product_images, aplus_images
           FROM products
           WHERE id = ?`
        )
        .bind(product.id)
        .first<ProductRecord>();
    }
  }

  if (!product) {
    throw new Error("Product creation failed unexpectedly");
  }

  return product;
}

export async function refreshProductRecord(input: {
  db: D1Database;
  apiKey: string;
  fallbackApiKeys?: string[];
  asin: string;
  marketplace: string;
  status?: string;
}): Promise<ProductRecord> {
  const fetched = await fetchAmazonProductDataWithFallback({
    asin: input.asin,
    marketplace: input.marketplace,
    primaryApiKey: input.apiKey,
    fallbackApiKeys: input.fallbackApiKeys,
  });

  return ensureProductRecord({
    db: input.db,
    asin: input.asin,
    marketplace: input.marketplace,
    apiKey: input.apiKey,
    fallbackApiKeys: input.fallbackApiKeys,
    title: fetched.title,
    imageUrl: fetched.imageUrl,
    category: fetched.category,
    description: fetched.description,
    features: fetched.features,
    productImages: fetched.productImages,
    aplusImages: fetched.aplusImages,
    status: input.status || "active",
    updateExistingFromInput: true,
    requireRealProductData: true,
  });
}

export function parseSheetProductRow(
  row: Record<string, string>,
  defaultMarketplace: string
): ParsedSheetProductRow | null {
  const asin = normalizeAsin(getRowValue(row, ["asin", "product_asin"]));
  if (!isValidAsin(asin)) {
    return null;
  }

  const marketplace = (getRowValue(row, ["marketplace", "country"]) || defaultMarketplace || "US")
    .trim()
    .toUpperCase();

  return {
    asin,
    marketplace,
    title: getNullableRowValue(row, ["custom_title", "title", "product_title"]),
    imageUrl: getNullableRowValue(row, ["image_url", "image", "product_photo"]),
    category: getNullableRowValue(row, ["category", "product_category"]),
    status: getNullableRowValue(row, ["status"]) || "active",
  };
}

function getRowValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (row[key]) {
      return row[key];
    }
  }
  return "";
}

function getNullableRowValue(row: Record<string, string>, keys: string[]): string | null {
  const value = getRowValue(row, keys).trim();
  return value.length > 0 ? value : null;
}
