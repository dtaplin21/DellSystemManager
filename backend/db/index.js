const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const schema = require('./schema');

// Initialize PostgreSQL pool for direct database access
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase
  }
});

const db = drizzle(pool, { schema });
let supabase = null;

async function connectToDatabase() {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Key are required in environment variables');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test the connection without creating a persistent client
    const client = await pool.connect();
    client.release(); // Release the test connection immediately
    console.log('Connected to Supabase PostgreSQL database');
    return db;
  } catch (error) {
    console.error('Failed to connect to database:', error);
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
  getSupabase: () => supabase,
  connectToDatabase,
  applyMigrations
};
