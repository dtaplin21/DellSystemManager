#!/usr/bin/env node

/**
 * Create a test user in both Supabase and local database
 * Usage: node scripts/create-test-user.js
 */

const { createClient } = require('@supabase/supabase-js');
const { db } = require('../db');
const { users } = require('../db/schema');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestUser() {
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    displayName: 'Test User',
    company: 'Test Company'
  };

  try {
    console.log('🔐 Creating test user in Supabase...');
    
    // Create user in Supabase
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        display_name: testUser.displayName,
        company: testUser.company
      }
    });

    if (supabaseError) {
      console.error('❌ Supabase error:', supabaseError.message);
      return;
    }

    console.log('✅ User created in Supabase:', supabaseUser.user.id);

    // Create user in local database
    console.log('💾 Creating user in local database...');
    
    const [user] = await db.insert(users).values({
      id: supabaseUser.user.id,
      email: testUser.email,
      displayName: testUser.displayName,
      company: testUser.company,
      subscription: 'basic',
      createdAt: new Date(),
    }).returning();

    console.log('✅ User created in local database:', user.id);
    console.log('\n🎉 Test user created successfully!');
    console.log('📧 Email:', testUser.email);
    console.log('🔑 Password:', testUser.password);
    console.log('\nYou can now log in with these credentials.');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  }
}

createTestUser().then(() => process.exit(0));
