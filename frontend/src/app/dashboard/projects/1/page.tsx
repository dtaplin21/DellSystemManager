'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  client: string;
  location: string;
  startDate: string;
  endDate: string;
  area: number;
  progress: number;
}

export default function ProjectDetailsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoading(true);
        
        // Create sample project for demo
        setProject({
          id: '1',
          name: 'Lakeview Containment Facility',
          description: 'Geosynthetic liner installation for industrial waste containment facility',
          status: 'Active',
          client: 'Lakeview Industries',
          location: 'Portland, OR',
          startDate: new Date('2025-03-15').toISOString(),
          endDate: new Date('2025-10-30').toISOString(),
          area: 85000,
          progress: 35
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load project details. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
        <p className="text-gray-500 mb-4">The project you're looking for does not exist or you don't have access to it.</p>
        <Link href="/dashboard/projects">
          <Button>Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-gray-500">{project.description}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">Edit Project</Button>
          <Button variant="destructive">Delete Project</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Client</h3>
              <p>{project.client}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Location</h3>
              <p>{project.location}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Start Date</h3>
              <p>{new Date(project.startDate).toLocaleDateString()}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">End Date</h3>
              <p>{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Not set'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Area</h3>
              <p>{project.area.toLocaleString()} sq ft</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <p>{project.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="w-full border-b">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="panels">Panel Layout</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="qc-data">QC Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Status</CardTitle>
                <CardDescription>Current completion status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-blue-600 h-4 rounded-full" 
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{project.progress}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common actions for this project</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/dashboard/projects/${project.id}/panel-layout`}>
                    <Button variant="outline" className="w-full">View Panel Layout</Button>
                  </Link>
                  <Link href={`/dashboard/projects/${project.id}/documents`}>
                    <Button variant="outline" className="w-full">Upload Documents</Button>
                  </Link>
                  <Link href={`/dashboard/projects/${project.id}/qc-data`}>
                    <Button variant="outline" className="w-full">Enter QC Data</Button>
                  </Link>
                  <Button variant="outline" className="w-full">Export Reports</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="panels" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Panel Layout</CardTitle>
              <CardDescription>View and edit panel layouts</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/dashboard/projects/${project.id}/panel-layout`}>
                <Button>Go to Panel Layout</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Manage project documents</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/dashboard/projects/${project.id}/documents`}>
                <Button>View Documents</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="qc-data" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>QC Data</CardTitle>
              <CardDescription>Manage quality control data</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/dashboard/projects/${project.id}/qc-data`}>
                <Button>View QC Data</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}