#!/usr/bin/env node

/**
 * Database Manager Script
 * 
 * This script provides an interactive menu for common database operations.
 * Usage: node scripts/db-manager.js
 */

const { Pool } = require('pg');
const readline = require('readline');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Question helper
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Database operations
async function checkPanels() {
  let client;
  
  try {
    console.log('\n🔍 Checking panel count...');
    client = await pool.connect();
    
    const result = await client.query('SELECT project_id, panels FROM panel_layouts');
    console.log(`📊 Total panel_layouts records: ${result.rows.length}`);
    
    let totalPanels = 0;
    for (const row of result.rows) {
      const panels = row.panels;
      const panelCount = Array.isArray(panels) ? panels.length : 0;
      totalPanels += panelCount;
      console.log(`   Project ${row.project_id}: ${panelCount} panels`);
    }
    
    console.log(`📊 Total panels across all projects: ${totalPanels}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
  }
}

async function clearAllPanels() {
  let client;
  
  try {
    console.log('\n🗑️  Clearing all panels...');
    client = await pool.connect();
    
    const result = await client.query('UPDATE panel_layouts SET panels = $1', ['[]']);
    console.log(`✅ Panels cleared successfully. Rows affected: ${result.rowCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
  }
}

async function clearProjectPanels(projectId) {
  let client;
  
  try {
    console.log(`\n🗑️  Clearing panels for project: ${projectId}`);
    client = await pool.connect();
    
    const result = await client.query(
      'UPDATE panel_layouts SET panels = $1 WHERE project_id = $2',
      ['[]', projectId]
    );
    
    console.log(`✅ Panels cleared for project ${projectId}. Rows affected: ${result.rowCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
  }
}

async function checkTableStructure() {
  let client;
  
  try {
    console.log('\n🔍 Checking table structure...');
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`📊 Tables found: ${result.rows.length}`);
    result.rows.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
  }
}

async function showMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('🗄️  DATABASE MANAGER');
  console.log('='.repeat(50));
  console.log('1. Check panel count');
  console.log('2. Clear all panels');
  console.log('3. Clear panels for specific project');
  console.log('4. Check table structure');
  console.log('5. Exit');
  console.log('='.repeat(50));
  
  const choice = await askQuestion('\nSelect an option (1-5): ');
  
  switch (choice) {
    case '1':
      await checkPanels();
      break;
    case '2':
      await clearAllPanels();
      break;
    case '3':
      const projectId = await askQuestion('Enter project ID: ');
      if (projectId.trim()) {
        await clearProjectPanels(projectId.trim());
      }
      break;
    case '4':
      await checkTableStructure();
      break;
    case '5':
      console.log('\n👋 Goodbye!');
      rl.close();
      await pool.end();
      process.exit(0);
      break;
    default:
      console.log('\n❌ Invalid option. Please try again.');
  }
  
  // Show menu again
  await showMenu();
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Database Manager...');
    console.log('🔌 Testing database connection...');
    
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
    
    await showMenu();
    
  } catch (error) {
    console.error('❌ Failed to start Database Manager:', error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  rl.close();
  await pool.end();
  process.exit(0);
});

// Start the application
main();
