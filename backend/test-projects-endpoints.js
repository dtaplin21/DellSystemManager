#!/usr/bin/env node

/**
 * Test script for all project-related endpoints
 * This script tests each endpoint and reports which ones are failing
 */

const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8003';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // Set this if you have a token
const USE_DEV_BYPASS = process.env.USE_DEV_BYPASS === 'true' || !TEST_TOKEN;

console.log('🧪 Testing Project Endpoints');
console.log('=' .repeat(60));
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`Using dev bypass: ${USE_DEV_BYPASS}`);
console.log(`Test token: ${TEST_TOKEN ? TEST_TOKEN.substring(0, 20) + '...' : 'Not provided'}`);
console.log('=' .repeat(60));
console.log('');

// Helper function to make HTTP requests
function makeRequest(method, path, body = null, useAuth = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (useAuth) {
      if (USE_DEV_BYPASS) {
        options.headers['x-dev-bypass'] = 'true';
      } else if (TEST_TOKEN) {
        options.headers['Authorization'] = `Bearer ${TEST_TOKEN}`;
      }
    }

    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          parsedData = data;
        }
        
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: parsedData,
          rawBody: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test results storage
const results = [];

async function testEndpoint(name, method, path, body = null, useAuth = true) {
  console.log(`\n📋 Testing: ${name}`);
  console.log(`   ${method} ${path}`);
  
  try {
    const startTime = Date.now();
    const response = await makeRequest(method, path, body, useAuth);
    const duration = Date.now() - startTime;
    
    const success = response.statusCode >= 200 && response.statusCode < 300;
    const status = success ? '✅ PASS' : '❌ FAIL';
    
    console.log(`   ${status} - Status: ${response.statusCode} ${response.statusMessage} (${duration}ms)`);
    
    if (!success || response.statusCode >= 400) {
      console.log(`   Response body:`, JSON.stringify(response.body, null, 2));
    }
    
    results.push({
      name,
      method,
      path,
      success,
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      duration,
      error: response.body,
      response: response.body
    });
    
    return response;
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.message}`);
    results.push({
      name,
      method,
      path,
      success: false,
      error: error.message,
      statusCode: 0
    });
    return null;
  }
}

async function runTests() {
  console.log('\n🚀 Starting endpoint tests...\n');
  
  // Test 1: GET /api/projects (list all projects)
  await testEndpoint(
    'GET /api/projects - List all projects',
    'GET',
    '/api/projects'
  );
  
  // Test 2: GET /api/projects/:id (get single project - will need a valid ID)
  // We'll test with a dummy ID first to see the error
  await testEndpoint(
    'GET /api/projects/:id - Get single project (invalid ID)',
    'GET',
    '/api/projects/00000000-0000-0000-0000-000000000000'
  );
  
  // Test 3: GET /api/projects/ssr/:id (SSR endpoint - no auth)
  await testEndpoint(
    'GET /api/projects/ssr/:id - SSR endpoint (no auth, invalid ID)',
    'GET',
    '/api/projects/ssr/00000000-0000-0000-0000-000000000000',
    null,
    false
  );
  
  // Test 4: POST /api/projects (create project)
  await testEndpoint(
    'POST /api/projects - Create new project',
    'POST',
    '/api/projects',
    {
      name: 'Test Project',
      description: 'Test project created by endpoint test script',
      location: 'Test Location',
      status: 'active'
    }
  );
  
  // Test 5: PATCH /api/projects/:id (update project - will need a valid ID)
  await testEndpoint(
    'PATCH /api/projects/:id - Update project (invalid ID)',
    'PATCH',
    '/api/projects/00000000-0000-0000-0000-000000000000',
    {
      name: 'Updated Test Project',
      description: 'Updated description'
    }
  );
  
  // Test 6: DELETE /api/projects/:id (delete project - will need a valid ID)
  await testEndpoint(
    'DELETE /api/projects/:id - Delete project (invalid ID)',
    'DELETE',
    '/api/projects/00000000-0000-0000-0000-000000000000'
  );
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  
  console.log(`Total tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    console.log('-'.repeat(60));
    results.filter(r => !r.success).forEach(result => {
      console.log(`\n${result.name}`);
      console.log(`  Method: ${result.method} ${result.path}`);
      console.log(`  Status: ${result.statusCode} ${result.statusMessage || ''}`);
      if (result.error) {
        console.log(`  Error: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error, null, 2)}`);
      }
      if (result.response && typeof result.response === 'object') {
        console.log(`  Response: ${JSON.stringify(result.response, null, 2)}`);
      }
    });
  }
  
  console.log('\n' + '=' .repeat(60));
  
  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

