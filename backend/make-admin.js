#!/usr/bin/env node

/**
 * Make a user an admin
 * Usage: node make-admin.js
 */

const { db } = require('./db');
const { users } = require('./db/schema');
const { eq } = require('drizzle-orm');

// Load environment variables
require('dotenv').config();

async function makeAdmin() {
  const email = 'dtaplin21+new@gmail.com';
  
  try {
    console.log(`🔓 Making user admin: ${email}`);
    
    // Update user to admin
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isAdmin: true,
        updatedAt: new Date()
      })
      .where(eq(users.email, email))
      .returning();
    
    if (updatedUser) {
      console.log('✅ User successfully made admin!');
      console.log('   Email:', updatedUser.email);
      console.log('   Display Name:', updatedUser.displayName);
      console.log('   Is Admin:', updatedUser.isAdmin ? '✅ YES' : '❌ NO');
      console.log('   Updated:', updatedUser.updatedAt);
      console.log('\n🎉 You now have admin access!');
      console.log('   - Bypass all subscription checks');
      console.log('   - Full access to all features');
      console.log('   - No payment required');
    } else {
      console.log('❌ User not found');
    }
    
  } catch (error) {
    console.error('❌ Error making user admin:', error);
  }
}

makeAdmin().then(() => process.exit(0));
