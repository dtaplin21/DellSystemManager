'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { useSupabaseAuth } from '../../hooks/use-supabase-auth';
import { useToast } from '../../hooks/use-toast';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const showSignup = searchParams?.get('signup') === 'true';
  const [isSignUp, setIsSignUp] = useState(showSignup);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, signIn, signUp, loading } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // Debug logging
  console.log('🔧 [LOGIN] Component render - user:', user?.email || 'no user', 'loading:', loading);
  
  useEffect(() => {
    // Only redirect if we have a user and we're not in a loading state
    if (user && !loading && !isLoading) {
      console.log('🔧 [LOGIN] User authenticated, redirecting to dashboard');
      router.replace('/dashboard');
    }
  }, [user, loading, isLoading, router]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isSignUp) {
        await signUp(email, password, {
          display_name: name,
          company: company || undefined
        });
        toast({
          title: 'Account created',
          description: 'Your account has been created successfully. Welcome!',
        });
      } else {
        await signIn(email, password);
        toast({
          title: 'Login successful',
          description: 'Welcome back!',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Authentication failed',
        description: error instanceof Error ? error.message : 'Failed to authenticate. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      // For now, we'll use a placeholder since Google auth isn't implemented in the hook
      toast({
        title: 'Google authentication',
        description: 'Google authentication is not yet implemented.',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Google login error:', error);
      toast({
        title: 'Google authentication failed',
        description: error instanceof Error ? error.message : 'Failed to authenticate with Google. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? 'Create an Account' : 'Log In'}</CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Sign up to access all features of GeoQC' 
              : 'Enter your credentials to access your account'
            }
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                {!isSignUp && (
                  <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="company">Company (Optional)</Label>
                <Input 
                  id="company" 
                  type="text" 
                  value={company} 
                  onChange={(e) => setCompany(e.target.value)} 
                />
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading 
                ? 'Processing...' 
                : isSignUp ? 'Sign Up' : 'Log In'
              }
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <span className="mr-2">
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" 
                    fill="#4285f4"/>
                </svg>
              </span>
              {isLoading ? 'Processing...' : 'Continue with Google'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-gray-600">
            {isSignUp ? 'Already have an account? ' : 'Need to create an account? '}
            <a 
              className="text-blue-600 hover:underline cursor-pointer" 
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Log in' : 'Sign up'}
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}