/**
 * Backend environment configuration
 * Re-exports the root config for backend use with fallback to standalone config
 */

const path = require('path');

// Try to find the root config from different possible locations
let configPath;
let config;
let configLoadError = null;

try {
  // First try the expected relative path
  configPath = path.join(__dirname, '..', '..', 'config', 'env');
  config = require(configPath);
  console.log('✅ Loaded config from root config/env.js');
} catch (error) {
  configLoadError = error;
  try {
    // If that fails, try from the project root
    configPath = path.join(process.cwd(), 'config', 'env');
    config = require(configPath);
    console.log('✅ Loaded config from project root config/env.js');
  } catch (error2) {
    configLoadError = error2;
    try {
      // If that fails, try from src/config (deployment structure)
      configPath = path.join(process.cwd(), 'src', 'config', 'env');
      config = require(configPath);
      console.log('✅ Loaded config from src/config/env.js');
    } catch (error3) {
      configLoadError = error3;
      // Final fallback: use standalone config
      console.warn('⚠️ Could not load root config, using standalone backend config');
      console.warn('Config load error:', configLoadError.message);
      console.warn('Failed paths:');
      console.warn('1. Relative path:', path.join(__dirname, '..', '..', 'config', 'env'));
      console.warn('2. Project root:', path.join(process.cwd(), 'config', 'env'));
      console.warn('3. Src config:', path.join(process.cwd(), 'src', 'config', 'env'));
      console.warn('Current working directory:', process.cwd());
      console.warn('__dirname:', __dirname);
      
      // Use standalone config as fallback
      config = require('./env-standalone');
      console.log('✅ Loaded standalone backend config');
    }
  }
}

// Debug: Log config structure to help diagnose issues
console.log('🔍 Config debug info:');
console.log('- Config keys:', Object.keys(config));
console.log('- Has supabase:', !!config.supabase);
if (config.supabase) {
  console.log('- Supabase keys:', Object.keys(config.supabase));
  console.log('- Supabase URL:', config.supabase.url ? 'SET' : 'NOT SET');
  console.log('- Service Role Key:', config.supabase.serviceRoleKey ? 'SET' : 'NOT SET');
  console.log('- Anon Key:', config.supabase.anonKey ? 'SET' : 'NOT SET');
} else {
  console.log('- Supabase config is undefined!');
}

// Check if config is empty or missing critical properties
if (!config || Object.keys(config).length === 0 || !config.supabase) {
  console.warn('⚠️ Root config is empty or missing supabase config, falling back to standalone config');
  config = require('./env-standalone');
  console.log('✅ Loaded standalone backend config as fallback');
}

module.exports = config;

