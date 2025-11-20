import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a simple mock client for development
const createMockClient = (): SupabaseClient => {
  console.log('🔧 [SUPABASE] Creating mock client - Supabase not configured or SSR');
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

// Create the Supabase client lazily to avoid SSR issues
let supabase: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (supabase) {
    return supabase;
  }

  // Get environment variables at runtime
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('🔧 [SUPABASE] Creating client with:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    isClient: typeof window !== 'undefined',
    url: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
  });

  // Only create client on the client side
  if (typeof window === 'undefined') {
    console.log('🔧 [SUPABASE] Server-side rendering - using mock client');
    return createMockClient();
  }

  try {
    if (supabaseUrl && supabaseAnonKey) {
      console.log('🔧 [SUPABASE] Creating real Supabase client');
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        }
      });
      console.log('✅ [SUPABASE] Real client created successfully');
      
      // Expose client on window for browser automation (development/testing only)
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        (window as any).__SUPABASE_CLIENT__ = supabase;
      }
    } else {
      console.log('🔧 [SUPABASE] Missing credentials - using mock client');
      supabase = createMockClient();
    }
  } catch (error) {
    console.error('❌ [SUPABASE] Error creating client:', error);
    supabase = createMockClient();
  }

  return supabase;
};

export { getSupabaseClient };

// Helper function to get current session
export const getCurrentSession = async () => {
  try {
    const client = getSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    return error ? null : session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

// Helper function to ensure valid session
export const ensureValidSession = async () => {
  try {
    const client = getSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error || !session) {
      return null;
    }
    
    // Check if token is expired (with 5 minute buffer)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const buffer = 5 * 60; // 5 minutes
    
    if (expiresAt && (expiresAt - now) < buffer) {
      const { data: { session: newSession }, error: refreshError } = await client.auth.refreshSession();
      return refreshError ? null : newSession;
    }
    
    return session;
  } catch (error) {
    console.error('Error ensuring valid session:', error);
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