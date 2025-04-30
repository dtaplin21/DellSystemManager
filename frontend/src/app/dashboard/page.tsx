'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusSummary from '@/components/dashboard/status-summary';
import ProjectCard from '@/components/dashboard/project-card';
import NotificationList from '@/components/dashboard/notification-list';
import AIDashboard from '@/components/dashboard/ai-dashboard';
import AIServiceStatus from '@/components/shared/ai-service-status';
import { useToast } from '@/hooks/use-toast';
import { fetchProjects } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  status: string;
  lastUpdated: string;
  progress: number;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button>New Project</Button>
      </div>
      
      <AIServiceStatus />
      
      <StatusSummary />
      
      <Card>
        <CardHeader>
          <CardTitle>AI Automation</CardTitle>
          <CardDescription>Let AI handle repetitive tasks and data analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <AIDashboard />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>View and manage your recent projects</CardDescription>
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

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Recent updates and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationList />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
