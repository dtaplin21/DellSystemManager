'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Navbar from '@/components/layout/navbar';
import Sidebar from '@/components/layout/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Temporarily using standalone layout for dashboard page
  // to preserve original working CSS styling
  
  return (
    <div>
      {children}
    </div>
  );
}
