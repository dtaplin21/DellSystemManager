'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import EditProjectForm from '../../components/projects/edit-project-form';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';

// Define proper types for our projects
interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  lastUpdated: string;
  progress: number;
  status?: string;
}

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
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Simulate fetching projects from API
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  }, []);

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
  
  // Handle project editing
  const handleProjectUpdate = (updatedProject: Project): void => {
    setProjects(projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    ));
    setShowEditModal(false);
    setSelectedProject(null);
    
    toast({
      title: 'Project Updated',
      description: `${updatedProject.name} has been updated successfully.`,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-50 to-white">
      {/* Simpler Edit Project Form */}
      {showEditModal && selectedProject && (
        <EditProjectForm 
          project={selectedProject}
          onUpdate={(updatedProject) => handleProjectUpdate(updatedProject as Project)}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedProject(null);
          }}
        />
      )}
      
      <header className="py-6 border-b border-orange-200 bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-navy-800">GeoQC</h1>
              <nav className="ml-10 space-x-4">
                <Link href="/dashboard" className="text-navy-800 font-medium">Dashboard</Link>
                <Link href="/dashboard/projects" className="text-gray-700 hover:text-orange-600">Projects</Link>
                <Link href="/dashboard/documents" className="text-gray-700 hover:text-orange-600">Documents</Link>
                <Link href="/dashboard/settings" className="text-gray-700 hover:text-orange-600">Settings</Link>
              </nav>
            </div>
            <div className="flex items-center space-x-3">
              {user ? (
                <>
                  <span className="text-sm text-gray-700">{user.email}</span>
                  <Button variant="outline" onClick={handleLogout} className="border-orange-500 text-orange-600 hover:bg-orange-50">
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">Log in</Button>
                  </Link>
                  <Link href="/signup">
                    <Button className="bg-navy-700 hover:bg-navy-800 text-white">Sign up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-bold mb-6 text-navy-900">
            Welcome to Your GeoQC Dashboard
          </h1>
          <p className="text-xl mb-8 text-navy-600">
            Manage your geosynthetic projects with our specialized tools for quality control, 
            document analysis, and collaborative workflows.
          </p>
        </div>
        
        <div className="mb-12 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-navy-800">Your Projects</h2>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 shadow-sm px-6">
            New Project
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow border border-orange-200 bg-white p-1">
              <CardHeader className="pb-2 border-b border-orange-100">
                <CardTitle className="text-lg text-navy-800">{project.name}</CardTitle>
                <CardDescription className="text-navy-600">{project.client}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-navy-500">Location:</span>
                    <span className="font-medium text-navy-700">{project.location}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-navy-500">Last Updated:</span>
                    <span className="font-medium text-navy-700">{project.lastUpdated}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-navy-500">Progress:</span>
                      <span className="font-medium text-navy-700">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-navy-100 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full" 
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 mt-2 border-t border-orange-100">
                    <Link href={`/projects/${project.id}`} className="text-navy-600 hover:text-navy-800 font-medium text-sm">
                      View Details
                    </Link>
                    <button 
                      onClick={() => {
                        setSelectedProject(project);
                        setShowEditModal(true);
                      }}
                      className="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Add New Project Card */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-dashed border-2 border-orange-300 bg-orange-50 p-1">
            <CardContent className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-navy-800 font-medium">Create New Project</p>
                <p className="text-orange-600 text-sm mt-1">Add a new geosynthetic project</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-orange-200">
            <h2 className="text-xl font-semibold mb-4 text-navy-800">2D Automation</h2>
            <p className="text-navy-600">
              Interpret panel layouts with precision, collaborate in real-time, and export to AutoCAD-compatible formats.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-orange-200">
            <h2 className="text-xl font-semibold mb-4 text-navy-800">AI Document Analysis</h2>
            <p className="text-navy-600">
              Extract data from QC files, get intelligent insights, and identify patterns in test results.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-orange-200">
            <h2 className="text-xl font-semibold mb-4 text-navy-800">Multi-User Collaboration</h2>
            <p className="text-navy-600">
              Work together in real-time with role-based access controls and live updates.
            </p>
          </div>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border border-orange-200 shadow-md p-1">
            <CardHeader className="border-b border-orange-100">
              <CardTitle className="text-navy-800">Recent QC Data</CardTitle>
              <CardDescription className="text-navy-600">Latest quality control measurements</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-orange-100">
                  <div>
                    <div className="font-medium text-navy-700">Seam Strength Test #42</div>
                    <div className="text-sm text-navy-500">Landfill Cell 4 Expansion</div>
                  </div>
                  <div className="text-green-600 font-medium">PASS</div>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-orange-100">
                  <div>
                    <div className="font-medium text-navy-700">Thickness Verification #18</div>
                    <div className="text-sm text-navy-500">Industrial Retention Pond</div>
                  </div>
                  <div className="text-green-600 font-medium">PASS</div>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-orange-100">
                  <div>
                    <div className="font-medium text-navy-700">Weld Inspection #97</div>
                    <div className="text-sm text-navy-500">Wastewater Treatment Lining</div>
                  </div>
                  <div className="text-orange-600 font-medium">WARNING</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-orange-200 shadow-md p-1">
            <CardHeader className="border-b border-orange-100">
              <CardTitle className="text-navy-800">Activity Feed</CardTitle>
              <CardDescription className="text-navy-600">Recent updates across all your projects</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-navy-700">New QC document uploaded</p>
                    <p className="text-sm text-navy-500">Sarah uploaded test results for Panel #28</p>
                    <p className="text-xs text-navy-400 mt-1">Today at 9:42 AM</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-navy-700">Panel installation completed</p>
                    <p className="text-sm text-navy-500">Field team completed installation of north-west section</p>
                    <p className="text-xs text-navy-400 mt-1">Yesterday at 4:30 PM</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-navy-700">QC test flagged for review</p>
                    <p className="text-sm text-navy-500">Anomaly detected in seam strength test</p>
                    <p className="text-xs text-navy-400 mt-1">May 2, 2025</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <footer className="py-8 mt-16 border-t border-orange-200">
          <div className="text-center text-navy-500">
            &copy; {new Date().getFullYear()} GeoQC. All rights reserved.
          </div>
        </footer>
      </main>
    </div>
  );
}