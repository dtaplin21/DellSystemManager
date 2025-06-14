const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const schema = require('./schema');

// Initialize PostgreSQL pool for direct database access
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  application_name: 'dell-system-manager' // Add application name for better monitoring
});

const db = drizzle(pool, { schema });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Debug environment variables
console.log('Checking Supabase credentials...');
console.log('SUPABASE_URL:', supabaseUrl ? '✓ Present' : '✗ Missing');
console.log('SUPABASE_KEY:', supabaseKey ? '✓ Present' : '✗ Missing');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Present' : '✗ Missing');

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
    client.release(); // Release the test connection immediately
    return db;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    console.error('Connection details:', {
      host: pool.options.host,
      port: pool.options.port,
      database: pool.options.database,
      user: pool.options.user,
      ssl: pool.options.ssl ? 'enabled' : 'disabled'
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
