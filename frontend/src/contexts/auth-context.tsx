'use client';

import { createContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithGoogle as firebaseSignInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logoutFirebase,
  getCurrentFirebaseUser
} from '@/lib/firebase';
import {
  loginUser,
  signupUser,
  loginWithGoogle,
  logout,
  getCurrentUser,
  updateUserProfile,
} from '@/lib/api';

interface User {
  id: string;
  email: string;
  displayName?: string;
  company?: string;
  position?: string;
  subscription?: 'basic' | 'premium';
  roles?: string[];
  profileImageUrl?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, company?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profileData: any) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        // Try to get current user from the server
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Sign in with Firebase
      const fbResult = await signInWithEmail(email, password);
      
      // Sign in with our backend
      const { user: authUser } = await loginUser(email, password);
      
      setUser(authUser);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string, company?: string) => {
    try {
      setIsLoading(true);
      
      // Sign up with Firebase
      const fbResult = await signUpWithEmail(email, password);
      
      // Sign up with our backend
      const { user: authUser } = await signupUser(name, email, password, company);
      
      setUser(authUser);
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogleFn = async () => {
    try {
      setIsLoading(true);
      
      // Sign in with Google via Firebase
      const { idToken } = await firebaseSignInWithGoogle();
      
      // Send the token to our backend
      const { user: authUser } = await loginWithGoogle(idToken);
      
      setUser(authUser);
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logoutFn = async () => {
    try {
      setIsLoading(true);
      
      // Logout from Firebase
      await logoutFirebase();
      
      // Logout from our backend
      await logout();
      
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData: any) => {
    try {
      setIsLoading(true);
      
      // Update profile on our backend
      const updatedUser = await updateUserProfile(profileData);
      
      setUser(updatedUser);
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        loginWithGoogle: loginWithGoogleFn,
        logout: logoutFn,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
