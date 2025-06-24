'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  
  const { signIn, resetPassword } = useSupabaseAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isResetMode) {
        await resetPassword(email);
        toast({
          title: 'Password Reset Sent',
          description: 'Check your email for password reset instructions.',
        });
        setIsResetMode(false);
      } else {
        await signIn(email, password);
        toast({
          title: 'Login Successful',
          description: 'Welcome back!',
        });
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Authentication failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isResetMode ? 'Reset Password' : 'Sign In'}
          </CardTitle>
          <CardDescription className="text-center">
            {isResetMode 
              ? 'Enter your email to receive reset instructions'
              : 'Enter your credentials to access your account'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            {!isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isResetMode ? 'Sending...' : 'Signing in...'}</span>
                </div>
              ) : (
                isResetMode ? 'Send Reset Email' : 'Sign In'
              )}
            </Button>

            <div className="text-center space-y-2">
              {isResetMode ? (
                <button
                  type="button"
                  onClick={() => setIsResetMode(false)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                  disabled={isLoading}
                >
                  Back to Sign In
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                  disabled={isLoading}
                >
                  Forgot your password?
                </button>
              )}
            </div>

            {!isResetMode && (
              <div className="text-center">
                <span className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <a
                    href="/signup"
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Sign up
                  </a>
                </span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
