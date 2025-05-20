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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New Project</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter the details for your new geosynthetic project.
              </DialogDescription>
            </DialogHeader>
            <ProjectForm onProjectCreated={handleProjectCreated} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>Manage all your geosynthetic projects</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Projects Yet"
              description="You haven't created any geosynthetic QC projects yet. Projects help you organize your quality control data, documents, and panel layouts."
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </div>
  );
}
