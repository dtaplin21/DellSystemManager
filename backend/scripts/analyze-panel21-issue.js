/**
 * Comprehensive analysis of Panel 21 to identify why it's being skipped
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false
});

// Import the normalization function to test it
const AsbuiltImportAI = require('../services/asbuiltImportAI');

async function analyzePanel21() {
  const client = await pool.connect();
  try {
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    
    console.log('🔍 COMPREHENSIVE PANEL 21 ANALYSIS\n');
    console.log('='.repeat(60));
    
    // Step 1: Get all panels and their identifiers
    console.log('\n📋 STEP 1: Analyzing ALL panels in the layout...');
    const panelQuery = `
      SELECT panels 
      FROM panel_layouts 
      WHERE project_id = $1
    `;
    
    const panelResult = await client.query(panelQuery, [projectId]);
    const panels = panelResult.rows[0].panels || [];
    
    console.log(`Found ${panels.length} total panels\n`);
    
    // Group panels by their identifier patterns
    const panelsByPattern = {
      hasPanelNumber: [],
      hasRollNumber: [],
      hasBoth: [],
      hasNeither: [],
      panel21Variants: []
    };
    
    const asbuiltImportAI = new AsbuiltImportAI();
    
    panels.forEach((panel, index) => {
      const pn = panel.panelNumber || null;
      const rn = panel.rollNumber || null;
      
      // Find Panel 21 variants
      const pnStr = (pn || '').toString().toUpperCase();
      const rnStr = (rn || '').toString().toUpperCase();
      if (pnStr.includes('21') || rnStr.includes('21') || 
          pnStr === '21' || rnStr === 'R21' || rnStr === 'R021' || rnStr === '21') {
        panelsByPattern.panel21Variants.push({
          index,
          id: panel.id,
          panelNumber: pn,
          rollNumber: rn,
          normalizedPN: pn ? asbuiltImportAI.normalizePanelNumber(pn) : null,
          normalizedRN: rn ? asbuiltImportAI.normalizePanelNumber(rn) : null
        });
      }
      
      if (pn && rn) {
        panelsByPattern.hasBoth.push({ id: panel.id, panelNumber: pn, rollNumber: rn });
      } else if (pn) {
        panelsByPattern.hasPanelNumber.push({ id: panel.id, panelNumber: pn });
      } else if (rn) {
        panelsByPattern.hasRollNumber.push({ id: panel.id, rollNumber: rn });
      } else {
        panelsByPattern.hasNeither.push({ id: panel.id });
      }
    });
    
    console.log('Panel identifier patterns:');
    console.log(`  Panels with both panelNumber and rollNumber: ${panelsByPattern.hasBoth.length}`);
    console.log(`  Panels with only panelNumber: ${panelsByPattern.hasPanelNumber.length}`);
    console.log(`  Panels with only rollNumber: ${panelsByPattern.hasRollNumber.length}`);
    console.log(`  Panels with neither: ${panelsByPattern.hasNeither.length}`);
    
    console.log('\n🔍 Panel 21 variants found:');
    panelsByPattern.panel21Variants.forEach(p => {
      console.log(`  ID: ${p.id}`);
      console.log(`    panelNumber: ${p.panelNumber || 'null'}`);
      console.log(`    rollNumber: ${p.rollNumber || 'null'}`);
      console.log(`    Normalized PN: ${p.normalizedPN || 'null'}`);
      console.log(`    Normalized RN: ${p.normalizedRN || 'null'}`);
      console.log('');
    });
    
    // Step 2: Check all asbuilt records and see what panel identifiers they have
    console.log('\n📊 STEP 2: Analyzing asbuilt records...');
    const recordsQuery = `
      SELECT 
        id,
        panel_id,
        domain,
        mapped_data->>'panelNumber' as mapped_panel_number,
        mapped_data->>'rollNumber' as mapped_roll_number,
        mapped_data
      FROM asbuilt_records
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const recordsResult = await client.query(recordsQuery, [projectId]);
    console.log(`Found ${recordsResult.rows.length} recent records\n`);
    
    // Check which records mention "21"
    const recordsWith21 = recordsResult.rows.filter(r => {
      const pn = (r.mapped_panel_number || '').toString().toUpperCase();
      const rn = (r.mapped_roll_number || '').toString().toUpperCase();
      return pn.includes('21') || rn.includes('21') || pn === '21' || rn === 'R21' || rn === 'R021';
    });
    
    console.log(`Records mentioning "21": ${recordsWith21.length}`);
    recordsWith21.forEach((r, i) => {
      console.log(`  Record ${i + 1}:`);
      console.log(`    ID: ${r.id}`);
      console.log(`    panel_id: ${r.panel_id}`);
      console.log(`    Domain: ${r.domain}`);
      console.log(`    mapped panelNumber: ${r.mapped_panel_number || 'null'}`);
      console.log(`    mapped rollNumber: ${r.mapped_roll_number || 'null'}`);
      
      // Check if panel_id matches any Panel 21 variant
      const matches = panelsByPattern.panel21Variants.filter(p => p.id === r.panel_id);
      if (matches.length > 0) {
        console.log(`    ✅ Matches Panel 21 variant: ${matches[0].id}`);
      } else {
        console.log(`    ❌ panel_id does NOT match any Panel 21 variant`);
      }
      console.log('');
    });
    
    // Step 3: Test normalization with various inputs
    console.log('\n🧪 STEP 3: Testing normalization with different inputs...');
    const testInputs = ['21', 'R21', 'R021', 'P21', 'P021', 'Panel 21', 'panel 21', '21A'];
    
    testInputs.forEach(input => {
      const normalized = asbuiltImportAI.normalizePanelNumber(input);
      console.log(`  Input: "${input}" → Normalized: "${normalized || 'null'}"`);
    });
    
    // Step 4: Test findPanelId with various inputs
    console.log('\n🔍 STEP 4: Testing findPanelId() with various inputs...');
    for (const input of ['21', 'R21', 'R021', 'P21', 'P021']) {
      try {
        const panelId = await asbuiltImportAI.findPanelId(projectId, input);
        console.log(`  findPanelId("${input}") → ${panelId || 'NULL (NOT FOUND)'}`);
        if (panelId) {
          const foundPanel = panels.find(p => p.id === panelId);
          console.log(`    Found panel: panelNumber=${foundPanel?.panelNumber || 'null'}, rollNumber=${foundPanel?.rollNumber || 'null'}`);
        }
      } catch (error) {
        console.log(`  findPanelId("${input}") → ERROR: ${error.message}`);
      }
    }
    
    // Step 5: Compare Panel 21 to a working panel
    console.log('\n📊 STEP 5: Comparing Panel 21 to other panels...');
    
    // Find a panel that has records (working example)
    const panelsWithRecords = new Set(recordsResult.rows.map(r => r.panel_id).filter(Boolean));
    const workingPanel = panels.find(p => panelsWithRecords.has(p.id) && p.id !== panelsByPattern.panel21Variants[0]?.id);
    
    if (workingPanel && panelsByPattern.panel21Variants.length > 0) {
      const panel21 = panelsByPattern.panel21Variants[0];
      console.log('\nPanel 21:');
      console.log(`  ID: ${panel21.id}`);
      console.log(`  panelNumber: ${panel21.panelNumber || 'null'}`);
      console.log(`  rollNumber: ${panel21.rollNumber || 'null'}`);
      
      const panel21Records = recordsResult.rows.filter(r => r.panel_id === panel21.id);
      console.log(`  Records in database: ${panel21Records.length}`);
      
      console.log('\nWorking Panel (for comparison):');
      console.log(`  ID: ${workingPanel.id}`);
      console.log(`  panelNumber: ${workingPanel.panelNumber || 'null'}`);
      console.log(`  rollNumber: ${workingPanel.rollNumber || 'null'}`);
      
      const workingRecords = recordsResult.rows.filter(r => r.panel_id === workingPanel.id);
      console.log(`  Records in database: ${workingRecords.length}`);
      
      // Check what their mapped data looks like
      if (workingRecords.length > 0) {
        console.log('\nWorking panel record mapped data:');
        console.log(`  panelNumber: ${workingRecords[0].mapped_panel_number || 'null'}`);
        console.log(`  rollNumber: ${workingRecords[0].mapped_roll_number || 'null'}`);
      }
    }
    
    // Step 6: Check if there are records with NULL panel_id that mention "21"
    console.log('\n⚠️  STEP 6: Checking for orphaned records (NULL panel_id)...');
    const orphanQuery = `
      SELECT 
        id,
        domain,
        panel_id,
        mapped_data->>'panelNumber' as mapped_panel_number,
        mapped_data->>'rollNumber' as mapped_roll_number
      FROM asbuilt_records
      WHERE project_id = $1
      AND (
        panel_id IS NULL
        OR panel_id NOT IN (SELECT jsonb_array_elements(panels)->>'id' FROM panel_layouts WHERE project_id = $1)
      )
      AND (
        mapped_data->>'panelNumber' ILIKE '%21%'
        OR mapped_data->>'rollNumber' ILIKE '%21%'
      )
      LIMIT 10
    `;
    
    const orphanResult = await client.query(orphanQuery, [projectId]);
    if (orphanResult.rows.length > 0) {
      console.log(`Found ${orphanResult.rows.length} orphaned records for Panel 21:\n`);
      orphanResult.rows.forEach((r, i) => {
        console.log(`  Orphan ${i + 1}:`);
        console.log(`    ID: ${r.id}`);
        console.log(`    panel_id: ${r.panel_id || 'NULL'}`);
        console.log(`    mapped panelNumber: ${r.mapped_panel_number || 'null'}`);
        console.log(`    mapped rollNumber: ${r.mapped_roll_number || 'null'}`);
        console.log('');
      });
    } else {
      console.log('No orphaned records found');
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

analyzePanel21().catch(console.error);

