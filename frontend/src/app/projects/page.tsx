'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SimpleCreateForm from '@/components/projects/simple-create-form';

// Simple mock data for demonstration
const mockProjects = [
  {
    id: '1',
    name: 'Highway 101 Overpass',
    status: 'Active',
    lastUpdated: '2025-04-20T10:30:00Z',
    progress: 65,
    client: 'CalTrans',
    location: 'San Francisco, CA'
  },
  {
    id: '2',
    name: 'Riverside Mall Development',
    status: 'On Hold',
    lastUpdated: '2025-04-18T16:45:00Z',
    progress: 35,
    client: 'Cedar Development Group',
    location: 'Riverside, CA'
  },
  {
    id: '3',
    name: 'Mountain Creek Landfill',
    status: 'Completed',
    lastUpdated: '2025-04-15T14:20:00Z',
    progress: 100,
    client: 'EcoWaste Solutions',
    location: 'Boulder, CO'
  }
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState(mockProjects);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Handle creating new project
  const handleCreateProject = (data: any) => {
    const project = {
      id: (projects.length + 1).toString(),
      name: data.name,
      client: data.client,
      location: data.location,
      status: data.status,
      progress: data.progress,
      lastUpdated: data.startDate || new Date().toISOString()
    };

    setProjects([project, ...projects]);
    setShowCreateModal(false);
  };

  // Simple status color function
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 border-green-500 text-green-800';
      case 'completed':
        return 'bg-blue-100 border-blue-500 text-blue-800';
      case 'on hold':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'delayed':
        return 'bg-red-100 border-red-500 text-red-800';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setShowCreateModal(true)}
        >
          + New Project
        </Button>
      </div>

      {/* Create Project Modal */}
      <SimpleCreateForm
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white shadow-md border-t-4 border-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projects.length}</div>
            <p className="text-gray-500 mt-2">Projects in system</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white shadow-md border-t-4 border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {projects.filter(p => p.status.toLowerCase() === 'active').length}
            </div>
            <p className="text-gray-500 mt-2">Currently in progress</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white shadow-md border-t-4 border-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {projects.filter(p => p.status.toLowerCase() === 'completed').length}
            </div>
            <p className="text-gray-500 mt-2">Successfully finished</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Project List</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">Name</th>
                <th className="py-3 px-6 text-left">Client</th>
                <th className="py-3 px-6 text-left">Location</th>
                <th className="py-3 px-6 text-left">Status</th>
                <th className="py-3 px-6 text-left">Progress</th>
                <th className="py-3 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm">
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-6 text-left whitespace-nowrap font-medium">
                    {project.name}
                  </td>
                  <td className="py-3 px-6 text-left">
                    {project.client}
                  </td>
                  <td className="py-3 px-6 text-left">
                    {project.location}
                  </td>
                  <td className="py-3 px-6 text-left">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-left">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${project.progress}%` }}></div>
                    </div>
                    <span className="text-xs">{project.progress}%</span>
                  </td>
                  <td className="py-3 px-6 text-center">
                    <Button size="sm" variant="outline" className="mr-2">
                      View
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500 border-red-500">
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}