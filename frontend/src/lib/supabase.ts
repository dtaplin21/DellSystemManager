import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Force recompilation - remove custom token logic
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
    console.log('✅ Creating real Supabase client with native token management');
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'sb-auth-token' // Use Supabase's default storage key
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

// Helper function to get current session (simplified)
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('❌ Error getting current session:', error);
    return null;
  }
};

// Helper function to ensure valid session and refresh if needed
export const ensureValidSession = async () => {
  try {
    console.log('🔍 Checking current session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
    
    if (!session) {
      console.log('⚠️ No session found');
      return null;
    }
    
    // Check if token is expired (with 5 minute buffer)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const buffer = 5 * 60; // 5 minutes
    
    if (expiresAt && (expiresAt - now) < buffer) {
      console.log('🔄 Token expiring soon, refreshing...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ Error refreshing session:', refreshError);
        return null;
      }
      
      if (newSession) {
        console.log('✅ Session refreshed successfully');
        
        // Store in localStorage
        localStorage.setItem('supabase-auth-token', JSON.stringify(newSession));
        
        // Set cookie
        document.cookie = `token=${newSession.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        
        return newSession;
      }
    }
    
    console.log('✅ Session is valid');
    return session;
  } catch (error) {
    console.error('❌ Error ensuring valid session:', error);
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