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
  const [isClient, setIsClient] = useState(false);

  // Detect client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadUserProfile = useCallback(async (supabaseUser: User) => {
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
      
      console.log('🔧 [AUTH] Setting user profile:', userProfile.email);
      setUser(userProfile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Fallback: create basic user object from Supabase user
      const fallbackUser = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        displayName: supabaseUser.user_metadata?.display_name || null,
        company: supabaseUser.user_metadata?.company || null,
        position: null,
        subscription: 'basic',
        profileImageUrl: null,
      };
      console.log('🔧 [AUTH] Setting fallback user profile:', fallbackUser.email);
      setUser(fallbackUser);
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      console.log('🔧 [AUTH] Attempting to get real authentication...');
      
      // Get real authentication session
      const currentSession = await getCurrentSession();
      
      if (currentSession?.user) {
        console.log('✅ [AUTH] Real user found:', currentSession.user.email);
        setSession(currentSession);
        await loadUserProfile(currentSession.user);
      } else {
        console.log('🔧 [AUTH] No authentication found - user needs to log in');
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [isClient, loadUserProfile]);

  useEffect(() => {
    // Only run authentication logic on client side
    if (!isClient) {
      return;
    }

    let mounted = true;

    initializeAuth();

    // Set up auth state change listener for both development and production
    const isDevelopment = process.env.NODE_ENV === 'development';
    let subscription: any = null;
    
    const { data: { subscription: authSubscription } } = getSupabaseClient().auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        console.log('🔧 [AUTH] Auth state changed:', event, newSession?.user?.email || 'no user');
        console.log('🔧 [AUTH] Current user state before update:', user?.email || 'no user');
        
        setSession(newSession);

        if (newSession?.user) {
          console.log('🔧 [AUTH] Loading user profile for:', newSession.user.email);
          // Only update if the user is different
          if (!user || user.id !== newSession.user.id) {
            await loadUserProfile(newSession.user);
          } else {
            console.log('🔧 [AUTH] User already loaded, skipping update');
          }
        } else {
          console.log('🔧 [AUTH] No user in session, setting user to null');
          if (user) {
            setUser(null);
          }
        }
      }
    );
    subscription = authSubscription;

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isClient, initializeAuth]);


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

  const updatePassword = async (newPassword: string) => {
    const { error } = await getSupabaseClient().auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw new Error(error.message || 'Password update failed');
    }
  };

  // Function to manually refresh session using Supabase's native refresh
  const refreshSession = useCallback(async () => {
    if (!isClient) return null;

    try {
      const { data: refreshed, error } = await getSupabaseClient().auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return null;
      }
      
      if (refreshed.session) {
        setSession(refreshed.session);
        if (refreshed.session.user) {
          await loadUserProfile(refreshed.session.user);
        }
        return refreshed.session;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  }, [isClient]);

  // Function to clear session and force fresh login
  const clearSessionAndRedirect = useCallback(async () => {
    if (!isClient) return;

    try {
      await getSupabaseClient().auth.signOut();
      setUser(null);
      setSession(null);
      
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }, [isClient]);

  return {
    user,
    session,
    loading: !isClient || loading,
    isAuthenticated: isClient && !!user,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
    refreshSession,
    clearSessionAndRedirect,
  };
} 