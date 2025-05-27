'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    location: '',
    status: 'Active',
    progress: 0,
    description: ''
  });

  // Handle creating new project
  const handleCreateProject = () => {
    if (!newProject.name || !newProject.client || !newProject.location) {
      alert('Please fill in all required fields');
      return;
    }

    const project = {
      id: (projects.length + 1).toString(),
      name: newProject.name,
      client: newProject.client,
      location: newProject.location,
      status: newProject.status,
      progress: newProject.progress,
      lastUpdated: new Date().toISOString()
    };

    setProjects([...projects, project]);
    setNewProject({
      name: '',
      client: '',
      location: '',
      status: 'Active',
      progress: 0,
      description: ''
    });
    setIsCreateModalOpen(false);
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string | number) => {
    setNewProject(prev => ({ ...prev, [field]: value }));
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
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              + New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900">Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="project-name" className="text-sm font-medium text-gray-700">Project Name *</Label>
                <Input
                  id="project-name"
                  type="text"
                  value={newProject.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter project name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="client" className="text-sm font-medium text-gray-700">Client *</Label>
                <Input
                  id="client"
                  type="text"
                  value={newProject.client}
                  onChange={(e) => handleInputChange('client', e.target.value)}
                  placeholder="Enter client name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="location" className="text-sm font-medium text-gray-700">Location *</Label>
                <Input
                  id="location"
                  type="text"
                  value={newProject.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Enter project location"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="status" className="text-sm font-medium text-gray-700">Status</Label>
                <Select value={newProject.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="progress" className="text-sm font-medium text-gray-700">Initial Progress (%)</Label>
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={newProject.progress}
                  onChange={(e) => handleInputChange('progress', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
                <Textarea
                  id="description"
                  value={newProject.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter project description (optional)"
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateProject}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
              >
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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