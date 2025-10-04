#!/usr/bin/env node

/**
 * Cleanup script to remove invalid as-built records
 * Removes records with incorrect field mappings, header rows, and material descriptions
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanupBadRecords() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 CLEANING UP BAD RECORDS');
    console.log('==========================');
    
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    
    // Get current record count
    const beforeCount = await client.query(
      'SELECT COUNT(*) FROM asbuilt_records WHERE project_id = $1',
      [projectId]
    );
    console.log(`📊 Records before cleanup: ${beforeCount.rows[0].count}`);
    
    // 1. Remove records with material descriptions in panelNumber
    console.log('\\n🗑️  Removing records with material descriptions...');
    const materialResult = await client.query(`
      DELETE FROM asbuilt_records 
      WHERE project_id = $1 
      AND (mapped_data->>'panelNumber' LIKE '%geomembrane%' 
           OR mapped_data->>'panelNumber' LIKE '%mil black%'
           OR mapped_data->>'panelNumber' LIKE '%Date%'
           OR mapped_data->>'panelNumber' LIKE '%Width%'
           OR mapped_data->>'panelNumber' LIKE '%Length%')
    `, [projectId]);
    console.log(`   Removed ${materialResult.rowCount} material description records`);
    
    // 2. Remove records with header values in panelNumber
    console.log('\\n🗑️  Removing records with header values...');
    const headerResult = await client.query(`
      DELETE FROM asbuilt_records 
      WHERE project_id = $1 
      AND (mapped_data->>'panelNumber' = 'Date'
           OR mapped_data->>'panelNumber' = 'Panel #'
           OR mapped_data->>'panelNumber' = 'Length'
           OR mapped_data->>'panelNumber' = 'Width'
           OR mapped_data->>'panelNumber' = 'Roll Number'
           OR mapped_data->>'panelNumber' = 'Panel Location / Comment')
    `, [projectId]);
    console.log(`   Removed ${headerResult.rowCount} header records`);
    
    // 3. Remove records with roll numbers as panel numbers (the main issue)
    console.log('\\n🗑️  Removing records with roll numbers as panel numbers...');
    const rollNumberResult = await client.query(`
      DELETE FROM asbuilt_records 
      WHERE project_id = $1 
      AND mapped_data->>'panelNumber' ~ '^[0-9]{4}$'
      AND mapped_data->>'panelNumber' NOT IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10')
    `, [projectId]);
    console.log(`   Removed ${rollNumberResult.rowCount} roll number records`);
    
    // 4. Remove duplicate records (keep only the most recent)
    console.log('\\n🗑️  Removing duplicate records...');
    const duplicateResult = await client.query(`
      DELETE FROM asbuilt_records 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, 
                 ROW_NUMBER() OVER (
                   PARTITION BY project_id, panel_id, domain, 
                   mapped_data->>'panelNumber', mapped_data->>'dateTime'
                   ORDER BY created_at DESC
                 ) as rn
          FROM asbuilt_records 
          WHERE project_id = $1
        ) t 
        WHERE rn > 1
      )
    `, [projectId]);
    console.log(`   Removed ${duplicateResult.rowCount} duplicate records`);
    
    // Get final record count
    const afterCount = await client.query(
      'SELECT COUNT(*) FROM asbuilt_records WHERE project_id = $1',
      [projectId]
    );
    console.log(`\\n📊 Records after cleanup: ${afterCount.rows[0].count}`);
    console.log(`📊 Total records removed: ${beforeCount.rows[0].count - afterCount.rows[0].count}`);
    
    // Show remaining records
    console.log('\\n📋 REMAINING RECORDS:');
    const remainingRecords = await client.query(`
      SELECT id, panel_id, domain, 
             mapped_data->>'panelNumber' as panel_number,
             mapped_data->>'dateTime' as date_time,
             created_at
      FROM asbuilt_records 
      WHERE project_id = $1 
      ORDER BY created_at DESC
    `, [projectId]);
    
    remainingRecords.rows.forEach((record, index) => {
      console.log(`${index + 1}. Panel: ${record.panel_number}, Domain: ${record.domain}, Date: ${record.date_time}`);
    });
    
    console.log('\\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupBadRecords();
