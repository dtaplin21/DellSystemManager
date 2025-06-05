'use client';

import { useState } from 'react';
import './projects.css';

interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  status: string;
  progress: number;
  lastUpdated: string;
}

export default function ProjectsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects] = useState<Project[]>([
    {
      id: '1',
      name: 'North Valley Containment',
      client: 'Valley Engineering',
      status: 'Active',
      location: 'North Valley, CA',
      lastUpdated: '2025-05-01',
      progress: 75
    },
    {
      id: '2',
      name: 'Southside Liner Installation',
      client: 'Metro Waste Solutions',
      status: 'On Hold',
      location: 'Southside, TX',
      lastUpdated: '2025-04-15',
      progress: 45
    },
    {
      id: '3',
      name: 'Eastwood Landfill Cover',
      client: 'Eastwood County',
      status: 'Completed',
      location: 'Eastwood, OR',
      lastUpdated: '2025-05-10',
      progress: 100
    }
  ]);

  const handleCreateProject = () => {
    alert('Project creation functionality ready! This will connect to your backend when ready.');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="border-b border-gray-200 pb-4 mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-900">Projects</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          + New Project
        </button>
      </div>
      
      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Create New Project</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateProject(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input 
                  type="text" 
                  placeholder="Enter project name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <input 
                  type="text" 
                  placeholder="Enter client name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input 
                  type="text" 
                  placeholder="Enter project location"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required 
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-5 flex items-center gap-2 border-b border-gray-100">
              <h3 className="text-xl font-bold text-blue-900 truncate flex-grow">{project.name}</h3>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                project.status === 'Active' 
                  ? 'bg-green-100 text-green-800 border border-green-500' 
                  : project.status === 'Completed'
                  ? 'bg-blue-100 text-blue-800 border border-blue-500'
                  : project.status === 'On Hold'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-500'
                  : 'bg-red-100 text-red-800 border border-red-500'
              }`}>
                {project.status}
              </span>
            </div>
            
            <div className="p-5">
              <div className="mb-4">
                <p className="text-gray-600 text-sm">
                  <span className="font-medium">Client:</span> {project.client}
                </p>
                <p className="text-gray-600 text-sm">
                  <span className="font-medium">Location:</span> {project.location}
                </p>
                <p className="text-gray-600 text-sm">
                  Last Updated: {new Date(project.lastUpdated).toLocaleDateString()}
                </p>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm font-medium text-gray-700">{project.progress}%</span>
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
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
              <a href={`/dashboard/projects/${project.id}`} className="flex-1 text-center px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
                View
              </a>
              <a href={`/dashboard/projects/${project.id}/panel-layout`} className="flex-1 text-center px-3 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors">
                Layout
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}