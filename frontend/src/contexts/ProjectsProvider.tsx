'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchProjects as fetchProjectsAPI, fetchProjectById, fetchPanelLayout, fetchDocuments } from '../lib/api';
import { useSupabaseAuth } from '../hooks/use-supabase-auth';
import type { Panel as CanonicalPanel } from '../types/panel';

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
  uploadedAt: string;
  projectId: string;
  type: string;
  size: number;
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

function mapBackendPanelToFrontend(panel: any): CanonicalPanel | null {
  if (!panel) return null;
  // Type guard: ensure required fields exist
  if (!panel.id || (!panel.panel_number && !panel.panelNumber) || (panel.width === undefined) || (panel.height === undefined && panel.length === undefined)) {
    return null;
  }
  return {
    id: panel.id,
    date: panel.date || '',
    panelNumber: panel.panel_number || panel.panelNumber || '',
    isValid: true,
    height: panel.height || panel.length || 0,
    width: panel.width || 0,
    rollNumber: panel.roll_number || panel.rollNumber || '',
    location: panel.location || '',
    x: panel.x || 0,
    y: panel.y || 0,
    shape: panel.shape || panel.type || 'rectangle',
    points: panel.points,
    radius: panel.radius,
    rotation: panel.rotation || 0,
    fill: panel.fill || '#87CEEB',
    color: panel.color || panel.fill || '#87CEEB',
    meta: {
      repairs: [],
      airTest: { result: 'pending' }
    }
  };
}

export function ProjectsProvider({ children }: ProjectsProviderProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useSupabaseAuth();

  // Fetch all projects using the API helper
  const fetchProjects = async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated || authLoading) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // CRITICAL: Wait for session to be accessible before making API calls
    // This prevents race conditions where isAuthenticated is true but session isn't ready
    let sessionReady = false;
    let retries = 0;
    const maxRetries = 5;
    
    while (!sessionReady && retries < maxRetries) {
      try {
        const { getSupabaseClient } = await import('../lib/supabase');
        const { data: { session } } = await getSupabaseClient().auth.getSession();
        
        if (session?.access_token) {
          sessionReady = true;
          console.log('✅ ProjectsProvider: Session is ready, proceeding with fetch');
        } else {
          retries++;
          if (retries < maxRetries) {
            console.log(`⏳ ProjectsProvider: Session not ready yet, waiting... (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
          }
        }
      } catch (error) {
        retries++;
        if (retries < maxRetries) {
          console.warn(`⚠️ ProjectsProvider: Error checking session, retrying... (attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.error('❌ ProjectsProvider: Failed to verify session after retries');
          setError('Session not ready. Please refresh the page.');
          setIsLoading(false);
          return;
        }
      }
    }
    
    if (!sessionReady) {
      console.error('❌ ProjectsProvider: Session never became ready');
      setError('Session timeout. Please refresh the page.');
      setIsLoading(false);
      return;
    }
    
    try {
      console.log('ProjectsProvider: Fetching projects using API helper...');
      const data = await fetchProjectsAPI();
      console.log('ProjectsProvider: Projects loaded:', data.length);
      setProjects(data);
    } catch (err) {
      console.error('ProjectsProvider: Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  // Select a project and fetch its details using API helpers
  const selectProject = async (id: string) => {
    try {
      console.log('ProjectsProvider: Selecting project:', id);
      setSelectedProjectId(id);
      
      // Fetch project details using API helper
      const projectData = await fetchProjectById(id);
      
      // Fetch panel layout using API helper
      let panelLayout = null;
      let panels: CanonicalPanel[] = [];
      try {
        const panelLayoutData = await fetchPanelLayout(id);
        panelLayout = panelLayoutData;
        
        // Safely parse the panels
        if (panelLayout?.panels) {
          let rawPanels = [];
          if (typeof panelLayout.panels === 'string') {
            try {
              rawPanels = JSON.parse(panelLayout.panels);
            } catch (panelParseErr) {
              console.warn('ProjectsProvider: Could not parse panel layout panels JSON string:', panelParseErr);
              rawPanels = [];
            }
          } else if (Array.isArray(panelLayout.panels)) {
            rawPanels = panelLayout.panels;
          } else {
            console.warn('ProjectsProvider: Unexpected panels format:', typeof panelLayout.panels);
            rawPanels = [];
          }
          // Map and filter panels
          panels = rawPanels.map(mapBackendPanelToFrontend).filter(Boolean) as CanonicalPanel[];
        } else {
          panels = [];
        }
      } catch (panelErr) {
        console.warn('ProjectsProvider: Could not fetch panel layout, using defaults:', panelErr);
        panelLayout = { panels: '[]', width: 0, height: 0, scale: 1 };
        panels = [];
      }
      
      // Fetch documents using API helper
      let documents: Document[] = [];
      try {
        const documentsData = await fetchDocuments(id);
        documents = Array.isArray(documentsData) ? documentsData : [];
      } catch (docErr) {
        console.warn('ProjectsProvider: Could not fetch documents:', docErr);
        documents = [];
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

  // Fetch projects on mount only when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchProjects();
    } else if (!authLoading) {
      // If not authenticated and auth loading is done, set loading to false
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading]);

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