/**
 * Backend environment configuration
 * Re-exports the root config for backend use with fallback to standalone config
 * 
 * In production (Render, etc.), skips root config and uses standalone directly
 * In development, tries root config first (for .env file support)
 */

const path = require('path');

// Detect production environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

let config;

if (isProduction) {
  // In production, skip root config and use standalone directly
  // This avoids file system dependencies and path resolution issues
  console.log('✅ Production environment detected, using standalone config');
  config = require('./env-standalone');
} else {
  // In development, try to load root config first (for .env file support)
  let configPath;
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
        
        // Use standalone config as fallback
        config = require('./env-standalone');
        console.log('✅ Loaded standalone backend config');
      }
    }
  }

  // Check if config is empty or missing critical properties
  if (!config || Object.keys(config).length === 0 || !config.supabase) {
    console.warn('⚠️ Root config is empty or missing supabase config, falling back to standalone config');
    config = require('./env-standalone');
    console.log('✅ Loaded standalone backend config as fallback');
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

module.exports = config;

