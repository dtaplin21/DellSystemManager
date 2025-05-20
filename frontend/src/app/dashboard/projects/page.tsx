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
      <div className="border-b border-navy-200 pb-4 mb-8">
        <h1 className="text-3xl font-bold text-navy-800">Projects</h1>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : projects.length > 0 ? (
          <>
            {projects.map((project) => (
              <div key={project.id} className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-3/4 p-6">
                    <div className="flex items-center mb-4">
                      <h3 className="text-2xl font-bold text-navy-800">{project.name}</h3>
                      <span className={`ml-4 px-3 py-1 text-sm font-medium rounded-full ${
                        project.status === 'Active' 
                          ? 'bg-green-100 text-green-800 border border-green-500' 
                          : project.status === 'Completed'
                          ? 'bg-blue-100 text-blue-800 border border-blue-500'
                          : 'bg-orange-100 text-orange-800 border border-orange-500'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    
                    <div className="mb-6">
                      <p className="text-navy-600">
                        Last Updated: {new Date(project.lastUpdated).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                      <a href={`/dashboard/projects/${project.id}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-navy-600 text-white border-2 border-navy-600 hover:bg-navy-700 hover:border-navy-700 transition-colors shadow">
                        View Details
                      </a>
                      <a href={`/dashboard/projects/${project.id}/panel-layout`} className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-white text-orange-600 border-2 border-orange-600 hover:bg-orange-50 transition-colors shadow">
                        Panel Layout
                      </a>
                      <a href={`/dashboard/projects/${project.id}/documents`} className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-white text-navy-600 border-2 border-navy-600 hover:bg-navy-50 transition-colors shadow">
                        Documents
                      </a>
                    </div>
                  </div>
                  
                  <div className="md:w-1/4 bg-gray-50 p-6 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col justify-center">
                    <div className="mb-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-navy-700">Progress</span>
                        <span className="text-sm font-medium text-navy-700">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${
                            project.progress < 30 ? 'bg-orange-500' : 
                            project.progress < 70 ? 'bg-blue-500' : 
                            'bg-green-500'
                          }`}
                          style={{ width: `${project.progress}%` }}>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-navy-600">
                      <div className="flex items-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>3 documents</span>
                      </div>
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span>5 comments</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-orange-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-xl font-bold text-navy-800 mb-2">No Projects Available</h3>
            <p className="text-navy-600 mb-6">There are currently no geosynthetic projects in the system.</p>
          </div>
        )}
      </div>
    </div>
  );
}
