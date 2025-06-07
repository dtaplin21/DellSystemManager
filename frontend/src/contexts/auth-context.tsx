'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../hooks/use-toast';

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
  login: (email: string, password: string) => Promise<User | undefined>;
  signup: (name: string, email: string, password: string, company?: string) => Promise<User | undefined>;
  loginWithGoogle: () => Promise<User | undefined>;
  logout: () => Promise<void>;
  updateProfile: (profileData: any) => Promise<User | undefined>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Mark as hydrated after client-side mount
    setIsHydrated(true);
    
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        // First check localStorage for cached user (only on client)
        if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem('geoqc_user');
          
          if (storedUser) {
            // Verify session with backend
            const response = await fetch('/api/auth/me', {
              credentials: 'include',
            });
            
            if (response.ok) {
              const { user } = await response.json();
              setUser(user);
              localStorage.setItem('geoqc_user', JSON.stringify(user));
            } else {
              // Session expired, clear local storage
              localStorage.removeItem('geoqc_user');
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('geoqc_user');
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      setUser(data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('geoqc_user', JSON.stringify(data.user));
      }
      
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Please check your credentials and try again.";
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string, company?: string) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, company }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }
      
      setUser(data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('geoqc_user', JSON.stringify(data.user));
      }
      
      toast({
        title: "Account created successfully",
        description: "Welcome to GeoSynth QC Pro!",
      });
      
      return data.user;
    } catch (error) {
      console.error('Signup error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Please check your information and try again.";
      toast({
        title: "Signup failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    
    try {
      // This would normally integrate with Firebase or another auth provider
      // For demo purposes, we'll simulate a successful Google login
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUser: User = {
        id: '789012',
        email: 'demo.user@example.com',
        displayName: 'Demo User',
        subscription: 'basic',
        profileImageUrl: 'https://ui-avatars.com/api/?name=Demo+User&background=random',
        createdAt: new Date().toISOString(),
      };
      
      setUser(mockUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('geoqc_user', JSON.stringify(mockUser));
      }
      return mockUser;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('geoqc_user');
      }
      
      toast({
        title: "Logged out successfully",
        description: "You have been logged out.",
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if API call fails
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('geoqc_user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData: any) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile update failed');
      }
      
      setUser(data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('geoqc_user', JSON.stringify(data.user));
      }
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
      
      return data.user;
    } catch (error) {
      console.error('Profile update error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile. Please try again.';
      toast({
        title: 'Update failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
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
        loginWithGoogle,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};