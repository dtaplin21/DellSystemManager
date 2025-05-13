'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ProjectCard from '@/components/dashboard/project-card';
import ProjectForm from '@/components/projects/project-form';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { fetchProjects } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  status: string;
  lastUpdated: string;
  progress: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true);
        
        // For demo purposes, create a sample project
        setProjects([
          {
            id: '1',
            name: 'Lakeview Containment Facility',
            status: 'Active',
            lastUpdated: new Date().toISOString(),
            progress: 35
          }
        ]);
        
        // In production, we would fetch from API:
        // const data = await fetchProjects();
        // setProjects(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load projects. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [toast]);

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev]);
    setDialogOpen(false);
    toast({
      title: 'Project Created',
      description: `${newProject.name} has been created successfully.`,
    });
  };

  const openCreateDialog = () => {
    setDialogOpen(true);
  };

  // Add sample projects to have a more populated UI
  useEffect(() => {
    if (!isLoading && projects.length === 1) {
      // Add more sample projects for a more populated UI
      setProjects([
        {
          id: '1',
          name: 'Lakeview Containment Facility',
          status: 'Active',
          lastUpdated: new Date().toISOString(),
          progress: 35
        },
        {
          id: '2',
          name: 'Riverside Solar Farm Liner',
          status: 'Completed',
          lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          progress: 100
        },
        {
          id: '3',
          name: 'Mountainview Mining Barrier',
          status: 'On Hold',
          lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          progress: 68
        },
        {
          id: '4',
          name: 'Eastside Chemical Plant Liner',
          status: 'Delayed',
          lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          progress: 22
        }
      ]);
    }
  }, [isLoading, projects.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f8fa] to-white">
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header with decorative accent */}
        <div className="relative rounded-xl bg-white p-6 border border-[#dfe1e6] shadow-sm overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0052cc] via-[#00857c] to-[#36b37e]"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#172b4d]">Projects</h1>
              <p className="mt-2 text-[#6b778c]">Manage and track all your geosynthetic engineering projects</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0052cc] hover:bg-[#003d99] text-white shadow transition-all duration-200 transform hover:translate-y-[-2px]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-[#172b4d]">Create New Project</DialogTitle>
                  <DialogDescription className="text-[#6b778c]">
                    Enter the details for your new geosynthetic engineering project.
                  </DialogDescription>
                </DialogHeader>
                <ProjectForm onProjectCreated={handleProjectCreated} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Project Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white border border-[#dfe1e6] rounded-xl overflow-hidden shadow-sm transform transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]">
            <div className="h-1 w-full bg-[#0052cc]"></div>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#6b778c] font-medium">Total Projects</h3>
                <div className="w-12 h-12 rounded-lg bg-[#0052cc] flex items-center justify-center text-white shadow-sm">
                  📊
                </div>
              </div>
              <div className="text-3xl font-bold text-[#172b4d]">{projects.length}</div>
              <p className="text-[#6b778c] mt-2 text-sm">Projects in system</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-[#dfe1e6] rounded-xl overflow-hidden shadow-sm transform transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]">
            <div className="h-1 w-full bg-[#36b37e]"></div>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#6b778c] font-medium">Active Projects</h3>
                <div className="w-12 h-12 rounded-lg bg-[#36b37e] flex items-center justify-center text-white shadow-sm">
                  ▶️
                </div>
              </div>
              <div className="text-3xl font-bold text-[#172b4d]">
                {projects.filter(p => p.status.toLowerCase() === 'active').length}
              </div>
              <p className="text-[#6b778c] mt-2 text-sm">Currently in progress</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-[#dfe1e6] rounded-xl overflow-hidden shadow-sm transform transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]">
            <div className="h-1 w-full bg-[#00857c]"></div>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#6b778c] font-medium">Completed</h3>
                <div className="w-12 h-12 rounded-lg bg-[#00857c] flex items-center justify-center text-white shadow-sm">
                  ✅
                </div>
              </div>
              <div className="text-3xl font-bold text-[#172b4d]">
                {projects.filter(p => p.status.toLowerCase() === 'completed').length}
              </div>
              <p className="text-[#6b778c] mt-2 text-sm">Successfully finished</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-[#dfe1e6] rounded-xl overflow-hidden shadow-sm transform transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]">
            <div className="h-1 w-full bg-[#ff5630]"></div>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#6b778c] font-medium">Needs Attention</h3>
                <div className="w-12 h-12 rounded-lg bg-[#ff5630] flex items-center justify-center text-white shadow-sm">
                  ⚠️
                </div>
              </div>
              <div className="text-3xl font-bold text-[#172b4d]">
                {projects.filter(p => ['delayed', 'on hold'].includes(p.status.toLowerCase())).length}
              </div>
              <p className="text-[#6b778c] mt-2 text-sm">Require follow-up</p>
            </CardContent>
          </Card>
        </div>

        {/* Project List */}
        <Card className="bg-white border border-[#dfe1e6] rounded-xl overflow-hidden shadow-sm">
          <CardHeader className="border-b border-[#dfe1e6] bg-[#f9fafc] p-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold text-[#172b4d]">All Projects</CardTitle>
                <CardDescription className="text-[#6b778c]">Manage all your geosynthetic engineering projects</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-[#6b778c] border-[#dfe1e6] hover:bg-[#f5f8fa] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  Sort
                </Button>
                <Button variant="outline" className="text-[#6b778c] border-[#dfe1e6] hover:bg-[#f5f8fa] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-[#fcfcfc]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-[#0052cc] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[#6b778c]">Loading your projects...</p>
              </div>
            ) : projects.length > 0 ? (
              <div className="space-y-6">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No Projects Yet"
                description="You haven't created any geosynthetic QC projects yet. Projects help you organize your quality control data, documents, and panel layouts."
                icon={
                  <div className="w-16 h-16 rounded-full bg-[#f5f8fa] flex items-center justify-center text-[#0052cc]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                }
                action={{
                  label: "Create Your First Project",
                  onClick: openCreateDialog
                }}
              />
            )}
          </CardContent>
        </Card>
        
        {/* Footer */}
        <div className="text-center text-[#6b778c] text-sm p-4 border-t border-[#dfe1e6] mt-8">
          <p>© 2025 GeoSynth QC Pro. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}