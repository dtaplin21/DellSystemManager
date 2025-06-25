import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const getSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        await loadUserProfile(session.user);
      }
    } catch (error) {
      console.error('Error getting session:', error);
    } finally {
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
    const { data, error } = await supabase.auth.signUp({
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
    const { data, error } = await supabase.auth.signInWithPassword({
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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');

    // Update user metadata in Supabase
    const { data, error } = await supabase.auth.updateUser({
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message || 'Password reset failed');
    }
  };

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
  };
} 