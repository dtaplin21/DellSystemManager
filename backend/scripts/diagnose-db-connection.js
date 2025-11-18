#!/usr/bin/env node

/**
 * Comprehensive Database Connection Diagnostic Tool
 * Tests every possible way a Supabase/PostgreSQL connection can fail
 */

require('dotenv').config();
const { Pool } = require('pg');
const dns = require('dns').promises;
const net = require('net');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(`${icon} ${name}: ${status}`, color);
  if (details) {
    console.log(`   ${details}`);
  }
}

const results = {
  tests: [],
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

function addResult(name, status, details = {}) {
  results.tests.push({ name, status, details, timestamp: new Date().toISOString() });
  if (status === 'PASS') results.summary.passed++;
  else if (status === 'FAIL') results.summary.failed++;
  else results.summary.warnings++;
  logTest(name, status, typeof details === 'string' ? details : JSON.stringify(details, null, 2));
}

// Test 1: Environment Variable Check
async function testEnvironmentVariables() {
  logSection('TEST 1: Environment Variables');
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    addResult('DATABASE_URL exists', 'FAIL', 'DATABASE_URL is not set');
    return null;
  }
  addResult('DATABASE_URL exists', 'PASS', `Length: ${dbUrl.length} characters`);
  
  // Parse connection string
  try {
    const url = new URL(dbUrl);
    addResult('Connection string format', 'PASS', {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || '5432 (default)',
      database: url.pathname.split('/')[1] || 'unknown',
      hasUsername: !!url.username,
      hasPassword: !!url.password,
      hasSSL: url.searchParams.has('sslmode') || url.searchParams.has('ssl')
    });
    return { url, connectionString: dbUrl };
  } catch (error) {
    addResult('Connection string format', 'FAIL', `Invalid URL format: ${error.message}`);
    return { connectionString: dbUrl, url: null };
  }
}

// Test 2: DNS Resolution
async function testDNSResolution(hostname) {
  logSection('TEST 2: DNS Resolution');
  
  if (!hostname) {
    addResult('DNS Resolution', 'FAIL', 'No hostname to resolve');
    return null;
  }
  
  try {
    const startTime = Date.now();
    const addresses = await dns.resolve4(hostname);
    const duration = Date.now() - startTime;
    addResult('DNS Resolution (IPv4)', 'PASS', {
      addresses,
      duration: `${duration}ms`,
      count: addresses.length
    });
    return addresses[0];
  } catch (error) {
    addResult('DNS Resolution (IPv4)', 'FAIL', error.message);
    
    // Try IPv6
    try {
      const addresses = await dns.resolve6(hostname);
      addResult('DNS Resolution (IPv6)', 'PASS', {
        addresses,
        count: addresses.length
      });
      return addresses[0];
    } catch (error6) {
      addResult('DNS Resolution (IPv6)', 'FAIL', error6.message);
      return null;
    }
  }
}

// Test 3: Network Connectivity (TCP Port Check)
async function testTCPConnection(hostname, port) {
  logSection('TEST 3: TCP Port Connectivity');
  
  if (!hostname || !port) {
    addResult('TCP Connection', 'FAIL', 'Missing hostname or port');
    return false;
  }
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000;
    let connected = false;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      connected = true;
      socket.destroy();
      addResult('TCP Connection', 'PASS', `Connected to ${hostname}:${port}`);
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      addResult('TCP Connection', 'FAIL', `Connection timeout after ${timeout}ms`);
      resolve(false);
    });
    
    socket.on('error', (error) => {
      addResult('TCP Connection', 'FAIL', {
        error: error.message,
        code: error.code,
        syscall: error.syscall
      });
      resolve(false);
    });
    
    try {
      socket.connect(port, hostname);
    } catch (error) {
      addResult('TCP Connection', 'FAIL', `Socket error: ${error.message}`);
      resolve(false);
    }
  });
}

// Test 4: SSL/TLS Handshake
async function testSSLHandshake(hostname, port) {
  logSection('TEST 4: SSL/TLS Handshake');
  
  if (!hostname || !port) {
    addResult('SSL Handshake', 'FAIL', 'Missing hostname or port');
    return false;
  }
  
  return new Promise((resolve) => {
    const options = {
      hostname,
      port,
      rejectUnauthorized: false,
      servername: hostname
    };
    
    const socket = net.createConnection(port, hostname, () => {
      const tlsSocket = require('tls').connect({
        socket,
        ...options
      }, () => {
        const cert = tlsSocket.getPeerCertificate();
        addResult('SSL Handshake', 'PASS', {
          protocol: tlsSocket.getProtocol(),
          cipher: tlsSocket.getCipher(),
          authorized: tlsSocket.authorized,
          issuer: cert?.issuer?.CN,
          subject: cert?.subject?.CN
        });
        tlsSocket.destroy();
        socket.destroy();
        resolve(true);
      });
      
      tlsSocket.on('error', (error) => {
        addResult('SSL Handshake', 'FAIL', {
          error: error.message,
          code: error.code
        });
        socket.destroy();
        resolve(false);
      });
      
      tlsSocket.setTimeout(5000, () => {
        addResult('SSL Handshake', 'FAIL', 'SSL handshake timeout');
        tlsSocket.destroy();
        socket.destroy();
        resolve(false);
      });
    });
    
    socket.on('error', (error) => {
      addResult('SSL Handshake', 'FAIL', `Socket error: ${error.message}`);
      resolve(false);
    });
    
    socket.setTimeout(5000, () => {
      addResult('SSL Handshake', 'FAIL', 'Connection timeout');
      socket.destroy();
      resolve(false);
    });
  });
}

// Test 5: PostgreSQL Protocol Handshake
async function testPostgreSQLHandshake(connectionString) {
  logSection('TEST 5: PostgreSQL Protocol Handshake');
  
  if (!connectionString) {
    addResult('PostgreSQL Handshake', 'FAIL', 'No connection string');
    return false;
  }
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  
  try {
    const startTime = Date.now();
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      )
    ]);
    
    const duration = Date.now() - startTime;
    
    // Test a simple query
    const queryStart = Date.now();
    const result = await Promise.race([
      client.query('SELECT NOW() as current_time, version() as db_version'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      )
    ]);
    const queryDuration = Date.now() - queryStart;
    
    addResult('PostgreSQL Handshake', 'PASS', {
      connectDuration: `${duration}ms`,
      queryDuration: `${queryDuration}ms`,
      currentTime: result.rows[0].current_time,
      version: result.rows[0].db_version.substring(0, 50) + '...',
      poolState: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    addResult('PostgreSQL Handshake', 'FAIL', {
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    
    try {
      await pool.end();
    } catch {}
    
    return false;
  }
}

// Test 6: Connection Pool Behavior
async function testConnectionPool(connectionString) {
  logSection('TEST 6: Connection Pool Behavior');
  
  if (!connectionString) {
    addResult('Connection Pool', 'FAIL', 'No connection string');
    return;
  }
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    min: 0,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  });
  
  const tests = [];
  
  // Test 1: Single connection
  try {
    const start = Date.now();
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
    const duration = Date.now() - start;
    addResult('Pool: Single connection', 'PASS', `Acquired in ${duration}ms`);
    client.release();
  } catch (error) {
    addResult('Pool: Single connection', 'FAIL', error.message);
  }
  
  // Test 2: Multiple concurrent connections
  try {
    const start = Date.now();
    const clients = await Promise.all([
      pool.connect(),
      pool.connect(),
      pool.connect()
    ]);
    const duration = Date.now() - start;
    addResult('Pool: Concurrent connections', 'PASS', {
      count: clients.length,
      duration: `${duration}ms`,
      poolState: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    clients.forEach(c => c.release());
  } catch (error) {
    addResult('Pool: Concurrent connections', 'FAIL', error.message);
  }
  
  // Test 3: Pool exhaustion
  try {
    const maxConnections = pool.options.max || 10;
    const clients = [];
    for (let i = 0; i < maxConnections; i++) {
      clients.push(await pool.connect());
    }
    addResult('Pool: Exhaustion test', 'PASS', {
      maxConnections,
      acquired: clients.length,
      poolState: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    clients.forEach(c => c.release());
  } catch (error) {
    addResult('Pool: Exhaustion test', 'FAIL', error.message);
  }
  
  await pool.end();
}

// Test 7: Authentication Credentials
async function testAuthentication(connectionString) {
  logSection('TEST 7: Authentication Credentials');
  
  if (!connectionString) {
    addResult('Authentication', 'FAIL', 'No connection string');
    return false;
  }
  
  try {
    const url = new URL(connectionString);
    const hasUsername = !!url.username;
    const hasPassword = !!url.password;
    
    addResult('Credentials present', hasUsername && hasPassword ? 'PASS' : 'WARN', {
      hasUsername,
      hasPassword,
      usernameLength: url.username?.length || 0,
      passwordLength: url.password?.length || 0
    });
    
    // Try to connect and authenticate
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });
    
    try {
      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);
      
      // Try to query pg_user to verify authentication
      const result = await client.query('SELECT current_user, current_database()');
      addResult('Authentication successful', 'PASS', {
        currentUser: result.rows[0].current_user,
        currentDatabase: result.rows[0].current_database
      });
      
      client.release();
      await pool.end();
      return true;
    } catch (error) {
      if (error.message.includes('password') || error.message.includes('authentication')) {
        addResult('Authentication failed', 'FAIL', {
          error: error.message,
          hint: 'Check username/password in DATABASE_URL'
        });
      } else {
        addResult('Authentication test', 'FAIL', error.message);
      }
      try {
        await pool.end();
      } catch {}
      return false;
    }
  } catch (error) {
    addResult('Authentication test', 'FAIL', error.message);
    return false;
  }
}

// Test 8: Database Server Response Time
async function testResponseTime(connectionString) {
  logSection('TEST 8: Database Server Response Time');
  
  if (!connectionString) {
    addResult('Response Time', 'FAIL', 'No connection string');
    return;
  }
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  
  const tests = [
    { name: 'Simple query', query: 'SELECT 1' },
    { name: 'NOW() query', query: 'SELECT NOW()' },
    { name: 'Version query', query: 'SELECT version()' },
    { name: 'Table count', query: 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\'' }
  ];
  
  for (const test of tests) {
    try {
      const start = Date.now();
      const client = await pool.connect();
      const result = await Promise.race([
        client.query(test.query),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 5000))
      ]);
      const duration = Date.now() - start;
      addResult(`Response Time: ${test.name}`, 'PASS', `${duration}ms`);
      client.release();
    } catch (error) {
      addResult(`Response Time: ${test.name}`, 'FAIL', error.message);
    }
  }
  
  await pool.end();
}

// Test 9: Connection String Variations
async function testConnectionStringVariations(originalString) {
  logSection('TEST 9: Connection String Variations');
  
  if (!originalString) {
    addResult('Connection String Variations', 'FAIL', 'No connection string');
    return;
  }
  
  try {
    const url = new URL(originalString);
    
    // Test different SSL modes
    const sslModes = ['require', 'prefer', 'disable'];
    
    for (const sslMode of sslModes) {
      const testUrl = new URL(originalString);
      testUrl.searchParams.set('sslmode', sslMode);
      
      const pool = new Pool({
        connectionString: testUrl.toString(),
        ssl: sslMode === 'require' || sslMode === 'prefer' 
          ? { rejectUnauthorized: false } 
          : false,
        connectionTimeoutMillis: 5000
      });
      
      try {
        const start = Date.now();
        const client = await Promise.race([
          pool.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        const duration = Date.now() - start;
        addResult(`SSL Mode: ${sslMode}`, 'PASS', `Connected in ${duration}ms`);
        client.release();
        await pool.end();
        break; // Found working SSL mode
      } catch (error) {
        addResult(`SSL Mode: ${sslMode}`, 'FAIL', error.message);
        try {
          await pool.end();
        } catch {}
      }
    }
  } catch (error) {
    addResult('Connection String Variations', 'FAIL', error.message);
  }
}

// Test 10: Firewall/Network Issues
async function testNetworkIssues(hostname, port) {
  logSection('TEST 10: Network/Firewall Issues');
  
  if (!hostname || !port) {
    addResult('Network Test', 'FAIL', 'Missing hostname or port');
    return;
  }
  
  // Test if port is accessible
  const socket = new net.Socket();
  let accessible = false;
  
  return new Promise((resolve) => {
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      accessible = true;
      socket.destroy();
      addResult('Port accessibility', 'PASS', `Port ${port} is accessible`);
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      addResult('Port accessibility', 'FAIL', {
        message: `Port ${port} appears blocked or unreachable`,
        possibleCauses: [
          'Firewall blocking outbound connections',
          'Network routing issue',
          'Database server not running',
          'Wrong port number'
        ]
      });
      resolve(false);
    });
    
    socket.on('error', (error) => {
      addResult('Port accessibility', 'FAIL', {
        error: error.message,
        code: error.code,
        possibleCauses: error.code === 'ECONNREFUSED' 
          ? ['Database server not running', 'Wrong port number']
          : error.code === 'EHOSTUNREACH'
          ? ['Network routing issue', 'Host unreachable']
          : ['Firewall blocking', 'Network configuration issue']
      });
      resolve(false);
    });
    
    socket.connect(port, hostname);
  });
}

// Main diagnostic function
async function runDiagnostics() {
  log('\n🔍 COMPREHENSIVE DATABASE CONNECTION DIAGNOSTICS', 'magenta');
  log('Testing all possible failure modes for Supabase/PostgreSQL connection\n', 'cyan');
  
  const startTime = Date.now();
  
  // Test 1: Environment Variables
  const envResult = await testEnvironmentVariables();
  if (!envResult) {
    log('\n❌ Cannot proceed without DATABASE_URL', 'red');
    printSummary();
    return;
  }
  
  const { url, connectionString } = envResult;
  
  if (!url) {
    log('\n⚠️  Connection string is not a valid URL, skipping network tests', 'yellow');
    // Try direct connection test anyway
    await testPostgreSQLHandshake(connectionString);
    printSummary();
    return;
  }
  
  const hostname = url.hostname;
  const port = parseInt(url.port || '5432', 10);
  
  // Test 2: DNS Resolution
  const ipAddress = await testDNSResolution(hostname);
  
  // Test 3: TCP Connectivity
  await testTCPConnection(hostname, port);
  
  // Test 4: SSL/TLS Handshake
  await testSSLHandshake(hostname, port);
  
  // Test 5: PostgreSQL Protocol
  await testPostgreSQLHandshake(connectionString);
  
  // Test 6: Connection Pool
  await testConnectionPool(connectionString);
  
  // Test 7: Authentication
  await testAuthentication(connectionString);
  
  // Test 8: Response Time
  await testResponseTime(connectionString);
  
  // Test 9: Connection String Variations
  await testConnectionStringVariations(connectionString);
  
  // Test 10: Network Issues
  await testNetworkIssues(hostname, port);
  
  const duration = Date.now() - startTime;
  
  logSection('DIAGNOSTIC SUMMARY');
  printSummary();
  log(`\nTotal diagnostic time: ${duration}ms`, 'cyan');
}

function printSummary() {
  console.log('\n');
  log('SUMMARY', 'cyan');
  console.log('-'.repeat(80));
  log(`✅ Passed: ${results.summary.passed}`, 'green');
  log(`❌ Failed: ${results.summary.failed}`, 'red');
  log(`⚠️  Warnings: ${results.summary.warnings}`, 'yellow');
  console.log('-'.repeat(80));
  
  if (results.summary.failed > 0) {
    log('\nFAILED TESTS:', 'red');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(test => {
        log(`\n❌ ${test.name}`, 'red');
        if (typeof test.details === 'object') {
          console.log(JSON.stringify(test.details, null, 2));
        } else {
          console.log(`   ${test.details}`);
        }
      });
  }
  
  // Recommendations
  if (results.summary.failed > 0) {
    log('\nRECOMMENDATIONS:', 'yellow');
    const failedTests = results.tests.filter(t => t.status === 'FAIL');
    
    if (failedTests.some(t => t.name.includes('DNS'))) {
      log('• Check DNS resolution - verify hostname is correct', 'yellow');
    }
    if (failedTests.some(t => t.name.includes('TCP'))) {
      log('• Check network connectivity - verify port is open and accessible', 'yellow');
    }
    if (failedTests.some(t => t.name.includes('SSL'))) {
      log('• Check SSL/TLS configuration - verify SSL mode in connection string', 'yellow');
    }
    if (failedTests.some(t => t.name.includes('Authentication'))) {
      log('• Check credentials - verify username and password in DATABASE_URL', 'yellow');
    }
    if (failedTests.some(t => t.name.includes('PostgreSQL'))) {
      log('• Check database server - verify it is running and accessible', 'yellow');
    }
    if (failedTests.some(t => t.name.includes('Pool'))) {
      log('• Check connection pool configuration - may need to adjust pool settings', 'yellow');
    }
  }
}

// Run diagnostics
runDiagnostics().catch(error => {
  log(`\n❌ Fatal error running diagnostics: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

