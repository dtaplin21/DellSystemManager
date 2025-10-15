const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load .env from current directory

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearAllRecords() {
  try {
    console.log('🧹 Clearing all as-built records for testing...');
    console.log('🔗 Connecting to: Supabase database');

    const projectId = '49e74875-5d29-4027-a817-d53602e68e4c';

    // Delete all records for the project
    const { data: deleteData, error: deleteError } = await supabase
      .from('asbuilt_records')
      .delete()
      .eq('project_id', projectId);
    
    if (deleteError) {
      console.error('❌ Error deleting records:', deleteError);
      return;
    }
    
    console.log(`🗑️ Deleted records for project ${projectId}`);

    // Show remaining records count
    const { count, error: countError } = await supabase
      .from('asbuilt_records')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting records:', countError);
      return;
    }
    
    console.log(`📊 Remaining records in database: ${count}`);

    console.log('🎉 Database cleared for testing!');
  } catch (error) {
    console.error('❌ Error clearing records:', error);
  }
}

// Run the cleanup
clearAllRecords();
