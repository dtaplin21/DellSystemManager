/**
 * Verify ML Infrastructure Setup
 * Run this to check if all ML components are properly configured
 */

require('dotenv').config({ path: '../../.env' });
const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const CHECKS = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function log(message, type = 'info') {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: '📋'
  };
  
  console.log(`${icons[type] || '📋'} ${message}`);
}

async function checkDatabase() {
  log('Checking database connection and tables...');
  
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Check if ML tables exist
    const tables = [
      'prompt_performance',
      'ml_models',
      'ml_predictions',
      'ml_audit_log',
      'import_patterns',
      'ai_accuracy_log'
    ];

    let allExist = true;
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);

      if (result.rows[0].exists) {
        log(`  Table ${table} exists`, 'success');
        CHECKS.passed++;
      } else {
        log(`  Table ${table} missing - run migration!`, 'error');
        log(`  Run: psql $DATABASE_URL -f backend/db/migrations/004_ml_infrastructure.sql`, 'warning');
        allExist = false;
        CHECKS.failed++;
      }
    }

    await pool.end();
    return allExist;
  } catch (error) {
    log(`Database check failed: ${error.message}`, 'error');
    CHECKS.failed++;
    return false;
  }
}

async function checkFiles() {
  log('Checking required files...');
  
  const requiredFiles = [
    'backend/services/prompt-templates/base.js',
    'backend/services/prompt-templates/panel-seaming-prompt.js',
    'backend/services/mlService.js',
    'backend/services/anomalyDetector.js',
    'backend/services/mlMonitor.js',
    'backend/services/historical-patterns.js',
    'backend/ml_models/server.py',
    'backend/ml_models/anomaly_detector/model.py'
  ];

  let allExist = true;
  for (const file of requiredFiles) {
    // Handle both root and backend directory execution
    const possiblePaths = [
      path.join(process.cwd(), file),
      path.join(process.cwd(), '..', file),
      path.join(__dirname, '..', file.replace('backend/', ''))
    ];
    
    let found = false;
    for (const fullPath of possiblePaths) {
      if (fs.existsSync(fullPath)) {
        log(`  ${file} exists`, 'success');
        CHECKS.passed++;
        found = true;
        break;
      }
    }
    
    if (!found) {
      log(`  ${file} missing`, 'error');
      allExist = false;
      CHECKS.failed++;
    }
  }

  return allExist;
}

async function checkPythonServer() {
  log('Checking Python ML server...');
  
  const mlServerUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
  
  try {
    const response = await axios.get(`${mlServerUrl}/health`, {
      timeout: 3000
    });

    if (response.data.status === 'healthy') {
      log(`  Python server is running at ${mlServerUrl}`, 'success');
      CHECKS.passed++;
      return true;
    } else {
      log(`  Python server responded but status is not healthy`, 'warning');
      CHECKS.warnings++;
      return false;
    }
  } catch (error) {
    log(`  Python server not running at ${mlServerUrl}`, 'warning');
    log(`  Start it with: cd backend/ml_models && python3 server.py`, 'warning');
    CHECKS.warnings++;
    return false;
  }
}

async function checkEnvironmentVariables() {
  log('Checking environment variables...');
  
  const required = [
    'DATABASE_URL',
    'OPENAI_API_KEY'
  ];

  const optional = [
    'ML_SERVICE_URL',
    'ML_SERVER_PORT'
  ];

  let allPresent = true;
  
  for (const key of required) {
    if (process.env[key]) {
      log(`  ${key} is set`, 'success');
      CHECKS.passed++;
    } else {
      log(`  ${key} is missing (required)`, 'error');
      allPresent = false;
      CHECKS.failed++;
    }
  }

  for (const key of optional) {
    if (process.env[key]) {
      log(`  ${key} is set`, 'success');
      CHECKS.passed++;
    } else {
      log(`  ${key} is not set (optional, using defaults)`, 'warning');
      CHECKS.warnings++;
    }
  }

  return allPresent;
}

async function checkPackageDependencies() {
  log('Checking Node.js dependencies...');
  
  try {
    require('./../services/mlService');
    require('./../services/anomalyDetector');
    require('./../services/mlMonitor');
    log('  All ML service dependencies loaded', 'success');
    CHECKS.passed++;
    return true;
  } catch (error) {
    log(`  Failed to load ML services: ${error.message}`, 'error');
    CHECKS.failed++;
    return false;
  }
}

async function main() {
  console.log('\n🔍 ML Infrastructure Verification\n');
  console.log('='.repeat(60));
  console.log();

  await checkFiles();
  console.log();
  
  await checkPackageDependencies();
  console.log();
  
  await checkEnvironmentVariables();
  console.log();
  
  await checkDatabase();
  console.log();
  
  await checkPythonServer();
  console.log();

  console.log('='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`  ✅ Passed: ${CHECKS.passed}`);
  console.log(`  ❌ Failed: ${CHECKS.failed}`);
  console.log(`  ⚠️  Warnings: ${CHECKS.warnings}`);
  console.log();

  if (CHECKS.failed === 0) {
    console.log('🎉 All critical checks passed! ML infrastructure is ready.');
    if (CHECKS.warnings > 0) {
      console.log('⚠️  Some optional components are not configured, but core functionality will work.');
    }
    process.exit(0);
  } else {
    console.log('❌ Some critical checks failed. Please fix the issues above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});

