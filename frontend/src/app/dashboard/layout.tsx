'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import Navbar from '@/components/layout/navbar';
import Sidebar from '@/components/layout/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, loading, refreshSession, clearSessionAndRedirect } = useSupabaseAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Dashboard Layout - Current State:', {
      user,
      isAuthenticated,
      loading,
    });
    
    if (!loading) {
      if (!isAuthenticated || !user) {
        console.log('User not authenticated or missing user data, redirecting to login');
        router.replace('/login');
      } else {
        console.log('User authenticated, rendering dashboard');
        // Refresh session to ensure we have a valid token
        refreshSession().catch((error) => {
          console.error('Failed to refresh session:', error);
          // If refresh fails, clear session and redirect to login
          clearSessionAndRedirect();
        });
      }
    }
  }, [loading, isAuthenticated, user, router, refreshSession, clearSessionAndRedirect]);

  if (loading) {
    console.log('Dashboard Layout - Loading state');
    return <div>Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    console.log('Dashboard Layout - Not authenticated or missing user data');
    return null;
  }

  console.log('Dashboard Layout - Rendering authenticated content for user:', user.email);
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
