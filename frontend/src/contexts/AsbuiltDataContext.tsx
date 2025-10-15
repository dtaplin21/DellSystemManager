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
  deleteRecord: (recordId: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  
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
    if (!projectId) {
      console.log('❌ [AsbuiltContext] No projectId provided to refreshProjectData');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 [AsbuiltContext] Refreshing project data for:', projectId);
      
      console.log('🔄 [AsbuiltContext] Starting API calls...');
      
      let recordsData, summaryData, filesData;
      
      try {
        console.log('🔄 [AsbuiltContext] Calling getProjectRecords...');
        recordsData = await safeAPI.getProjectRecords(projectId);
        console.log('✅ [AsbuiltContext] getProjectRecords completed:', recordsData?.length || 0, 'records');
      } catch (error) {
        console.error('❌ [AsbuiltContext] getProjectRecords failed:', error);
        throw error;
      }
      
      try {
        console.log('🔄 [AsbuiltContext] Calling getProjectSummary...');
        summaryData = await safeAPI.getProjectSummary(projectId);
        console.log('✅ [AsbuiltContext] getProjectSummary completed:', summaryData);
      } catch (error) {
        console.error('❌ [AsbuiltContext] getProjectSummary failed:', error);
        throw error;
      }
      
      try {
        console.log('🔄 [AsbuiltContext] Calling getProjectFileMetadata...');
        filesData = await safeAPI.getProjectFileMetadata(projectId);
        console.log('✅ [AsbuiltContext] getProjectFileMetadata completed:', filesData?.length || 0, 'files');
      } catch (error) {
        console.error('❌ [AsbuiltContext] getProjectFileMetadata failed:', error);
        throw error;
      }
      
      console.log('✅ [AsbuiltContext] API calls completed:');
      console.log('  - recordsData length:', recordsData?.length || 0);
      console.log('  - summaryData:', summaryData);
      console.log('  - filesData length:', filesData?.length || 0);
      
      // Transform records data from snake_case to camelCase
      const transformedRecords = recordsData.map((record: any) => ({
        ...record,
        panelId: record.panel_id,
        projectId: record.project_id,
        sourceDocId: record.source_doc_id,
        rawData: record.raw_data,
        mappedData: record.mapped_data,
        aiConfidence: parseFloat(record.ai_confidence) || 0,
        requiresReview: record.requires_review,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        createdBy: record.created_by
      }));
      
      console.log('📊 [AsbuiltContext] Transformed records:', transformedRecords.length);
      console.log('📊 [AsbuiltContext] First record:', transformedRecords[0]);
      
      setProjectRecords(transformedRecords);
      setProjectSummary(summaryData);
      
      console.log('✅ [AsbuiltContext] Data set successfully:');
      console.log('  - Records:', transformedRecords.length);
      console.log('  - Summary:', summaryData);
      console.log('  - Files:', filesData.length);
      
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
      console.error('❌ [AsbuiltContext] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
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

  // Delete record
  const deleteRecord = useCallback(async (recordId: string) => {
    try {
      console.log('🗑️ [AsbuiltContext] Deleting record:', recordId);
      
      await safeAPI.deleteRecord(recordId);
      
      // Remove record from local state
      setProjectRecords(prev => prev.filter(record => record.id !== recordId));
      
      console.log('✅ [AsbuiltContext] Record deleted successfully');
    } catch (err) {
      console.error('❌ [AsbuiltContext] Error deleting record:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete record');
      throw err; // Re-throw so UI can handle the error
    }
  }, []);

  // Delete file
  const deleteFile = useCallback(async (fileId: string) => {
    try {
      console.log('🗑️ [AsbuiltContext] Deleting file:', fileId);
      
      await safeAPI.deleteFile(fileId);
      
      // Remove file from local state
      setFileMetadata(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      
      console.log('✅ [AsbuiltContext] File deleted successfully');
    } catch (err) {
      console.error('❌ [AsbuiltContext] Error deleting file:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete file');
      throw err; // Re-throw so UI can handle the error
    }
  }, []);

  // Auto-refresh when projectId changes
  useEffect(() => {
    console.log('🔄 [AsbuiltContext] Auto-refresh useEffect triggered:');
    console.log('  - projectId:', projectId);
    if (projectId) {
      console.log('🔄 [AsbuiltContext] Auto-refreshing data for project:', projectId);
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
    deleteRecord,
    deleteFile,
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
