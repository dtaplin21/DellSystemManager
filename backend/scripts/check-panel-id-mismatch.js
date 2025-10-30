/**
 * Check if a specific panel ID exists and has records
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false
});

async function checkPanelId() {
  const client = await pool.connect();
  try {
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    const panelIdFromScreenshot = '9a6e0063-72b2-4257-892a-c3710dde3c1d';
    const panelIdFromDb = 'aa0d832e-f1b2-4a82-bab5-6bdc1a4f501b';
    
    console.log('🔍 Checking panel ID mismatch...\n');
    console.log(`Panel ID from screenshot: ${panelIdFromScreenshot}`);
    console.log(`Panel ID from database: ${panelIdFromDb}\n`);
    
    // Check if screenshot panel ID exists in panel_layouts
    const panelQuery = `
      SELECT panels 
      FROM panel_layouts 
      WHERE project_id = $1
    `;
    
    const panelResult = await client.query(panelQuery, [projectId]);
    const panels = panelResult.rows[0].panels || [];
    
    const screenshotPanel = panels.find(p => p.id === panelIdFromScreenshot);
    const dbPanel = panels.find(p => p.id === panelIdFromDb);
    
    if (screenshotPanel) {
      console.log('✅ Found panel with screenshot ID:');
      console.log(`   panelNumber: ${screenshotPanel.panelNumber || 'null'}`);
      console.log(`   rollNumber: ${screenshotPanel.rollNumber || 'null'}`);
    } else {
      console.log('❌ Panel with screenshot ID NOT found in layout');
    }
    
    if (dbPanel) {
      console.log('\n✅ Found panel with database ID:');
      console.log(`   panelNumber: ${dbPanel.panelNumber || 'null'}`);
      console.log(`   rollNumber: ${dbPanel.rollNumber || 'null'}`);
    }
    
    // Check records for screenshot panel ID
    console.log('\n📊 Checking asbuilt records...');
    const recordsQuery1 = `
      SELECT COUNT(*) as count, domain
      FROM asbuilt_records
      WHERE project_id = $1 AND panel_id = $2
      GROUP BY domain
    `;
    
    const records1 = await client.query(recordsQuery1, [projectId, panelIdFromScreenshot]);
    console.log(`Records for screenshot panel ID: ${records1.rows.length} domains`);
    records1.rows.forEach(r => {
      console.log(`  ${r.domain}: ${r.count} records`);
    });
    
    const records2 = await client.query(recordsQuery1, [projectId, panelIdFromDb]);
    console.log(`\nRecords for database panel ID: ${records2.rows.length} domains`);
    records2.rows.forEach(r => {
      console.log(`  ${r.domain}: ${r.count} records`);
    });
    
    // Check all panels with "21" in panelNumber or rollNumber
    console.log('\n🔍 All panels with "21" in panelNumber or rollNumber:');
    const allPanels21 = panels.filter(p => {
      const pn = (p.panelNumber || '').toString();
      const rn = (p.rollNumber || '').toString();
      return pn.includes('21') || rn.includes('21');
    });
    
    allPanels21.forEach(p => {
      console.log(`  ID: ${p.id}`);
      console.log(`     panelNumber: ${p.panelNumber || 'null'}`);
      console.log(`     rollNumber: ${p.rollNumber || 'null'}`);
      
      const recQuery = `SELECT COUNT(*) as count FROM asbuilt_records WHERE project_id = $1 AND panel_id = $2`;
      client.query(recQuery, [projectId, p.id]).then(result => {
        console.log(`     Records: ${result.rows[0].count}`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPanelId().catch(console.error);

