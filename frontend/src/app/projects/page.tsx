'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectsRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the dashboard/projects page
    console.log('Projects page: Redirecting to /dashboard/projects');
    
    // Use a timeout to ensure the navigation happens after the component is fully mounted
    const redirectTimer = setTimeout(() => {
      router.push('/dashboard/projects');
    }, 100);
    
    return () => clearTimeout(redirectTimer);
  }, [router]);
  
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-semibold">Redirecting to Projects Page...</h2>
        <p className="text-gray-500 mt-2">Please wait while we redirect you to the Projects dashboard</p>
      </div>
    </div>
  );
}