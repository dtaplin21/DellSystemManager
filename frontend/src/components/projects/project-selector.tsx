'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, FolderOpen, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// Check if Supabase environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only create Supabase client if environment variables are available
let supabase: any = null;
if (supabaseUrl && supabaseAnonKey) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase environment variables are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
}

interface Project {
  id: string;
  name: string;
  description?: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectSelectorProps {
  onProjectSelect: (project: Project & { panels: any[] }) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectSelector({ onProjectSelect, isOpen, onClose }: ProjectSelectorProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    if (isOpen && user) {
      fetchProjects();
    }
  }, [isOpen, user]);

  const fetchProjects = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        setError('Supabase is not configured. Please check your environment variables.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session');
        return;
      }

      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const projectsData = await response.json();
      setProjects(projectsData);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = async (project: Project) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        setError('Supabase is not configured. Please check your environment variables.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session');
        return;
      }

      const response = await fetch(`/api/projects/${project.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch project details');
      }

      const projectData = await response.json();
      onProjectSelect(projectData);
      onClose();
    } catch (err) {
      console.error('Error fetching project details:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;

    setCreatingProject(true);
    setError(null);

    try {
      if (!supabase) {
        setError('Supabase is not configured. Please check your environment variables.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session');
        return;
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: '',
          location: '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      setProjects([newProject, ...projects]);
      setNewProjectName('');
      setShowCreateForm(false);
      
      // Automatically select the new project
      await handleProjectSelect(newProject);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project');
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

  // Show configuration error if Supabase is not available
  if (!supabase) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-25 z-50" />
          <Dialog.Content className="fixed inset-0 overflow-y-auto z-50">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Configuration Required
                </Dialog.Title>
                
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    Supabase is not configured. Please add the following environment variables to your <code>.env.local</code> file:
                  </p>
                  <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
                    <p><strong>NEXT_PUBLIC_SUPABASE_URL</strong>=your_supabase_project_url</p>
                    <p><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong>=your_supabase_anon_key</p>
                  </div>
                </div>

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
                    {loading ? (
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
                      projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleProjectSelect(project)}
                          disabled={loading}
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