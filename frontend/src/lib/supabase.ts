import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Force recompilation - token refresh fix
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug logging
console.log('🔍 Supabase URL:', supabaseUrl);
console.log('🔍 Supabase Anon Key:', supabaseAnonKey ? supabaseAnonKey.slice(0, 10) + '…' : 'undefined');

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables are not set. Please create a .env.local file with your Supabase credentials.');
  console.warn('Required variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create a mock client if environment variables are missing
const createMockClient = (): SupabaseClient => {
  console.warn('Using mock Supabase client - authentication features will not work');
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: (callback: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
  } as any as SupabaseClient;
};

// Validate URL format before creating client
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http');
  } catch {
    return false;
  }
};

// Only create the real client if we have valid URL and key
let supabase: SupabaseClient;
try {
  if (isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseUrl) {
    console.log('✅ Creating real Supabase client with auto-refresh enabled');
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'supabase-auth-token'
      }
    });
  } else {
    console.log('⚠️ Creating mock Supabase client');
    supabase = createMockClient();
  }
} catch (error) {
  console.error('❌ Error creating Supabase client:', error);
  console.log('⚠️ Falling back to mock client');
  supabase = createMockClient();
}

export { supabase };

// Helper function to update cookie with fresh token
const updateTokenCookie = (token: string) => {
  if (typeof window !== 'undefined') {
    // Set cookie for backend use
    document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Strict`;
    console.log('🍪 Cookie updated with fresh token:', token.substring(0, 20) + '...');
  }
};

// Helper function to clear token cookie
const clearTokenCookie = () => {
  if (typeof window !== 'undefined') {
    document.cookie = 'token=; Max-Age=0; path=/';
    console.log('🧹 Cookie cleared');
  }
};

// Helper function to ensure we have a valid session
export const ensureValidSession = async () => {
  try {
    console.log('🔍 ensureValidSession: Starting session check...');
    
    // First, try to get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      clearTokenCookie();
      return null;
    }
    
    if (!session) {
      console.log('⚠️ No session found');
      clearTokenCookie();
      return null;
    }
    
    console.log('✅ Session found, checking expiration...');
    
    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;
    
    console.log('🔍 Token expiration check:', {
      expiresAt,
      now,
      timeUntilExpiry: expiresAt ? expiresAt - now : 'unknown',
      isExpired: expiresAt ? expiresAt < now : false
    });
    
    // Refresh if token is expired OR expires within 5 minutes
    if (expiresAt && (expiresAt < now || (expiresAt - now) < fiveMinutes)) {
      console.log('🔄 Token needs refresh, attempting...');
      
      // Try to refresh the session
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        // If refresh fails, clear the session and return null
        await supabase.auth.signOut();
        clearTokenCookie();
        return null;
      }
      
      if (refreshed.session) {
        console.log('✅ Session refreshed successfully');
        // ✅ Update cookie with fresh token
        updateTokenCookie(refreshed.session.access_token);
        return refreshed.session;
      } else {
        console.log('⚠️ No session returned from refresh');
        clearTokenCookie();
        return null;
      }
    }
    
    console.log('✅ Using existing valid session');
    // ✅ Update cookie with current valid token
    updateTokenCookie(session.access_token);
    return session;
  } catch (error) {
    console.error('Error ensuring valid session:', error);
    clearTokenCookie();
    return null;
  }
};

// Types for better TypeScript support
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          company: string | null;
          position: string | null;
          subscription: string;
          profile_image_url: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          company?: string | null;
          position?: string | null;
          subscription?: string;
          profile_image_url?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          company?: string | null;
          position?: string | null;
          subscription?: string;
          profile_image_url?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          location: string | null;
          user_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          location?: string | null;
          user_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          location?: string | null;
          user_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}; 