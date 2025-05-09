'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';

// Mock project data for demonstration
const DEMO_PROJECTS = [
  {
    id: '1',
    name: 'Landfill Cell 4 Expansion',
    client: 'Metro Waste Management',
    location: 'Northfield, MN',
    lastUpdated: '2025-05-01',
    progress: 68,
  },
  {
    id: '2',
    name: 'Industrial Retention Pond',
    client: 'Ace Manufacturing',
    location: 'Detroit, MI',
    lastUpdated: '2025-04-28',
    progress: 32,
  },
  {
    id: '3',
    name: 'Wastewater Treatment Lining',
    client: 'PureWater Inc.',
    location: 'Tampa, FL',
    lastUpdated: '2025-05-03',
    progress: 94,
  },
];

export default function Dashboard() {
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication state
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    
    // Simulate fetching projects from API
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
      router.push('/');
    } catch (error) {
      toast({
        title: 'Logout failed',
        description: 'There was an error logging out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">GeoQC</h1>
              <nav className="ml-10 space-x-4">
                <a href="#" className="text-gray-900 font-medium">Dashboard</a>
                <a href="#" className="text-gray-500 hover:text-gray-900">Projects</a>
                <a href="#" className="text-gray-500 hover:text-gray-900">Reports</a>
                <a href="#" className="text-gray-500 hover:text-gray-900">Settings</a>
              </nav>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-700">
                {user?.email}
              </span>
              <Button variant="ghost" onClick={handleLogout}>Logout</Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Your Projects</h2>
          <Button>New Project</Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription>{project.client}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Location:</span>
                      <span className="font-medium">{project.location}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Last Updated:</span>
                      <span className="font-medium">{project.lastUpdated}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Progress:</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          
          {/* Add New Project Card */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-dashed border-2 border-gray-300 bg-gray-50">
            <CardContent className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">Create New Project</p>
                <p className="text-gray-500 text-sm mt-1">Add a new geosynthetic project</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent QC Data</CardTitle>
              <CardDescription>Latest quality control measurements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <div>
                    <div className="font-medium">Seam Strength Test #42</div>
                    <div className="text-sm text-gray-500">Landfill Cell 4 Expansion</div>
                  </div>
                  <div className="text-green-600 font-medium">PASS</div>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <div>
                    <div className="font-medium">Thickness Verification #18</div>
                    <div className="text-sm text-gray-500">Industrial Retention Pond</div>
                  </div>
                  <div className="text-green-600 font-medium">PASS</div>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <div>
                    <div className="font-medium">Weld Inspection #97</div>
                    <div className="text-sm text-gray-500">Wastewater Treatment Lining</div>
                  </div>
                  <div className="text-amber-600 font-medium">WARNING</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>Recent updates across all your projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">New QC document uploaded</p>
                    <p className="text-sm text-gray-500">Sarah uploaded test results for Panel #28</p>
                    <p className="text-xs text-gray-400 mt-1">Today at 9:42 AM</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Panel installation completed</p>
                    <p className="text-sm text-gray-500">Field team completed installation of north-west section</p>
                    <p className="text-xs text-gray-400 mt-1">Yesterday at 4:30 PM</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">QC test flagged for review</p>
                    <p className="text-sm text-gray-500">Anomaly detected in seam strength test</p>
                    <p className="text-xs text-gray-400 mt-1">May 2, 2025</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}