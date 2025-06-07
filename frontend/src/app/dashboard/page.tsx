'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  lastUpdated: string;
  progress: number;
  status?: string;
}

const DEMO_PROJECTS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Demo Geosynthetic Project',
    client: 'Demo Client',
    location: 'Denver, CO',
    lastUpdated: '2025-06-04',
    progress: 25,
  },
];

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quality Control Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Monitor your geosynthetic projects, track quality control metrics, and manage panel layouts efficiently.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <div className="text-2xl">📊</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">Currently ongoing projects</p>
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/projects">View All</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Tests</CardTitle>
            <div className="text-2xl">✅</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">Completed this month</p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{width: '78%'}}></div>
              </div>
            </div>
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/qc-data">View Data</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Panel Layouts</CardTitle>
            <div className="text-2xl">🎯</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">Optimized designs created</p>
            <div className="mt-3">
              <Button asChild className="bg-orange-600 hover:bg-orange-700" size="sm">
                <Link href="/dashboard/panel-layout">Create Layout</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <div className="text-2xl">📄</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">Reports and specifications</p>
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/documents">Browse Files</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-500">
                      {project.client} • {project.location} • Updated {new Date(project.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{project.progress}% Complete</div>
                    <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="pt-4">
                <Button asChild>
                  <Link href="/dashboard/projects">View All Projects</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}