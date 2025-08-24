#!/usr/bin/env node

/**
 * Check Panels Script
 * 
 * This script checks the current panel count and database status.
 * Usage: node scripts/check-panels.js [projectId]
 * 
 * If no projectId is provided, it will show stats for all projects.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkPanels(projectId = null) {
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    if (projectId) {
      console.log(`🔍 Checking panels for project: ${projectId}`);
      
      // Get panel count for specific project
      const result = await client.query(
        'SELECT panels FROM panel_layouts WHERE project_id = $1',
        [projectId]
      );
      
      if (result.rows.length === 0) {
        console.log(`⚠️  No panel_layouts found for project ${projectId}`);
        return;
      }
      
      const panels = result.rows[0].panels;
      const panelCount = Array.isArray(panels) ? panels.length : 0;
      
      console.log(`📊 Project ${projectId}:`);
      console.log(`   Panels: ${panelCount}`);
      console.log(`   Data type: ${typeof panels}`);
      
      if (panelCount > 0) {
        console.log(`   Sample panel:`, JSON.stringify(panels[0], null, 2));
      }
      
    } else {
      console.log('🔍 Checking panels for ALL projects...');
      
      // Get overall stats
      const result = await client.query(
        'SELECT project_id, panels FROM panel_layouts'
      );
      
      console.log(`📊 Total panel_layouts records: ${result.rows.length}`);
      
      let totalPanels = 0;
      const projectStats = [];
      
      for (const row of result.rows) {
        const panels = row.panels;
        const panelCount = Array.isArray(panels) ? panels.length : 0;
        totalPanels += panelCount;
        
        projectStats.push({
          projectId: row.project_id,
          panelCount,
          dataType: typeof panels
        });
      }
      
      console.log(`📊 Total panels across all projects: ${totalPanels}`);
      console.log(`📊 Projects with panels:`);
      
      projectStats.forEach(stat => {
        console.log(`   ${stat.projectId}: ${stat.panelCount} panels (${stat.dataType})`);
      });
      
      if (totalPanels > 0) {
        console.log(`\n🔍 Sample panel data:`);
        const firstRow = result.rows.find(row => Array.isArray(row.panels) && row.panels.length > 0);
        if (firstRow) {
          console.log(JSON.stringify(firstRow.panels[0], null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking panels:', error.message);
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
  console.log(`🎯 Target: Check panels for project ${projectId}`);
} else {
  console.log(`🎯 Target: Check panels for ALL projects`);
}

// Run the script
checkPanels(projectId);
