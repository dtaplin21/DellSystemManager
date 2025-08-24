#!/usr/bin/env node

/**
 * Fix Panels Column Script
 * 
 * This script migrates the panels column from TEXT to JSONB type
 * to match the schema definition.
 * 
 * WARNING: This is a destructive operation that will modify the table structure.
 * Make sure to backup your data before running this script.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixPanelsColumn() {
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check current column type
    console.log('\n🔍 Checking current column type...');
    const checkResult = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'panel_layouts' AND column_name = 'panels'
    `);
    
    if (checkResult.rows.length === 0) {
      console.error('❌ panels column not found in panel_layouts table');
      return;
    }
    
    const currentColumn = checkResult.rows[0];
    console.log(`📊 Current panels column:`);
    console.log(`   Type: ${currentColumn.data_type}`);
    console.log(`   Default: ${currentColumn.column_default || 'NULL'}`);
    console.log(`   Nullable: ${currentColumn.is_nullable}`);
    
    if (currentColumn.data_type === 'jsonb') {
      console.log('✅ Panels column is already JSONB type. No changes needed.');
      return;
    }
    
    // Backup current data
    console.log('\n💾 Backing up current data...');
    const backupResult = await client.query('SELECT * FROM panel_layouts');
    console.log(`📊 Backed up ${backupResult.rows.length} rows`);
    
    // Convert TEXT data to JSONB
    console.log('\n🔄 Converting TEXT data to JSONB...');
    for (const row of backupResult.rows) {
      let panelsData = [];
      
      try {
        if (row.panels && row.panels !== '[]') {
          // Try to parse existing TEXT data
          panelsData = JSON.parse(row.panels);
          console.log(`   Project ${row.project_id}: Converted ${panelsData.length} panels`);
        }
      } catch (parseError) {
        console.log(`   Project ${row.project_id}: Invalid JSON, setting to empty array`);
        panelsData = [];
      }
      
      // Update with JSONB data
      await client.query(
        'UPDATE panel_layouts SET panels = $1 WHERE id = $2',
        [JSON.stringify(panelsData), row.id]
      );
    }
    
    // Change column type to JSONB
    console.log('\n🔧 Changing column type to JSONB...');
    await client.query(`
      ALTER TABLE panel_layouts 
      ALTER COLUMN panels TYPE jsonb USING panels::jsonb
    `);
    
    // Set default value
    console.log('\n🔧 Setting default value...');
    await client.query(`
      ALTER TABLE panel_layouts 
      ALTER COLUMN panels SET DEFAULT '[]'::jsonb
    `);
    
    // Verify the change
    console.log('\n✅ Verifying changes...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'panel_layouts' AND column_name = 'panels'
    `);
    
    const newColumn = verifyResult.rows[0];
    console.log(`📊 New panels column:`);
    console.log(`   Type: ${newColumn.data_type}`);
    console.log(`   Default: ${newColumn.column_default}`);
    console.log(`   Nullable: ${newColumn.is_nullable}`);
    
    if (newColumn.data_type === 'jsonb') {
      console.log('\n🎉 SUCCESS: Panels column successfully migrated to JSONB!');
      console.log('✅ Your database now matches the schema definition');
      console.log('✅ Panels should now persist correctly');
    } else {
      console.error('\n❌ FAILED: Column type change was not successful');
    }
    
  } catch (error) {
    console.error('❌ Error fixing panels column:', error.message);
    console.error('🔍 Full error:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
      console.log('🔌 Database connection released');
    }
    await pool.end();
    console.log('🏁 Script completed');
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This script will modify the panel_layouts table structure');
console.log('📋 What it will do:');
console.log('   1. Backup current data');
console.log('   2. Convert TEXT data to JSONB');
console.log('   3. Change column type from TEXT to JSONB');
console.log('   4. Set default value to empty array');
console.log('');
console.log('🚨 This is a destructive operation. Make sure you have backups.');
console.log('');

// Run the migration
fixPanelsColumn();
