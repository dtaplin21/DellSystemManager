/**
 * Check the specific reason for panel ID mismatch
 * Compare what's in database vs what frontend logic would generate
 */

require('dotenv').config();
const { Pool } = require('pg');
const AsbuiltImportAI = require('../services/asbuiltImportAI');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false
});

async function checkMismatchReason() {
  const client = await pool.connect();
  try {
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    const screenshotPanelId = '9a6e0063-72b2-4257-892a-c3710dde3c1d';
    const dbPanel21Id = 'aa0d832e-f1b2-4a82-bab5-6bdc1a4f501b';
    
    console.log('🔍 INVESTIGATING PANEL ID MISMATCH\n');
    console.log('='.repeat(60));
    
    // Get all panels
    const panelQuery = `
      SELECT panels 
      FROM panel_layouts 
      WHERE project_id = $1
    `;
    
    const panelResult = await client.query(panelQuery, [projectId]);
    const panels = panelResult.rows[0].panels || [];
    
    // Find Panel 21 in database
    const panel21 = panels.find(p => {
      const pn = (p.panelNumber || '').toString().toUpperCase();
      const rn = (p.rollNumber || '').toString().toUpperCase();
      return pn.includes('21') || rn.includes('21') || pn === 'P021' || rn === 'R021';
    });
    
    console.log('\n📋 Database Panel 21:');
    console.log(`  ID: ${panel21.id}`);
    console.log(`  panelNumber: ${panel21.panelNumber}`);
    console.log(`  rollNumber: ${panel21.rollNumber}`);
    console.log(`  x: ${panel21.x}, y: ${panel21.y}`);
    console.log(`  width: ${panel21.width}, height: ${panel21.height}`);
    
    // Check if screenshot ID exists anywhere
    console.log('\n🔍 Checking if screenshot panel ID exists in database...');
    const screenshotPanel = panels.find(p => p.id === screenshotPanelId);
    
    if (screenshotPanel) {
      console.log(`  ✅ Found panel with screenshot ID!`);
      console.log(`     panelNumber: ${screenshotPanel.panelNumber || 'null'}`);
      console.log(`     rollNumber: ${screenshotPanel.rollNumber || 'null'}`);
      console.log(`     Position: (${screenshotPanel.x}, ${screenshotPanel.y})`);
      console.log(`     Size: ${screenshotPanel.width} x ${screenshotPanel.height}`);
      
      // Check if it's actually Panel 21 by identifier
      const isPanel21 = (screenshotPanel.panelNumber || '').includes('21') || 
                        (screenshotPanel.rollNumber || '').includes('21');
      console.log(`     Is this Panel 21? ${isPanel21 ? 'YES' : 'NO'}`);
      
      if (isPanel21) {
        console.log('\n  ⚠️  PROBLEM IDENTIFIED!');
        console.log('     There are TWO panels with Panel 21 identifiers but different UUIDs!');
        console.log(`     Database Panel 21 UUID: ${panel21.id}`);
        console.log(`     Screenshot Panel 21 UUID: ${screenshotPanel.id}`);
      }
    } else {
      console.log(`  ❌ Screenshot panel ID NOT found in database`);
    }
    
    // Simulate frontend ID generation
    console.log('\n🔄 Simulating Frontend ID Generation:');
    console.log('Based on usePanelData.ts line 165:');
    console.log('  panelId = backendPanel.id || rollNumber || panelNumber || generatedId');
    
    // Simulate what the API returns
    const backendPanel = {
      id: panel21.id,
      panel_number: panel21.panelNumber, // snake_case (from API transformation)
      roll_number: panel21.rollNumber,   // snake_case
      panelNumber: panel21.panelNumber,  // camelCase (direct from JSONB)
      rollNumber: panel21.rollNumber,    // camelCase
      x: panel21.x,
      y: panel21.y,
      width: panel21.width,
      height: panel21.height
    };
    
    console.log('\n  API Response (backendPanel):');
    console.log(`    id: ${backendPanel.id}`);
    console.log(`    panel_number: ${backendPanel.panel_number || 'undefined'}`);
    console.log(`    roll_number: ${backendPanel.roll_number || 'undefined'}`);
    console.log(`    panelNumber: ${backendPanel.panelNumber || 'undefined'}`);
    console.log(`    rollNumber: ${backendPanel.rollNumber || 'undefined'}`);
    
    // Frontend extraction logic (from usePanelData.ts line 161-162)
    const rollNumber = backendPanel.roll_number && backendPanel.roll_number !== '' 
      ? backendPanel.roll_number 
      : null;
    const panelNumber = backendPanel.panel_number && backendPanel.panel_number !== '' 
      ? backendPanel.panel_number 
      : null;
    
    console.log('\n  Frontend Extraction:');
    console.log(`    Extracted rollNumber: ${rollNumber || 'null'}`);
    console.log(`    Extracted panelNumber: ${panelNumber || 'null'}`);
    console.log(`    backendPanel.id exists: ${!!backendPanel.id}`);
    
    // Generate ID as frontend does
    const xFeet = Number(backendPanel.x || 0);
    const yFeet = Number(backendPanel.y || 0);
    const widthFeet = Number(backendPanel.width_feet || backendPanel.width || 100);
    const heightFeet = Number(backendPanel.height_feet || backendPanel.height || 100);
    const generatedId = `panel-${projectId}-${xFeet}-${yFeet}-${widthFeet}-${heightFeet}`;
    
    const frontendPanelId = backendPanel.id || rollNumber || panelNumber || generatedId;
    
    console.log('\n  Frontend ID Calculation Result:');
    console.log(`    Step 1: backendPanel.id = ${backendPanel.id || 'undefined'} → ${backendPanel.id ? 'USED' : 'SKIP'}`);
    console.log(`    Step 2: rollNumber = ${rollNumber || 'null'} → ${!backendPanel.id && rollNumber ? 'WOULD USE' : 'SKIP'}`);
    console.log(`    Step 3: panelNumber = ${panelNumber || 'null'} → ${!backendPanel.id && !rollNumber && panelNumber ? 'WOULD USE' : 'SKIP'}`);
    console.log(`    Step 4: generatedId = ${generatedId} → ${!backendPanel.id && !rollNumber && !panelNumber ? 'WOULD USE' : 'SKIP'}`);
    console.log(`    Final frontend panelId: ${frontendPanelId}`);
    console.log(`    Database panel id: ${panel21.id}`);
    console.log(`    Match: ${frontendPanelId === panel21.id ? '✅ YES' : '❌ NO - MISMATCH!'}`);
    
    // Check for duplicate panels with same position but different IDs
    console.log('\n🔍 Checking for duplicate panels with same position...');
    const panel21Position = `${panel21.x},${panel21.y},${panel21.width},${panel21.height}`;
    const panelsAtSamePosition = panels.filter(p => 
      `${p.x},${p.y},${p.width},${p.height}` === panel21Position &&
      p.id !== panel21.id
    );
    
    if (panelsAtSamePosition.length > 0) {
      console.log(`  ⚠️  Found ${panelsAtSamePosition.length} other panel(s) at the same position:`);
      panelsAtSamePosition.forEach(p => {
        console.log(`    ID: ${p.id}`);
        console.log(`    panelNumber: ${p.panelNumber || 'null'}`);
        console.log(`    rollNumber: ${p.rollNumber || 'null'}`);
      });
    } else {
      console.log('  ✅ No duplicate panels at same position');
    }
    
    // Check panel history - see if panel was updated/recreated
    console.log('\n📅 Checking panel layout update history...');
    const updateQuery = `
      SELECT last_updated
      FROM panel_layouts
      WHERE project_id = $1
    `;
    
    const updateResult = await client.query(updateQuery, [projectId]);
    if (updateResult.rows.length > 0) {
      console.log(`  Last updated: ${updateResult.rows[0].last_updated}`);
      console.log(`  Current time: ${new Date().toISOString()}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Analysis complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkMismatchReason().catch(console.error);

