const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');
const schema = require('./schema');

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment variables');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
      sslmode: 'require'
    }
  });

  // Add connection handlers for debugging
  pool.on('connect', (client) => {
    console.log('New client connected to database for migrations');
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client during migration:', err);
  });

  const db = drizzle(pool, { schema });

  try {
    console.log('Running migrations...');
    
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        display_name TEXT,
        company TEXT,
        position TEXT,
        subscription VARCHAR(20) DEFAULT 'basic',
        profile_image_url TEXT,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active',
        client TEXT,
        location TEXT,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        area DECIMAL,
        progress INTEGER DEFAULT 0,
        subscription VARCHAR(20) DEFAULT 'basic',
        user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS panel_layouts (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id),
        panels TEXT NOT NULL,
        width DECIMAL NOT NULL,
        height DECIMAL NOT NULL,
        scale DECIMAL NOT NULL DEFAULT 1,
        last_updated TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        uploaded_at TIMESTAMP NOT NULL,
        uploaded_by VARCHAR(255) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS qc_data (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id),
        type VARCHAR(50) NOT NULL,
        panel_id VARCHAR(255) NOT NULL,
        date TIMESTAMP NOT NULL,
        result VARCHAR(50) NOT NULL,
        technician VARCHAR(255),
        temperature DECIMAL,
        pressure DECIMAL,
        speed DECIMAL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL,
        created_by UUID REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        related_to VARCHAR(50),
        related_id UUID,
        read BOOLEAN DEFAULT FALSE,
        date TIMESTAMP NOT NULL
      );
    `);

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().catch(console.error);
}

module.exports = { runMigrations }; 