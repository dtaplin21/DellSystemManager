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
 *   */10 * * * * cd /path/to/project && node scripts/keep-alive-ping.js
 * 
 * Or use GitHub Actions (see .github/workflows/keep-alive.yml)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://geosyntec-backend-ugea.onrender.com';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://quality-control-quality-assurance.onrender.com';
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

async function pingAllServices() {
  log('🔄 Starting keep-alive ping cycle...', 'blue');
  
  const results = {
    backend: await pingService('Backend', BACKEND_URL, '/health'),
    aiService: await pingService('AI Service', AI_SERVICE_URL, '/health'),
  };
  
  const allSuccess = results.backend.success && results.aiService.success;
  
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

