import { useState, useEffect, createContext, useContext } from 'react';
import { User } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, company?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth hook
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // First check localStorage for quick auth state
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');
        
        if (token && userData) {
          try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            console.log('User data loaded from localStorage:', parsedUser);
          } catch (error) {
            console.error('Error parsing stored user data:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
          }
        }

        // Then verify with server to ensure session is still valid
        const response = await fetch('/api/auth/user', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          console.log('User data verified with server:', userData);
          // Update localStorage with fresh data
          localStorage.setItem('userData', JSON.stringify(userData));
        } else if (response.status === 401) {
          console.log('Session invalid, clearing auth state');
          // Clear invalid auth state
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // Don't clear on network errors, keep existing state
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Raw login response data:', data);
        
        // Extract user data from the nested structure
        const userData = data.user;
        console.log('Extracted user data:', userData);
        
        // Ensure we have the required data
        if (!userData?.id || !userData?.email) {
          console.error('Missing required fields:', {
            hasId: !!userData?.id,
            hasEmail: !!userData?.email,
            userData
          });
          throw new Error('Invalid response data from server');
        }

        const processedUserData: User = {
          id: userData.id,
          email: userData.email,
          displayName: userData.displayName || userData.name || null,
          company: userData.company || null,
          position: userData.position || null,
          subscription: userData.subscription || 'basic'
        };

        console.log('Processed user data:', processedUserData);
        setUser(processedUserData);
        localStorage.setItem('userData', JSON.stringify(processedUserData));
        localStorage.setItem('authToken', data.token);

        // Verify the user data was set correctly
        const storedUser = localStorage.getItem('userData');
        console.log('Stored user data:', storedUser);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Login failed with status:', response.status, errorData);
        throw new Error(errorData.message || 'Login failed');
      }
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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, company }),
      });

      if (response.ok) {
        const data = await response.json();
        const userData: User = {
          id: data.id,
          email: data.email,
          displayName: data.name || null,
          company: data.company,
          position: data.position,
          subscription: data.subscription
        };
        setUser(userData);
        localStorage.setItem('userData', JSON.stringify(userData));
      } else {
        throw new Error('Signup failed');
      }
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
      const response = await fetch('/api/auth/google', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        const userData: User = {
          id: data.id,
          email: data.email,
          displayName: data.name || null,
          company: data.company,
          position: data.position,
          subscription: data.subscription
        };
        setUser(userData);
        localStorage.setItem('userData', JSON.stringify(userData));
      } else {
        throw new Error('Google login failed');
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/updateProfile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const updatedUserData = await response.json();
        setUser(updatedUserData);
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
      } else {
        throw new Error('Profile update failed');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    loginWithGoogle,
    logout,
    updateProfile
  };
}