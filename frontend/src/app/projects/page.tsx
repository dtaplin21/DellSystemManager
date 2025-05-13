'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectsRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the dashboard/projects page
    router.push('/dashboard/projects');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-semibold">Redirecting to Projects...</h2>
      </div>
    </div>
  );
}