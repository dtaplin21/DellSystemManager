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
  }, []); // Empty dependency array since we only want to run this once

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

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8 border-b border-navy-200 pb-4">
        <h1 className="text-3xl font-bold text-navy-800">Projects</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-orange-600 hover:bg-orange-700 text-white border-2 border-orange-600 hover:border-orange-700 px-6 py-2 rounded-md shadow-md transition-all hover:shadow-lg transform hover:scale-105"
              size="lg"
            >
              Create New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl text-navy-800">Create New Project</DialogTitle>
              <DialogDescription className="text-navy-600 mt-2">
                Enter the details for your new geosynthetic project.
              </DialogDescription>
            </DialogHeader>
            <ProjectForm onProjectCreated={handleProjectCreated} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-gray-200 shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-navy-700 to-navy-800 text-white py-6">
          <CardTitle className="text-2xl font-bold">All Projects</CardTitle>
          <CardDescription className="text-gray-200 mt-2">Manage all your geosynthetic projects</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              }
              action={{
                label: "Create Your First Project",
                onClick: openCreateDialog
              }}
            />
          )}
        </CardContent>
      </Card>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-orange-500">
          <h3 className="text-xl font-semibold text-navy-800 mb-3">Project Management</h3>
          <p className="text-navy-600 mb-4">Create, organize, and manage your geosynthetic liner projects in one place.</p>
          <div className="bg-orange-50 p-3 rounded-md text-orange-800 text-sm">
            <span className="font-medium">PRO TIP:</span> Use project templates to quickly set up common configurations.
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-navy-500">
          <h3 className="text-xl font-semibold text-navy-800 mb-3">Quality Control</h3>
          <p className="text-navy-600 mb-4">Track and manage all quality control data for your installation projects.</p>
          <div className="bg-navy-50 p-3 rounded-md text-navy-800 text-sm">
            <span className="font-medium">PRO TIP:</span> Set up automated QC reports to keep stakeholders informed.
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
          <h3 className="text-xl font-semibold text-navy-800 mb-3">Panel Layout</h3>
          <p className="text-navy-600 mb-4">Design and visualize your geosynthetic panel layouts with precision.</p>
          <div className="bg-green-50 p-3 rounded-md text-green-800 text-sm">
            <span className="font-medium">PRO TIP:</span> Export your layouts to CAD for detailed engineering work.
          </div>
        </div>
      </div>
    </div>
  );
}
