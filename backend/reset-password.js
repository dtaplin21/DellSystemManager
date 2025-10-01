#!/usr/bin/env node

/**
 * Reset user password using Supabase admin API
 * Usage: node reset-password.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetPassword() {
  const email = 'dtaplin21+new@gmail.com';
  const newPassword = 'NewPassword123!'; // You can change this
  
  try {
    console.log(`🔑 Resetting password for: ${email}`);
    console.log(`🔑 New password will be: ${newPassword}`);
    
    // Get user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error('❌ User not found:', email);
      return;
    }
    
    console.log('✅ User found:', user.id);
    
    // Update user password
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    
    if (error) {
      console.error('❌ Error updating password:', error.message);
      return;
    }
    
    console.log('✅ Password updated successfully!');
    console.log('\n🎉 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', newPassword);
    console.log('\nYou can now use these credentials to sign in anywhere!');
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  }
}

resetPassword().then(() => process.exit(0));
