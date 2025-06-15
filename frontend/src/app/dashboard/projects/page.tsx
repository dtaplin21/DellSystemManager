'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/use-auth';
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
  const { user, isAuthenticated } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    location: '',
    description: '',
    status: 'Active',
    progress: 0
  });

  useEffect(() => {
    const fetchProjects = async () => {
      if (!isAuthenticated) return;
      
      try {
        const response = await fetch('/api/projects', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        } else {
          console.error('Failed to fetch projects:', response.status);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [isAuthenticated]);

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
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create project');
      }

      const newProject = await response.json();
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
    } catch (error) {
      console.error('Error creating project:', error);
      alert(error instanceof Error ? error.message : 'Failed to create project');
    }
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
        
        {isLoading ? (
          <div className="loading-state">
            <p>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects found. Create your first project to get started.</p>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}