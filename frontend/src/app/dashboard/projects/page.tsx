'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../../../hooks/use-supabase-auth';
import { useToast } from '../../../hooks/use-toast';
import { fetchProjects, createProject, deleteProject } from '../../../lib/api';
import './projects.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const { user, isAuthenticated } = useSupabaseAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    location: '',
    description: '',
    status: 'Active',
    progress: 0
  });

  useEffect(() => {
    const loadProjects = async () => {
      if (!isAuthenticated) return;
      
      try {
        const data = await fetchProjects();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to fetch projects',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [isAuthenticated, toast]);

  const handleProjectSelect = (projectId: string) => {
    if (projectId) {
      router.push(`/dashboard/projects/${projectId}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newProject = await createProject(formData);
      setProjects(prev => [...prev, newProject]);
      setShowCreateModal(false);
      setFormData({
        name: '',
        client: '',
        location: '',
        description: '',
        status: 'Active',
        progress: 0
      });
      toast({
        title: 'Success',
        description: 'Project created successfully!',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create project',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      
      // Remove the project from the local state
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setShowDeleteModal(false);
      setProjectToDelete(null);
      toast({
        title: 'Success',
        description: 'Project deleted successfully!',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      
      // Extract detailed error information
      let errorMessage = 'Failed to delete project';
      let errorTitle = 'Error';
      
      if (error instanceof Error) {
        // Check if error has errorData property (from our API function)
        const errorData = (error as any).errorData;
        
        if (errorData) {
          errorMessage = errorData.message || errorMessage;
          if (errorData.step) {
            errorTitle = `Error deleting ${errorData.step}`;
            if (errorData.details) {
              errorMessage += `\n\nDetails: ${errorData.details}`;
            }
            if (errorData.constraint) {
              errorMessage += `\n\nConstraint: ${errorData.constraint}`;
            }
            if (errorData.table) {
              errorMessage += `\n\nTable: ${errorData.table}`;
            }
          } else if (errorData.details) {
            errorMessage = `${errorData.message || errorMessage}\n\nDetails: ${errorData.details}`;
          }
        } else {
          // Fallback to error message
          errorMessage = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 5000 // Show for 5 seconds to allow reading detailed messages
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setProjectToDelete(null);
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'project-status status-active';
      case 'completed': return 'project-status status-completed';
      case 'on hold': return 'project-status status-on-hold';
      default: return 'project-status status-delayed';
    }
  };

  const getProgressClass = (progress: number) => {
    if (progress < 30) return 'progress-fill progress-low';
    if (progress < 70) return 'progress-fill progress-medium';
    return 'progress-fill progress-high';
  };

  return (
    <div className="projects-page">
      <div className="projects-container">
        <div className="projects-header">
          <h1 className="projects-title">Projects</h1>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-create"
          >
            + New Project
          </button>
        </div>
        
        {/* Project Selector Dropdown */}
        {!isLoading && projects.length > 0 && (
          <div className="project-selector-container">
            <label htmlFor="project-select" className="project-select-label">Quick Select</label>
            <select
              id="project-select"
              className="project-select"
              onChange={(e) => handleProjectSelect(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Select a project to view</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">Create New Project</h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateProject}>
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter project name"
                    className="form-input"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client *</label>
                  <input 
                    type="text" 
                    name="client"
                    value={formData.client}
                    onChange={handleInputChange}
                    placeholder="Enter client name"
                    className="form-input"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <input 
                    type="text" 
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Enter project location"
                    className="form-input"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter project description (optional)"
                    className="form-input"
                    rows={3}
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-submit"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Project Modal */}
        {showDeleteModal && projectToDelete && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">Delete Project</h2>
                <button 
                  onClick={closeDeleteModal}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete the project <strong>&quot;{projectToDelete.name}&quot;</strong>?</p>
                <p className="warning-text">This action cannot be undone. All project data, panel layouts, QC data, and documents will be permanently deleted.</p>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="btn-cancel"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  className="btn-delete"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="loading-state">
            <p>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <h2 className="empty-state-title">No Projects Yet</h2>
            <p className="empty-state-message">It looks like you haven&apos;t created any projects. Get started by creating your first one!</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn-create-empty"
            >
              + Create Your First Project
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-card-header">
                  <div>
                    <h3 className="project-name">{project.name}</h3>
                  </div>
                  <div className={getStatusClass(project.status)}>
                    {project.status}
                  </div>
                </div>
                
                <div className="project-card-body">
                  <div className="project-details">
                    {project.description && (
                      <div className="project-detail">
                        <span className="detail-label">Description:</span>
                        <span className="detail-value">{project.description}</span>
                      </div>
                    )}
                    {project.location && (
                      <div className="project-detail">
                        <span className="detail-label">Location:</span>
                        <span className="detail-value">{project.location}</span>
                      </div>
                    )}
                    <div className="project-detail">
                      <span className="detail-label">Created:</span>
                      <span className="detail-value">{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="project-detail">
                      <span className="detail-label">Updated:</span>
                      <span className="detail-value">{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="project-actions">
                  <a href={`/dashboard/projects/${project.id}`} className="btn-action btn-view">
                    View Details
                  </a>
                  <a href={`/dashboard/projects/${project.id}/panel-layout`} className="btn-action btn-layout">
                    Panel Layout
                  </a>
                  <button
                    onClick={() => openDeleteModal(project)}
                    className="btn-action btn-delete"
                    title="Delete Project"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}