const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const schema = require('./schema');

// Parse connection string
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// Initialize PostgreSQL pool for direct database access
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  max: 3, // Reduced from 5 to prevent too many connections
  min: 0, // Start with 0 connections, create as needed
  idleTimeoutMillis: 60000, // Increased to 60 seconds
  connectionTimeoutMillis: 15000, // Increased to 15 seconds
  application_name: 'dell-system-manager',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Send keep-alive after 10 seconds
  maxUses: 1000, // Close and replace a connection after it has been used 1000 times
  allowExitOnIdle: true, // Allow the pool to close idle connections
  // Add retry logic for connection failures
  retryDelay: 1000,
  maxRetries: 3
});

// Add error handler for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit the process, just log the error
  console.error('Error details:', {
    code: err.code,
    message: err.message,
    stack: err.stack
  });
});

// Add connection handler
pool.on('connect', (client) => {
  console.log('New client connected to database');
  // Set statement timeout to prevent long-running queries
  client.query('SET statement_timeout = 30000'); // 30 seconds
});

// Add acquire handler
pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

// Add remove handler
pool.on('remove', (client) => {
  console.log('Client removed from pool');
  // Log the reason if available
  if (client._ending) {
    console.log('Client was removed due to pool ending');
  }
});

const db = drizzle(pool, { schema });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// Debug environment variables
console.log('Checking Supabase credentials...');
console.log('SUPABASE_URL:', supabaseUrl ? '✓ Present' : '✗ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Present' : '✗ Missing');
console.log('SUPABASE_KEY (fallback):', process.env.SUPABASE_KEY ? '✓ Present' : '✗ Missing');
console.log('DATABASE_URL:', connectionString ? '✓ Present' : '✗ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('\nMissing Supabase credentials. Please check your .env file.');
  console.error('Required environment variables:');
  console.error('1. SUPABASE_URL - Your Supabase project URL');
  console.error('2. SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key (preferred)');
  console.error('3. SUPABASE_KEY - Your Supabase anon key (fallback)');
  console.error('4. DATABASE_URL - Your Supabase database connection string\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function connectToDatabase() {
  try {
    console.log('🔌 Attempting to connect to database...');
    console.log('🔌 Connection string preview:', connectionString.split('@')[0] + '@[HIDDEN]');
    
    // Test the connection without creating a persistent client
    const client = await pool.connect();
    console.log('✅ Successfully connected to Supabase PostgreSQL database');
    
    // Log connection details (without sensitive info)
    const connectionInfo = {
      host: client.connectionParameters.host,
      port: client.connectionParameters.port,
      database: client.connectionParameters.database,
      user: client.connectionParameters.user,
      ssl: client.connectionParameters.ssl ? 'enabled' : 'disabled'
    };
    console.log('🔌 Connection details:', connectionInfo);
    
    // Test a simple query
    const testResult = await client.query('SELECT NOW() as current_time, version() as db_version');
    console.log('✅ Database test query successful:', {
      currentTime: testResult.rows[0].current_time,
      version: testResult.rows[0].db_version.substring(0, 50) + '...'
    });
    
    client.release(); // Release the test connection immediately
    return db;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    console.error('❌ Connection string format:', connectionString.split('@')[0] + '@[HIDDEN]');
    console.error('❌ Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function applyMigrations() {
  try {
    console.log('🔧 Applying database migrations...');
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
    console.log('✅ panel_layouts table created/verified');
    
    // Create index if it doesn't exist
    const createIndex = `
      CREATE INDEX IF NOT EXISTS idx_panel_layouts_project_id 
      ON panel_layouts(project_id);
    `;
    
    await client.query(createIndex);
    console.log('✅ panel_layouts index created/verified');
    
    // Create asbuilt_records table if it doesn't exist
    const createAsbuiltTable = `
      CREATE TABLE IF NOT EXISTS asbuilt_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        panel_id UUID NOT NULL,
        domain VARCHAR(50) NOT NULL CHECK (domain IN ('panel_placement', 'panel_seaming', 'non_destructive', 'trial_weld', 'repairs', 'destructive')),
        source_doc_id UUID,
        raw_data JSONB NOT NULL,
        mapped_data JSONB NOT NULL,
        ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
        requires_review BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID
      );
    `;
    
    await client.query(createAsbuiltTable);
    console.log('✅ asbuilt_records table created/verified');
    
    // Create indexes for asbuilt_records
    const createAsbuiltIndexes = `
      CREATE INDEX IF NOT EXISTS idx_asbuilt_project_panel ON asbuilt_records(project_id, panel_id);
      CREATE INDEX IF NOT EXISTS idx_asbuilt_domain ON asbuilt_records(domain);
      CREATE INDEX IF NOT EXISTS idx_asbuilt_created_at ON asbuilt_records(created_at);
    `;
    
    await client.query(createAsbuiltIndexes);
    console.log('✅ asbuilt_records indexes created/verified');
    
    client.release();
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Failed to apply database migrations:', error);
    console.error('❌ Migration error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    // Don't throw error - allow server to continue without database
    console.log('⚠️ Server will continue without database functionality');
  }
}

module.exports = {
  db,
  supabase,
  connectToDatabase,
  applyMigrations,
  pool
};
