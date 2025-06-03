'use client';

import Dashboard from './dashboard/page';
import Navbar from '../components/layout/navbar';
import Sidebar from '../components/layout/sidebar';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Dashboard />
        </main>
      </div>
    </div>
  );
}
