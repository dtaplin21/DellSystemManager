#!/usr/bin/env node

/**
 * Clear All Panels Script
 * 
 * This script clears all panels from the panel_layouts table.
 * Usage: node scripts/clear-panels.js [projectId]
 * 
 * If no projectId is provided, it will clear panels for all projects.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function clearPanels(projectId = null) {
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    if (projectId) {
      console.log(`🗑️  Clearing panels for project: ${projectId}`);
      
      const result = await client.query(
        'UPDATE panel_layouts SET panels = $1 WHERE project_id = $2',
        ['[]', projectId]
      );
      
      console.log(`✅ Panels cleared for project ${projectId}`);
      console.log(`📊 Rows affected: ${result.rowCount}`);
      
      if (result.rowCount === 0) {
        console.log(`⚠️  No panel_layouts found for project ${projectId}`);
      }
    } else {
      console.log('🗑️  Clearing panels for ALL projects...');
      
      const result = await client.query(
        'UPDATE panel_layouts SET panels = $1',
        ['[]']
      );
      
      console.log(`✅ Panels cleared for all projects`);
      console.log(`📊 Rows affected: ${result.rowCount}`);
      
      if (result.rowCount === 0) {
        console.log(`⚠️  No panel_layouts found in database`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error clearing panels:', error.message);
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
const projectId = args[0] || null;

if (projectId) {
  console.log(`🎯 Target: Clear panels for project ${projectId}`);
} else {
  console.log(`🎯 Target: Clear panels for ALL projects`);
}

// Run the script
clearPanels(projectId);
