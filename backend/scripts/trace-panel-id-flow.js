/**
 * Trace the panel ID flow from database to frontend
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false
});

async function tracePanelIdFlow() {
  const client = await pool.connect();
  try {
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    
    console.log('🔍 TRACING PANEL ID FLOW\n');
    console.log('='.repeat(60));
    
    // Step 1: Check what's actually in the database
    console.log('\n📋 STEP 1: Database Panel 21 Structure');
    const dbQuery = `
      SELECT panels 
      FROM panel_layouts 
      WHERE project_id = $1
    `;
    
    const dbResult = await client.query(dbQuery, [projectId]);
    const panels = dbResult.rows[0].panels || [];
    
    const panel21 = panels.find(p => {
      const pn = (p.panelNumber || '').toString().toUpperCase();
      const rn = (p.rollNumber || '').toString().toUpperCase();
      return pn.includes('21') || rn.includes('21') || pn === 'P021' || rn === 'R021';
    });
    
    if (panel21) {
      console.log('Panel 21 in database:');
      console.log(JSON.stringify({
        id: panel21.id,
        panelNumber: panel21.panelNumber,
        rollNumber: panel21.rollNumber,
        x: panel21.x,
        y: panel21.y,
        width: panel21.width,
        height: panel21.height
      }, null, 2));
      
      // Check what the API would return
      console.log('\n📡 STEP 2: What GET /api/panels/layout/:projectId Returns');
      console.log('Simulating API response structure...');
      
      // The API returns panels as-is from database, but let's check field names
      console.log('\nPanel fields check:');
      console.log(`  Has 'id': ${'id' in panel21}`);
      console.log(`  Has 'panelNumber': ${'panelNumber' in panel21}`);
      console.log(`  Has 'rollNumber': ${'rollNumber' in panel21}`);
      console.log(`  Has 'panel_number': ${'panel_number' in panel21}`);
      console.log(`  Has 'roll_number': ${'roll_number' in panel21}`);
      
      // Step 3: Simulate the frontend mapping logic
      console.log('\n🔄 STEP 3: Simulating Frontend ID Generation Logic');
      console.log('Based on usePanelData.ts line 165:');
      console.log('  panelId = backendPanel.id || rollNumber || panelNumber || generatedId');
      
      const backendPanel = panel21; // What comes from API
      const rollNumber = backendPanel.roll_number && backendPanel.roll_number !== '' ? backendPanel.roll_number : null;
      const panelNumber = backendPanel.panel_number && backendPanel.panel_number !== '' ? backendPanel.panel_number : null;
      
      console.log('\nField extraction:');
      console.log(`  backendPanel.id: ${backendPanel.id}`);
      console.log(`  backendPanel.roll_number: ${backendPanel.roll_number || 'undefined'}`);
      console.log(`  backendPanel.panel_number: ${backendPanel.panel_number || 'undefined'}`);
      console.log(`  backendPanel.rollNumber: ${backendPanel.rollNumber || 'undefined'}`);
      console.log(`  backendPanel.panelNumber: ${backendPanel.panelNumber || 'undefined'}`);
      console.log(`  Extracted rollNumber: ${rollNumber || 'null'}`);
      console.log(`  Extracted panelNumber: ${panelNumber || 'null'}`);
      
      // Generate ID as frontend does
      const xFeet = Number(backendPanel.x || 0);
      const yFeet = Number(backendPanel.y || 0);
      const widthFeet = Number(backendPanel.width_feet || backendPanel.width || 100);
      const heightFeet = Number(backendPanel.height_feet || backendPanel.height || 100);
      const generatedId = `panel-${projectId}-${xFeet}-${yFeet}-${widthFeet}-${heightFeet}`;
      
      const frontendPanelId = backendPanel.id || rollNumber || panelNumber || generatedId;
      
      console.log('\nFrontend ID calculation:');
      console.log(`  generatedId: ${generatedId}`);
      console.log(`  Final frontend panelId: ${frontendPanelId}`);
      console.log(`  Database panel id: ${panel21.id}`);
      console.log(`  Match: ${frontendPanelId === panel21.id ? '✅ YES' : '❌ NO - MISMATCH!'}`);
      
      if (frontendPanelId !== panel21.id) {
        console.log('\n⚠️  ID MISMATCH DETECTED!');
        console.log('\nWhy the mismatch:');
        if (!backendPanel.id) {
          console.log('  ❌ backendPanel.id is missing/undefined');
        }
        if (rollNumber && rollNumber !== panel21.id) {
          console.log(`  ⚠️  Falling back to rollNumber: ${rollNumber}`);
        }
        if (panelNumber && panelNumber !== panel21.id && rollNumber !== panel21.id) {
          console.log(`  ⚠️  Falling back to panelNumber: ${panelNumber}`);
        }
        if (generatedId !== panel21.id) {
          console.log(`  ⚠️  Using generatedId: ${generatedId}`);
        }
      }
    }
    
    // Step 4: Check panel field naming conventions
    console.log('\n📝 STEP 4: Field Naming Convention Analysis');
    console.log('Checking if database uses snake_case vs camelCase...');
    
    const samplePanels = panels.slice(0, 5);
    samplePanels.forEach((p, i) => {
      console.log(`\nPanel ${i + 1}:`);
      console.log('  Fields with "id":', Object.keys(p).filter(k => k.includes('id')));
      console.log('  Fields with "panel":', Object.keys(p).filter(k => k.includes('panel')));
      console.log('  Fields with "roll":', Object.keys(p).filter(k => k.includes('roll')));
      console.log('  All fields:', Object.keys(p).join(', '));
    });
    
    // Step 5: Check if panels are being saved correctly
    console.log('\n💾 STEP 5: Checking Panel Save/Update Logic');
    console.log('Looking for panel update endpoints...');
    
    const updateQuery = `
      SELECT 
        last_updated,
        (SELECT COUNT(*) FROM jsonb_array_elements(panels) AS p) as panel_count
      FROM panel_layouts
      WHERE project_id = $1
    `;
    
    const updateResult = await client.query(updateQuery, [projectId]);
    if (updateResult.rows.length > 0) {
      console.log('Last updated:', updateResult.rows[0].last_updated);
      console.log('Panel count:', updateResult.rows[0].panel_count);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Trace complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

tracePanelIdFlow().catch(console.error);

