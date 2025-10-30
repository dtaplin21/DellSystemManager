/**
 * List all projects and their panel counts
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : false
});

async function listProjects() {
  const client = await pool.connect();
  try {
    console.log('🔍 Listing all projects and panels...\n');
    
    // Get all projects
    const projectsQuery = `
      SELECT id, name, created_at 
      FROM projects 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    const projectsResult = await client.query(projectsQuery);
    console.log(`Found ${projectsResult.rows.length} projects:\n`);
    
    for (const project of projectsResult.rows) {
      console.log(`📋 Project: ${project.name}`);
      console.log(`   ID: ${project.id}`);
      
      // Get panel layout
      const panelQuery = `
        SELECT panels 
        FROM panel_layouts 
        WHERE project_id = $1
      `;
      
      const panelResult = await client.query(panelQuery, [project.id]);
      
      if (panelResult.rows.length > 0) {
        const panels = panelResult.rows[0].panels || [];
        console.log(`   Panels: ${panels.length}`);
        
        // Check for Panel 21
        const panel21 = panels.find(p => {
          const panelNum = (p.panelNumber || '').toString().trim().toUpperCase();
          const rollNum = (p.rollNumber || '').toString().trim().toUpperCase();
          return panelNum.includes('21') || rollNum.includes('21') || 
                 panelNum === '21' || rollNum === 'R21' || rollNum === '21';
        });
        
        if (panel21) {
          console.log(`   ✅ Panel 21 found! ID: ${panel21.id}`);
          console.log(`      panelNumber: ${panel21.panelNumber || 'null'}`);
          console.log(`      rollNumber: ${panel21.rollNumber || 'null'}`);
          
          // Check for asbuilt records
          const recordsQuery = `
            SELECT COUNT(*) as count, domain
            FROM asbuilt_records
            WHERE project_id = $1 AND panel_id = $2
            GROUP BY domain
          `;
          
          const recordsResult = await client.query(recordsQuery, [project.id, panel21.id]);
          if (recordsResult.rows.length > 0) {
            console.log(`   📊 Asbuilt records for Panel 21:`);
            recordsResult.rows.forEach(r => {
              console.log(`      ${r.domain}: ${r.count} records`);
            });
          } else {
            console.log(`   ⚠️  No asbuilt records for Panel 21`);
          }
        }
      } else {
        console.log(`   No panel layout found`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

listProjects().catch(console.error);

