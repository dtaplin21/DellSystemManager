#!/usr/bin/env node

/**
 * Keep-Alive Ping Script for Render Services
 * 
 * This script pings Render services every 10 minutes to prevent cold starts.
 * Run this as a cron job or background service to keep services warm.
 * 
 * Usage:
 *   node scripts/keep-alive-ping.js
 * 
 * Or set up as a cron job (every 10 minutes):
 *   0,10,20,30,40,50 * * * * cd /path/to/project && node scripts/keep-alive-ping.js
 * 
 * Or use GitHub Actions (see .github/workflows/keep-alive.yml)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://geosyntec-backend-ugea.onrender.com';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://geosyntec-backend.onrender.com';
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

async function pingService(name, url, endpoint = '/health') {
  const fullUrl = `${url}${endpoint}`;
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Keep-Alive-Ping/1.0',
      },
    });
    
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      log(`✅ ${name}: OK (${response.status}) - ${duration}ms`, 'green');
      return { success: true, status: response.status, duration };
    } else {
      log(`⚠️  ${name}: Non-OK status (${response.status}) - ${duration}ms`, 'yellow');
      return { success: false, status: response.status, duration };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      log(`❌ ${name}: Timeout after ${duration}ms`, 'red');
      return { success: false, error: 'timeout', duration };
    } else {
      log(`❌ ${name}: Error - ${error.message} (${duration}ms)`, 'red');
      return { success: false, error: error.message, duration };
    }
  }
}

async function pingServiceWithAuth(name, url, endpoint, authToken) {
  const fullUrl = `${url}${endpoint}`;
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds - increased for cold starts (60s cold start + 30s buffer)
    
    const headers = {
      'User-Agent': 'Keep-Alive-Ping/1.0',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal,
      headers,
    });
    
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const body = await response.json().catch(() => ({}));
      log(`✅ ${name}: OK (${response.status}) - ${duration}ms`, 'green');
      return { success: true, status: response.status, duration, data: body };
    } else {
      log(`⚠️  ${name}: Non-OK status (${response.status}) - ${duration}ms`, 'yellow');
      return { success: false, status: response.status, duration };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      log(`❌ ${name}: Timeout after ${duration}ms`, 'red');
      return { success: false, error: 'timeout', duration };
    } else {
      log(`❌ ${name}: Error - ${error.message} (${duration}ms)`, 'red');
      return { success: false, error: error.message, duration };
    }
  }
}

async function pingAllServices() {
  log('🔄 Starting keep-alive ping cycle...', 'blue');
  
  const results = {
    backend: await pingService('Backend', BACKEND_URL, '/health'),
    backendApiHealth: await pingService('Backend API', BACKEND_URL, '/api/health'),
    aiService: await pingService('AI Service', AI_SERVICE_URL, '/health'),
  };
  
  // Try to ping projects endpoint if we have auth token (optional, won't fail if missing)
  const authToken = process.env.KEEP_ALIVE_AUTH_TOKEN;
  if (authToken) {
    log('🔐 Auth token found, testing authenticated endpoints...', 'blue');
    results.backendProjects = await pingServiceWithAuth(
      'Backend Projects API', 
      BACKEND_URL, 
      '/api/projects',
      authToken
    );
    
    if (results.backendProjects.success && results.backendProjects.data) {
      const projectCount = Array.isArray(results.backendProjects.data) 
        ? results.backendProjects.data.length 
        : results.backendProjects.data.projects?.length || 0;
      log(`📊 Projects endpoint returned ${projectCount} project(s)`, 'green');
    }
  } else {
    log('ℹ️  No auth token provided (KEEP_ALIVE_AUTH_TOKEN), skipping authenticated endpoints', 'yellow');
  }
  
  const allSuccess = results.backend.success && results.backendApiHealth.success && results.aiService.success;
  
  if (allSuccess) {
    log('✅ All services are responding', 'green');
  } else {
    log('⚠️  Some services failed to respond', 'yellow');
  }
  
  return results;
}

// Main execution
if (require.main === module) {
  // Run once immediately
  pingAllServices()
    .then(() => {
      log('✅ Keep-alive ping completed', 'green');
      process.exit(0);
    })
    .catch((error) => {
      log(`❌ Keep-alive ping failed: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { pingAllServices, pingService };

