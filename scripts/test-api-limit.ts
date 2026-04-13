/**
 * Test script to check if Amazon RapidAPI is rate limited
 * Usage: npx tsx scripts/test-api-limit.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .dev.vars file
const envPath = resolve(process.cwd(), '.dev.vars');
config({ path: envPath });

async function testAmazonApiLimit() {
  const apiKey = process.env.AMAZON_API_KEY;
  const fallbackKey = process.env.AMAZON_API_KEY_FALLBACK;

  if (!apiKey) {
    console.error('❌ AMAZON_API_KEY not found in environment');
    process.exit(1);
  }

  console.log('🧪 Testing Amazon RapidAPI rate limits...\n');
  console.log('📍 Using primary key:', apiKey.substring(0, 10) + '...');
  if (fallbackKey) {
    console.log('📍 Using fallback key:', fallbackKey.substring(0, 10) + '...');
  }
  console.log('');

  const testAsins = ['B0CX23V7FT', 'B09V3KXJPB', 'B0BSHF7WHW'];
  const countries = ['US', 'GB', 'DE'];
  
  const results: Array<{
    attempt: number;
    key: string;
    asin: string;
    country: string;
    status: number;
    success: boolean;
    error?: string;
  }> = [];

  // Test primary key
  console.log('🔵 Testing PRIMARY API key...\n');
  
  for (let i = 0; i < 5; i++) {
    const asin = testAsins[i % testAsins.length];
    const country = countries[i % countries.length];
    
    try {
      const response = await fetch(
        `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=${country}`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com',
          },
        }
      );

      const success = response.ok;
      results.push({
        attempt: i + 1,
        key: 'PRIMARY',
        asin,
        country,
        status: response.status,
        success,
      });

      if (success) {
        console.log(`✅ Attempt ${i + 1}: ${asin} (${country}) - ${response.status} OK`);
      } else if (response.status === 429) {
        console.log(`🚫 Attempt ${i + 1}: ${asin} (${country}) - 429 RATE LIMITED`);
      } else if (response.status === 401 || response.status === 403) {
        console.log(`❌ Attempt ${i + 1}: ${asin} (${country}) - ${response.status} AUTH ERROR`);
      } else {
        console.log(`⚠️  Attempt ${i + 1}: ${asin} (${country}) - ${response.status}`);
      }

      // Small delay to avoid immediate rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      results.push({
        attempt: i + 1,
        key: 'PRIMARY',
        asin,
        country,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log(`❌ Attempt ${i + 1}: Network error - ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Test fallback key if exists
  if (fallbackKey) {
    console.log('\n🟡 Testing FALLBACK API key...\n');
    
    for (let i = 0; i < 3; i++) {
      const asin = testAsins[i % testAsins.length];
      const country = countries[i % countries.length];
      
      try {
        const response = await fetch(
          `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=${country}`,
          {
            headers: {
              'X-RapidAPI-Key': fallbackKey,
              'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com',
            },
          }
        );

        const success = response.ok;
        results.push({
          attempt: i + 1,
          key: 'FALLBACK',
          asin,
          country,
          status: response.status,
          success,
        });

        if (success) {
          console.log(`✅ Attempt ${i + 1}: ${asin} (${country}) - ${response.status} OK`);
        } else if (response.status === 429) {
          console.log(`🚫 Attempt ${i + 1}: ${asin} (${country}) - 429 RATE LIMITED`);
        } else if (response.status === 401 || response.status === 403) {
          console.log(`❌ Attempt ${i + 1}: ${asin} (${country}) - ${response.status} AUTH ERROR`);
        } else {
          console.log(`⚠️  Attempt ${i + 1}: ${asin} (${country}) - ${response.status}`);
        }

        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        results.push({
          attempt: i + 1,
          key: 'FALLBACK',
          asin,
          country,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.log(`❌ Attempt ${i + 1}: Network error - ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const totalAttempts = results.length;
  const successCount = results.filter(r => r.success).length;
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  const authErrorCount = results.filter(r => r.status === 401 || r.status === 403).length;

  console.log(`\nTotal Attempts: ${totalAttempts}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`🚫 Rate Limited: ${rateLimitedCount}`);
  console.log(`❌ Auth Errors: ${authErrorCount}`);
  console.log(`⚠️  Other Errors: ${totalAttempts - successCount - rateLimitedCount - authErrorCount}`);

  if (rateLimitedCount > 0) {
    console.log('\n⚠️  WARNING: API is being rate limited!');
    console.log('💡 Consider:');
    console.log('   - Waiting a few minutes before more requests');
    console.log('   - Using the fallback key more frequently');
    console.log('   - Upgrading your RapidAPI plan for higher limits');
  } else if (successCount === totalAttempts) {
    console.log('\n✅ GOOD: API is responding normally, not rate limited');
  }

  if (authErrorCount > 0) {
    console.log('\n❌ CRITICAL: API keys are being rejected!');
    console.log('💡 Check your RapidAPI subscription and key validity');
  }

  console.log('');
}

testAmazonApiLimit().catch(console.error);
