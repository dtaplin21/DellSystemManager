'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Direct browser redirect without Next.js router
    window.location.href = '/dashboard';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-navy-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-navy-600">Loading dashboard...</p>
      </div>
    </div>
  );
}
