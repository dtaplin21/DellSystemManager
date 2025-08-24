#!/usr/bin/env node

/**
 * Check Table Structure Script
 * 
 * This script checks the structure of database tables.
 * Usage: node scripts/check-table-structure.js [tableName]
 * 
 * If no tableName is provided, it will show all tables.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTableStructure(tableName = null) {
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    if (tableName) {
      console.log(`🔍 Checking structure for table: ${tableName}`);
      
      // Get column information for specific table
      const result = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      if (result.rows.length === 0) {
        console.log(`⚠️  Table '${tableName}' not found`);
        return;
      }
      
      console.log(`📊 Table: ${tableName}`);
      console.log(`📊 Columns: ${result.rows.length}`);
      console.log('\n📋 Column Details:');
      
      result.rows.forEach((column, index) => {
        console.log(`   ${index + 1}. ${column.column_name}`);
        console.log(`      Type: ${column.data_type}`);
        console.log(`      Nullable: ${column.is_nullable}`);
        console.log(`      Default: ${column.column_default || 'NULL'}`);
        if (column.character_maximum_length) {
          console.log(`      Max Length: ${column.character_maximum_length}`);
        }
        console.log('');
      });
      
    } else {
      console.log('🔍 Checking all tables...');
      
      // Get list of all tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      console.log(`📊 Total tables: ${tablesResult.rows.length}`);
      console.log('\n📋 Tables found:');
      
      for (const table of tablesResult.rows) {
        const tableName = table.table_name;
        console.log(`\n🔍 Table: ${tableName}`);
        
        // Get column count for each table
        const columnsResult = await client.query(`
          SELECT COUNT(*) as column_count
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
        
        const columnCount = columnsResult.rows[0].column_count;
        console.log(`   Columns: ${columnCount}`);
        
        // Show first few columns as preview
        if (columnCount > 0) {
          const previewResult = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position
            LIMIT 3
          `, [tableName]);
          
          console.log(`   Preview: ${previewResult.rows.map(c => `${c.column_name}(${c.data_type})`).join(', ')}`);
          if (columnCount > 3) {
            console.log(`   ... and ${columnCount - 3} more columns`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error.message);
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

// Get command line arguments
const args = process.argv.slice(2);
const tableName = args[0] || null;

if (tableName) {
  console.log(`🎯 Target: Check structure for table ${tableName}`);
} else {
  console.log(`🎯 Target: Check structure for ALL tables`);
}

// Run the script
checkTableStructure(tableName);
