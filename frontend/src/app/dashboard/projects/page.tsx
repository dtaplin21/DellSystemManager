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
              <form onSubmit={(e) => { e.preventDefault(); handleCreateProject(); }}>
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input 
                    type="text" 
                    placeholder="Enter project name"
                    className="form-input"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client *</label>
                  <input 
                    type="text" 
                    placeholder="Enter client name"
                    className="form-input"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <input 
                    type="text" 
                    placeholder="Enter project location"
                    className="form-input"
                    required 
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
                  <div className="project-detail">
                    <span className="detail-label">Client:</span>
                    <span className="detail-value">{project.client}</span>
                  </div>
                  <div className="project-detail">
                    <span className="detail-label">Location:</span>
                    <span className="detail-value">{project.location}</span>
                  </div>
                  <div className="project-detail">
                    <span className="detail-label">Updated:</span>
                    <span className="detail-value">{new Date(project.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="project-progress">
                  <div className="progress-header">
                    <span className="progress-label">Progress</span>
                    <span className="progress-value">{project.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className={getProgressClass(project.progress)}
                      style={{ width: `${project.progress}%` }}
                    ></div>
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
      </div>
    </div>
  );
}