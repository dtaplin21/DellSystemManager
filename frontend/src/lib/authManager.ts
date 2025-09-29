import { getSupabaseClient } from './supabase';

// Use the same Supabase client instance as the rest of the app
const getSupabase = () => getSupabaseClient();

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  error: string | null;
}

class AuthManager {
  private static instance: AuthManager;
  private refreshPromise: Promise<string> | null = null;
  private authStateCallbacks: Set<(state: AuthState) => void> = new Set();

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  constructor() {
    // Listen for auth state changes
    getSupabase().auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      this.notifyAuthStateChange();
    });
  }

  // Get current authentication state
  async getAuthState(): Promise<AuthState> {
    try {
      const { data: { session }, error } = await getSupabase().auth.getSession();
      
      if (error) {
        return {
          isAuthenticated: false,
          token: null,
          user: null,
          error: error.message
        };
      }

      return {
        isAuthenticated: !!session,
        token: session?.access_token || null,
        user: session?.user || null,
        error: null
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        token: null,
        user: null,
        error: error instanceof Error ? error.message : 'Unknown auth error'
      };
    }
  }

  // Get valid token with automatic refresh
  async getValidToken(): Promise<string> {
    try {
      console.log('🔐 [AUTH MANAGER] Getting valid token...');
      const { data: { session }, error } = await getSupabase().auth.getSession();
      
      console.log('🔐 [AUTH MANAGER] Session check result:', {
        hasSession: !!session,
        hasError: !!error,
        errorMessage: error?.message,
        hasAccessToken: !!session?.access_token,
        tokenLength: session?.access_token?.length,
        tokenPreview: session?.access_token?.substring(0, 20) + '...'
      });
      
      if (error || !session) {
        console.error('🔐 [AUTH MANAGER] No valid session:', error?.message);
        throw new Error('No valid session. Please log in.');
      }

      // Check if token expires within 5 minutes
      const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      console.log('🔐 [AUTH MANAGER] Token expiration check:', {
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'No expiration',
        now: new Date(now).toISOString(),
        expiresSoon: expiresAt ? (expiresAt - now < fiveMinutes) : false
      });

      if (expiresAt && expiresAt - now < fiveMinutes) {
        console.log('🔐 [AUTH MANAGER] Token expires soon, refreshing...');
        return await this.refreshToken();
      }

      console.log('🔐 [AUTH MANAGER] Returning valid token:', session.access_token.substring(0, 20) + '...');
      return session.access_token;
    } catch (error) {
      console.error('Error getting valid token:', error);
      throw new Error('Authentication failed. Please log in again.');
    }
  }

  // Refresh token with deduplication
  private async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      console.log('Token refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const token = await this.refreshPromise;
      console.log('Token refreshed successfully');
      return token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const { data: { session }, error } = await getSupabase().auth.refreshSession();
    
    if (error || !session) {
      throw new Error('Failed to refresh session. Please log in again.');
    }

    return session.access_token;
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (state: AuthState) => void): () => void {
    this.authStateCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.authStateCallbacks.delete(callback);
    };
  }

  private async notifyAuthStateChange(): Promise<void> {
    const state = await this.getAuthState();
    this.authStateCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error in auth state callback:', error);
      }
    });
  }

  // Sign out
  async signOut(): Promise<void> {
    await getSupabase().auth.signOut();
  }
}

export const authManager = AuthManager.getInstance();
