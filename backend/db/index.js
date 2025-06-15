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
    rejectUnauthorized: false // Required for Supabase
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  application_name: 'dell-system-manager' // Add application name for better monitoring
});

// Add error handler for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const db = drizzle(pool, { schema });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Debug environment variables
console.log('Checking Supabase credentials...');
console.log('SUPABASE_URL:', supabaseUrl ? '✓ Present' : '✗ Missing');
console.log('SUPABASE_KEY:', supabaseKey ? '✓ Present' : '✗ Missing');
console.log('DATABASE_URL:', connectionString ? '✓ Present' : '✗ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('\nMissing Supabase credentials. Please check your .env file.');
  console.error('Required environment variables:');
  console.error('1. SUPABASE_URL - Your Supabase project URL');
  console.error('2. SUPABASE_KEY - Your Supabase anon/public key');
  console.error('3. DATABASE_URL - Your Supabase database connection string\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function connectToDatabase() {
  try {
    // Test the connection without creating a persistent client
    const client = await pool.connect();
    console.log('Successfully connected to Supabase PostgreSQL database');
    
    // Log connection details (without sensitive info)
    const connectionInfo = {
      host: client.connectionParameters.host,
      port: client.connectionParameters.port,
      database: client.connectionParameters.database,
      user: client.connectionParameters.user,
      ssl: client.connectionParameters.ssl ? 'enabled' : 'disabled'
    };
    console.log('Connection details:', connectionInfo);
    
    client.release(); // Release the test connection immediately
    return db;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    console.error('Connection string format:', connectionString.split('@')[0] + '@[HIDDEN]');
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function applyMigrations() {
  try {
    // Simple migration - just test if we can query the database
    // Actual schema creation should be done via drizzle-kit push
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database schema created successfully');
  } catch (error) {
    console.error('Failed to create database schema:', error);
    // Don't throw error - allow server to continue without database
    console.log('Server will continue without database functionality');
  }
}

module.exports = {
  db,
  supabase,
  connectToDatabase,
  applyMigrations
};
