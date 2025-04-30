const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const schema = require('./schema');

// Use DATABASE_URL from environment variables
const connectionString = process.env.DATABASE_URL || 
  `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

// Create postgres client
const client = postgres(connectionString, { max: 10 });

// Create drizzle instance
const db = drizzle(client, { schema });

// Connect to database
async function connectToDatabase() {
  try {
    // Ping database to check connection
    await client`SELECT 1`;
    console.log('Connected to PostgreSQL database');
    
    // Apply any pending migrations
    await applyMigrations();
    
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

// Apply migrations
async function applyMigrations() {
  try {
    // In a production app, you'd use drizzle-kit for migrations
    // For simplicity, we're just checking if tables exist
    const tablesExist = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;
    
    if (!tablesExist[0].exists) {
      console.log('Tables not found, creating schema...');
      // You'd typically run migrations here with:
      // const { migrate } = require('drizzle-orm/postgres-js/migrator');
      // await migrate(db, { migrationsFolder: './migrations' });
      
      // For simplicity in this example, we're just logging
      console.log('Schema creation would happen here in a real app');
    } else {
      console.log('Database schema exists');
    }
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

module.exports = { db, connectToDatabase };
