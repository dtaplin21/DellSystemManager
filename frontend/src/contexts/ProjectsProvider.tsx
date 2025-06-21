'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Panel {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: any;
}

interface Document {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
  projectId: string;
  fileSize?: number;
  mimeType?: string;
  status?: string;
}

interface ProjectDetail extends ProjectSummary {
  panels: Panel[];
  documents: Document[];
  panelLayout?: {
    width: number;
    height: number;
    scale: number;
    panels: string; // JSON string
  };
}

interface ProjectsContextType {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  selectedProject: ProjectDetail | null;
  isLoading: boolean;
  error: string | null;
  selectProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  clearSelection: () => void;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

interface ProjectsProviderProps {
  children: ReactNode;
}

export function ProjectsProvider({ children }: ProjectsProviderProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all projects
  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('ProjectsProvider: Fetching projects...');
      const response = await fetch('/api/projects', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
        },
      });
      
      console.log('ProjectsProvider: Response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to load projects (${response.status})`);
        }
      }
      
      const data = await response.json();
      console.log('ProjectsProvider: Projects loaded:', data.length);
      setProjects(data);
    } catch (err) {
      console.error('ProjectsProvider: Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  // Select a project and fetch its details
  const selectProject = async (id: string) => {
    try {
      console.log('ProjectsProvider: Selecting project:', id);
      setSelectedProjectId(id);
      
      // Fetch project details
      const projectResponse = await fetch(`/api/projects/${id}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
        },
      });
      
      if (!projectResponse.ok) {
        throw new Error('Failed to load project details');
      }
      
      const projectData = await projectResponse.json();
      
      // Fetch panel layout
      const panelsResponse = await fetch(`/api/panels/layout/${id}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
        },
      });
      
      let panelLayout = null;
      let panels: Panel[] = [];
      if (panelsResponse.ok) {
        panelLayout = await panelsResponse.json();
        panels = panelLayout?.panels ? JSON.parse(panelLayout.panels) : [];
      }
      
      // Fetch documents
      const documentsResponse = await fetch(`/api/documents?projectId=${id}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
        },
      });
      
      let documents: Document[] = [];
      if (documentsResponse.ok) {
        documents = await documentsResponse.json();
      }
      
      const projectDetail: ProjectDetail = {
        ...projectData,
        panels,
        documents,
        panelLayout: panelLayout || undefined,
      };
      
      console.log('ProjectsProvider: Project details loaded:', projectDetail);
      setSelectedProject(projectDetail);
      
    } catch (err) {
      console.error('ProjectsProvider: Error selecting project:', err);
      setError(err instanceof Error ? err.message : 'Unable to load project data');
      setSelectedProjectId(null);
      setSelectedProject(null);
    }
  };

  const clearSelection = () => {
    setSelectedProjectId(null);
    setSelectedProject(null);
  };

  const refreshProjects = async () => {
    await fetchProjects();
  };

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const value: ProjectsContextType = {
    projects,
    selectedProjectId,
    selectedProject,
    isLoading,
    error,
    selectProject,
    refreshProjects,
    clearSelection,
  };

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
} 