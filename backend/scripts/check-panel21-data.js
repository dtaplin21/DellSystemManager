/**
 * Diagnostic script to check if Panel 21 data exists in the database
 * Checks:
 * 1. Panel 21's actual panelId in panel_layouts
 * 2. Asbuilt records for Panel 21
 * 3. Panel placement records specifically
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false
});

async function checkPanel21Data() {
  const client = await pool.connect();
  try {
    console.log('🔍 [DIAGNOSTIC] Checking Panel 21 data in database...\n');
    
    // Get project ID from command line or use default
    const projectId = process.argv[2] || process.env.DEFAULT_PROJECT_ID;
    
    if (!projectId) {
      console.error('❌ Please provide a project ID as argument or set DEFAULT_PROJECT_ID in .env');
      console.log('Usage: node check-panel21-data.js <projectId>');
      return;
    }
    
    console.log(`📋 Project ID: ${projectId}\n`);
    
    // Step 1: Find Panel 21 in panel_layouts
    console.log('Step 1: Finding Panel 21 in panel_layouts...');
    const panelQuery = `
      SELECT panels 
      FROM panel_layouts 
      WHERE project_id = $1
    `;
    
    const panelResult = await client.query(panelQuery, [projectId]);
    
    if (panelResult.rows.length === 0) {
      console.log('❌ No panel layout found for this project\n');
      return;
    }
    
    const panels = panelResult.rows[0].panels || [];
    console.log(`✅ Found ${panels.length} panels in layout\n`);
    
    // Find Panel 21 by panelNumber or rollNumber
    const panel21 = panels.find(p => {
      const panelNum = (p.panelNumber || '').toString().trim().toUpperCase();
      const rollNum = (p.rollNumber || '').toString().trim().toUpperCase();
      return panelNum.includes('21') || rollNum.includes('21') || 
             panelNum === '21' || rollNum === 'R21' || rollNum === '21';
    });
    
    if (!panel21) {
      console.log('❌ Panel 21 not found in layout');
      console.log('Available panels (first 10):');
      panels.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ID: ${p.id}`);
        console.log(`     panelNumber: ${p.panelNumber || 'null'}`);
        console.log(`     rollNumber: ${p.rollNumber || 'null'}`);
      });
      return;
    }
    
    console.log('✅ Found Panel 21:');
    console.log(`   ID: ${panel21.id}`);
    console.log(`   panelNumber: ${panel21.panelNumber || 'null'}`);
    console.log(`   rollNumber: ${panel21.rollNumber || 'null'}`);
    console.log(`   Position: (${panel21.x}, ${panel21.y})`);
    console.log(`   Size: ${panel21.width} x ${panel21.height}\n`);
    
    const panel21Id = panel21.id;
    
    // Step 2: Check for asbuilt records with this panelId
    console.log('Step 2: Checking asbuilt_records for Panel 21...');
    const recordsQuery = `
      SELECT 
        id,
        domain,
        panel_id,
        mapped_data->>'panelNumber' as mapped_panel_number,
        mapped_data->>'rollNumber' as mapped_roll_number,
        created_at
      FROM asbuilt_records
      WHERE project_id = $1 AND panel_id = $2
      ORDER BY created_at DESC
    `;
    
    const recordsResult = await client.query(recordsQuery, [projectId, panel21Id]);
    console.log(`✅ Found ${recordsResult.rows.length} records for Panel 21 (panelId: ${panel21Id})\n`);
    
    if (recordsResult.rows.length > 0) {
      console.log('Records breakdown by domain:');
      const byDomain = {};
      recordsResult.rows.forEach(r => {
        byDomain[r.domain] = (byDomain[r.domain] || 0) + 1;
      });
      Object.entries(byDomain).forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count} records`);
      });
      console.log('');
      
      // Show panel_placement records specifically
      const panelPlacementRecords = recordsResult.rows.filter(r => r.domain === 'panel_placement');
      if (panelPlacementRecords.length > 0) {
        console.log(`✅ Found ${panelPlacementRecords.length} panel_placement records:`);
        panelPlacementRecords.slice(0, 3).forEach((r, i) => {
          console.log(`  ${i + 1}. ID: ${r.id}`);
          console.log(`     Mapped Panel Number: ${r.mapped_panel_number || 'null'}`);
          console.log(`     Created: ${r.created_at}`);
        });
      } else {
        console.log('❌ No panel_placement records found for Panel 21');
      }
    } else {
      console.log('❌ No asbuilt records found for Panel 21\n');
      
      // Step 3: Check if records exist with wrong panel_id (maybe NULL or different ID)
      console.log('Step 3: Checking for records that might be for Panel 21 but have wrong panel_id...');
      const allRecordsQuery = `
        SELECT 
          id,
          domain,
          panel_id,
          mapped_data->>'panelNumber' as mapped_panel_number,
          mapped_data->>'rollNumber' as mapped_roll_number,
          created_at
        FROM asbuilt_records
        WHERE project_id = $1
        AND (
          mapped_data->>'panelNumber' ILIKE '%21%'
          OR mapped_data->>'rollNumber' ILIKE '%21%'
          OR mapped_data->>'panelNumber' = '21'
          OR mapped_data->>'panelNumber' = 'R21'
        )
        ORDER BY created_at DESC
        LIMIT 20
      `;
      
      const allRecordsResult = await client.query(allRecordsQuery, [projectId]);
      console.log(`Found ${allRecordsResult.rows.length} records that mention "21" in mapped_data:\n`);
      
      if (allRecordsResult.rows.length > 0) {
        console.log('These records might be for Panel 21 but have wrong panel_id:');
        allRecordsResult.rows.forEach((r, i) => {
          console.log(`  ${i + 1}. Domain: ${r.domain}`);
          console.log(`     panel_id: ${r.panel_id}`);
          console.log(`     Expected panel_id: ${panel21Id}`);
          console.log(`     Match: ${r.panel_id === panel21Id ? '✅ YES' : '❌ NO'}`);
          console.log(`     Mapped Panel Number: ${r.mapped_panel_number || 'null'}`);
          console.log(`     Mapped Roll Number: ${r.mapped_roll_number || 'null'}`);
          console.log('');
        });
      }
    }
    
    // Step 4: Check all panel_placement records for the project
    console.log('\nStep 4: Checking all panel_placement records for this project...');
    const allPlacementQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT panel_id) as unique_panels
      FROM asbuilt_records
      WHERE project_id = $1 AND domain = 'panel_placement'
    `;
    
    const placementResult = await client.query(allPlacementQuery, [projectId]);
    console.log(`Total panel_placement records: ${placementResult.rows[0].total}`);
    console.log(`Unique panels with placement records: ${placementResult.rows[0].unique_panels}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the diagnostic
checkPanel21Data().catch(console.error);

