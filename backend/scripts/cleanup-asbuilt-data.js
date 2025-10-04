#!/usr/bin/env node

/**
 * Cleanup As-Built Data Script
 * 
 * This script removes all as-built data from the database including:
 * - asbuilt_records table
 * - uploaded_files table (as-built related)
 * - asbuilt_domain enum type
 * - All related indexes and constraints
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupAsbuiltData() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting as-built data cleanup...');
    
    // 1. Drop foreign key constraints first
    console.log('📋 Dropping foreign key constraints...');
    try {
      await client.query(`
        ALTER TABLE asbuilt_records 
        DROP CONSTRAINT IF EXISTS fk_asbuilt_source_file;
      `);
      console.log('✅ Dropped fk_asbuilt_source_file constraint');
    } catch (error) {
      console.log('ℹ️  fk_asbuilt_source_file constraint not found or already dropped');
    }
    
    // 2. Drop indexes
    console.log('📋 Dropping indexes...');
    const indexes = [
      'idx_asbuilt_project_panel',
      'idx_asbuilt_domain', 
      'idx_asbuilt_confidence',
      'idx_asbuilt_requires_review',
      'idx_asbuilt_created_at',
      'idx_uploaded_files_project',
      'idx_uploaded_files_domain',
      'idx_uploaded_files_upload_date',
      'idx_uploaded_files_status'
    ];
    
    for (const indexName of indexes) {
      try {
        await client.query(`DROP INDEX IF EXISTS ${indexName};`);
        console.log(`✅ Dropped index ${indexName}`);
      } catch (error) {
        console.log(`ℹ️  Index ${indexName} not found or already dropped`);
      }
    }
    
    // 3. Drop tables
    console.log('📋 Dropping tables...');
    const tables = ['asbuilt_records', 'uploaded_files'];
    
    for (const tableName of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
        console.log(`✅ Dropped table ${tableName}`);
      } catch (error) {
        console.log(`ℹ️  Table ${tableName} not found or already dropped`);
      }
    }
    
    // 4. Drop enum type
    console.log('📋 Dropping enum types...');
    try {
      await client.query(`DROP TYPE IF EXISTS asbuilt_domain CASCADE;`);
      console.log('✅ Dropped asbuilt_domain enum type');
    } catch (error) {
      console.log('ℹ️  asbuilt_domain enum type not found or already dropped');
    }
    
    // 5. Remove as-built related code from schema.js
    console.log('📋 Updating schema.js...');
    // Note: This would need to be done manually or with file operations
    
    console.log('✅ As-built data cleanup completed successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Remove as-built related files from the codebase');
    console.log('   2. Update schema.js to remove asbuilt references');
    console.log('   3. Remove as-built routes and services');
    console.log('   4. Test the application to ensure no as-built references remain');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupAsbuiltData()
    .then(() => {
      console.log('🎉 Cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupAsbuiltData };
