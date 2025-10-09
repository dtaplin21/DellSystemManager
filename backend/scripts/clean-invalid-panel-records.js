const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' }); // Load backend .env

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  }
});

async function cleanInvalidPanelRecords() {
  const client = await pool.connect();
  try {
    console.log('🧹 Cleaning invalid panel records...');
    console.log('🔗 Connecting to: Supabase database');

    // Find records with invalid panel numbers (non-numeric)
    const findInvalidQuery = `
      SELECT id, mapped_data->>'panelNumber' as panel_number, domain, created_at
      FROM asbuilt_records
      WHERE mapped_data->>'panelNumber' !~ '^[0-9]+$'
      ORDER BY created_at DESC
    `;
    
    const invalidRecords = await client.query(findInvalidQuery);
    console.log(`🔍 Found ${invalidRecords.rows.length} invalid panel records:`);
    
    invalidRecords.rows.forEach(record => {
      console.log(`  - ID: ${record.id}, Panel: "${record.panel_number}", Domain: ${record.domain}, Date: ${record.created_at}`);
    });

    if (invalidRecords.rows.length === 0) {
      console.log('✅ No invalid panel records found!');
      return;
    }

    // Delete invalid records
    const deleteQuery = `
      DELETE FROM asbuilt_records
      WHERE mapped_data->>'panelNumber' !~ '^[0-9]+$'
    `;
    
    const deleteResult = await client.query(deleteQuery);
    console.log(`🗑️ Deleted ${deleteResult.rowCount} invalid panel records`);

    // Show remaining valid records count
    const countQuery = `
      SELECT COUNT(*) as total_records
      FROM asbuilt_records
    `;
    
    const countResult = await client.query(countQuery);
    console.log(`📊 Remaining valid records: ${countResult.rows[0].total_records}`);

    console.log('🎉 Database cleanup complete!');
  } catch (error) {
    console.error('❌ Error cleaning records:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
cleanInvalidPanelRecords();
