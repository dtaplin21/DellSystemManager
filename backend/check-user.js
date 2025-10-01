#!/usr/bin/env node

/**
 * Check user information and admin status
 * Usage: node check-user.js
 */

const { createClient } = require('@supabase/supabase-js');
const { db } = require('./db');
const { users } = require('./db/schema');
const { eq } = require('drizzle-orm');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUser() {
  const email = 'dtaplin21+new@gmail.com';
  
  try {
    console.log(`🔍 Looking for user: ${email}`);
    
    // Check in local database
    console.log('📊 Checking local database...');
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (user) {
      console.log('✅ User found in local database:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Display Name:', user.displayName);
      console.log('   Company:', user.company);
      console.log('   Subscription:', user.subscription);
      console.log('   Is Admin:', user.isAdmin ? '✅ YES' : '❌ NO');
      console.log('   Created:', user.createdAt);
    } else {
      console.log('❌ User not found in local database');
    }
    
    // Check in Supabase
    console.log('\n🔍 Checking Supabase...');
    const { data: supabaseUsers, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Supabase error:', error.message);
      return;
    }
    
    const supabaseUser = supabaseUsers.users.find(u => u.email === email);
    if (supabaseUser) {
      console.log('✅ User found in Supabase:');
      console.log('   ID:', supabaseUser.id);
      console.log('   Email:', supabaseUser.email);
      console.log('   Email Confirmed:', supabaseUser.email_confirmed_at ? '✅ YES' : '❌ NO');
      console.log('   Created:', supabaseUser.created_at);
      console.log('   Last Sign In:', supabaseUser.last_sign_in_at);
    } else {
      console.log('❌ User not found in Supabase');
    }
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
  }
}

checkUser().then(() => process.exit(0));
