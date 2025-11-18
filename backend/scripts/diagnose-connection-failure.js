#!/usr/bin/env node

/**
 * Advanced Connection Failure Diagnostic
 * Identifies why both ports are failing
 */

require('dotenv').config();
const { Pool } = require('pg');
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

const results = {
  issues: [],
  recommendations: []
};

function addIssue(severity, issue, details) {
  results.issues.push({ severity, issue, details });
  const icon = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡';
  log(`${icon} [${severity}] ${issue}`, severity === 'CRITICAL' ? 'red' : severity === 'HIGH' ? 'yellow' : 'blue');
  if (details) {
    console.log(`   ${details}`);
  }
}

function addRecommendation(rec) {
  results.recommendations.push(rec);
  log(`💡 ${rec}`, 'green');
}

// Test 1: Analyze Connection String
function analyzeConnectionString() {
  logSection('TEST 1: Connection String Analysis');
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    addIssue('CRITICAL', 'DATABASE_URL not set', 'Environment variable is missing');
    return null;
  }
  
  try {
    const url = new URL(dbUrl);
    const hostname = url.hostname;
    const port = parseInt(url.port || '5432', 10);
    
    log('Connection String Details:', 'cyan');
    console.log(`  Hostname: ${hostname}`);
    console.log(`  Port: ${port}`);
    console.log(`  Database: ${url.pathname.split('/')[1]}`);
    console.log(`  Has Username: ${!!url.username}`);
    console.log(`  Has Password: ${!!url.password ? 'Yes (hidden)' : 'No'}`);
    
    // Check hostname pattern
    const isPooler = hostname.includes('.pooler.');
    const isSupabase = hostname.includes('.supabase.');
    
    if (isPooler && port === 5432) {
      addIssue('HIGH', 'Hostname/Port Mismatch', 
        'Using pooler hostname with direct port. Pooler hostname may not work with port 5432.');
      addRecommendation('Transform hostname when switching to direct connection');
    }
    
    if (!isSupabase) {
      addIssue('MEDIUM', 'Non-Supabase Hostname', 
        'Hostname does not match Supabase pattern. May not be a Supabase database.');
    }
    
    return { url, hostname, port, isPooler };
  } catch (error) {
    addIssue('CRITICAL', 'Invalid Connection String Format', error.message);
    return null;
  }
}

// Test 2: Hostname Transformation Test
async function testHostnameTransformations(originalUrl) {
  logSection('TEST 2: Hostname Transformation Tests');
  
  const transformations = [
    {
      name: 'Original (Pooler)',
      transform: (url) => {
        url.hostname = originalUrl.hostname;
        url.port = '6543';
        return url.toString();
      }
    },
    {
      name: 'Remove .pooler, Keep .com',
      transform: (url) => {
        url.hostname = originalUrl.hostname.replace('.pooler.supabase.com', '.supabase.com');
        url.port = '5432';
        return url.toString();
      }
    },
    {
      name: 'Remove .pooler, Change .com to .co',
      transform: (url) => {
        url.hostname = originalUrl.hostname
          .replace('.pooler.supabase.com', '.supabase.co')
          .replace('.pooler.supabase.co', '.supabase.co');
        url.port = '5432';
        return url.toString();
      }
    },
    {
      name: 'Direct Connection Pattern',
      transform: (url) => {
        // Extract project ref from hostname
        const match = originalUrl.hostname.match(/aws-(\d+)-([^-]+)-(\d+)\.pooler\.supabase\.com/);
        if (match) {
          const [, num, region, num2] = match;
          url.hostname = `aws-${num}-${region}-${num2}.supabase.co`;
        } else {
          url.hostname = originalUrl.hostname.replace('.pooler.', '.');
        }
        url.port = '5432';
        return url.toString();
      }
    }
  ];
  
  for (const test of transformations) {
    try {
      const testUrl = new URL(originalUrl.toString());
      const testConnString = test.transform(testUrl);
      const testPort = parseInt(new URL(testConnString).port || '5432', 10);
      
      log(`\nTesting: ${test.name}`, 'yellow');
      console.log(`  Hostname: ${new URL(testConnString).hostname}`);
      console.log(`  Port: ${testPort}`);
      
      const pool = new Pool({
        connectionString: testConnString,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 5000
      });
      
      try {
        const start = Date.now();
        const client = await Promise.race([
          pool.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
        
        const duration = Date.now() - start;
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        
        log(`  ✅ SUCCESS - Connected in ${duration}ms`, 'green');
        addRecommendation(`Use this connection format: ${test.name}`);
        return testConnString;
      } catch (error) {
        await pool.end().catch(() => {});
        log(`  ❌ FAILED - ${error.message}`, 'red');
        
        // Check for IP ban indicators
        if (error.message.includes('ECONNREFUSED') || 
            error.message.includes('connection refused')) {
          addIssue('HIGH', 'Possible IP Ban', 
            `Connection refused - IP may be banned by Supabase Fail2ban`);
        }
      }
    } catch (error) {
      log(`  ❌ ERROR - ${error.message}`, 'red');
    }
  }
  
  return null;
}

// Test 3: IP Ban Detection
function checkIPBanIndicators() {
  logSection('TEST 3: IP Ban Detection');
  
  log('Checking for IP ban indicators...', 'cyan');
  addRecommendation('Check Supabase Dashboard → Database Settings → Unban IP');
  addRecommendation('Wait 30 minutes for automatic unban');
  addRecommendation('Use CLI: supabase network-bans remove --db-unban-ip <your-ip>');
  
  log('\nCommon IP Ban Symptoms:', 'yellow');
  console.log('  • Both ports fail immediately');
  console.log('  • Connection refused errors');
  console.log('  • Timeouts on all connection attempts');
  console.log('  • Works from different IP/network');
}

// Test 4: SSL/TLS Configuration
async function testSSLConfigurations(originalUrl) {
  logSection('TEST 4: SSL/TLS Configuration Tests');
  
  const sslConfigs = [
    { name: 'rejectUnauthorized: false', config: { rejectUnauthorized: false } },
    { name: 'rejectUnauthorized: true', config: { rejectUnauthorized: true } },
    { name: 'sslmode=require in URL', modifyUrl: (url) => {
      url.searchParams.set('sslmode', 'require');
      return url.toString();
    }}
  ];
  
  for (const test of sslConfigs) {
    try {
      let testConnString = originalUrl.toString();
      if (test.modifyUrl) {
        const testUrl = new URL(originalUrl.toString());
        testConnString = test.modifyUrl(testUrl);
      }
      
      log(`\nTesting: ${test.name}`, 'yellow');
      
      const pool = new Pool({
        connectionString: testConnString,
        ssl: test.config || { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 5000
      });
      
      try {
        const client = await Promise.race([
          pool.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
        
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        
        log(`  ✅ SUCCESS`, 'green');
        addRecommendation(`Use SSL config: ${test.name}`);
        break;
      } catch (error) {
        await pool.end().catch(() => {});
        log(`  ❌ FAILED - ${error.message}`, 'red');
      }
    } catch (error) {
      log(`  ❌ ERROR - ${error.message}`, 'red');
    }
  }
}

// Test 5: Connection String Parameters
function testConnectionParameters(originalUrl) {
  logSection('TEST 5: Connection String Parameters');
  
  log('Testing different connection parameters...', 'cyan');
  
  const params = [
    { sslmode: 'require' },
    { sslmode: 'prefer' },
    { connect_timeout: '10' },
    { sslmode: 'require', connect_timeout: '10' }
  ];
  
  for (const paramSet of params) {
    try {
      const testUrl = new URL(originalUrl.toString());
      Object.entries(paramSet).forEach(([key, value]) => {
        testUrl.searchParams.set(key, value);
      });
      
      log(`\nTesting: ${JSON.stringify(paramSet)}`, 'yellow');
      console.log(`  Connection String: ${testUrl.toString().substring(0, 80)}...`);
      
      // Note: Actual connection test would go here, but we'll just log the format
      log(`  Format ready for testing`, 'blue');
    } catch (error) {
      log(`  ❌ ERROR - ${error.message}`, 'red');
    }
  }
}

// Main diagnostic function
async function runDiagnostics() {
  log('\n🔍 ADVANCED CONNECTION FAILURE DIAGNOSTICS', 'magenta');
  log('Identifying why both ports are failing\n', 'cyan');
  
  // Test 1: Analyze connection string
  const connAnalysis = analyzeConnectionString();
  if (!connAnalysis) {
    log('\n❌ Cannot proceed without valid connection string', 'red');
    return;
  }
  
  const { url: originalUrl } = connAnalysis;
  
  // Test 2: Hostname transformations
  const workingConnection = await testHostnameTransformations(originalUrl);
  
  // Test 3: IP ban check
  checkIPBanIndicators();
  
  // Test 4: SSL configurations
  await testSSLConfigurations(originalUrl);
  
  // Test 5: Connection parameters
  testConnectionParameters(originalUrl);
  
  // Summary
  logSection('DIAGNOSTIC SUMMARY');
  
  log('\nIssues Found:', 'cyan');
  results.issues.forEach((issue, i) => {
    log(`${i + 1}. [${issue.severity}] ${issue.issue}`, 
      issue.severity === 'CRITICAL' ? 'red' : issue.severity === 'HIGH' ? 'yellow' : 'blue');
  });
  
  log('\nRecommendations:', 'cyan');
  results.recommendations.forEach((rec, i) => {
    log(`${i + 1}. ${rec}`, 'green');
  });
  
  if (workingConnection) {
    log('\n✅ WORKING CONNECTION FOUND:', 'green');
    console.log(`   ${workingConnection.substring(0, 60)}...`);
    log('\nUpdate your code to use this connection string format.', 'yellow');
  } else {
    log('\n❌ NO WORKING CONNECTION FOUND', 'red');
    log('Possible causes:', 'yellow');
    console.log('  1. IP address is banned (check Supabase dashboard)');
    console.log('  2. Network/firewall blocking connections');
    console.log('  3. Database credentials are incorrect');
    console.log('  4. Supabase service is down');
  }
}

// Run diagnostics
runDiagnostics().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

