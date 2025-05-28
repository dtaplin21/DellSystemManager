'use client';

import { useState, useEffect } from 'react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // Simulate loading projects from API
    setTimeout(() => {
      const mockProjects = [
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
        },
        {
          id: '4',
          name: 'Westlake Industrial Pond',
          client: 'Westlake Industries',
          status: 'Delayed',
          location: 'Westlake, MI',
          lastUpdated: '2025-03-22',
          progress: 30
        },
        {
          id: '5',
          name: 'Central City Treatment Plant',
          client: 'Central Municipal Authority',
          status: 'Active',
          location: 'Central City, NY',
          lastUpdated: '2025-05-18',
          progress: 60
        }
      ];
      
      setProjects(mockProjects);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleUpdateProject = (updatedProject) => {
    setProjects(projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    ));
    setEditingProject(null);
    
    toast({
      title: 'Project Updated',
      description: `${updatedProject.name} has been updated successfully.`,
    });
  };

  const handleCreateProject = (data) => {
    const newProject = {
      id: (projects.length + 1).toString(),
      name: data.name,
      client: data.client,
      location: data.location,
      status: data.status || 'Active',
      progress: data.progress || 0,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setProjects([newProject, ...projects]);
    setShowCreateModal(false);
    
    toast({
      title: 'Project Created',
      description: `${data.name} has been created successfully.`,
    });
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="border-b border-navy-200 pb-4 mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-navy-800">Projects</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          + New Project
        </button>
      </div>
      
      {/* Create Project Modal */}
      <SimpleCreateForm
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />

      {/* Edit Project Modal */}
      {editingProject && (
        <EditForm 
          project={editingProject}
          onSave={handleUpdateProject}
          onCancel={() => setEditingProject(null)}
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="flex justify-center py-12 col-span-full">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : projects.length > 0 ? (
          <>
            {projects.map((project) => (
              <div key={project.id} className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
                <div className="p-5 flex items-center gap-2 border-b border-gray-100">
                  <h3 className="text-xl font-bold text-navy-800 truncate flex-grow">{project.name}</h3>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full flex-shrink-0 ${
                    project.status === 'Active' 
                      ? 'bg-green-100 text-green-800 border border-green-500' 
                      : project.status === 'Completed'
                      ? 'bg-blue-100 text-blue-800 border border-blue-500'
                      : project.status === 'On Hold'
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-500'
                      : project.status === 'Delayed'
                      ? 'bg-red-100 text-red-800 border border-red-500'
                      : 'bg-orange-100 text-orange-800 border border-orange-500'
                  }`}>
                    {project.status}
                  </span>
                </div>
                
                <div className="p-5 flex-grow">
                  <div className="mb-4">
                    <p className="text-navy-600 text-sm">
                      <span className="font-medium">Client:</span> {project.client}
                    </p>
                    <p className="text-navy-600 text-sm">
                      <span className="font-medium">Location:</span> {project.location}
                    </p>
                    <p className="text-navy-600 text-sm">
                      Last Updated: {new Date(project.lastUpdated).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  <div className="mb-4">
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
                  
                  <div className="flex flex-wrap gap-2 text-sm text-navy-600 mb-4">
                    <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>3 docs</span>
                    </div>
                    <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <span>5 comments</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 justify-between">
                  <div className="flex gap-2">
                    <a href={`/dashboard/projects/${project.id}`} className="inline-flex items-center justify-center rounded-md text-xs font-medium px-3 py-1.5 bg-navy-600 text-white hover:bg-navy-700 transition-colors">
                      View
                    </a>
                    <a href={`/dashboard/projects/${project.id}/panel-layout`} className="inline-flex items-center justify-center rounded-md text-xs font-medium px-3 py-1.5 bg-white text-orange-600 border border-orange-600 hover:bg-orange-50 transition-colors">
                      Layout
                    </a>
                  </div>
                  <button 
                    onClick={() => setEditingProject(project)}
                    className="inline-flex items-center justify-center rounded-md text-xs font-medium px-3 py-1.5 bg-white text-navy-600 border border-navy-200 hover:bg-navy-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 0L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="ml-1">Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center col-span-full">
            <h3 className="text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
          </div>
        )}
      </div>
    </div>
  );
}