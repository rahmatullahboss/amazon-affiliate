/**
 * enrich.js — Standalone script to fetch real Amazon product data
 * 
 * Usage:
 *   node scripts/enrich.js          # Enrich 10 products
 *   node scripts/enrich.js 25       # Enrich 25 products
 * 
 * Reads ASINs from local D1 database, calls RapidAPI,
 * and updates products with real title, image, price, description.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const API_KEY = '9526f19141mshd939399dce12cbdp1d9e68jsn75e244cf35ad';
const BATCH_LIMIT = parseInt(process.argv[2] || '10', 10);
const DELAY_MS = 1200; // delay between requests to respect rate limits

// ─── Helpers ──────────────────────────────────────────
function d1Query(sql) {
  try {
    const result = execSync(
      `npx wrangler d1 execute DB --local --command="${sql.replace(/"/g, '\\"')}" --json`,
      { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = JSON.parse(result);
    return parsed[0]?.results || [];
  } catch (e) {
    console.error('D1 query failed:', sql.substring(0, 80));
    return [];
  }
}

function d1Run(sql) {
  try {
    execSync(
      `npx wrangler d1 execute DB --local --command="${sql.replace(/"/g, '\\"')}"`,
      { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch (e) {
    return false;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escSql(str) {
  return (str || '').replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// ─── Main ─────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 Finding up to ${BATCH_LIMIT} products with placeholder data...\n`);

  // Find products that still have placeholder data
  const products = d1Query(
    `SELECT id, asin, marketplace FROM products WHERE (title LIKE '%Amazon Product B0%' OR title LIKE 'Product B0%') AND is_active = 1 ORDER BY id ASC LIMIT ${BATCH_LIMIT}`
  );

  if (products.length === 0) {
    console.log('✅ All products already have real data! Nothing to enrich.');
    return;
  }

  // Count total remaining
  const countRows = d1Query(
    `SELECT COUNT(*) as cnt FROM products WHERE (title LIKE '%Amazon Product B0%' OR title LIKE 'Product B0%') AND is_active = 1`
  );
  const totalRemaining = countRows[0]?.cnt || products.length;

  console.log(`📦 Found ${products.length} products to enrich (${totalRemaining} total remaining)\n`);

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;

    try {
      const response = await fetch(
        `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${product.asin}&country=${product.marketplace || 'US'}`,
        {
          headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com',
          },
        }
      );

      if (!response.ok) {
        console.log(`${progress} ❌ ${product.asin} — API returned ${response.status}`);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const json = await response.json();
      const data = json.data;

      if (!data?.product_title) {
        console.log(`${progress} ⚠️  ${product.asin} — Not found on Amazon`);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      // Extract data
      const title = escSql(data.product_title.substring(0, 500));
      const imageUrl = escSql(data.product_photo || '');
      const category = escSql(data.product_category || '');
      const price = escSql(data.product_price || '');
      const originalPrice = escSql(data.product_original_price || '');
      const rating = data.product_star_rating ? parseFloat(data.product_star_rating) : 4.5;
      const description = escSql((data.product_description || '').substring(0, 2000));
      const features = escSql(
        data.about_product ? JSON.stringify(data.about_product.slice(0, 6)) : '[]'
      );

      const updateSql = `UPDATE products SET title='${title}', image_url='${imageUrl}', category='${category}', price='${price}', original_price='${originalPrice}', rating=${rating}, description='${description}', features='${features}', fetched_at=datetime('now'), updated_at=datetime('now') WHERE id=${product.id}`;

      const success = d1Run(updateSql);
      if (success) {
        console.log(`${progress} ✅ ${product.asin} → ${data.product_title.substring(0, 60)}...`);
        enriched++;
      } else {
        console.log(`${progress} ❌ ${product.asin} — DB update failed`);
        failed++;
      }
    } catch (err) {
      console.log(`${progress} ❌ ${product.asin} — ${err.message}`);
      failed++;
    }

    // Rate limit
    if (i < products.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Enriched: ${enriched}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`📦 Remaining: ~${totalRemaining - enriched}`);
  console.log(`${'═'.repeat(50)}\n`);

  if (totalRemaining - enriched > 0) {
    console.log(`💡 Run again to enrich more: node scripts/enrich.js ${BATCH_LIMIT}`);
  }
}

main().catch(console.error);
