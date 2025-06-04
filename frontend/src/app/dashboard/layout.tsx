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
  // Allow dashboard access without authentication as per comment
  // Users can access dashboard without login
  
  return (
    <div className="min-h-screen bg-navy-900">
      <div className="bg-orange-600 p-4">
        <h1 className="text-white text-xl font-bold">GeoQC Dashboard</h1>
      </div>
      <div className="flex">
        <div className="w-64 bg-navy-800 min-h-screen p-4">
          <nav className="text-white">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Navigation</h2>
            </div>
            <ul className="space-y-2">
              <li><a href="/dashboard" className="block p-2 bg-navy-700 rounded">Dashboard</a></li>
              <li><a href="/dashboard/projects" className="block p-2 hover:bg-navy-700 rounded">Projects</a></li>
              <li><a href="/dashboard/panel-layout" className="block p-2 hover:bg-navy-700 rounded">Panel Layout</a></li>
            </ul>
          </nav>
        </div>
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
