import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// Helper function to ensure we have a valid session
export const ensureValidSession = async () => {
  try {
    console.log('🔍 ensureValidSession: Starting session check...');
    
    // First, try to get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ ensureValidSession: Error getting session:', error);
      return null;
    }
    
    if (!session) {
      console.log('⚠️ ensureValidSession: No session found');
      return null;
    }
    
    console.log('✅ ensureValidSession: Session found:', {
      userId: session.user?.id,
      expiresAt: session.expires_at,
      hasAccessToken: !!session.access_token,
      hasRefreshToken: !!session.refresh_token
    });
    
    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;
    
    console.log('🔍 ensureValidSession: Token expiration check:', {
      expiresAt,
      now,
      timeUntilExpiry: expiresAt ? expiresAt - now : 'unknown',
      needsRefresh: expiresAt ? (expiresAt - now) < fiveMinutes : false
    });
    
    if (expiresAt && (expiresAt - now) < fiveMinutes) {
      console.log('🔄 ensureValidSession: Token expiring soon, refreshing session...');
      
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ ensureValidSession: Error refreshing session:', refreshError);
        // If refresh fails, clear the session and return null
        await supabase.auth.signOut();
        return null;
      }
      
      if (refreshData.session) {
        console.log('✅ ensureValidSession: Session refreshed successfully:', {
          userId: refreshData.session.user?.id,
          expiresAt: refreshData.session.expires_at
        });
        return refreshData.session;
      } else {
        console.log('⚠️ ensureValidSession: No session returned from refresh');
        return null;
      }
    }
    
    console.log('✅ ensureValidSession: Using existing valid session');
    return session;
  } catch (error) {
    console.error('❌ ensureValidSession: Error ensuring valid session:', error);
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