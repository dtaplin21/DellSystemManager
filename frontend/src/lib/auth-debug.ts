// Authentication debugging utility
import { getSupabaseClient } from './supabase';

export async function debugAuthStatus() {
  console.log('🔍 [AUTH DEBUG] === Starting Authentication Debug ===');
  
  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      console.log('❌ [AUTH DEBUG] Running on server side - no auth available');
      return { isAuthenticated: false, reason: 'Server side' };
    }

    // Get Supabase client
    const supabase = getSupabaseClient();
    console.log('✅ [AUTH DEBUG] Supabase client created');

    // Check current session
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('🔍 [AUTH DEBUG] Session check result:', {
      hasSession: !!session,
      hasError: !!error,
      errorMessage: error?.message,
      hasAccessToken: !!session?.access_token,
      tokenLength: session?.access_token?.length,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'No expiration'
    });

    if (error) {
      console.error('❌ [AUTH DEBUG] Session error:', error);
      return { isAuthenticated: false, reason: error.message };
    }

    if (!session) {
      console.log('❌ [AUTH DEBUG] No session found');
      return { isAuthenticated: false, reason: 'No session' };
    }

    if (!session.access_token) {
      console.log('❌ [AUTH DEBUG] No access token in session');
      return { isAuthenticated: false, reason: 'No access token' };
    }

    // Check localStorage fallback
    try {
      const storedSession = localStorage.getItem('supabase.auth.token');
      console.log('🔍 [AUTH DEBUG] LocalStorage check:', {
        hasStoredSession: !!storedSession,
        storedSessionLength: storedSession?.length
      });
    } catch (localStorageError) {
      console.warn('⚠️ [AUTH DEBUG] LocalStorage access failed:', localStorageError);
    }

    console.log('✅ [AUTH DEBUG] Authentication is valid');
    return { 
      isAuthenticated: true, 
      session: {
        userId: session.user?.id,
        email: session.user?.email,
        tokenPreview: session.access_token.substring(0, 20) + '...',
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'No expiration'
      }
    };

  } catch (error) {
    console.error('❌ [AUTH DEBUG] Debug failed:', error);
    return { isAuthenticated: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Test function to check auth and make a test API call
export async function testAuthenticatedAPI() {
  console.log('🔍 [AUTH DEBUG] === Testing Authenticated API ===');
  
  const authStatus = await debugAuthStatus();
  console.log('🔍 [AUTH DEBUG] Auth status:', authStatus);
  
  if (!authStatus.isAuthenticated) {
    console.error('❌ [AUTH DEBUG] Cannot test API - not authenticated');
    return { success: false, reason: authStatus.reason };
  }

  try {
    // Test the failing endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003'}/api/panel-requirements/test-project`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStatus.session?.tokenPreview?.replace('...', '') || 'MISSING_TOKEN'}`
      }
    });

    console.log('🔍 [AUTH DEBUG] API test response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    const responseText = await response.text();
    console.log('🔍 [AUTH DEBUG] API test response body:', responseText);

    return { 
      success: response.ok, 
      status: response.status, 
      response: responseText 
    };

  } catch (error) {
    console.error('❌ [AUTH DEBUG] API test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
