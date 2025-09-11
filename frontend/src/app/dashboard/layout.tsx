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
  const isRefreshing = useRef(false);

  useEffect(() => {
    console.log('Dashboard Layout - Current State:', {
      user,
      isAuthenticated,
      loading,
      hasRefreshed: hasRefreshed.current,
      isRefreshing: isRefreshing.current,
    });
    
    if (loading) return;

    if (!isAuthenticated || !user) {
      console.log('User not authenticated or missing user data, redirecting to login');
      router.replace('/login');
      return;
    }

    // Only refresh session once per mount and prevent concurrent refreshes
    if (!hasRefreshed.current && !isRefreshing.current) {
      console.log('User authenticated, refreshing session...');
      hasRefreshed.current = true;
      isRefreshing.current = true;
      
      refreshSession()
        .then((session) => {
          isRefreshing.current = false;
          if (session) {
            console.log('✅ Dashboard: Session refreshed successfully');
          } else {
            console.error('❌ Dashboard: Session refresh failed');
            clearSessionAndRedirect();
          }
        })
        .catch((error) => {
          isRefreshing.current = false;
          console.error('❌ Dashboard: Failed to refresh session:', error);
          clearSessionAndRedirect();
        });
    }
  }, [loading, isAuthenticated, user, refreshSession, clearSessionAndRedirect, router]);

  if (loading || isRefreshing.current) {
    console.log('Dashboard Layout - Loading state', {
      loading,
      isRefreshing: isRefreshing.current,
      user,
      isAuthenticated
    });
    return (
      <div className="p-4">
        <div className="bg-yellow-100 p-4 rounded">
          <h3 className="font-bold">Debug Loading State:</h3>
          <p>loading: {loading ? 'true' : 'false'}</p>
          <p>isRefreshing: {isRefreshing.current ? 'true' : 'false'}</p>
          <p>user: {user ? 'present' : 'null'}</p>
          <p>isAuthenticated: {isAuthenticated ? 'true' : 'false'}</p>
        </div>
        <div className="mt-4">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    console.log('Dashboard Layout - Not authenticated or missing user data');
    return null;
  }

  console.log('Dashboard Layout - Rendering authenticated content for user:', user.email);
  return (
    <div className="h-screen overflow-x-hidden flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
