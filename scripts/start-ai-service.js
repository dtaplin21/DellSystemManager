#!/usr/bin/env node

/**
 * Cross-platform AI Service Starter
 * Works on Windows, macOS, and Linux
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for terminal output
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

function logStatus(message) {
  log(`[INFO] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`[SUCCESS] ${message}`, 'green');
}

function logWarning(message) {
  log(`[WARNING] ${message}`, 'yellow');
}

function logError(message) {
  log(`[ERROR] ${message}`, 'red');
}

// Detect platform
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Find Python command
function findPythonCommand() {
  const commands = isWindows ? ['python', 'py', 'python3'] : ['python3', 'python'];
  
  for (const cmd of commands) {
    try {
      const { execSync } = require('child_process');
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {
      // Command not found, try next
    }
  }
  
  return null;
}

// Check if Redis is running
function checkRedis() {
  try {
    const { execSync } = require('child_process');
    if (isWindows) {
      // Windows: Use tasklist or Get-Process
      try {
        execSync('tasklist /FI "IMAGENAME eq redis-server.exe" 2>nul | find /I "redis-server.exe"', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    } else {
      // Unix/Mac: Use pgrep
      execSync('pgrep -x redis-server', { stdio: 'ignore' });
      return true;
    }
  } catch {
    return false;
  }
}

// Main function
async function startAIService() {
  // When running via concurrently, reduce verbose output
  const isConcurrent = process.env.CONCURRENTLY === 'true' || process.argv.includes('--concurrent');
  
  if (!isConcurrent) {
    log('🚀 Starting AI Service...', 'cyan');
    console.log('');
  }

  // Get paths
  const rootDir = path.resolve(__dirname, '..');
  const aiServiceDir = path.join(rootDir, 'ai_service');
  const venvDir = path.join(aiServiceDir, 'venv');
  const requirementsPath = path.join(aiServiceDir, 'requirements.txt');

  // Check if ai_service directory exists
  if (!fs.existsSync(aiServiceDir)) {
    logError(`AI service directory not found: ${aiServiceDir}`);
    process.exit(1);
  }

  // Find Python command
  const pythonCmd = findPythonCommand();
  if (!pythonCmd) {
    logError('Python 3 is not installed or not in PATH');
    log('Please install Python 3 from https://www.python.org/downloads/');
    process.exit(1);
  }

  if (!isConcurrent) {
    logStatus(`Using Python: ${pythonCmd}`);
  }

  // Check/create virtual environment
  if (!fs.existsSync(venvDir)) {
    if (!isConcurrent) {
      logStatus('Creating virtual environment...');
    }
    try {
      const { execSync } = require('child_process');
      execSync(`${pythonCmd} -m venv venv`, {
        cwd: aiServiceDir,
        stdio: isConcurrent ? 'ignore' : 'inherit'
      });
      if (!isConcurrent) {
        logSuccess('Virtual environment created');
      }
    } catch (error) {
      logError(`Failed to create virtual environment: ${error.message}`);
      process.exit(1);
    }
  }

  // Determine pip and python paths based on platform
  let pipCmd, pythonExecutable;
  if (isWindows) {
    pipCmd = path.join(venvDir, 'Scripts', 'pip.exe');
    pythonExecutable = path.join(venvDir, 'Scripts', 'python.exe');
  } else {
    pipCmd = path.join(venvDir, 'bin', 'pip');
    pythonExecutable = path.join(venvDir, 'bin', 'python');
  }

  // Install/upgrade dependencies (only if venv was just created or if SKIP_DEPS is not set)
  // Skip dependency installation when running via concurrently to speed up startup
  const skipDeps = process.env.SKIP_AI_DEPS === 'true';
  
  if (!skipDeps && fs.existsSync(requirementsPath)) {
    // Check if dependencies need to be installed (venv exists but packages might be missing)
    const testImport = isWindows 
      ? `"${pythonExecutable}" -c "import flask, openai" 2>nul`
      : `"${pythonExecutable}" -c "import flask, openai" 2>/dev/null`;
    
    try {
      const { execSync } = require('child_process');
      execSync(testImport, { cwd: aiServiceDir, stdio: 'ignore' });
      // Dependencies already installed, skip
    } catch {
      // Dependencies missing, install them
      logStatus('Installing/upgrading dependencies...');
      try {
        execSync(`"${pipCmd}" install -q --upgrade pip`, {
          cwd: aiServiceDir,
          stdio: 'inherit'
        });
        execSync(`"${pipCmd}" install -q -r requirements.txt`, {
          cwd: aiServiceDir,
          stdio: 'inherit'
        });
        logSuccess('Dependencies installed');
      } catch (error) {
        logWarning(`Failed to install some dependencies: ${error.message}`);
        logWarning('Continuing anyway...');
      }
    }
  } else if (skipDeps) {
    logStatus('Skipping dependency check (running in dev mode)...');
  } else {
    logWarning(`requirements.txt not found at ${requirementsPath}`);
  }

  // Check Redis (only warn if not running via concurrently, since redis is started separately)
  if (!isConcurrent && !checkRedis()) {
    logWarning('Redis server not detected. Some features may not work.');
    log('To start Redis:', isWindows ? 'redis-server.exe' : 'redis-server');
  }

  // Set environment variables
  const env = {
    ...process.env,
    PORT: process.env.PORT || '5001',
    FLASK_APP: 'app.py',
    FLASK_ENV: 'development',
    FLASK_DEBUG: '1',
    LITELLM_MODEL: process.env.LITELLM_MODEL || 'gpt-4o',
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
    AI_SERVICE_URL: `http://localhost:${process.env.PORT || '5001'}`,
  };

  // Check for required environment variables
  if (!env.OPENAI_API_KEY && !isConcurrent) {
    logWarning('OPENAI_API_KEY not set. Some features may not work.');
  }

  if (!isConcurrent) {
    console.log('');
    logSuccess(`Starting AI Service on port ${env.PORT}...`);
    log(`   Health check: http://localhost:${env.PORT}/health`);
    log('   Press Ctrl+C to stop');
    console.log('');
  } else {
    // Minimal output when running via concurrently
    console.log(`[AI] Starting on port ${env.PORT}...`);
  }

  // Start the Flask app
  const appPath = path.join(aiServiceDir, 'app.py');
  
  if (!fs.existsSync(appPath)) {
    logError(`app.py not found at ${appPath}`);
    process.exit(1);
  }

  const child = spawn(`"${pythonExecutable}"`, ['app.py'], {
    cwd: aiServiceDir,
    env,
    shell: isWindows,
    stdio: 'inherit'
  });

  child.on('error', (error) => {
    logError(`Failed to start AI service: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      logError(`AI service exited with code ${code}`);
      process.exit(code);
    }
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    log('\nShutting down AI service...', 'yellow');
    child.kill('SIGINT');
    setTimeout(() => {
      child.kill('SIGTERM');
      process.exit(0);
    }, 2000);
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
    process.exit(0);
  });
}

// Run if called directly
if (require.main === module) {
  startAIService().catch((error) => {
    logError(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { startAIService };

