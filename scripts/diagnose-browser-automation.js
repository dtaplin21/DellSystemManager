#!/usr/bin/env node

/**
 * Diagnostic script to test browser automation flow
 * 
 * Usage:
 *   node scripts/diagnose-browser-automation.js [projectId]
 * 
 * Example:
 *   node scripts/diagnose-browser-automation.js 49e74875-5d29-4027-a817-d53602e68e4c
 */

const axios = require('axios');
const { spawn } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

async function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    
    server.on('error', () => resolve(false));
  });
}

async function checkHttpEndpoint(url, timeout = 5000) {
  try {
    const response = await axios.get(url, { timeout, validateStatus: () => true });
    return {
      accessible: response.status < 500,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      accessible: false,
      error: error.message
    };
  }
}

async function checkFrontend() {
  logSection('1. Frontend Health Check');
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  logInfo(`Checking frontend at: ${frontendUrl}`);
  
  const port = 3000;
  const portAvailable = await checkPort(port);
  
  if (!portAvailable) {
    logError(`Port ${port} is not available (frontend may not be running)`);
    logWarning('Start the frontend with: cd frontend && npm run dev');
    return false;
  }
  
  logSuccess(`Port ${port} is available`);
  
  const httpCheck = await checkHttpEndpoint(frontendUrl);
  if (httpCheck.accessible) {
    logSuccess(`Frontend is accessible (HTTP ${httpCheck.status})`);
    return true;
  } else {
    logError(`Frontend is not accessible: ${httpCheck.error || `HTTP ${httpCheck.status}`}`);
    return false;
  }
}

async function checkBackend() {
  logSection('2. Backend Health Check');
  
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';
  logInfo(`Checking backend at: ${backendUrl}`);
  
  const healthCheck = await checkHttpEndpoint(`${backendUrl}/api/ai/health`);
  if (healthCheck.accessible) {
    logSuccess(`Backend is accessible (HTTP ${healthCheck.status})`);
    return true;
  } else {
    logError(`Backend is not accessible: ${healthCheck.error || `HTTP ${healthCheck.status}`}`);
    return false;
  }
}

async function checkAIService() {
  logSection('3. AI Service Health Check');
  
  const aiServiceUrl = process.env.AI_SERVICE_URL || process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:5001';
  logInfo(`Checking AI service at: ${aiServiceUrl}`);
  
  const healthCheck = await checkHttpEndpoint(`${aiServiceUrl}/health`);
  if (healthCheck.accessible) {
    logSuccess(`AI service is accessible (HTTP ${healthCheck.status})`);
    return true;
  } else {
    logError(`AI service is not accessible: ${healthCheck.error || `HTTP ${healthCheck.status}`}`);
    logWarning('Start the AI service with: cd ai-service && python -m flask run --port 5001');
    return false;
  }
}

async function checkPanelLayoutPage(projectId) {
  logSection('4. Panel Layout Page Check');
  
  if (!projectId) {
    logWarning('No project ID provided - skipping panel layout page check');
    return false;
  }
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const panelLayoutUrl = `${frontendUrl}/dashboard/projects/${projectId}/panel-layout`;
  
  logInfo(`Checking panel layout page: ${panelLayoutUrl}`);
  
  const pageCheck = await checkHttpEndpoint(panelLayoutUrl);
  if (pageCheck.accessible) {
    logSuccess(`Panel layout page is accessible (HTTP ${pageCheck.status})`);
    return true;
  } else {
    logError(`Panel layout page is not accessible: ${pageCheck.error || `HTTP ${pageCheck.status}`}`);
    logWarning('This could mean:');
    logWarning('  - The project ID is invalid');
    logWarning('  - Authentication is required');
    logWarning('  - The route does not exist');
    return false;
  }
}

async function checkPanelData(projectId) {
  logSection('5. Panel Data Check');
  
  if (!projectId) {
    logWarning('No project ID provided - skipping panel data check');
    return false;
  }
  
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';
  const layoutUrl = `${backendUrl}/api/panel-layout/ssr-layout/${projectId}`;
  
  logInfo(`Checking panel data at: ${layoutUrl}`);
  
  try {
    const response = await axios.get(layoutUrl, { timeout: 10000, validateStatus: () => true });
    
    if (response.status === 200 && response.data) {
      const panelCount = response.data.layout?.panels?.length || 0;
      if (panelCount > 0) {
        logSuccess(`Panel data found: ${panelCount} panels`);
        return true;
      } else {
        logWarning(`Panel layout exists but has no panels (${panelCount} panels)`);
        logWarning('Seed panel data with: node scripts/populate-panel-layout.js <projectId>');
        return false;
      }
    } else {
      logError(`Failed to fetch panel data: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Error checking panel data: ${error.message}`);
    return false;
  }
}

async function testBrowserAutomation(projectId) {
  logSection('6. Browser Automation Test');
  
  if (!projectId) {
    logWarning('No project ID provided - skipping browser automation test');
    return false;
  }
  
  const aiServiceUrl = process.env.AI_SERVICE_URL || process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:5001';
  const testMessage = "What panels are in the layout?";
  
  logInfo(`Sending test message to AI service: "${testMessage}"`);
  logInfo(`Project ID: ${projectId}`);
  
  try {
    const response = await axios.post(
      `${aiServiceUrl}/api/ai/chat`,
      {
        projectId: projectId,
        user_id: 'diagnostic-test-user',
        user_tier: 'paid_user',
        message: testMessage,
        context: {
          projectId: projectId,
          panelLayoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/projects/${projectId}/panel-layout`
        }
      },
      {
        timeout: 120000, // 2 minutes for browser automation
        validateStatus: () => true
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Browser automation test completed successfully');
      logInfo(`Response length: ${response.data.response?.length || 0} characters`);
      return true;
    } else {
      logError(`Browser automation test failed: ${response.data.error || 'Unknown error'}`);
      if (response.data.details) {
        logInfo(`Details: ${response.data.details}`);
      }
      return false;
    }
  } catch (error) {
    logError(`Error during browser automation test: ${error.message}`);
    if (error.response) {
      logError(`Response status: ${error.response.status}`);
      logError(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

async function main() {
  const projectId = process.argv[2];
  
  log('\n🔍 Browser Automation Diagnostic Tool', 'bright');
  log('=====================================\n', 'bright');
  
  if (projectId) {
    logInfo(`Testing with project ID: ${projectId}`);
  } else {
    logWarning('No project ID provided - some checks will be skipped');
    logInfo('Usage: node scripts/diagnose-browser-automation.js <projectId>');
  }
  
  const results = {
    frontend: await checkFrontend(),
    backend: await checkBackend(),
    aiService: await checkAIService(),
    panelLayoutPage: projectId ? await checkPanelLayoutPage(projectId) : null,
    panelData: projectId ? await checkPanelData(projectId) : null,
    browserAutomation: projectId ? await testBrowserAutomation(projectId) : null
  };
  
  logSection('Summary');
  
  const checks = [
    { name: 'Frontend', result: results.frontend },
    { name: 'Backend', result: results.backend },
    { name: 'AI Service', result: results.aiService },
    { name: 'Panel Layout Page', result: results.panelLayoutPage },
    { name: 'Panel Data', result: results.panelData },
    { name: 'Browser Automation', result: results.browserAutomation }
  ];
  
  checks.forEach(check => {
    if (check.result === null) {
      logWarning(`${check.name}: Skipped`);
    } else if (check.result) {
      logSuccess(`${check.name}: OK`);
    } else {
      logError(`${check.name}: FAILED`);
    }
  });
  
  const allPassed = Object.values(results).every(r => r === null || r === true);
  
  console.log('\n');
  if (allPassed) {
    logSuccess('All checks passed! Browser automation should work correctly.');
  } else {
    logError('Some checks failed. Please fix the issues above before using browser automation.');
    console.log('\n');
    log('Next steps:', 'bright');
    log('1. Ensure all services are running:', 'cyan');
    log('   - Frontend: cd frontend && npm run dev', 'cyan');
    log('   - Backend: cd backend && npm run dev', 'cyan');
    log('   - AI Service: cd ai-service && python -m flask run --port 5001', 'cyan');
    log('2. If panel data is missing, seed it:', 'cyan');
    log(`   node scripts/populate-panel-layout.js ${projectId || '<projectId>'}`, 'cyan');
    log('3. Check logs for detailed error messages', 'cyan');
  }
  
  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };

