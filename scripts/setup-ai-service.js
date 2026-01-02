#!/usr/bin/env node

/**
 * Cross-platform AI Service Setup Script
 * Works on Windows, macOS, and Linux
 */

const { spawn, execSync } = require('child_process');
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

// Check if running as root/admin
function checkRoot() {
  if (isWindows) {
    try {
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  } else {
    return process.getuid && process.getuid() === 0;
  }
}

// Find Python command
function findPythonCommand() {
  const commands = isWindows ? ['python', 'py', 'python3'] : ['python3', 'python'];
  
  for (const cmd of commands) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {
      // Command not found, try next
    }
  }
  
  return null;
}

// Get Python version
function getPythonVersion(pythonCmd) {
  try {
    const version = execSync(`${pythonCmd} --version`, { encoding: 'utf-8' });
    return version.trim();
  } catch {
    return null;
  }
}

// Get Node.js version
function getNodeVersion() {
  try {
    return process.version;
  } catch {
    return null;
  }
}

// Create .env file if it doesn't exist
function createEnvFile(filePath, content) {
  if (fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    logError(`Failed to create ${filePath}: ${error.message}`);
    return false;
  }
}

// Main setup function
async function setupAIService() {
  // Check if running as root
  if (checkRoot()) {
    logError('This script should not be run as root/admin');
    process.exit(1);
  }

  logStatus('Setting up Dell System Manager AI Service (OpenAI-Only)', 'cyan');
  console.log('');

  const rootDir = path.resolve(__dirname, '..');
  const aiServiceDir = path.join(rootDir, 'ai_service');
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');

  // Check Python version
  logStatus('Checking Python version...');
  const pythonCmd = findPythonCommand();
  if (!pythonCmd) {
    logError('Python 3 is required but not installed');
    log('Please install Python 3 from https://www.python.org/downloads/');
    process.exit(1);
  }
  
  const pythonVersion = getPythonVersion(pythonCmd);
  if (pythonVersion) {
    logSuccess(`Python ${pythonVersion} found`);
  }

  // Check Node.js version
  logStatus('Checking Node.js version...');
  const nodeVersion = getNodeVersion();
  if (nodeVersion) {
    logSuccess(`Node.js ${nodeVersion} found`);
  } else {
    logError('Node.js is required but not installed');
    log('Please install Node.js from https://nodejs.org/');
    process.exit(1);
  }

  // Install Python dependencies
  logStatus('Installing Python dependencies...');
  if (!fs.existsSync(aiServiceDir)) {
    logError(`AI service directory not found: ${aiServiceDir}`);
    process.exit(1);
  }

  const requirementsPath = path.join(aiServiceDir, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    try {
      execSync(`${pythonCmd} -m pip install -r requirements.txt`, {
        cwd: aiServiceDir,
        stdio: 'inherit'
      });
      logSuccess('Python dependencies installed');
    } catch (error) {
      logError(`Failed to install Python dependencies: ${error.message}`);
      process.exit(1);
    }
  } else {
    logError(`requirements.txt not found at ${requirementsPath}`);
    process.exit(1);
  }

  // Install Node.js dependencies - Backend
  logStatus('Installing Node.js dependencies (Backend)...');
  const backendPackageJson = path.join(backendDir, 'package.json');
  if (fs.existsSync(backendPackageJson)) {
    try {
      execSync('npm install', {
        cwd: backendDir,
        stdio: 'inherit'
      });
      logSuccess('Backend dependencies installed');
    } catch (error) {
      logError(`Failed to install backend dependencies: ${error.message}`);
      process.exit(1);
    }
  } else {
    logError(`Backend package.json not found at ${backendPackageJson}`);
    process.exit(1);
  }

  // Install Node.js dependencies - Frontend
  logStatus('Installing Node.js dependencies (Frontend)...');
  const frontendPackageJson = path.join(frontendDir, 'package.json');
  if (fs.existsSync(frontendPackageJson)) {
    try {
      execSync('npm install', {
        cwd: frontendDir,
        stdio: 'inherit'
      });
      logSuccess('Frontend dependencies installed');
    } catch (error) {
      logError(`Failed to install frontend dependencies: ${error.message}`);
      process.exit(1);
    }
  } else {
    logError(`Frontend package.json not found at ${frontendPackageJson}`);
    process.exit(1);
  }

  // Setup environment variables
  logStatus('Setting up environment variables...');

  // Create ai_service/.env
  const aiServiceEnvPath = path.join(aiServiceDir, '.env');
  const aiServiceEnvContent = `# AI Service Environment Variables
OPENAI_API_KEY=your_openai_api_key_here

# Database and caching (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Flask configuration
FLASK_ENV=development
FLASK_DEBUG=1
`;

  if (createEnvFile(aiServiceEnvPath, aiServiceEnvContent)) {
    logSuccess('Created ai_service/.env');
  } else {
    logStatus('ai_service/.env already exists, skipping...');
  }

  // Create frontend/.env.local
  const frontendEnvPath = path.join(frontendDir, '.env.local');
  const frontendEnvContent = `# Frontend Environment Variables
NEXT_PUBLIC_BACKEND_URL=http://localhost:8003
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:5001
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_APP_NAME=Dell System Manager
NEXT_PUBLIC_APP_VERSION=1.0.0
`;

  if (createEnvFile(frontendEnvPath, frontendEnvContent)) {
    logSuccess('Created frontend/.env.local');
  } else {
    logStatus('frontend/.env.local already exists, skipping...');
  }

  // Test OpenAI API key
  logStatus('Checking OpenAI API key...');
  if (fs.existsSync(aiServiceEnvPath)) {
    try {
      const envContent = fs.readFileSync(aiServiceEnvPath, 'utf-8');
      const openaiKeyMatch = envContent.match(/OPENAI_API_KEY=(.+)/);
      if (openaiKeyMatch && openaiKeyMatch[1] !== 'your_openai_api_key_here') {
        logSuccess('OpenAI API key found');
      } else {
        logWarning('Please set your OpenAI API key in ai_service/.env');
      }
    } catch (error) {
      logWarning('Could not read ai_service/.env');
    }
  }

  // Test Python dependencies
  logStatus('Testing Python dependencies...');
  try {
    execSync(`${pythonCmd} -c "import openai, flask; print('Python dependencies OK')"`, {
      stdio: 'ignore'
    });
    logSuccess('Python dependencies verified');
  } catch (error) {
    logError('Python dependencies test failed');
    log('Some dependencies may be missing. Please check requirements.txt');
  }

  // Test Node.js
  logStatus('Testing Node.js...');
  try {
    execSync('node -e "console.log(\'Node.js OK\')"', {
      stdio: 'ignore'
    });
    logSuccess('Node.js verified');
  } catch (error) {
    logError('Node.js test failed');
    process.exit(1);
  }

  console.log('');
  logSuccess('Setup completed successfully!', 'green');
  console.log('');
  
  logStatus('Next steps:');
  console.log('1. Set your OpenAI API key in ai_service/.env');
  console.log('2. Set your Supabase credentials in frontend/.env.local');
  console.log('3. Start the services:');
  console.log('   - AI Service: npm run dev:ai');
  console.log('   - Backend: npm run dev:backend');
  console.log('   - Frontend: npm run dev:frontend');
  console.log('   - All services: npm run dev:all');
  console.log('');
  
  logStatus('AI Features Available:');
  console.log('✓ Document Analysis (OpenAI GPT-4o)');
  console.log('✓ Handwriting OCR (OpenAI Vision)');
  console.log('✓ Panel Layout Optimization (OpenAI)');
  console.log('✓ QC Data Analysis (OpenAI)');
  console.log('✓ Data Extraction (OpenAI)');
  console.log('✓ Project Recommendations (OpenAI)');
  console.log('');
  
  logWarning('Note: This setup uses OpenAI GPT-4o for all AI features.');
  logWarning('Costs will be based on OpenAI\'s pricing (~$0.005 per 1K tokens).');
}

// Run if called directly
if (require.main === module) {
  setupAIService().catch((error) => {
    logError(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { setupAIService };

