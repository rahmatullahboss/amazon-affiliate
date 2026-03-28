import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, '..', 'ASIN LIST - USA.csv');
const outPath = path.join(__dirname, '..', 'seed.sql');

if (!fs.existsSync(csvPath)) {
  console.error("CSV file not found at", csvPath);
  process.exit(1);
}

const csvText = fs.readFileSync(csvPath, 'utf-8');
const rawTokens = csvText.split(/[\n,\s\t]+/);

const asins = new Set();
for (const token of rawTokens) {
  const t = token.trim().toUpperCase();
  if (t.length === 10 && t.startsWith('B')) {
    asins.add(t);
  }
}

const uniqueAsins = Array.from(asins);
console.log(`Found ${uniqueAsins.length} valid unique ASINs in CSV.`);

// The categories listed in migration 0002
const CATEGORIES = [
  'air-conditioner', 'audio-video', 'gadgets',
  'home-appliances', 'kitchen', 'refrigerator', 'pcs-laptop'
];

const PRE_TITLES = [
  'High Performance', 'Premium Quality', 'Ultra Slim',
  'Advanced Smart', 'Professional Grade', 'Portable Wireless'
];

const POST_TITLES = [
  'System 2024 Edition', 'Device (Latest Model)', 'Kit Replacement',
  'Bundle with Accessories', 'Pro Max Version', '- Best Seller'
];

let sql = `-- Auto-generated seed file from ASIN LIST - USA.csv\n\n`;

uniqueAsins.forEach((asin, i) => {
  const cat = CATEGORIES[i % CATEGORIES.length];
  const title = `${PRE_TITLES[i % PRE_TITLES.length]} Amazon Product ${asin} ${POST_TITLES[i % POST_TITLES.length]}`;
  const img = `https://images-na.ssl-images-amazon.com/images/I/${asin}._AC_SL1500_.jpg`;
  
  // Random price generation between 50 and 500
  const basePrice = Math.floor(Math.random() * 450) + 50;
  const currentPrice = `$${basePrice}.99`;
  const originalPrice = `$${Math.floor(basePrice * 1.2)}.99`;
  const rating = (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1); // 4.0 to 5.0

  sql += `INSERT OR IGNORE INTO products (asin, title, image_url, marketplace, category, description, rating, price, original_price) VALUES ('${asin}', '${title}', '${img}', 'US', '${cat}', 'This is a premium product directly imported via the CSV seed script. It features high durability, excellent build quality, and is highly rated by experts.', ${rating}, '${currentPrice}', '${originalPrice}');\n`;
});

fs.writeFileSync(outPath, sql);
console.log(`Successfully generated seed.sql with ${uniqueAsins.length} INSERT statements.`);
