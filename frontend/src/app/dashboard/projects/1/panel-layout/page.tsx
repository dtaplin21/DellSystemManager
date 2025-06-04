'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectPanelLayoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect old numeric ID to correct UUID for panel layout
    router.replace('/dashboard/projects/00000000-0000-0000-0000-000000000001/panel-layout');
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Redirecting to panel layout...</p>
      </div>
    </div>
  );
}