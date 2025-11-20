#!/usr/bin/env node
/**
 * Check if IP might be banned by Supabase
 * Tests various connection scenarios to detect IP bans
 */

const { Pool } = require('pg');
const config = require('../../config/env');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('❌ DATABASE_URL not set');
  process.exit(1);
}

console.log('🔍 Checking for IP ban or rate limiting...\n');

// Test 1: Try connection with very short timeout
async function testQuickConnection() {
  console.log('TEST 1: Quick connection test (5 second timeout)');
  try {
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 5000
    });
    
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]);
    
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    
    console.log('  ✅ Connection successful - IP likely not banned\n');
    return true;
  } catch (error) {
    console.log(`  ❌ Connection failed: ${error.message}\n`);
    return false;
  }
}

// Test 2: Check for specific ban error messages
async function testBanIndicators() {
  console.log('TEST 2: Checking for ban indicators');
  
  const banIndicators = [
    'too many connections',
    'connection limit',
    'rate limit',
    'banned',
    'blocked',
    'IP',
    'authentication failed',
    'password authentication failed'
  ];
  
  try {
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 10000
    });
    
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);
    
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    
    console.log('  ✅ No ban indicators found\n');
    return false;
  } catch (error) {
    const errorLower = error.message.toLowerCase();
    const foundIndicators = banIndicators.filter(indicator => 
      errorLower.includes(indicator)
    );
    
    if (foundIndicators.length > 0) {
      console.log(`  ⚠️  Possible ban indicators found:`);
      foundIndicators.forEach(ind => console.log(`     - ${ind}`));
      console.log(`  Error: ${error.message}\n`);
      return true;
    } else {
      console.log(`  ❌ Connection failed but no ban indicators`);
      console.log(`  Error: ${error.message}\n`);
      return false;
    }
  }
}

// Test 3: Test multiple rapid connections (rate limit test)
async function testRateLimit() {
  console.log('TEST 3: Rate limit test (5 rapid connections)');
  
  const results = [];
  for (let i = 0; i < 5; i++) {
    try {
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 5000
      });
      
      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);
      
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      
      results.push({ attempt: i + 1, success: true });
    } catch (error) {
      results.push({ attempt: i + 1, success: false, error: error.message });
      break; // Stop on first failure
    }
    
    // Small delay between attempts
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`  Results: ${successCount}/5 successful`);
  
  if (successCount === 0) {
    console.log('  ❌ All connections failed - likely not rate limiting\n');
  } else if (successCount < 5) {
    console.log('  ⚠️  Some connections failed - possible rate limiting\n');
  } else {
    console.log('  ✅ All connections successful - no rate limiting detected\n');
  }
  
  return successCount;
}

// Test 4: Check connection string for changes
function checkConnectionString() {
  console.log('TEST 4: Connection string analysis');
  
  try {
    const url = new URL(dbUrl);
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Port: ${url.port || 'default'}`);
    console.log(`  Database: ${url.pathname.substring(1)}`);
    console.log(`  Username: ${url.username ? '***' : 'N/A'}`);
    
    // Check if using pooler vs direct
    const isPooler = url.port === '6543' || url.hostname.includes('pooler');
    console.log(`  Connection Type: ${isPooler ? 'Pooler (6543)' : 'Direct (5432)'}`);
    
    console.log('  ✅ Connection string format valid\n');
    return true;
  } catch (error) {
    console.log(`  ❌ Connection string invalid: ${error.message}\n`);
    return false;
  }
}

// Main
async function main() {
  console.log('🔍 IP Ban & Rate Limit Diagnostic\n');
  console.log('═'.repeat(60));
  
  checkConnectionString();
  
  const quickTest = await testQuickConnection();
  const banTest = await testBanIndicators();
  const rateLimitTest = await testRateLimit();
  
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Quick Connection: ${quickTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Ban Indicators: ${banTest ? '⚠️  FOUND' : '✅ NONE'}`);
  console.log(`Rate Limit Test: ${rateLimitTest}/5 successful`);
  
  if (!quickTest && !banTest) {
    console.log('\n💡 DIAGNOSIS:');
    console.log('   Connection failures are NOT due to IP ban or rate limiting.');
    console.log('   The issue is likely network-level (firewall blocking).');
  } else if (banTest) {
    console.log('\n⚠️  WARNING:');
    console.log('   Possible IP ban detected. Check Supabase dashboard for:');
    console.log('   - IP allowlist settings');
    console.log('   - Connection limits');
    console.log('   - Fail2ban logs');
  }
}

main().catch(console.error);

