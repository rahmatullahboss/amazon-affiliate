/**
 * Refetch script — backfill product_images and aplus_images from RapidAPI
 * with exponential backoff retry on 429 rate limits.
 *
 * Usage: npx tsx scripts/refetch-images.ts
 * 
 * Only fetches products that don't already have product_images set.
 */

const API_KEY = "9526f19141mshd939399dce12cbdp1d9e68jsn75e244cf35ad";
const BASE_DELAY_MS = 3000;     // 3 seconds between requests
const MAX_RETRIES = 4;
const BATCH_SIZE = 5;           // Apply SQL every 5 successful fetches
const COOLDOWN_AFTER_429 = 15000; // 15 second cooldown after a 429

interface ApiResponse {
  status: string;
  data?: {
    product_title?: string;
    product_photo?: string;
    product_photos?: string[];
    product_category?: string;
    product_description?: string;
    about_product?: string[];
    aplus_images?: string[];
  };
}

interface ProductInfo {
  asin: string;
  marketplace: string;
}

interface FetchResult {
  productImages: string[];
  aplusImages: string[];
  title: string | null;
  imageUrl: string | null;
  category: string | null;
  description: string | null;
  features: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(asin: string, marketplace: string): Promise<FetchResult | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(
      `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=${marketplace}`,
      {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
        },
      }
    );

    if (res.status === 429) {
      const waitMs = COOLDOWN_AFTER_429 * (attempt + 1);
      console.log(`  ⏳ Rate limited (429), waiting ${waitMs / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      console.error(`  ❌ HTTP ${res.status} for ${asin}`);
      return null;
    }

    const json = (await res.json()) as ApiResponse;

    if (!json.data || !json.data.product_title) {
      console.warn(`  ⚠️ No data returned for ${asin}`);
      return null;
    }

    return {
      productImages: json.data.product_photos?.slice(0, 8) || [],
      aplusImages: json.data.aplus_images?.slice(0, 6) || [],
      title: json.data.product_title?.substring(0, 500) || null,
      imageUrl: json.data.product_photo || null,
      category: json.data.product_category || null,
      description: json.data.product_description?.substring(0, 2000) || null,
      features: json.data.about_product?.slice(0, 6) || [],
    };
  }

  console.error(`  ❌ All retries exhausted for ${asin}`);
  return null;
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

function buildUpdateSql(asin: string, marketplace: string, data: FetchResult): string {
  const updates: string[] = [];

  const productImagesJson = data.productImages.length > 0 ? JSON.stringify(data.productImages) : "";
  const aplusImagesJson = data.aplusImages.length > 0 ? JSON.stringify(data.aplusImages) : "";
  const featuresJson = data.features.length > 0 ? JSON.stringify(data.features) : "";

  if (productImagesJson) updates.push(`product_images = '${escapeSql(productImagesJson)}'`);
  if (aplusImagesJson) updates.push(`aplus_images = '${escapeSql(aplusImagesJson)}'`);
  if (data.title) updates.push(`title = '${escapeSql(data.title)}'`);
  if (data.imageUrl) updates.push(`image_url = '${escapeSql(data.imageUrl)}'`);
  if (data.category) updates.push(`category = '${escapeSql(data.category)}'`);
  if (data.description) updates.push(`description = '${escapeSql(data.description)}'`);
  if (featuresJson) updates.push(`features = '${escapeSql(featuresJson)}'`);
  updates.push(`fetched_at = datetime('now')`);
  updates.push(`updated_at = datetime('now')`);

  return `UPDATE products SET ${updates.join(", ")} WHERE asin = '${asin}' AND marketplace = '${marketplace}';`;
}

async function applySqlBatch(sqlStatements: string[], target: "remote" | "local"): Promise<void> {
  const { writeFileSync } = await import("fs");
  const { execSync } = await import("child_process");
  const sqlFile = `/tmp/refetch-batch-${Date.now()}.sql`;
  writeFileSync(sqlFile, sqlStatements.join("\n"), "utf-8");

  const flag = target === "remote" ? "--remote" : "--local";
  try {
    execSync(`npx wrangler d1 execute DB ${flag} --file=${sqlFile}`, {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: "pipe",
    });
    console.log(`  💾 Applied ${sqlStatements.length} updates to ${target} DB`);
  } catch (e) {
    console.error(`  ⚠️ Failed to apply batch to ${target}. SQL saved at ${sqlFile}`);
  }
}

async function main(): Promise<void> {
  const { execSync } = await import("child_process");

  console.log("🔍 Fetching products that need image backfill from remote DB...\n");

  const rawOutput = execSync(
    `npx wrangler d1 execute DB --remote --command="SELECT asin, marketplace FROM products WHERE is_active = 1 AND status = 'active' AND (product_images IS NULL OR product_images = '')" --json 2>/dev/null`,
    { cwd: process.cwd(), encoding: "utf-8" }
  );

  const parsed = JSON.parse(rawOutput) as Array<{ results: ProductInfo[] }>;
  const products = parsed[0]?.results || [];

  console.log(`📦 Found ${products.length} products needing image backfill\n`);

  if (products.length === 0) {
    console.log("✅ All products already have images! Nothing to do.");
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let batchSql: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const { asin, marketplace } = products[i];
    console.log(`[${i + 1}/${products.length}] Fetching ${asin} (${marketplace})...`);

    const data = await fetchWithRetry(asin, marketplace);

    if (data) {
      batchSql.push(buildUpdateSql(asin, marketplace, data));
      console.log(`  ✅ ${data.productImages.length} gallery, ${data.aplusImages.length} A+, ${data.features.length} features`);
      successCount++;

      // Apply batch periodically
      if (batchSql.length >= BATCH_SIZE) {
        await applySqlBatch(batchSql, "remote");
        batchSql = [];
      }
    } else {
      failCount++;
    }

    // Delay between requests
    if (i < products.length - 1) {
      await sleep(BASE_DELAY_MS);
    }
  }

  // Flush remaining batch
  if (batchSql.length > 0) {
    await applySqlBatch(batchSql, "remote");
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`✅ Success: ${successCount} | ❌ Failed: ${failCount} | Total: ${products.length}`);
  console.log(`═══════════════════════════════════\n`);
}

main().catch(console.error);
