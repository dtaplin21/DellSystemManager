const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const schema = require('./schema');
const config = require('../config/env');
const logger = require('../lib/logger');

// Parse connection string
const connectionString = config.databaseUrl;

// Initialize PostgreSQL pool for direct database access
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 3, // Reduced from 5 to prevent too many connections
  min: 0, // Start with 0 connections, create as needed
  idleTimeoutMillis: 60000, // Increased to 60 seconds
  connectionTimeoutMillis: 15000, // Increased to 15 seconds
  application_name: 'dell-system-manager',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Send keep-alive after 10 seconds
  maxUses: 1000, // Close and replace a connection after it has been used 1000 times
  allowExitOnIdle: true // Allow the pool to close idle connections
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
  client.query('SET statement_timeout = 30000'); // 30 seconds
});

// Add acquire handler
pool.on('acquire', () => {
  logger.debug('PostgreSQL client acquired from pool');
});

// Add remove handler
pool.on('remove', (client) => {
  logger.debug('PostgreSQL client removed from pool', {
    host: client?.connectionParameters?.host,
    database: client?.connectionParameters?.database
  });
});

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
  connectToDatabase,
  applyMigrations,
  pool
};
