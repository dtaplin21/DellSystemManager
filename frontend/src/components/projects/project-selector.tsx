'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, FolderOpen, Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useProjects } from '@/contexts/ProjectsProvider';

interface ProjectSelectorProps {
  onProjectSelect: (project: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectSelector({ onProjectSelect, isOpen, onClose }: ProjectSelectorProps) {
  const { user, isAuthenticated } = useSupabaseAuth();
  const { projects, selectProject, isLoading, error } = useProjects();
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const handleProjectSelect = async (project: any) => {
    if (!isAuthenticated) return;

    try {
      await selectProject(project.id);
      onProjectSelect(project);
      onClose();
    } catch (err) {
      console.error('Error selecting project:', err);
    }
  };

  const handleCreateProject = async () => {
    if (!isAuthenticated || !newProjectName.trim()) return;

    setCreatingProject(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: '',
          location: '',
          status: 'active',
          progress: 0
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      setNewProjectName('');
      setShowCreateForm(false);
      
      // Automatically select the new project
      await handleProjectSelect(newProject);
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setCreatingProject(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-25 z-50" />
        <Dialog.Content className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
              <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
                Choose Project
              </Dialog.Title>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {!showCreateForm ? (
                <>
                  <div className="mb-4">
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Project
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {isLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Loading projects...</p>
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="text-center py-8">
                        <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No projects found</p>
                        <p className="text-xs text-gray-400">Create your first project to get started</p>
                      </div>
                    ) : (
                      projects
                        .filter(project => project.status === 'active')
                        .map((project) => (
                          <button
                            key={project.id}
                            onClick={() => handleProjectSelect(project)}
                            disabled={isLoading}
                            className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {project.name}
                                </h4>
                                {project.description && (
                                  <p className="text-xs text-gray-500 truncate mt-1">
                                    {project.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  Updated {formatDate(project.updated_at)}
                                </p>
                              </div>
                              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      id="project-name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Enter project name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={creatingProject}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      disabled={creatingProject}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim() || creatingProject}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {creatingProject ? 'Creating...' : 'Create Project'}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
} 