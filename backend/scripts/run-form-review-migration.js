const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Get database URL from config
const config = require('../config/env');
const connectionString = config.databaseUrl || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running migration: Add Form Review and Source Tracking Columns...');
    console.log('📄 Migration file: 006_add_form_review_columns.sql');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '006_add_form_review_columns.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added status, source, approved_by, approved_at, rejection_reason, review_notes columns');
    console.log('✅ Created form_status and form_source enum types');
    console.log('✅ Created indexes for performance');
    
    // Verify the columns were added
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'asbuilt_records' 
      AND column_name IN ('status', 'source', 'approved_by', 'approved_at', 'rejection_reason', 'review_notes')
      ORDER BY column_name
    `);
    
    console.log('\n📊 Verification: Columns added to asbuilt_records table:');
    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('  ❌ No columns found - migration may have failed');
    }
    
    // Verify enum types
    const enumResult = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('form_status', 'form_source')
      ORDER BY typname
    `);
    
    console.log('\n📊 Verification: Enum types created:');
    if (enumResult.rows.length > 0) {
      enumResult.rows.forEach(row => {
        console.log(`  ✅ ${row.typname}`);
      });
    } else {
      console.log('  ❌ No enum types found');
    }
    
    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'asbuilt_records' 
      AND indexname LIKE 'idx_asbuilt_%'
      ORDER BY indexname
    `);
    
    console.log('\n📊 Verification: Indexes created:');
    if (indexResult.rows.length > 0) {
      indexResult.rows.forEach(row => {
        console.log(`  ✅ ${row.indexname}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n🎉 Migration script completed successfully!');
    console.log('✅ You can now use the form review features in the web app.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });

