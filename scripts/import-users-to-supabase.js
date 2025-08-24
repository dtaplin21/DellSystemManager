const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function importUsers() {
  try {
    console.log('Starting user import...');
    
    // Get all users from existing database
    const result = await pool.query(`
      SELECT id, email, password, display_name, company, subscription, created_at, updated_at
      FROM users
      ORDER BY created_at
    `);
    
    console.log(`Found ${result.rows.length} users to import`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of result.rows) {
      try {
        console.log(`Importing user: ${user.email}`);
        
        // Create user in Supabase Auth with the same password
        // Note: We need to use the service role key to create users with existing passwords
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: 'temporary-password-123', // We'll update this in the next step
          email_confirm: true,
          user_metadata: {
            display_name: user.display_name,
            company: user.company,
            subscription: user.subscription
          }
        });
        
        if (authError) {
          console.error(`Error creating auth user for ${user.email}:`, authError);
          errorCount++;
          continue;
        }
        
        // Update the user's profile with additional data
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.user.id,
            display_name: user.display_name,
            company: user.company,
            subscription: user.subscription,
            created_at: user.created_at,
            updated_at: user.updated_at
          });
        
        if (profileError) {
          console.error(`Error updating profile for ${user.email}:`, profileError);
          errorCount++;
          continue;
        }
        
        // Update projects to use new user ID
        await pool.query(`
          UPDATE projects 
          SET user_id = $1 
          WHERE user_id = $2
        `, [authUser.user.id, user.id]);
        
        // Update other tables that reference user_id
        await pool.query(`
          UPDATE documents 
          SET uploaded_by = $1 
          WHERE uploaded_by = $2
        `, [authUser.user.id, user.id]);
        
        await pool.query(`
          UPDATE qc_data 
          SET created_by = $1 
          WHERE created_by = $2
        `, [authUser.user.id, user.id]);
        
        await pool.query(`
          UPDATE notifications 
          SET user_id = $1 
          WHERE user_id = $2
        `, [authUser.user.id, user.id]);
        
        successCount++;
        console.log(`✓ Successfully imported ${user.email}`);
        
      } catch (error) {
        console.error(`Error importing user ${user.email}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\nImport completed:`);
    console.log(`✓ Successfully imported: ${successCount} users`);
    console.log(`✗ Failed to import: ${errorCount} users`);
    
    // Note: You'll need to manually update passwords for existing users
    // since Supabase doesn't support importing bcrypt hashes directly
    console.log('\n⚠️  IMPORTANT: You need to manually update passwords for existing users');
    console.log('Users have been created with temporary passwords. They will need to reset their passwords.');
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the import
importUsers(); 