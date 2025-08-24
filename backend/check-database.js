const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCurrentState() {
  try {
    console.log('🔍 Checking current database state before clearing...');
    
    const client = await pool.connect();
    
    // Check current panel count for your project
    const layoutResult = await client.query(
      'SELECT * FROM panel_layouts WHERE project_id = $1', 
      ['69fc302b-166d-4543-9990-89c4b1e0ed59']
    );
    
    if (layoutResult.rows.length > 0) {
      const layout = layoutResult.rows[0];
      console.log('\n📊 Current state:');
      console.log('  Project ID:', layout.project_id);
      console.log('  Panels count:', layout.panels ? layout.panels.length : 0);
      console.log('  Layout ID:', layout.id);
      console.log('  Last Updated:', layout.last_updated);
      console.log('  Width:', layout.width);
      console.log('  Height:', layout.height);
      console.log('  Scale:', layout.scale);
    } else {
      console.log('\n❌ No layout found for this project');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkCurrentState();
