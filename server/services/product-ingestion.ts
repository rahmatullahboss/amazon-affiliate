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
  product_images?: string | null;
  aplus_images?: string | null;
}

interface EnsureProductInput {
  db: D1Database;
  asin: string;
  marketplace: string;
  apiKey?: string;
  title?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  description?: string | null;
  features?: string[] | null;
  productImages?: string[] | null;
  aplusImages?: string[] | null;
  status?: string;
  updateExistingFromInput?: boolean;
}

interface ParsedSheetProductRow {
  asin: string;
  marketplace: string;
  title: string | null;
  imageUrl: string | null;
  category: string | null;
  status: string;
}

const VALID_ASIN_REGEX = /^B[0-9A-Z]{9}$/;

export function normalizeAsin(rawAsin: string): string {
  return rawAsin.trim().toUpperCase();
}

export function isValidAsin(asin: string): boolean {
  return VALID_ASIN_REGEX.test(normalizeAsin(asin));
}

export function buildFallbackImageUrl(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/I/${asin}._AC_SL1500_.jpg`;
}

export async function fetchAmazonProductData(
  apiKey: string,
  asin: string,
  marketplace: string
): Promise<AmazonProductData | null> {
  const response = await fetch(
    `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=${marketplace}`,
    {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as {
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

  if (!result.data?.product_title) {
    return null;
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

export async function ensureProductRecord(input: EnsureProductInput): Promise<ProductRecord> {
  const asin = normalizeAsin(input.asin);
  const marketplace = input.marketplace;
  const status = input.status || "active";

  let product = await input.db
    .prepare(
      `SELECT id, asin, title, image_url, marketplace, category, status, product_images, aplus_images
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
    const fetched =
      (!explicitTitle || !explicitImageUrl) && input.apiKey
        ? await fetchAmazonProductData(input.apiKey, asin, marketplace)
        : null;

    const title = explicitTitle || fetched?.title || `Product ${asin}`;
    const imageUrl = explicitImageUrl || fetched?.imageUrl || buildFallbackImageUrl(asin);
    const category = explicitCategory ?? fetched?.category ?? null;
    const description = explicitDescription ?? fetched?.description ?? null;
    const features = explicitFeatures ?? (fetched?.features.length ? JSON.stringify(fetched.features) : null);
    const productImages = explicitProductImages ?? (fetched?.productImages?.length ? JSON.stringify(fetched.productImages) : null);
    const aplusImages = explicitAplusImages ?? (fetched?.aplusImages?.length ? JSON.stringify(fetched.aplusImages) : null);

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
           product_images,
           aplus_images,
           status,
           fetched_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        asin,
        title,
        imageUrl,
        marketplace,
        category,
        description,
        features,
        productImages,
        aplusImages,
        status,
        fetched ? new Date().toISOString() : null
      )
      .run();

    product = await input.db
      .prepare(
        `SELECT id, asin, title, image_url, marketplace, category, status, product_images, aplus_images
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
          `SELECT id, asin, title, image_url, marketplace, category, status, product_images, aplus_images
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
