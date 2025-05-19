const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const schema = require('./schema');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const db = drizzle(pool, { schema });

async function connectToDatabase() {
  try {
    await pool.connect();
    return db;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

async function applyMigrations() {
  try {
    // Create tables based on schema
    const queries = Object.values(schema)
      .filter(table => table.create) // Only get table definitions
      .map(table => table.create().run());
    
    await Promise.all(queries);
    console.log('Database schema created successfully');
  } catch (error) {
    console.error('Failed to create database schema:', error);
    throw error;
  }
}

module.exports = {
  db,
  connectToDatabase,
  applyMigrations
};
