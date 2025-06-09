import { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          // Update localStorage with fresh data
          localStorage.setItem('userData', JSON.stringify(userData));
        } else if (response.status === 401) {
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
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const userData = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name
        };
        
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(userData));
        setUser(userData);
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
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

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout
  };
}