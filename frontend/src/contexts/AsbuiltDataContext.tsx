'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { AsbuiltRecord, AsbuiltSummary, PanelAsbuiltSummary, AsbuiltDomain } from '@/types/asbuilt';
import { safeAPI } from '@/lib/safe-api';

// File metadata interface for shared file management
export interface FileMetadata {
  id: string;
  fileName: string;
  fileType: 'excel' | 'pdf' | 'image';
  panelId: string | null; // Allow null for project-wide files
  domain: AsbuiltDomain;
  uploadedAt: string;
  fileSize: number;
  previewUrl?: string;
  downloadUrl: string;
  projectId: string;
  sourceDocId?: string;
}

// Context type definition
interface AsbuiltDataContextType {
  // Project-level data
  projectSummary: AsbuiltSummary | null;
  projectRecords: AsbuiltRecord[];
  
  // Panel-specific data (keyed by panelId)
  panelData: Map<string, PanelAsbuiltSummary>;
  
  // File metadata for viewing
  fileMetadata: Map<string, FileMetadata>;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Shared state management functions
  updatePanelData: (panelId: string, data: PanelAsbuiltSummary) => void;
  addFileMetadata: (file: FileMetadata) => void;
  removeFileMetadata: (fileId: string) => void;
  refreshAllData: (projectId: string) => Promise<void>;
  refreshPanelData: (projectId: string, panelId: string) => Promise<void>;
  refreshProjectData: (projectId: string) => Promise<void>;
  
  // Utility functions
  getFilesForPanel: (panelId: string) => FileMetadata[];
  getFilesForDomain: (panelId: string, domain: AsbuiltDomain) => FileMetadata[];
  getPanelSummary: (panelId: string) => PanelAsbuiltSummary | null;
}

// Create the context
const AsbuiltDataContext = createContext<AsbuiltDataContextType | undefined>(undefined);

// Provider component
interface AsbuiltDataProviderProps {
  children: ReactNode;
  projectId: string;
}

export const AsbuiltDataProvider: React.FC<AsbuiltDataProviderProps> = ({ 
  children, 
  projectId 
}) => {
  // State management
  const [projectSummary, setProjectSummary] = useState<AsbuiltSummary | null>(null);
  const [projectRecords, setProjectRecords] = useState<AsbuiltRecord[]>([]);
  const [panelData, setPanelData] = useState<Map<string, PanelAsbuiltSummary>>(new Map());
  const [fileMetadata, setFileMetadata] = useState<Map<string, FileMetadata>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update panel data
  const updatePanelData = useCallback((panelId: string, data: PanelAsbuiltSummary) => {
    setPanelData(prev => new Map(prev.set(panelId, data)));
  }, []);

  // Add file metadata
  const addFileMetadata = useCallback((file: FileMetadata) => {
    setFileMetadata(prev => new Map(prev.set(file.id, file)));
  }, []);

  // Remove file metadata
  const removeFileMetadata = useCallback((fileId: string) => {
    setFileMetadata(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  }, []);

  // Get files for a specific panel
  const getFilesForPanel = useCallback((panelId: string): FileMetadata[] => {
    return Array.from(fileMetadata.values()).filter(file => 
      file.panelId === panelId || file.panelId === null // Include project-wide files
    );
  }, [fileMetadata]);

  // Get files for a specific panel and domain
  const getFilesForDomain = useCallback((panelId: string, domain: AsbuiltDomain): FileMetadata[] => {
    return Array.from(fileMetadata.values()).filter(
      file => (file.panelId === panelId || file.panelId === null) && file.domain === domain
    );
  }, [fileMetadata]);

  // Get panel summary
  const getPanelSummary = useCallback((panelId: string): PanelAsbuiltSummary | null => {
    return panelData.get(panelId) || null;
  }, [panelData]);

  // Refresh project data
  const refreshProjectData = useCallback(async (projectId: string) => {
    if (!projectId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 [AsbuiltContext] Refreshing project data for:', projectId);
      
      const [recordsData, summaryData, filesData] = await Promise.all([
        safeAPI.getProjectRecords(projectId),
        safeAPI.getProjectSummary(projectId),
        safeAPI.getProjectFileMetadata(projectId)
      ]);
      
      // Transform records data from snake_case to camelCase
      const transformedRecords = recordsData.map((record: any) => ({
        ...record,
        panelId: record.panel_id,
        projectId: record.project_id,
        sourceDocId: record.source_doc_id,
        rawData: record.raw_data,
        mappedData: record.mapped_data,
        aiConfidence: record.ai_confidence,
        requiresReview: record.requires_review,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        createdBy: record.created_by
      }));
      
      setProjectRecords(transformedRecords);
      setProjectSummary(summaryData);
      
      // Convert file metadata to Map format
      const filesMap = new Map();
      filesData.forEach((file: any) => {
        filesMap.set(file.id, {
          id: file.id,
          fileName: file.file_name,
          fileType: file.file_type,
          panelId: file.panel_id,
          domain: file.domain,
          uploadedAt: file.created_at,
          fileSize: file.file_size,
          projectId: file.project_id,
          metadata: file.metadata
        });
      });
      setFileMetadata(filesMap);
      
      // Extract unique panels from records and update panel data
      const uniquePanels = new Set(transformedRecords.map(record => record.panelId));
      const panelDataPromises = Array.from(uniquePanels).map(panelId => 
        safeAPI.getAsbuiltSafe(projectId, panelId)
      );
      
      const panelDataResults = await Promise.all(panelDataPromises);
      const newPanelData = new Map<string, PanelAsbuiltSummary>();
      
      panelDataResults.forEach((data, index) => {
        const panelId = Array.from(uniquePanels)[index];
        if (panelId && data) {
          newPanelData.set(panelId, data);
        }
      });
      
      setPanelData(newPanelData);
      
      console.log('✅ [AsbuiltContext] Project data refreshed successfully');
    } catch (err) {
      console.error('❌ [AsbuiltContext] Error refreshing project data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh project data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh panel data
  const refreshPanelData = useCallback(async (projectId: string, panelId: string) => {
    if (!projectId || !panelId) return;
    
    try {
      console.log('🔄 [AsbuiltContext] Refreshing panel data for:', { projectId, panelId });
      
      const data = await safeAPI.getAsbuiltSafe(projectId, panelId);
      updatePanelData(panelId, data);
      
      console.log('✅ [AsbuiltContext] Panel data refreshed successfully');
    } catch (err) {
      console.error('❌ [AsbuiltContext] Error refreshing panel data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh panel data');
    }
  }, [updatePanelData]);

  // Refresh all data
  const refreshAllData = useCallback(async (projectId: string) => {
    await refreshProjectData(projectId);
  }, [refreshProjectData]);

  // Auto-refresh when projectId changes
  useEffect(() => {
    if (projectId) {
      refreshAllData(projectId);
    }
  }, [projectId, refreshAllData]);

  // Context value
  const contextValue: AsbuiltDataContextType = {
    projectSummary,
    projectRecords,
    panelData,
    fileMetadata,
    isLoading,
    error,
    updatePanelData,
    addFileMetadata,
    removeFileMetadata,
    refreshAllData,
    refreshPanelData,
    refreshProjectData,
    getFilesForPanel,
    getFilesForDomain,
    getPanelSummary,
  };

  return (
    <AsbuiltDataContext.Provider value={contextValue}>
      {children}
    </AsbuiltDataContext.Provider>
  );
};

// Custom hook to use the context
export const useAsbuiltData = (): AsbuiltDataContextType => {
  const context = useContext(AsbuiltDataContext);
  if (context === undefined) {
    throw new Error('useAsbuiltData must be used within an AsbuiltDataProvider');
  }
  return context;
};

export default AsbuiltDataContext;
