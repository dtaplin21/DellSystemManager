import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (supabaseUser: User) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // Create profile if it doesn't exist
        await createProfile(supabaseUser);
        return;
      }

      const authUser: AuthUser = {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        displayName: profile.display_name,
        company: profile.company,
        position: profile.position,
        subscription: profile.subscription,
        profileImageUrl: profile.profile_image_url,
      };

      setUser(authUser);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (supabaseUser: User) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: supabaseUser.id,
          display_name: supabaseUser.user_metadata?.display_name || null,
          subscription: 'basic',
        });

      if (error) {
        console.error('Error creating profile:', error);
      } else {
        // Fetch the profile again
        await fetchUserProfile(supabaseUser);
      }
    } catch (error) {
      console.error('Error in createProfile:', error);
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
        data: metadata,
      },
    });

    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    // Update local user state
    setUser(prev => prev ? {
      ...prev,
      displayName: data.display_name,
      company: data.company,
      position: data.position,
      subscription: data.subscription,
      profileImageUrl: data.profile_image_url,
    } : null);

    return data;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
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