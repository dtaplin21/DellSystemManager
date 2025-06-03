'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/use-auth';
import Link from 'next/link';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Automatically redirect to dashboard
  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  // Show loading spinner while redirecting
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-navy-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-navy-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
