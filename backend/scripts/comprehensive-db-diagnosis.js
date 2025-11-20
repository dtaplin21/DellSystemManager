#!/usr/bin/env node
/**
 * Comprehensive Database Connection Diagnosis
 * Tests all possible failure modes for Supabase PostgreSQL connection
 */

const { Pool } = require('pg');
const dns = require('dns').promises;
const net = require('net');
const tls = require('tls');
const https = require('https');
const config = require('../../config/env');

const SUPABASE_HOST = 'aws-0-us-east-2.pooler.supabase.com';
const POOLER_PORT = 6543;
const DIRECT_PORT = 5432;

console.log('🔍 === COMPREHENSIVE DATABASE CONNECTION DIAGNOSIS ===\n');

// Test 1: Environment Variables
async function testEnvironmentVariables() {
  console.log('📋 TEST 1: Environment Variables');
  console.log('─'.repeat(60));
  
  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  console.log(`DATABASE_URL: ${dbUrl ? '✅ SET' : '❌ MISSING'}`);
  if (dbUrl) {
    // Mask sensitive parts
    const masked = dbUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`  Masked: ${masked.substring(0, 80)}...`);
  }
  
  console.log(`SUPABASE_URL: ${supabaseUrl ? '✅ SET' : '❌ MISSING'}`);
  console.log(`SUPABASE_KEY: ${supabaseKey ? '✅ SET' : '❌ MISSING'}`);
  console.log(`SUPABASE_CONNECTION_MODE: ${process.env.SUPABASE_CONNECTION_MODE || 'auto (default)'}`);
  console.log('');
  
  return { dbUrl, supabaseUrl, supabaseKey };
}

// Test 2: DNS Resolution
async function testDNSResolution() {
  console.log('🌐 TEST 2: DNS Resolution');
  console.log('─'.repeat(60));
  
  try {
    const addresses = await dns.resolve4(SUPABASE_HOST);
    console.log(`✅ DNS Resolution: SUCCESS`);
    console.log(`  IP Addresses: ${addresses.join(', ')}`);
    
    // Test reverse DNS
    try {
      const hostnames = await Promise.all(addresses.map(ip => dns.reverse(ip)));
      console.log(`  Reverse DNS: ${hostnames.flat().join(', ')}`);
    } catch (e) {
      console.log(`  Reverse DNS: Failed (not critical)`);
    }
    console.log('');
    return { success: true, addresses };
  } catch (error) {
    console.log(`❌ DNS Resolution: FAILED`);
    console.log(`  Error: ${error.message}`);
    console.log('');
    return { success: false, error: error.message };
  }
}

// Test 3: TCP Port Connectivity
async function testTCPConnectivity(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, error: 'Connection timeout' });
    }, timeout);
    
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ success: true });
    });
    
    socket.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, error: error.message, code: error.code });
    });
    
    socket.connect(port, host);
  });
}

async function testPortConnectivity() {
  console.log('🔌 TEST 3: TCP Port Connectivity');
  console.log('─'.repeat(60));
  
  // Test Pooler Port (6543)
  console.log(`Testing port ${POOLER_PORT} (pooler)...`);
  const poolerResult = await testTCPConnectivity(SUPABASE_HOST, POOLER_PORT, 10000);
  if (poolerResult.success) {
    console.log(`  ✅ Port ${POOLER_PORT}: CONNECTED`);
  } else {
    console.log(`  ❌ Port ${POOLER_PORT}: FAILED`);
    console.log(`     Error: ${poolerResult.error}`);
    if (poolerResult.code) {
      console.log(`     Code: ${poolerResult.code}`);
    }
  }
  
  // Test Direct Port (5432)
  console.log(`Testing port ${DIRECT_PORT} (direct)...`);
  const directResult = await testTCPConnectivity(SUPABASE_HOST, DIRECT_PORT, 10000);
  if (directResult.success) {
    console.log(`  ✅ Port ${DIRECT_PORT}: CONNECTED`);
  } else {
    console.log(`  ❌ Port ${DIRECT_PORT}: FAILED`);
    console.log(`     Error: ${directResult.error}`);
    if (directResult.code) {
      console.log(`     Code: ${directResult.code}`);
    }
  }
  console.log('');
  
  return { pooler: poolerResult, direct: directResult };
}

// Test 4: SSL/TLS Handshake
async function testSSLHandshake(host, port, timeout = 10000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, error: 'SSL handshake timeout' });
    }, timeout);
    
    const tlsSocket = tls.connect({
      socket: socket,
      host: host,
      port: port,
      rejectUnauthorized: false,
      servername: host
    }, () => {
      clearTimeout(timer);
      const cert = tlsSocket.getPeerCertificate();
      tlsSocket.destroy();
      resolve({ 
        success: true, 
        protocol: tlsSocket.getProtocol(),
        cipher: tlsSocket.getCipher(),
        authorized: tlsSocket.authorized,
        issuer: cert ? cert.issuer.CN : 'N/A'
      });
    });
    
    tlsSocket.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, error: error.message, code: error.code });
    });
    
    socket.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, error: error.message, code: error.code });
    });
    
    socket.connect(port, host);
  });
}

async function testSSLConnectivity() {
  console.log('🔒 TEST 4: SSL/TLS Handshake');
  console.log('─'.repeat(60));
  
  // Test Pooler Port SSL
  console.log(`Testing SSL on port ${POOLER_PORT}...`);
  const poolerSSL = await testSSLHandshake(SUPABASE_HOST, POOLER_PORT, 15000);
  if (poolerSSL.success) {
    console.log(`  ✅ Port ${POOLER_PORT} SSL: SUCCESS`);
    console.log(`     Protocol: ${poolerSSL.protocol}`);
    console.log(`     Cipher: ${poolerSSL.cipher?.name || 'N/A'}`);
    console.log(`     Authorized: ${poolerSSL.authorized}`);
    console.log(`     Issuer: ${poolerSSL.issuer}`);
  } else {
    console.log(`  ❌ Port ${POOLER_PORT} SSL: FAILED`);
    console.log(`     Error: ${poolerSSL.error}`);
    if (poolerSSL.code) {
      console.log(`     Code: ${poolerSSL.code}`);
    }
  }
  
  // Test Direct Port SSL
  console.log(`Testing SSL on port ${DIRECT_PORT}...`);
  const directSSL = await testSSLHandshake(SUPABASE_HOST, DIRECT_PORT, 15000);
  if (directSSL.success) {
    console.log(`  ✅ Port ${DIRECT_PORT} SSL: SUCCESS`);
    console.log(`     Protocol: ${directSSL.protocol}`);
    console.log(`     Cipher: ${directSSL.cipher?.name || 'N/A'}`);
    console.log(`     Authorized: ${directSSL.authorized}`);
    console.log(`     Issuer: ${directSSL.issuer}`);
  } else {
    console.log(`  ❌ Port ${DIRECT_PORT} SSL: FAILED`);
    console.log(`     Error: ${directSSL.error}`);
    if (directSSL.code) {
      console.log(`     Code: ${directSSL.code}`);
    }
  }
  console.log('');
  
  return { pooler: poolerSSL, direct: directSSL };
}

// Test 5: Connection String Parsing
async function testConnectionStringParsing(dbUrl) {
  console.log('📝 TEST 5: Connection String Parsing');
  console.log('─'.repeat(60));
  
  if (!dbUrl) {
    console.log('❌ DATABASE_URL not set, skipping test');
    console.log('');
    return { success: false };
  }
  
  try {
    const url = new URL(dbUrl);
    console.log(`✅ Connection String: VALID`);
    console.log(`  Protocol: ${url.protocol}`);
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Port: ${url.port || 'default (5432)'}`);
    console.log(`  Database: ${url.pathname.substring(1) || 'N/A'}`);
    console.log(`  Username: ${url.username ? '***' : 'N/A'}`);
    console.log(`  Password: ${url.password ? '***' : 'N/A'}`);
    console.log(`  SSL Mode: ${url.searchParams.get('sslmode') || 'N/A'}`);
    console.log('');
    return { success: true, parsed: url };
  } catch (error) {
    console.log(`❌ Connection String: INVALID`);
    console.log(`  Error: ${error.message}`);
    console.log('');
    return { success: false, error: error.message };
  }
}

// Test 6: PostgreSQL Protocol Handshake
async function testPostgreSQLHandshake(host, port, dbUrl) {
  console.log('🗄️  TEST 6: PostgreSQL Protocol Handshake');
  console.log('─'.repeat(60));
  
  if (!dbUrl) {
    console.log('❌ DATABASE_URL not set, skipping test');
    console.log('');
    return { success: false };
  }
  
  try {
    const url = new URL(dbUrl);
    const testPool = new Pool({
      connectionString: dbUrl.replace(/:(\d+)/, `:${port}`),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 15000
    });
    
    const startTime = Date.now();
    const client = await Promise.race([
      testPool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 15000)
      )
    ]);
    
    const duration = Date.now() - startTime;
    
    // Test a simple query
    const queryResult = await client.query('SELECT version()');
    const version = queryResult.rows[0].version;
    
    client.release();
    await testPool.end();
    
    console.log(`✅ PostgreSQL Handshake: SUCCESS`);
    console.log(`  Port: ${port}`);
    console.log(`  Connection Time: ${duration}ms`);
    console.log(`  PostgreSQL Version: ${version.substring(0, 50)}...`);
    console.log('');
    return { success: true, duration, version };
  } catch (error) {
    console.log(`❌ PostgreSQL Handshake: FAILED`);
    console.log(`  Port: ${port}`);
    console.log(`  Error: ${error.message}`);
    if (error.code) {
      console.log(`  Code: ${error.code}`);
    }
    console.log('');
    return { success: false, error: error.message, code: error.code };
  }
}

// Test 7: Connection Pool Behavior
async function testConnectionPool(dbUrl) {
  console.log('🏊 TEST 7: Connection Pool Behavior');
  console.log('─'.repeat(60));
  
  if (!dbUrl) {
    console.log('❌ DATABASE_URL not set, skipping test');
    console.log('');
    return { success: false };
  }
  
  try {
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 3,
      min: 0,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000
    });
    
    console.log('Testing pool connection...');
    const startTime = Date.now();
    
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pool connection timeout')), 20000)
      )
    ]);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Pool Connection: SUCCESS`);
    console.log(`  Connection Time: ${duration}ms`);
    console.log(`  Pool State:`);
    console.log(`    Total: ${pool.totalCount}`);
    console.log(`    Idle: ${pool.idleCount}`);
    console.log(`    Waiting: ${pool.waitingCount}`);
    
    // Test query
    const result = await client.query('SELECT 1 as test');
    console.log(`  Query Test: ${result.rows[0].test === 1 ? '✅ PASSED' : '❌ FAILED'}`);
    
    client.release();
    await pool.end();
    console.log('');
    return { success: true, duration, poolState: { total: pool.totalCount, idle: pool.idleCount } };
  } catch (error) {
    console.log(`❌ Pool Connection: FAILED`);
    console.log(`  Error: ${error.message}`);
    if (error.code) {
      console.log(`  Code: ${error.code}`);
    }
    console.log('');
    return { success: false, error: error.message, code: error.code };
  }
}

// Test 8: Network Routing
async function testNetworkRouting() {
  console.log('🛣️  TEST 8: Network Routing');
  console.log('─'.repeat(60));
  
  try {
    const addresses = await dns.resolve4(SUPABASE_HOST);
    console.log(`Testing routing to ${addresses[0]}...`);
    
    // Try to connect and see how far we get
    const socket = new net.Socket();
    let connected = false;
    let errorOccurred = false;
    
    const timeout = setTimeout(() => {
      if (!connected) {
        socket.destroy();
        console.log(`  ⚠️  Connection timeout - packets may be blocked`);
        console.log(`     This suggests firewall/network blocking`);
      }
    }, 5000);
    
    socket.on('connect', () => {
      connected = true;
      clearTimeout(timeout);
      console.log(`  ✅ TCP connection established`);
      console.log(`     Local Address: ${socket.localAddress}:${socket.localPort}`);
      console.log(`     Remote Address: ${socket.remoteAddress}:${socket.remotePort}`);
      socket.destroy();
    });
    
    socket.on('error', (error) => {
      errorOccurred = true;
      clearTimeout(timeout);
      console.log(`  ❌ Connection error: ${error.message}`);
      console.log(`     Code: ${error.code}`);
      if (error.code === 'ETIMEDOUT' || error.code === 'EHOSTUNREACH') {
        console.log(`     ⚠️  This suggests network routing issue`);
      }
    });
    
    socket.connect(POOLER_PORT, addresses[0]);
    
    // Wait a bit for connection attempt
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    if (!connected && !errorOccurred) {
      console.log(`  ⚠️  Connection attempt timed out`);
      console.log(`     This suggests packets are being dropped silently`);
    }
    
    console.log('');
    return { success: connected };
  } catch (error) {
    console.log(`❌ Network Routing Test: FAILED`);
    console.log(`  Error: ${error.message}`);
    console.log('');
    return { success: false, error: error.message };
  }
}

// Test 9: Supabase API Connectivity (to verify Supabase is reachable)
async function testSupabaseAPI(supabaseUrl) {
  console.log('🌐 TEST 9: Supabase API Connectivity');
  console.log('─'.repeat(60));
  
  if (!supabaseUrl) {
    console.log('❌ SUPABASE_URL not set, skipping test');
    console.log('');
    return { success: false };
  }
  
  try {
    const url = new URL(supabaseUrl);
    const testUrl = `${url.protocol}//${url.host}/rest/v1/`;
    
    console.log(`Testing HTTPS connection to ${url.host}...`);
    
    const result = await new Promise((resolve, reject) => {
      const req = https.get(testUrl, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ success: true, status: res.statusCode, headers: res.headers });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    console.log(`✅ Supabase API: REACHABLE`);
    console.log(`  Status: ${result.status}`);
    console.log(`  This confirms Supabase service is up`);
    console.log('');
    return { success: true, status: result.status };
  } catch (error) {
    console.log(`❌ Supabase API: UNREACHABLE`);
    console.log(`  Error: ${error.message}`);
    console.log(`  This suggests broader connectivity issues`);
    console.log('');
    return { success: false, error: error.message };
  }
}

// Test 10: Connection String Variations
async function testConnectionStringVariations(dbUrl) {
  console.log('🔄 TEST 10: Connection String Variations');
  console.log('─'.repeat(60));
  
  if (!dbUrl) {
    console.log('❌ DATABASE_URL not set, skipping test');
    console.log('');
    return { success: false };
  }
  
  const variations = [
    { name: 'Original', connString: dbUrl },
    { name: 'With sslmode=require', connString: dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require' },
    { name: 'With sslmode=prefer', connString: dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'sslmode=prefer' },
    { name: 'With sslmode=disable', connString: dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'sslmode=disable' },
  ];
  
  for (const variation of variations) {
    try {
      const pool = new Pool({
        connectionString: variation.connString,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 10000
      });
      
      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);
      
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      
      console.log(`  ✅ ${variation.name}: SUCCESS`);
    } catch (error) {
      console.log(`  ❌ ${variation.name}: FAILED - ${error.message.substring(0, 50)}`);
    }
  }
  console.log('');
}

// Main diagnostic function
async function runDiagnostics() {
  try {
    // Test 1: Environment Variables
    const env = await testEnvironmentVariables();
    
    // Test 2: DNS Resolution
    const dnsResult = await testDNSResolution();
    
    // Test 3: TCP Port Connectivity
    const tcpResult = await testPortConnectivity();
    
    // Test 4: SSL/TLS Handshake (only if TCP works)
    let sslResult = { pooler: { success: false }, direct: { success: false } };
    if (tcpResult.pooler.success || tcpResult.direct.success) {
      sslResult = await testSSLConnectivity();
    } else {
      console.log('🔒 TEST 4: SSL/TLS Handshake');
      console.log('─'.repeat(60));
      console.log('⚠️  Skipped - TCP connectivity failed');
      console.log('');
    }
    
    // Test 5: Connection String Parsing
    await testConnectionStringParsing(env.dbUrl);
    
    // Test 6: PostgreSQL Protocol Handshake (only if TCP works)
    if (tcpResult.pooler.success || tcpResult.direct.success) {
      if (tcpResult.pooler.success) {
        await testPostgreSQLHandshake(SUPABASE_HOST, POOLER_PORT, env.dbUrl);
      }
      if (tcpResult.direct.success) {
        await testPostgreSQLHandshake(SUPABASE_HOST, DIRECT_PORT, env.dbUrl);
      }
    } else {
      console.log('🗄️  TEST 6: PostgreSQL Protocol Handshake');
      console.log('─'.repeat(60));
      console.log('⚠️  Skipped - TCP connectivity failed');
      console.log('');
    }
    
    // Test 7: Connection Pool Behavior
    await testConnectionPool(env.dbUrl);
    
    // Test 8: Network Routing
    await testNetworkRouting();
    
    // Test 9: Supabase API Connectivity
    await testSupabaseAPI(env.supabaseUrl);
    
    // Test 10: Connection String Variations
    await testConnectionStringVariations(env.dbUrl);
    
    // Summary
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('═'.repeat(60));
    console.log(`DNS Resolution: ${dnsResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`TCP Port ${POOLER_PORT}: ${tcpResult.pooler.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`TCP Port ${DIRECT_PORT}: ${tcpResult.direct.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`SSL Port ${POOLER_PORT}: ${sslResult.pooler.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`SSL Port ${DIRECT_PORT}: ${sslResult.direct.success ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!tcpResult.pooler.success && !tcpResult.direct.success) {
      console.log('\n🔴 ROOT CAUSE: Network connectivity blocked');
      console.log('   Both PostgreSQL ports are unreachable.');
      console.log('   This indicates firewall/VPN/network policy blocking.');
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   1. Check firewall rules - allow outbound to Supabase');
      console.log('   2. Check VPN settings - may be blocking database ports');
      console.log('   3. Verify Supabase IP allowlist includes your IP');
      console.log('   4. Test from different network to confirm');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

// Run diagnostics
runDiagnostics().then(() => {
  console.log('✅ Diagnosis complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Diagnosis error:', error);
  process.exit(1);
});

