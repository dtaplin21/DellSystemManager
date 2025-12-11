const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const path = require('path');
const schema = require('./schema');
const config = require('../config/env');
const logger = require('../lib/logger');

// Parse connection string
let connectionString = config.databaseUrl;

// Connection mode selector (from environment variable)
const connectionMode = process.env.SUPABASE_CONNECTION_MODE || 'auto'; // 'auto', 'pooler', 'direct'
logger.info('Supabase connection mode', { mode: connectionMode });

// Helper function to modify connection string port
function modifyConnectionPort(connString, newPort) {
  try {
    const url = new URL(connString);
    url.port = newPort.toString();
    return url.toString();
  } catch (error) {
    // If not a URL, try to replace port in connection string
    return connString.replace(/:\d+(\/|$)/, `:${newPort}$1`);
  }
}

// Helper function to get port from connection string
function getConnectionPort(connString) {
  try {
    const url = new URL(connString);
    return parseInt(url.port || '5432', 10);
  } catch (error) {
    // Try to extract port from connection string format
    const match = connString.match(/:(\d+)(\/|$)/);
    return match ? parseInt(match[1], 10) : 5432;
  }
}

// Helper function to test connection with a specific port
async function testConnectionWithPort(connString, port, timeoutMs = 5000) {
  const testConnString = modifyConnectionPort(connString, port);
  const testPool = new Pool({
    connectionString: testConnString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    min: 0,
    connectionTimeoutMillis: timeoutMs
  });
  
  try {
    const client = await Promise.race([
      testPool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
      )
    ]);
    
    // Test a simple query
    await client.query('SELECT 1');
    client.release();
    await testPool.end();
    return true;
  } catch (error) {
    try {
      await testPool.end();
    } catch {}
    return false;
  }
}

// Determine which port to use based on connection mode
async function determineConnectionPort(connString) {
  const currentPort = getConnectionPort(connString);
  
  // If mode is explicitly set, use that
  if (connectionMode === 'direct') {
    logger.info('Using direct connection mode (port 5432)');
    return modifyConnectionPort(connString, 5432);
  }
  
  if (connectionMode === 'pooler') {
    logger.info('Using pooler connection mode (port 6543)');
    return modifyConnectionPort(connString, 6543);
  }
  
  // Auto mode: try current port first, then fallback
  logger.info('Auto mode: testing connection ports', { currentPort });
  
  // If current port is 6543, test it first
  if (currentPort === 6543) {
    logger.debug('Testing pooler port (6543) first');
    const poolerWorks = await testConnectionWithPort(connString, 6543, 3000);
    
    if (poolerWorks) {
      logger.info('✅ Pooler port (6543) is accessible, using pooler connection');
      return modifyConnectionPort(connString, 6543);
    }
    
    logger.warn('⚠️ Pooler port (6543) failed, testing direct port (5432)');
    const directWorks = await testConnectionWithPort(connString, 5432, 3000);
    
    if (directWorks) {
      logger.info('✅ Direct port (5432) is accessible, using direct connection');
      return modifyConnectionPort(connString, 5432);
    }
    
    logger.error('❌ Both ports failed, using original connection string');
    return connString;
  }
  
  // If current port is 5432, test it first
  if (currentPort === 5432) {
    logger.debug('Testing direct port (5432) first');
    const directWorks = await testConnectionWithPort(connString, 5432, 3000);
    
    if (directWorks) {
      logger.info('✅ Direct port (5432) is accessible, using direct connection');
      return modifyConnectionPort(connString, 5432);
    }
    
    logger.warn('⚠️ Direct port (5432) failed, testing pooler port (6543)');
    const poolerWorks = await testConnectionWithPort(connString, 6543, 3000);
    
    if (poolerWorks) {
      logger.info('✅ Pooler port (6543) is accessible, using pooler connection');
      return modifyConnectionPort(connString, 6543);
    }
    
    logger.error('❌ Both ports failed, using original connection string');
    return connString;
  }
  
  // Unknown port, use as-is
  logger.warn('Unknown port in connection string, using as-is', { port: currentPort });
  return connString;
}

// Validate connection string format
function validateConnectionString(connString) {
  if (!connString) {
    throw new Error('DATABASE_URL is not configured');
  }
  
  try {
    const url = new URL(connString);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      throw new Error(`Invalid database protocol: ${url.protocol}. Expected postgresql:// or postgres://`);
    }
    
    // Log connection details (masked for security)
    const maskedUrl = `${url.protocol}//${url.hostname}:${url.port || '5432'}/${url.pathname.split('/')[1] || 'unknown'}`;
    logger.info('Database connection string validated', {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.split('/')[1] || 'unknown',
      maskedUrl: maskedUrl
    });
    
    return true;
  } catch (error) {
    if (error instanceof TypeError) {
      // Not a URL, might be a connection string format
      logger.warn('Connection string is not a URL format, assuming PostgreSQL connection string');
      return true;
    }
    throw new Error(`Invalid DATABASE_URL format: ${error.message}`);
  }
}

// Validate connection string format
try {
  validateConnectionString(connectionString);
} catch (error) {
  logger.error('Database connection string validation failed', {
    error: error.message
  });
  throw error;
}

// Determine optimal connection string (synchronously for manual modes, async for auto)
let finalConnectionString = connectionString;

if (connectionMode === 'direct') {
  finalConnectionString = modifyConnectionPort(connectionString, 5432);
  logger.info('Using direct connection mode (port 5432)');
} else if (connectionMode === 'pooler') {
  finalConnectionString = modifyConnectionPort(connectionString, 6543);
  logger.info('Using pooler connection mode (port 6543)');
} else {
  // Auto mode - start with current port, will test and switch if needed
  logger.info('Auto mode: will test ports on first connection attempt', {
    currentPort: getConnectionPort(connectionString)
  });
  finalConnectionString = connectionString;
}

// Initialize PostgreSQL pool for direct database access
// Use the initial connection string (will be optimized on first connection in auto mode)
const pool = new Pool({
  connectionString: finalConnectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // Increased to handle concurrent requests
  min: 0, // Start with 0 to avoid startup failures if DB is temporarily unavailable
  idleTimeoutMillis: 30000, // 30 seconds - shorter timeout to detect dead connections faster
  connectionTimeoutMillis: 20000, // 20 seconds - increased for slower networks
  application_name: 'dell-system-manager',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Send keep-alive after 10 seconds
  maxUses: 1000, // Close and replace a connection after it has been used 1000 times
  allowExitOnIdle: true // Allow the pool to close idle connections
});

// Track if we've optimized the connection string
let connectionOptimized = connectionMode !== 'auto';
let optimizedConnectionString = finalConnectionString;

// Optimize connection string on first use (for auto mode)
async function optimizeConnectionIfNeeded() {
  if (connectionOptimized) {
    return optimizedConnectionString;
  }
  
  logger.info('Auto mode: optimizing connection port...');
  try {
    optimizedConnectionString = await determineConnectionPort(connectionString);
    connectionOptimized = true;
    
    const finalPort = getConnectionPort(optimizedConnectionString);
    logger.info('✅ Connection optimized', {
      port: finalPort,
      mode: finalPort === 6543 ? 'pooler' : finalPort === 5432 ? 'direct' : 'custom'
    });
    
    // Update pool connection string by recreating it
    // Note: We can't change the connection string of an existing pool,
    // but we'll use the optimized string for new connections via queryWithRetry
    return optimizedConnectionString;
  } catch (error) {
    logger.warn('Failed to optimize connection, using original', {
      error: error.message
    });
    connectionOptimized = true; // Don't retry optimization
    return connectionString;
  }
}

// Log the initial connection configuration
const initialPort = getConnectionPort(finalConnectionString);
logger.info('PostgreSQL connection pool initialized', {
  port: initialPort,
  mode: connectionMode,
  host: (() => {
    try {
      return new URL(finalConnectionString).hostname;
    } catch {
      return 'unknown';
    }
  })()
});

// Add error handler for the pool
pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', {
    error: {
      code: err.code,
      message: err.message,
      stack: config.isDevelopment ? err.stack : undefined
    }
  });
});

// Add connection handler
pool.on('connect', (client) => {
  logger.debug('PostgreSQL client connected', {
    host: client.connectionParameters.host,
    database: client.connectionParameters.database
  });
  // Set statement timeout to prevent long-running queries
  client.query('SET statement_timeout = 30000').catch(err => {
    logger.warn('Failed to set statement timeout on new connection', { error: err.message });
  });
});

// Add acquire handler
pool.on('acquire', (client) => {
  logger.debug('PostgreSQL client acquired from pool', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

// Add remove handler
pool.on('remove', (client) => {
  logger.debug('PostgreSQL client removed from pool', {
    host: client?.connectionParameters?.host,
    database: client?.connectionParameters?.database,
    reason: 'Connection closed or removed'
  });
});

// Add error handler for connection errors
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle PostgreSQL client', {
    error: {
      code: err.code,
      message: err.message,
      stack: config.isDevelopment ? err.stack : undefined
    },
    poolState: {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    }
  });
});

// Connection pool health check
function getPoolHealth() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    healthy: pool.totalCount > 0 || pool.idleCount > 0
  };
}

// Reset connection pool if stuck
async function resetPool() {
  try {
    logger.warn('Resetting connection pool due to stuck state');
    await pool.end();
    // Note: We can't recreate the pool here as it's exported, but this will help
    // The pool will be recreated on next query attempt
  } catch (error) {
    logger.error('Error resetting pool', { error: error.message });
  }
}

// Test database connectivity
async function testDatabaseConnection(timeoutMs = 5000) {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Connection test timed out',
        duration: timeoutMs
      });
    }, timeoutMs);
    
    const startTime = Date.now();
    try {
      const client = await pool.connect();
      const testResult = await client.query('SELECT NOW() as current_time, version() as db_version');
      const duration = Date.now() - startTime;
      client.release();
      clearTimeout(timeout);
      
      resolve({
        success: true,
        duration,
        currentTime: testResult.rows[0].current_time,
        version: testResult.rows[0].db_version.substring(0, 50)
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      clearTimeout(timeout);
      resolve({
        success: false,
        error: error.message,
        code: error.code,
        duration
      });
    }
  });
}

// Connection retry helper with exponential backoff, early failure detection, and port optimization
async function queryWithRetry(queryText, params = [], maxRetries = 3) {
  let lastError;
  let consecutiveFailures = 0;
  
  // Optimize connection on first use (for auto mode)
  if (!connectionOptimized && connectionMode === 'auto') {
    await optimizeConnectionIfNeeded();
  }
  
  // Check pool health first
  const poolHealth = getPoolHealth();
  if (pool.waitingCount > 5) {
    logger.warn('High number of waiting connections, pool may be stuck', {
      poolState: poolHealth
    });
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Validate connection pool health before query
      if (pool.totalCount === 0 && pool.idleCount === 0) {
        logger.debug('Connection pool is empty, will create new connection');
      }
      
      // Use optimized connection string if available and different from pool's connection string
      let queryPool = pool;
      if (connectionOptimized && optimizedConnectionString !== finalConnectionString) {
        // Create a temporary pool with optimized connection string for this query
        const optimizedPool = new Pool({
          connectionString: optimizedConnectionString,
          ssl: { rejectUnauthorized: false },
          max: 1,
          connectionTimeoutMillis: 10000
        });
        
        try {
          const result = await Promise.race([
            optimizedPool.query(queryText, params),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), 25000)
            )
          ]);
          await optimizedPool.end();
          return result;
        } catch (optError) {
          try {
            await optimizedPool.end();
          } catch {}
          // Fall through to use original pool
        }
      }
      
      // Add query timeout to prevent hanging
      const queryPromise = queryPool.query(queryText, params);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout after 25 seconds')), 25000);
      });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      // Success - reset failure counter
      consecutiveFailures = 0;
      return result;
    } catch (error) {
      lastError = error;
      consecutiveFailures++;
      
      // Check if it's a connection/timeout error that might be retryable
      const isRetryable = 
        error.message.includes('timeout') ||
        error.message.includes('Connection terminated') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('Query timeout') ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED';
      
      // On first failure in auto mode, try to optimize connection
      if (attempt === 1 && !connectionOptimized && connectionMode === 'auto' && isRetryable) {
        logger.warn('First connection attempt failed, optimizing connection port...');
        try {
          await optimizeConnectionIfNeeded();
          // Continue to retry with potentially optimized connection
        } catch (optError) {
          logger.warn('Connection optimization failed, continuing with original', {
            error: optError.message
          });
        }
      }
      
      // Early failure detection: if first attempt fails with clear unreachable error, fail fast
      if (attempt === 1 && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        logger.error('Database appears unreachable, failing fast', {
          error: error.message,
          code: error.code,
          poolState: getPoolHealth()
        });
        throw error;
      }
      
      if (!isRetryable || attempt === maxRetries) {
        // Not retryable or max retries reached
        logger.error('Database query failed after retries', {
          attempt,
          maxRetries,
          error: error.message,
          code: error.code,
          poolState: getPoolHealth(),
          query: queryText.substring(0, 100) + '...'
        });
        throw error;
      }
      
      // Calculate exponential backoff delay: 500ms, 1000ms, 2000ms (increased from 100-400ms)
      const delay = Math.min(500 * Math.pow(2, attempt - 1), 2000);
      logger.warn(`Database query failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`, {
        error: error.message,
        code: error.code,
        query: queryText.substring(0, 100) + '...',
        poolState: getPoolHealth()
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

const db = drizzle(pool, { schema });

// Initialize Supabase client
const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase credentials are not configured correctly');
}

if (!config.supabase.serviceRoleKey && config.isDevelopment) {
  logger.warn('Supabase service role key is not configured. Falling back to anon key which may trigger RLS errors.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

// Helper function to create a user-scoped Supabase client for RLS
// This is needed when RLS policies check auth.uid()
function createUserScopedSupabaseClient(userAccessToken) {
  if (!userAccessToken) {
    // If no token provided, return the service role client (bypasses RLS)
    return supabase;
  }
  
  // Create a new client with the user's access token
  // This allows RLS policies to work correctly
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${userAccessToken}`
      }
    }
  });
}

async function connectToDatabase() {
  try {
    // Test the connection without creating a persistent client
    const client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL database', {
      host: client.connectionParameters.host,
      database: client.connectionParameters.database,
      port: client.connectionParameters.port,
      ssl: client.connectionParameters.ssl ? 'enabled' : 'disabled'
    });
    
    // Test a simple query for readiness
    const testResult = await client.query('SELECT NOW() as current_time');
    logger.debug('Database readiness check succeeded', {
      currentTime: testResult.rows[0].current_time
    });
    
    client.release(); // Release the test connection immediately
    return db;
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL database', {
      error: {
        code: error.code,
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    throw error;
  }
}

async function applyMigrations() {
  try {
    logger.info('Applying database migrations');
    const client = await pool.connect();
    
    // Create panel_layouts table if it doesn't exist
    const createPanelLayoutsTable = `
      CREATE TABLE IF NOT EXISTS panel_layouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        panels JSONB NOT NULL DEFAULT '[]',
        width DECIMAL NOT NULL DEFAULT 4000,
        height DECIMAL NOT NULL DEFAULT 4000,
        scale DECIMAL NOT NULL DEFAULT 1.0,
        last_updated TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    
    await client.query(createPanelLayoutsTable);
    logger.debug('panel_layouts table verified');
    
    // Create index if it doesn't exist
    const createIndex = `
      CREATE INDEX IF NOT EXISTS idx_panel_layouts_project_id 
      ON panel_layouts(project_id);
    `;
    
    await client.query(createIndex);
    logger.debug('panel_layouts index verified');
    
    // Create file_metadata table if it doesn't exist
    const createFileMetadataTable = `
      CREATE TABLE IF NOT EXISTS file_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name TEXT NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size INTEGER NOT NULL,
        project_id UUID NOT NULL,
        uploaded_by UUID,
        domain VARCHAR(50),
        panel_id UUID,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    await client.query(createFileMetadataTable);
    logger.debug('file_metadata table verified');
    
    // Create indexes for file_metadata
    const createFileMetadataIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_file_metadata_project_id ON file_metadata(project_id);`,
      `CREATE INDEX IF NOT EXISTS idx_file_metadata_panel_id ON file_metadata(panel_id);`,
      `CREATE INDEX IF NOT EXISTS idx_file_metadata_domain ON file_metadata(domain);`,
      `CREATE INDEX IF NOT EXISTS idx_file_metadata_created_at ON file_metadata(created_at);`
    ];
    
    for (const indexQuery of createFileMetadataIndexes) {
      await client.query(indexQuery);
    }
    logger.debug('file_metadata indexes verified');
    
    // Ensure pgcrypto extension for gen_random_uuid
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
      logger.debug('pgcrypto extension verified');
    } catch (extErr) {
      logger.warn('Could not ensure pgcrypto extension (may already exist or lack perms)', {
        error: { message: extErr.message }
      });
    }

    // Apply ML infrastructure migration (tables: ml_models, ml_predictions, etc.)
    try {
      const mlMigrationPath = path.join(__dirname, 'migrations', '004_ml_infrastructure.sql');
      const mlSql = await fs.readFile(mlMigrationPath, 'utf8');
      await client.query(mlSql);
      logger.debug('ML infrastructure migration applied');
    } catch (mlErr) {
      logger.warn('ML infrastructure migration not applied', {
        error: { message: mlErr.message },
        hint: 'If permissions restrict file reads, run the SQL manually in the DB.'
      });
    }

    // Apply form review columns migration
    try {
      const formReviewMigrationPath = path.join(__dirname, 'migrations', '006_add_form_review_columns.sql');
      const formReviewSql = await fs.readFile(formReviewMigrationPath, 'utf8');
      await client.query(formReviewSql);
      logger.debug('Form review columns migration applied');
    } catch (formReviewErr) {
      logger.warn('Form review columns migration not applied', {
        error: { message: formReviewErr.message },
        hint: 'If permissions restrict file reads, run the SQL manually in the DB. The migration file is at backend/db/migrations/006_add_form_review_columns.sql'
      });
    }

    // Apply automation jobs table migration
    try {
      const automationJobsMigrationPath = path.join(__dirname, 'migrations', '007_add_automation_jobs_table.sql');
      const automationJobsSql = await fs.readFile(automationJobsMigrationPath, 'utf8');
      await client.query(automationJobsSql);
      logger.debug('Automation jobs table migration applied');
    } catch (automationJobsErr) {
      logger.warn('Automation jobs table migration not applied', {
        error: { message: automationJobsErr.message },
        hint: 'If permissions restrict file reads, run the SQL manually in the DB. The migration file is at backend/db/migrations/007_add_automation_jobs_table.sql'
      });
    }

    // Apply patches and destructive tests columns migration
    try {
      const patchesMigrationPath = path.join(__dirname, 'migrations', '008_add_patches_and_destructs.sql');
      const patchesSql = await fs.readFile(patchesMigrationPath, 'utf8');
      await client.query(patchesSql);
      logger.debug('Patches and destructive tests columns migration applied');
    } catch (patchesErr) {
      logger.warn('Patches and destructive tests columns migration not applied', {
        error: { message: patchesErr.message },
        hint: 'If permissions restrict file reads, run the SQL manually in the DB. The migration file is at backend/db/migrations/008_add_patches_and_destructs.sql'
      });
    }

    client.release();
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Failed to apply database migrations', {
      error: {
        code: error.code,
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    // Don't throw error - allow server to continue without database
    logger.warn('Server will continue without completed migrations');
  }
}

module.exports = {
  db,
  supabase,
  createUserScopedSupabaseClient,
  connectToDatabase,
  applyMigrations,
  pool,
  queryWithRetry,
  getPoolHealth,
  resetPool,
  testDatabaseConnection
};
