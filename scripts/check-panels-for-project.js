const { Client } = require('pg');

// Use the Supabase connection string from backend .env
const connectionString = 'postgresql://postgres.chfdozvsvltdmglcuoqf:Qualitydata790@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

const PROJECT_ID = '69fc302b-166d-4543-9990-89c4b1e0ed59'; // The project from your console logs

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('🔍 Connected to database');
    
    // 1. Check if the project exists
    console.log('\n🔍 Checking if project exists...');
    const projectRes = await client.query(
      'SELECT id, name, user_id FROM projects WHERE id = $1',
      [PROJECT_ID]
    );
    
    if (projectRes.rows.length === 0) {
      console.log('❌ Project not found in database');
      return;
    }
    
    const project = projectRes.rows[0];
    console.log('✅ Project found:', {
      id: project.id,
      name: project.name,
      userId: project.user_id
    });
    
    // 2. Check if panel_layouts table exists
    console.log('\n🔍 Checking panel_layouts table...');
    const tableRes = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'panel_layouts'
      ORDER BY ordinal_position
    `);
    
    if (tableRes.rows.length === 0) {
      console.log('❌ panel_layouts table not found');
      return;
    }
    
    console.log('✅ panel_layouts table structure:');
    tableRes.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 3. Check if there's a panel layout for this project
    console.log('\n🔍 Checking for panel layout...');
    const layoutRes = await client.query(
      'SELECT id, project_id, panels, width, height, scale, last_updated FROM panel_layouts WHERE project_id = $1',
      [PROJECT_ID]
    );
    
    if (layoutRes.rows.length === 0) {
      console.log('❌ No panel layout found for this project');
      console.log('💡 This explains why panels array is empty!');
      return;
    }
    
    const layout = layoutRes.rows[0];
    console.log('✅ Panel layout found:', {
      id: layout.id,
      projectId: layout.project_id,
      panelsType: typeof layout.panels,
      panelsLength: layout.panels ? layout.panels.length : 'N/A',
      width: layout.width,
      height: layout.height,
      scale: layout.scale,
      lastUpdated: layout.last_updated
    });
    
    // 4. Parse and examine the panels data
    console.log('\n🔍 Examining panels data...');
    console.log('🔍 Raw panels value:', layout.panels);
    console.log('🔍 Raw panels length:', layout.panels ? layout.panels.length : 'N/A');
    console.log('🔍 Raw panels type:', typeof layout.panels);
    
    let panels = [];
    try {
      if (typeof layout.panels === 'string') {
        console.log('🔍 Attempting to parse panels JSON string...');
        panels = JSON.parse(layout.panels);
        console.log('✅ Successfully parsed panels JSON string');
        console.log('🔍 Parsed result:', panels);
        console.log('🔍 Parsed result type:', typeof panels);
        console.log('🔍 Is array?', Array.isArray(panels));
      } else if (Array.isArray(layout.panels)) {
        panels = layout.panels;
        console.log('✅ Panels already an array');
      } else {
        console.log('⚠️ Unexpected panels format:', typeof layout.panels);
        return;
      }
      
      console.log(`📊 Panels count: ${panels.length}`);
      
      if (panels.length > 0) {
        console.log('📋 First few panels:');
        panels.slice(0, 3).forEach((panel, idx) => {
          console.log(`  Panel ${idx + 1}:`, {
            id: panel.id,
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            shape: panel.shape
          });
        });
      } else {
        console.log('📋 No panels in the array');
        console.log('🔍 This explains why the frontend shows no panels!');
      }
      
    } catch (parseError) {
      console.error('❌ Error parsing panels:', parseError);
      console.log('🔍 Raw panels value:', layout.panels);
      console.log('🔍 Raw panels value (hex):', Buffer.from(layout.panels || '', 'utf8').toString('hex'));
    }
    
    // 5. Check if there are any panels in the old 'panels' table
    console.log('\n🔍 Checking old panels table...');
    try {
      const oldPanelsRes = await client.query(
        'SELECT COUNT(*) as count FROM panels WHERE project_id = $1',
        [PROJECT_ID]
      );
      
      if (oldPanelsRes.rows[0].count > 0) {
        console.log(`⚠️ Found ${oldPanelsRes.rows[0].count} panels in old 'panels' table`);
        console.log('💡 These might need to be migrated to panel_layouts');
      } else {
        console.log('✅ No panels in old panels table');
      }
    } catch (error) {
      console.log('✅ Old panels table does not exist (expected)');
    }
    
    // 6. Check ALL panel layouts in the database
    console.log('\n🔍 Checking ALL panel layouts in database...');
    const allLayoutsRes = await client.query(
      'SELECT project_id, panels, last_updated FROM panel_layouts ORDER BY last_updated DESC LIMIT 10'
    );
    
    console.log(`📊 Found ${allLayoutsRes.rows.length} total panel layouts in database`);
    
    if (allLayoutsRes.rows.length > 0) {
      console.log('📋 Recent panel layouts:');
      allLayoutsRes.rows.forEach((layout, idx) => {
        let panelCount = 0;
        try {
          if (layout.panels && typeof layout.panels === 'string') {
            const parsed = JSON.parse(layout.panels);
            panelCount = Array.isArray(parsed) ? parsed.length : 0;
          }
        } catch (e) {
          panelCount = 'parse error';
        }
        
        console.log(`  Layout ${idx + 1}: Project ${layout.project_id.substring(0, 8)}... - ${panelCount} panels - Updated: ${layout.last_updated}`);
      });
    }
    
    // 7. Check if there are any non-empty panel layouts
    console.log('\n🔍 Checking for non-empty panel layouts...');
    const nonEmptyLayoutsRes = await client.query(`
      SELECT project_id, panels, last_updated 
      FROM panel_layouts 
      WHERE panels != '[]' AND panels != 'null' AND panels IS NOT NULL
      ORDER BY last_updated DESC
    `);
    
    console.log(`📊 Found ${nonEmptyLayoutsRes.rows.length} non-empty panel layouts`);
    
    if (nonEmptyLayoutsRes.rows.length > 0) {
      console.log('📋 Non-empty layouts:');
      nonEmptyLayoutsRes.rows.forEach((layout, idx) => {
        try {
          const parsed = JSON.parse(layout.panels);
          const panelCount = Array.isArray(parsed) ? parsed.length : 0;
          console.log(`  Layout ${idx + 1}: Project ${layout.project_id.substring(0, 8)}... - ${panelCount} panels`);
          
          if (panelCount > 0 && idx === 0) {
            console.log('    First few panels:');
            parsed.slice(0, 3).forEach((panel, pIdx) => {
              console.log(`      Panel ${pIdx + 1}: ${panel.id || 'no-id'} at (${panel.x}, ${panel.y})`);
            });
          }
        } catch (e) {
          console.log(`    Layout ${idx + 1}: Parse error - ${e.message}`);
        }
      });
    } else {
      console.log('❌ NO PANELS FOUND ANYWHERE in the database!');
      console.log('💡 This suggests either:');
      console.log('   1. Panels were never created');
      console.log('   2. Panels were deleted');
      console.log('   3. There is a bug in panel creation/saving');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
