// Test script to verify token refresh mechanism
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

async function testTokenRefresh() {
  try {
    console.log('🔍 Testing token refresh mechanism...');
    
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error);
      return;
    }
    
    if (!session) {
      console.log('⚠️ No session found - user needs to log in');
      return;
    }
    
    console.log('✅ Session found');
    console.log('🔍 Token expiration:', new Date(session.expires_at * 1000));
    console.log('🔍 Current time:', new Date());
    console.log('🔍 Time until expiry:', session.expires_at - Math.floor(Date.now() / 1000), 'seconds');
    
    // Try to refresh the session
    console.log('🔄 Attempting to refresh session...');
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('❌ Error refreshing session:', refreshError);
      return;
    }
    
    if (refreshed.session) {
      console.log('✅ Session refreshed successfully');
      console.log('🔍 New token expiration:', new Date(refreshed.session.expires_at * 1000));
      console.log('🔍 New time until expiry:', refreshed.session.expires_at - Math.floor(Date.now() / 1000), 'seconds');
    } else {
      console.log('⚠️ No session returned from refresh');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testTokenRefresh(); 