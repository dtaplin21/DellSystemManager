const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Parse connection string
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running migration: Add text_content column to documents table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'add_text_content_column.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added text_content column to documents table');
    console.log('✅ Added full-text search index for better performance');
    
    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name = 'text_content'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verification: text_content column exists in documents table');
    } else {
      console.log('❌ Verification failed: text_content column not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  }); 