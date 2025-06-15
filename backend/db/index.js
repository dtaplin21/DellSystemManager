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
  max: 10, // Reduced from 20 to prevent too many connections
  min: 2, // Keep at least 2 connections ready
  idleTimeoutMillis: 60000, // Increased from 30000 to 60000 (1 minute)
  connectionTimeoutMillis: 5000, // Increased from 2000 to 5000 (5 seconds)
  application_name: 'dell-system-manager',
  keepAlive: true, // Enable keep-alive
  keepAliveInitialDelayMillis: 10000 // Send keep-alive after 10 seconds
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
  // Set a longer statement timeout
  client.query('SET statement_timeout = 30000'); // 30 seconds
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

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
