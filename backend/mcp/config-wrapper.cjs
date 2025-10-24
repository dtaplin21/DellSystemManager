/**
 * CommonJS wrapper for MCP config
 * This allows us to use require() in the ES module server
 */

const path = require('path');

// Load the main config
let mainConfig;
try {
  const configPath = path.resolve(__dirname, '../../config/env');
  mainConfig = require(configPath);
} catch (error) {
  console.error('❌ Failed to load main config:', error.message);
  process.exit(1);
}

// MCP-specific configuration
const mcpConfig = {
  // MCP Server Settings
  server: {
    name: 'dellsystemmanager-mcp',
    version: '1.0.0',
    mode: process.env.MCP_MODE || 'internal', // 'internal' or 'external'
    port: process.env.MCP_PORT || 3002,
    host: process.env.MCP_HOST || 'localhost'
  },

  // Database Configuration (reuse existing)
  database: {
    url: mainConfig.databaseUrl,
    ssl: { rejectUnauthorized: false },
    maxConnections: parseInt(process.env.MCP_DB_MAX_CONNECTIONS) || 5,
    // Separate read-only connection for external MCP
    readOnlyUrl: process.env.MCP_DATABASE_URL || mainConfig.databaseUrl
  },

  // Authentication & Security
  auth: {
    // Internal MCP - Simple email whitelist
    internal: {
      enabled: process.env.MCP_INTERNAL_ENABLED !== 'false',
      allowedEmails: (process.env.MCP_ALLOWED_EMAILS || 'dtaplin21+new@gmail.com').split(',').filter(Boolean),
      requireAuth: process.env.MCP_INTERNAL_AUTH !== 'false'
    },
    // External MCP - Full Supabase auth
    external: {
      enabled: process.env.MCP_EXTERNAL_ENABLED === 'true',
      supabaseUrl: mainConfig.supabase.url,
      supabaseKey: mainConfig.supabase.anonKey,
      jwtSecret: mainConfig.supabase.jwtSecret,
      requireAuth: true
    }
  },

  // Rate Limiting
  rateLimit: {
    enabled: process.env.MCP_RATE_LIMIT !== 'false',
    windowMs: parseInt(process.env.MCP_RATE_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.MCP_RATE_MAX) || 100, // 100 requests per window
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      prefix: 'mcp-ratelimit:'
    },
    // Tool-specific limits
    tools: {
      'query_database': { max: 20, windowMs: 15 * 60 * 1000 },
      'import_asbuilt_excel': { max: 10, windowMs: 60 * 60 * 1000 },
      'get_projects': { max: 100, windowMs: 15 * 60 * 1000 },
      'get_asbuilt_records': { max: 200, windowMs: 15 * 60 * 1000 }
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.MCP_LOG_LEVEL || mainConfig.logging?.level || 'info',
    file: {
      error: 'logs/mcp-error.log',
      combined: 'logs/mcp-combined.log'
    },
    console: {
      enabled: process.env.MCP_CONSOLE_LOG !== 'false'
    }
  },

  // Tool Permissions
  permissions: {
    // Internal tools (admin/team only)
    internal: [
      'query_database',
      'delete_project',
      'bulk_import',
      'debug_records',
      'get_all_projects',
      'get_user_data',
      'system_status'
    ],
    // External tools (customer-facing)
    external: [
      'get_my_projects',
      'get_project_panels',
      'get_asbuilt_records',
      'search_records',
      'generate_report',
      'import_asbuilt_excel'
    ]
  },

  // Security Settings
  security: {
    // Input validation
    maxQueryLength: parseInt(process.env.MCP_MAX_QUERY_LENGTH) || 1000,
    maxFileSize: parseInt(process.env.MCP_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    
    // Row-level security
    enforceRowLevelSecurity: process.env.MCP_ROW_LEVEL_SECURITY !== 'false',
    
    // Audit logging
    auditLog: {
      enabled: process.env.MCP_AUDIT_LOG !== 'false',
      file: 'logs/mcp-audit.log',
      includeSensitiveData: process.env.MCP_AUDIT_SENSITIVE === 'true'
    }
  },

  // AI Integration
  ai: {
    openaiApiKey: mainConfig.secrets?.openaiApiKey || process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: parseInt(process.env.MCP_MAX_TOKENS) || 4096,
    temperature: parseFloat(process.env.MCP_TEMPERATURE) || 0.1
  }
};

// Validation
function validateConfig() {
  const errors = [];
  
  if (!mcpConfig.database.url) {
    errors.push('Database URL is required');
  }
  
  if (mcpConfig.auth.external.enabled && !mcpConfig.auth.external.supabaseUrl) {
    errors.push('Supabase URL is required for external MCP');
  }
  
  if (mcpConfig.rateLimit.enabled && !mcpConfig.rateLimit.redis.url) {
    errors.push('Redis URL is required for rate limiting');
  }
  
  if (errors.length > 0) {
    throw new Error(`MCP Configuration errors:\n${errors.join('\n')}`);
  }
}

// Validate on load
try {
  validateConfig();
  console.log('✅ MCP configuration validated successfully');
} catch (error) {
  console.error('❌ MCP configuration validation failed:', error.message);
  process.exit(1);
}

module.exports = mcpConfig;
