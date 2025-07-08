'use client';
export const dynamic = "force-dynamic";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import './dashboard.css';

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
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Main Content */}
        <main>
          <h1 className="dashboard-title">Quality Control Dashboard</h1>
          <p className="dashboard-subtitle">
            Monitor your geosynthetic projects, track quality control metrics, and manage panel layouts efficiently.
          </p>

          {/* Stats Grid */}
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon primary">📊</div>
                <div>
                  <h3 className="card-title">Active Projects</h3>
                  <p className="card-description">Currently ongoing projects</p>
                </div>
              </div>
              <div className="card-value">{projects.length}</div>
              <div className="card-actions">
                <Link href="/dashboard/projects" className="btn btn-secondary">
                  View All
                </Link>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon success">✅</div>
                <div>
                  <h3 className="card-title">Quality Tests</h3>
                  <p className="card-description">Completed this month</p>
                </div>
              </div>
              <div className="card-value">127</div>
              <div className="card-progress">
                <div className="card-progress-bar" style={{width: '78%'}}></div>
              </div>
              <div className="card-actions">
                <Link href="/dashboard/qc-data" className="btn btn-secondary">
                  View Data
                </Link>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon warning">🎯</div>
                <div>
                  <h3 className="card-title">Panel Layouts</h3>
                  <p className="card-description">Optimized designs created</p>
                </div>
              </div>
              <div className="card-value">23</div>
              <div className="card-actions">
                <Link href="/dashboard/projects" className="btn btn-orange">
                  View Projects
                </Link>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon warning">🎮</div>
                <div>
                  <h3 className="card-title">Playground</h3>
                  <p className="card-description">Test panel designs in sandbox</p>
                </div>
              </div>
              <div className="card-value">Ready</div>
              <div className="card-actions">
                <Link href="/dashboard/panel-playground" className="btn btn-orange">
                  Open Playground
                </Link>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon info">📄</div>
                <div>
                  <h3 className="card-title">Documents</h3>
                  <p className="card-description">Reports and specifications</p>
                </div>
              </div>
              <div className="card-value">89</div>
              <div className="card-actions">
                <Link href="/dashboard/documents" className="btn btn-secondary">
                  Browse Files
                </Link>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon ai">🤖</div>
                <div>
                  <h3 className="card-title">AI Assistant</h3>
                  <p className="card-description">Document analysis & layout automation</p>
                </div>
              </div>
              <div className="card-value">Ready</div>
              <div className="card-actions">
                <Link href="/dashboard/ai" className="btn btn-primary">
                  Open Assistant
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <div className="actions-grid">
              <Link href="/dashboard/projects" className="action-item">
                <div className="action-icon primary">➕</div>
                <span className="action-text">New Project</span>
              </Link>
              
              <Link href="/dashboard/panel-playground" className="action-item">
                <div className="action-icon orange">🔧</div>
                <span className="action-text">Panel Layout Playground</span>
              </Link>

              <Link href="/dashboard/ai" className="action-item">
                <div className="action-icon ai">🤖</div>
                <span className="action-text">AI Assistant</span>
              </Link>
              
              <Link href="/dashboard/qc-data" className="action-item">
                <div className="action-icon success">📈</div>
                <span className="action-text">Upload QC Data</span>
              </Link>
              
              <Link href="/dashboard/documents" className="action-item">
                <div className="action-icon purple">📋</div>
                <span className="action-text">Generate Report</span>
              </Link>
            </div>
          </div>

          {/* Recent Projects */}
          <div className="recent-projects">
            <h2>Recent Projects</h2>
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
              </div>
            ) : (
              <div>
                {projects.map((project) => (
                  <div key={project.id} className="project-item">
                    <div className="project-info">
                      <h3>{project.name}</h3>
                      <div className="project-meta">
                        {project.client} • {project.location} • Updated {new Date(project.lastUpdated).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="project-progress">
                      <div className="progress-label">{project.progress}% Complete</div>
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar" 
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="card-actions" style={{marginTop: '1.5rem'}}>
                  <Link href="/dashboard/projects" className="btn btn-primary">
                    View All Projects
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}