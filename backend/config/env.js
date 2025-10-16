/**
 * Backend environment configuration
 * Re-exports the root config for backend use with fallback to standalone config
 */

const path = require('path');

// Try to find the root config from different possible locations
let configPath;
try {
  // First try the expected relative path
  configPath = path.join(__dirname, '..', '..', 'config', 'env');
  module.exports = require(configPath);
  console.log('✅ Loaded config from root config/env.js');
} catch (error) {
  try {
    // If that fails, try from the project root
    configPath = path.join(process.cwd(), 'config', 'env');
    module.exports = require(configPath);
    console.log('✅ Loaded config from project root config/env.js');
  } catch (error2) {
    try {
      // If that fails, try from src/config (deployment structure)
      configPath = path.join(process.cwd(), 'src', 'config', 'env');
      module.exports = require(configPath);
      console.log('✅ Loaded config from src/config/env.js');
    } catch (error3) {
      // Final fallback: use standalone config
      console.warn('⚠️ Could not load root config, using standalone backend config');
      console.warn('Failed paths:');
      console.warn('1. Relative path:', path.join(__dirname, '..', '..', 'config', 'env'));
      console.warn('2. Project root:', path.join(process.cwd(), 'config', 'env'));
      console.warn('3. Src config:', path.join(process.cwd(), 'src', 'config', 'env'));
      console.warn('Current working directory:', process.cwd());
      console.warn('__dirname:', __dirname);
      
      // Use standalone config as fallback
      module.exports = require('./env-standalone');
      console.log('✅ Loaded standalone backend config');
    }
  }
}

