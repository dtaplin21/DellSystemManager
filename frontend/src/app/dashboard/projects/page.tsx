'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ProjectCard from '@/components/dashboard/project-card';
import ProjectForm from '@/components/projects/project-form';
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
        const data = await fetchProjects();
        setProjects(data);
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
            <div className="text-center py-8 text-gray-500">
              No projects found. Create your first project to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
