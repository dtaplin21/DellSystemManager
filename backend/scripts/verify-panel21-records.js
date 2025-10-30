/**
 * Verify Panel 21 records and check exact data
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false
});

async function verifyRecords() {
  const client = await pool.connect();
  try {
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59'; // western placer
    const panelId = 'aa0d832e-f1b2-4a82-bab5-6bdc1a4f501b'; // Panel 21
    
    console.log('🔍 Verifying Panel 21 records...\n');
    console.log(`Project ID: ${projectId}`);
    console.log(`Panel ID: ${panelId}\n`);
    
    // Get the actual panel details
    const panelQuery = `
      SELECT panels 
      FROM panel_layouts 
      WHERE project_id = $1
    `;
    
    const panelResult = await client.query(panelQuery, [projectId]);
    const panels = panelResult.rows[0].panels || [];
    const panel21 = panels.find(p => p.id === panelId);
    
    if (panel21) {
      console.log('✅ Panel 21 details:');
      console.log(JSON.stringify(panel21, null, 2));
      console.log('');
    }
    
    // Get all records for this panel
    const recordsQuery = `
      SELECT 
        id,
        domain,
        panel_id,
        mapped_data,
        raw_data,
        created_at
      FROM asbuilt_records
      WHERE project_id = $1 AND panel_id = $2
      ORDER BY created_at DESC
    `;
    
    const recordsResult = await client.query(recordsQuery, [projectId, panelId]);
    console.log(`📊 Found ${recordsResult.rows.length} total records\n`);
    
    recordsResult.rows.forEach((r, i) => {
      console.log(`Record ${i + 1}:`);
      console.log(`  ID: ${r.id}`);
      console.log(`  Domain: ${r.domain}`);
      console.log(`  Panel ID: ${r.panel_id}`);
      console.log(`  Mapped Data:`, JSON.stringify(r.mapped_data, null, 2));
      console.log(`  Created: ${r.created_at}`);
      console.log('');
    });
    
    // Also check if there are any records with null panel_id that might be for Panel 21
    const orphanQuery = `
      SELECT 
        id,
        domain,
        panel_id,
        mapped_data->>'panelNumber' as mapped_panel_number,
        mapped_data->>'rollNumber' as mapped_roll_number
      FROM asbuilt_records
      WHERE project_id = $1
      AND (panel_id IS NULL OR panel_id != $2)
      AND (
        mapped_data->>'panelNumber' ILIKE '%21%'
        OR mapped_data->>'rollNumber' ILIKE '%21%'
      )
      LIMIT 10
    `;
    
    const orphanResult = await client.query(orphanQuery, [projectId, panelId]);
    if (orphanResult.rows.length > 0) {
      console.log(`⚠️  Found ${orphanResult.rows.length} records with "21" that have wrong or null panel_id:`);
      orphanResult.rows.forEach(r => {
        console.log(`  - Domain: ${r.domain}, panel_id: ${r.panel_id || 'NULL'}, mapped: ${r.mapped_panel_number || r.mapped_roll_number}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyRecords().catch(console.error);

