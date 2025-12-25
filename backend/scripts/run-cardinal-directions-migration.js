const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Get database URL from environment
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

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
    console.log('🔧 Running migration: Add Cardinal Directions and Location Description...');
    console.log('📄 Migration file: 011_add_cardinal_directions.sql');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '011_add_cardinal_directions.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Created cardinal_direction enum type');
    console.log('✅ Added cardinal_direction column to projects table');
    console.log('✅ Added cardinal_direction column to panel_layouts table');
    console.log('✅ Added location_description column to asbuilt_records table');
    console.log('✅ Created indexes for performance');
    
    // Verify the columns were added
    const projectsResult = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      AND column_name = 'cardinal_direction'
    `);
    
    const panelLayoutsResult = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'panel_layouts' 
      AND column_name = 'cardinal_direction'
    `);
    
    const asbuiltResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'asbuilt_records' 
      AND column_name = 'location_description'
    `);
    
    console.log('\n📊 Verification:');
    if (projectsResult.rows.length > 0) {
      console.log(`  ✅ projects.cardinal_direction (${projectsResult.rows[0].udt_name})`);
    } else {
      console.log('  ❌ projects.cardinal_direction not found');
    }
    
    if (panelLayoutsResult.rows.length > 0) {
      console.log(`  ✅ panel_layouts.cardinal_direction (${panelLayoutsResult.rows[0].udt_name})`);
    } else {
      console.log('  ❌ panel_layouts.cardinal_direction not found');
    }
    
    if (asbuiltResult.rows.length > 0) {
      console.log(`  ✅ asbuilt_records.location_description (${asbuiltResult.rows[0].data_type})`);
    } else {
      console.log('  ❌ asbuilt_records.location_description not found');
    }
    
    // Verify enum type
    const enumResult = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname = 'cardinal_direction'
    `);
    
    if (enumResult.rows.length > 0) {
      console.log(`  ✅ cardinal_direction enum type exists`);
    } else {
      console.log('  ❌ cardinal_direction enum type not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
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
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });

