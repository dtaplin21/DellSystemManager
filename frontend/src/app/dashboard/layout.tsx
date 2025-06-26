'use client';

import { useEffect, useRef } from 'react';
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
  const hasRefreshed = useRef(false);

  useEffect(() => {
    console.log('Dashboard Layout - Current State:', {
      user,
      isAuthenticated,
      loading,
    });
    
    if (loading) return;

    if (!isAuthenticated || !user) {
      console.log('User not authenticated or missing user data, redirecting to login');
      router.replace('/login');
      return;
    }

    // Only refresh session once per mount
    if (!hasRefreshed.current) {
      console.log('User authenticated, refreshing session...');
      hasRefreshed.current = true;
      
      refreshSession()
        .then((session) => {
          if (session) {
            console.log('✅ Dashboard: Session refreshed successfully');
          } else {
            console.error('❌ Dashboard: Session refresh failed');
            clearSessionAndRedirect();
          }
        })
        .catch((error) => {
          console.error('Failed to refresh session:', error);
          clearSessionAndRedirect();
        });
    }
  }, [loading, isAuthenticated, user]); // Reduced dependencies

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
