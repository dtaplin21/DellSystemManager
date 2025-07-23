require('dotenv').config();
const { Pool } = require('pg');

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

async function checkDatabaseColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking documents table columns...');
    
    // Check what columns exist in the documents table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Documents table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });
    
    // Check if text_content column exists
    const textContentExists = result.rows.some(row => row.column_name === 'text_content');
    console.log(`\n✅ text_content column exists: ${textContentExists}`);
    
    // Check if path column exists
    const pathExists = result.rows.some(row => row.column_name === 'path');
    console.log(`✅ path column exists: ${pathExists}`);
    
    // Check if file_path column exists (should not exist)
    const filePathExists = result.rows.some(row => row.column_name === 'file_path');
    console.log(`❌ file_path column exists: ${filePathExists}`);
    
    if (!textContentExists) {
      console.log('\n⚠️ text_content column is missing! Running migration again...');
      
      // Run the migration again
      const migrationSQL = `
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS text_content TEXT;
      `;
      
      await client.query(migrationSQL);
      console.log('✅ Migration applied again');
    }
    
  } catch (error) {
    console.error('❌ Error checking database columns:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the check
checkDatabaseColumns()
  .then(() => {
    console.log('🎉 Database column check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Database column check failed:', error);
    process.exit(1);
  }); 