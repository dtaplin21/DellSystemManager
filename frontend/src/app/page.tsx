'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/use-auth';
import Link from 'next/link';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !isLoading) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4">
        <header className="py-6 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-800">GeoQC</div>
          <div className="space-x-4">
            {!user && !isLoading ? (
              <>
                <Link href="/login">
                  <Button variant="ghost">Log in</Button>
                </Link>
                <Link href="/login?signup=true">
                  <Button>Sign up</Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            )}
          </div>
        </header>

        <main className="py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6 text-gray-900">
              Professional QC Management for Geosynthetic Projects
            </h1>
            <p className="text-xl mb-8 text-gray-600">
              Streamline your quality control workflows with our specialized 2D automation, 
              AI document analysis, and collaborative tools designed for geosynthetic material projects.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/login?signup=true">
                <Button size="lg" className="px-8">Get Started</Button>
              </Link>
              <Button size="lg" variant="outline" className="px-8">
                Learn More
              </Button>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">2D Automation</h2>
              <p className="text-gray-600">
                Interpret panel layouts with precision, collaborate in real-time, and export to AutoCAD-compatible formats.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">AI Document Analysis</h2>
              <p className="text-gray-600">
                Extract data from QC files, get intelligent insights, and identify patterns in test results.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Multi-User Collaboration</h2>
              <p className="text-gray-600">
                Work together in real-time with role-based access controls and live updates.
              </p>
            </div>
          </div>
        </main>

        <footer className="py-8 border-t border-gray-200">
          <div className="text-center text-gray-500">
            &copy; {new Date().getFullYear()} GeoQC. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}
