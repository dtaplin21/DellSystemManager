import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient, getCurrentSession } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  display_name: string | null;
  company: string | null;
  position: string | null;
  subscription: string;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  company: string | null;
  position: string | null;
  subscription: string;
  profileImageUrl: string | null;
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    getSession();

    // Fallback: ensure loading is set to false after 15 seconds
    const fallbackTimeout = setTimeout(() => {
      setLoading(false);
    }, 15000);

    // Listen for auth changes
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 Auth state change:', event, session ? 'session present' : 'no session');
        setSession(session);
        
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
        // Don't set loading to false here - let getSession handle it
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, []);

  const getSession = async () => {
    console.log('🔍 [useSupabaseAuth] getSession called');
    try {
      // Add timeout protection
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Session retrieval timeout'));
        }, 10000); // 10 second timeout
      });
      
      console.log('🔍 [useSupabaseAuth] Calling getCurrentSession...');
      // Race between session retrieval and timeout
      const session = await Promise.race([
        getCurrentSession(),
        timeoutPromise
      ]);
      
      console.log('🔍 [useSupabaseAuth] Session result:', session ? 'session found' : 'no session');
      setSession(session);
      
      if (session?.user) {
        console.log('🔍 [useSupabaseAuth] Loading user profile...');
        await loadUserProfile(session.user);
      } else {
        console.log('🔍 [useSupabaseAuth] No user in session');
      }
    } catch (error) {
      console.error('🔍 [useSupabaseAuth] Error getting session:', error);
      // Set loading to false even on error to prevent infinite loading
    } finally {
      console.log('🔍 [useSupabaseAuth] Setting loading to false');
      setLoading(false);
    }
  };

  const loadUserProfile = async (supabaseUser: User) => {
    try {
      // Create user object from Supabase user metadata
      const userProfile: AuthUser = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        displayName: supabaseUser.user_metadata?.display_name || null,
        company: supabaseUser.user_metadata?.company || null,
        position: null,
        subscription: 'basic',
        profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
      };
      
      setUser(userProfile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Fallback: create basic user object from Supabase user
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        displayName: supabaseUser.user_metadata?.display_name || null,
        company: supabaseUser.user_metadata?.company || null,
        position: null,
        subscription: 'basic',
        profileImageUrl: null,
      });
    }
  };

  const signUp = async (email: string, password: string, metadata: {
    display_name: string;
    company?: string;
  }) => {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: metadata.display_name,
          company: metadata.company,
        }
      }
    });

    if (error) {
      throw new Error(error.message || 'Signup failed');
    }

    if (data.user) {
      await loadUserProfile(data.user);
    }

    return { user: data.user, session: data.session };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message || 'Login failed');
    }

    if (data.user) {
      await loadUserProfile(data.user);
    }

    return { user: data.user, session: data.session };
  };

  const signOut = async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');

    // Update user metadata in Supabase
    const { data, error } = await getSupabaseClient().auth.updateUser({
      data: {
        display_name: updates.display_name,
        company: updates.company,
        position: updates.position,
      }
    });

    if (error) {
      throw new Error(error.message || 'Profile update failed');
    }

    if (data.user) {
      await loadUserProfile(data.user);
    }

    return user;
  };

  const resetPassword = async (email: string) => {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message || 'Password reset failed');
    }
  };

  // Function to manually refresh session using Supabase's native refresh
  const refreshSession = useCallback(async () => {
    try {
      console.log('🔄 Manually refreshing session...');
      const { data: refreshed, error } = await getSupabaseClient().auth.refreshSession();
      
      if (error) {
        console.error('❌ Error refreshing session:', error);
        return null;
      }
      
      if (refreshed.session) {
        console.log('✅ Session refreshed successfully');
        setSession(refreshed.session);
        if (refreshed.session.user) {
          await loadUserProfile(refreshed.session.user);
        }
        return refreshed.session;
      } else {
        console.log('⚠️ No session returned from refresh');
        return null;
      }
    } catch (error) {
      console.error('❌ Error refreshing session:', error);
      return null;
    }
  }, []);

  // Function to clear session and force fresh login
  const clearSessionAndRedirect = useCallback(async () => {
    try {
      console.log('🧹 Clearing session and redirecting to login...');
      await getSupabaseClient().auth.signOut();
      setUser(null);
      setSession(null);
      
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    refreshSession,
    clearSessionAndRedirect,
  };
} 