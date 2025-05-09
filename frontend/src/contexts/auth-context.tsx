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
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        // This would normally call an API endpoint to check the session
        const storedUser = localStorage.getItem('geoqc_user');
        
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      // This would normally call an API endpoint to authenticate
      // For demo purposes, we'll simulate a successful login
      if (email && password) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockUser: User = {
          id: '123456',
          email: email,
          displayName: email.split('@')[0],
          subscription: 'basic',
          createdAt: new Date().toISOString(),
        };
        
        setUser(mockUser);
        localStorage.setItem('geoqc_user', JSON.stringify(mockUser));
        return mockUser;
      }
      
      throw new Error('Invalid credentials');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string, company?: string) => {
    setIsLoading(true);
    
    try {
      // This would normally call an API endpoint to register
      // For demo purposes, we'll simulate a successful registration
      if (name && email && password) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockUser: User = {
          id: '123456',
          email: email,
          displayName: name,
          company: company,
          subscription: 'basic',
          createdAt: new Date().toISOString(),
        };
        
        setUser(mockUser);
        localStorage.setItem('geoqc_user', JSON.stringify(mockUser));
        return mockUser;
      }
      
      throw new Error('Please fill all required fields');
    } catch (error) {
      console.error('Signup error:', error);
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
      localStorage.setItem('geoqc_user', JSON.stringify(mockUser));
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
      // This would normally call an API endpoint to logout
      // For demo purposes, we'll just clear the local state
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setUser(null);
      localStorage.removeItem('geoqc_user');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData: any) => {
    setIsLoading(true);
    
    try {
      // This would normally call an API endpoint to update the profile
      // For demo purposes, we'll just update the local state
      
      if (user) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const updatedUser = {
          ...user,
          ...profileData,
        };
        
        setUser(updatedUser);
        localStorage.setItem('geoqc_user', JSON.stringify(updatedUser));
        
        toast({
          title: 'Profile updated',
          description: 'Your profile has been updated successfully.',
        });
        
        return updatedUser;
      }
      
      throw new Error('Not authenticated');
    } catch (error) {
      console.error('Profile update error:', error);
      
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update profile. Please try again.',
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