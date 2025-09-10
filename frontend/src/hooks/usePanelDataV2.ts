'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Panel, PanelLayout, validatePanelLayout, FeatureFlags } from '@/types/panel';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

interface UsePanelDataOptions {
  projectId: string;
  featureFlags?: Partial<FeatureFlags>;
}

interface UsePanelDataReturn {
  // Data state
  dataState: {
    state: 'loading' | 'loaded' | 'error' | 'empty';
    panels: Panel[];
    error?: string;
    lastUpdated?: number;
  };
  
  // Panel operations (all in world units)
  updatePanel: (panelId: string, updates: Partial<Panel>) => void;
  addPanel: (panel: Panel) => void;
  removePanel: (panelId: string) => void;
  batchUpdatePanels: (updates: Record<string, Partial<Panel>>) => void;
  
  // Data operations
  loadData: () => Promise<void>;
  saveData: () => Promise<boolean>;
  clearData: () => void;
  
  // Loading state
  isLoading: boolean;
  hasUnsavedChanges: boolean;
  
  // Debug operations
  addTestPanel: () => void;
  clearStorage: () => void;
}

/**
 * Hook for managing panel data with world coordinates
 * All panel positions and dimensions are stored in world units (feet)
 */
export function usePanelData({ projectId, featureFlags = {} }: UsePanelDataOptions): UsePanelDataReturn {
  const [dataState, setDataState] = useState<{
    state: 'loading' | 'loaded' | 'error' | 'empty';
    panels: Panel[];
    error?: string;
    lastUpdated?: number;
  }>({
    state: 'loading',
    panels: [],
    lastUpdated: Date.now()
  });

  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Refs for stable callbacks
  const debugLogRef = useRef((message: string, data?: any) => {
    if (featureFlags.ENABLE_DEBUG_LOGGING) {
      console.log(`[usePanelDataV2] ${message}`, data);
    }
  });

  // Update debug log when feature flags change
  useEffect(() => {
    debugLogRef.current = (message: string, data?: any) => {
      if (featureFlags.ENABLE_DEBUG_LOGGING) {
        console.log(`[usePanelDataV2] ${message}`, data);
      }
    };
  }, [featureFlags.ENABLE_DEBUG_LOGGING]);

  // Fetch data from backend (keeps world units)
  const fetchBackendData = useCallback(async (): Promise<PanelLayout | null> => {
    try {
      debugLogRef.current('Fetching data from backend', { projectId });
      
      const response = await fetch(`/api/panel-layout/${projectId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      debugLogRef.current('Backend response', data);
      
      if (!data || !data.layout) {
        debugLogRef.current('No layout data in response');
        return null;
      }
      
      // Map backend data to frontend format (keep world units)
      const mappedLayout: PanelLayout = {
        id: data.layout.id || `layout-${projectId}`,
        projectId: projectId,
        panels: data.layout.panels?.map((backendPanel: any, index: number) => {
          // Extract dimensions in feet (world units)
          const widthFeet = Number(backendPanel.width_feet || backendPanel.width || 100);
          const heightFeet = Number(backendPanel.height_feet || backendPanel.length || backendPanel.height || 100);
          const xFeet = Number(backendPanel.x || 0);
          const yFeet = Number(backendPanel.y || 0);
          
          return {
            id: backendPanel.id || `panel-${projectId}-${index}-${Date.now()}`,
            width: widthFeet, // Keep in world units (feet)
            height: heightFeet, // Keep in world units (feet)
            x: xFeet, // Keep in world units (feet)
            y: yFeet, // Keep in world units (feet)
            rotation: backendPanel.rotation || 0,
            isValid: true,
            shape: backendPanel.type === 'triangle' ? 'triangle' : 
                   backendPanel.type === 'right-triangle' ? 'right-triangle' : 'rectangle',
            type: backendPanel.type || 'panel',
            model: backendPanel.model || 'Unknown',
            manufacturer: backendPanel.manufacturer || 'Unknown',
            power: backendPanel.power || 0,
            efficiency: backendPanel.efficiency || 0,
            panelNumber: backendPanel.panel_number || backendPanel.panelNumber || 'Unknown',
            rollNumber: backendPanel.roll_number || backendPanel.rollNumber || 'Unknown',
            color: backendPanel.color || '#3b82f6',
            fill: backendPanel.fill || '#3b82f6',
            date: backendPanel.date || new Date().toISOString().split('T')[0],
            location: backendPanel.location || 'Unknown'
          };
        }) || []
      };
      
      debugLogRef.current('Mapped layout', { 
        panelCount: mappedLayout.panels.length,
        firstPanel: mappedLayout.panels[0]
      });

      if (validatePanelLayout(mappedLayout)) {
        return mappedLayout;
      } else {
        throw new Error('Invalid panel layout data received from backend');
      }
    } catch (error) {
      console.error('Failed to fetch panel data:', error);
      throw error;
    }
  }, [projectId]);

  // Load data from localStorage (keep world units)
  const loadLocalStorageData = useCallback((): PanelLayout | null => {
    try {
      const key = `panelLayout-${projectId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        debugLogRef.current('No localStorage data found');
        return null;
      }
      
      const parsed = JSON.parse(stored);
      debugLogRef.current('Loaded from localStorage', { panelCount: parsed.panels?.length || 0 });
      
      if (validatePanelLayout(parsed)) {
        return parsed;
      } else {
        console.warn('Invalid data in localStorage, clearing');
        localStorage.removeItem(key);
        return null;
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }, [projectId]);

  // Save data to localStorage (keep world units)
  const saveToLocalStorage = useCallback((layout: PanelLayout) => {
    try {
      const key = `panelLayout-${projectId}`;
      localStorage.setItem(key, JSON.stringify(layout));
      debugLogRef.current('Saved to localStorage', { panelCount: layout.panels.length });
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [projectId]);

  // Load data (backend + localStorage merge)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setDataState(prev => ({ ...prev, state: 'loading' }));
    
    try {
      // Try to load from backend first
      const backendData = await fetchBackendData();
      
      // Load from localStorage
      const localData = loadLocalStorageData();
      
      let finalLayout: PanelLayout;
      
      if (backendData && localData) {
        // Merge: use backend as base, apply localStorage positions
        debugLogRef.current('Merging backend and localStorage data');
        
        const mergedPanels = backendData.panels.map(backendPanel => {
          const localPanel = localData.panels.find(p => p.id === backendPanel.id);
          if (localPanel) {
            // Use local position but keep backend properties
            return {
              ...backendPanel,
              x: localPanel.x,
              y: localPanel.y,
              rotation: localPanel.rotation
            };
          }
          return backendPanel;
        });
        
        finalLayout = {
          ...backendData,
          panels: mergedPanels
        };
      } else if (backendData) {
        finalLayout = backendData;
      } else if (localData) {
        finalLayout = localData;
      } else {
        // No data available
        setDataState({
          state: 'empty',
          panels: [],
          lastUpdated: Date.now()
        });
        return;
      }
      
      setDataState({
        state: 'loaded',
        panels: finalLayout.panels,
        lastUpdated: Date.now()
      });
      
      // Save merged data back to localStorage
      saveToLocalStorage(finalLayout);
      
    } catch (error) {
      console.error('Failed to load data:', error);
      setDataState({
        state: 'error',
        panels: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        lastUpdated: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchBackendData, loadLocalStorageData, saveToLocalStorage]);

  // Save data to backend
  const saveData = useCallback(async (): Promise<boolean> => {
    if (dataState.state !== 'loaded') {
      console.warn('No data to save');
      return false;
    }
    
    try {
      const layout: PanelLayout = {
        id: `layout-${projectId}`,
        projectId,
        panels: dataState.panels
      };
      
      debugLogRef.current('Saving data to backend', { panelCount: layout.panels.length });
      
      const response = await fetch(`/api/panel-layout/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(layout),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Save to localStorage as backup
      saveToLocalStorage(layout);
      
      setHasUnsavedChanges(false);
      debugLogRef.current('Data saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save data:', error);
      return false;
    }
  }, [dataState, projectId, saveToLocalStorage]);

  // Panel operations (all in world units)
  const updatePanel = useCallback((panelId: string, updates: Partial<Panel>) => {
    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;
      
      const updatedPanels = prev.panels.map(panel =>
        panel.id === panelId ? { ...panel, ...updates } : panel
      );
      
      setHasUnsavedChanges(true);
      
      return {
        ...prev,
        panels: updatedPanels,
        lastUpdated: Date.now()
      };
    });
  }, []);

  const addPanel = useCallback((panel: Panel) => {
    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;
      
      setHasUnsavedChanges(true);
      
      return {
        ...prev,
        panels: [...prev.panels, panel],
        lastUpdated: Date.now()
      };
    });
  }, []);

  const removePanel = useCallback((panelId: string) => {
    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;
      
      setHasUnsavedChanges(true);
      
      return {
        ...prev,
        panels: prev.panels.filter(panel => panel.id !== panelId),
        lastUpdated: Date.now()
      };
    });
  }, []);

  const batchUpdatePanels = useCallback((updates: Record<string, Partial<Panel>>) => {
    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;
      
      const updatedPanels = prev.panels.map(panel => {
        const panelUpdates = updates[panel.id];
        return panelUpdates ? { ...panel, ...panelUpdates } : panel;
      });
      
      setHasUnsavedChanges(true);
      
      return {
        ...prev,
        panels: updatedPanels,
        lastUpdated: Date.now()
      };
    });
  }, []);

  // Utility functions
  const clearData = useCallback(() => {
    setDataState({
      state: 'empty',
      panels: [],
      lastUpdated: Date.now()
    });
    setHasUnsavedChanges(false);
    
    // Clear localStorage
    const key = `panelLayout-${projectId}`;
    localStorage.removeItem(key);
  }, [projectId]);

  const addTestPanel = useCallback(() => {
    const testPanel: Panel = {
      id: `test-panel-${Date.now()}`,
      width: 10, // 10 feet
      height: 10, // 10 feet
      x: Math.random() * (WORLD_CONSTANTS.WIDTH_FT - 10),
      y: Math.random() * (WORLD_CONSTANTS.HEIGHT_FT - 10),
      rotation: 0,
      isValid: true,
      shape: 'rectangle',
      type: 'test',
      model: 'Test Panel',
      manufacturer: 'Test Manufacturer',
      power: 100,
      efficiency: 0.2,
      panelNumber: `TEST-${Date.now()}`,
      rollNumber: `ROLL-${Date.now()}`,
      color: '#3b82f6',
      fill: '#3b82f6'
    };
    
    addPanel(testPanel);
    debugLogRef.current('Added test panel', testPanel);
  }, [addPanel]);

  const clearStorage = useCallback(() => {
    clearData();
    debugLogRef.current('Cleared all data');
  }, [clearData]);

  // Auto-save when data changes
  useEffect(() => {
    if (hasUnsavedChanges && dataState.state === 'loaded') {
      const timeoutId = setTimeout(() => {
        saveToLocalStorage({
          id: `layout-${projectId}`,
          projectId,
          panels: dataState.panels
        });
      }, 1000); // Auto-save after 1 second of inactivity
      
      return () => clearTimeout(timeoutId);
    }
  }, [hasUnsavedChanges, dataState, projectId, saveToLocalStorage]);

  return {
    dataState,
    updatePanel,
    addPanel,
    removePanel,
    batchUpdatePanels,
    loadData,
    saveData,
    clearData,
    isLoading,
    hasUnsavedChanges,
    addTestPanel,
    clearStorage
  };
}

export default usePanelData;
