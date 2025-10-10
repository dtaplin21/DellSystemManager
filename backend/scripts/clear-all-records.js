const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' }); // Load backend .env

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  }
});

async function clearAllRecords() {
  const client = await pool.connect();
  try {
    console.log('🧹 Clearing all as-built records for testing...');
    console.log('🔗 Connecting to: Supabase database');

    const projectId = '49e74875-5d29-4027-a817-d53602e68e4c';

    // Delete all records for the project
    const deleteQuery = `
      DELETE FROM asbuilt_records
      WHERE project_id = $1
    `;
    
    const deleteResult = await client.query(deleteQuery, [projectId]);
    console.log(`🗑️ Deleted ${deleteResult.rowCount} records`);

    // Show remaining records count
    const countQuery = `
      SELECT COUNT(*) as total_records
      FROM asbuilt_records
    `;
    
    const countResult = await client.query(countQuery);
    console.log(`📊 Remaining records in database: ${countResult.rows[0].total_records}`);

    console.log('🎉 Database cleared for testing!');
  } catch (error) {
    console.error('❌ Error clearing records:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
clearAllRecords();
