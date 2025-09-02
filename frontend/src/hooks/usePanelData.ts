import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Panel, 
  PanelLayout, 
  PanelDataState, 
  PanelPositionMap,
  DataState,
  validatePanel,
  validatePanelLayout,
  validatePanelPositionMap,
  DEFAULT_FEATURE_FLAGS
} from '@/types/panel';

interface UsePanelDataOptions {
  projectId: string;
  featureFlags?: Partial<typeof DEFAULT_FEATURE_FLAGS>;
}

interface UsePanelDataReturn {
  dataState: PanelDataState;
  isLoading: boolean;
  error: string | null;
  panels: Panel[];
  updatePanelPosition: (panelId: string, position: { x: number; y: number; rotation?: number }) => void;
  addPanel: (panel: Omit<Panel, 'id'>) => void;
  removePanel: (panelId: string) => void;
  refreshData: () => Promise<void>;
  clearLocalStorage: () => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export function usePanelData({ projectId, featureFlags = {} }: UsePanelDataOptions): UsePanelDataReturn {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  
  const [dataState, setDataState] = useState<PanelDataState>({
    state: 'loading',
    panels: [],
    lastUpdated: Date.now()
  });

  // Debug logging helper
  const debugLog = useCallback((message: string, data?: any) => {
    if (flags.ENABLE_DEBUG_LOGGING) {
      console.log(`[usePanelData] ${message}`, data);
    }
  }, [flags.ENABLE_DEBUG_LOGGING]);

  // Load data from localStorage
  const loadLocalStorageData = useCallback((): PanelPositionMap => {
    if (!flags.ENABLE_LOCAL_STORAGE || typeof window === 'undefined') {
      return {};
    }

    try {
      const saved = localStorage.getItem('panelLayoutPositions');
      if (!saved) return {};

      const parsed = JSON.parse(saved);
      if (validatePanelPositionMap(parsed)) {
        debugLog('Loaded localStorage positions', parsed);
        return parsed;
      } else {
        debugLog('Invalid localStorage data, clearing', parsed);
        localStorage.removeItem('panelLayoutPositions');
        return {};
      }
    } catch (error) {
      debugLog('Error loading localStorage data', error);
      localStorage.removeItem('panelLayoutPositions');
      return {};
    }
  }, [flags.ENABLE_LOCAL_STORAGE, debugLog]);

  // Save data to localStorage
  const saveToLocalStorage = useCallback((positionMap: PanelPositionMap) => {
    if (!flags.ENABLE_LOCAL_STORAGE || typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem('panelLayoutPositions', JSON.stringify(positionMap));
      debugLog('Saved to localStorage', positionMap);
    } catch (error) {
      debugLog('Error saving to localStorage', error);
    }
  }, [flags.ENABLE_LOCAL_STORAGE, debugLog]);

  // Fetch data from backend
  const fetchBackendData = useCallback(async (): Promise<PanelLayout | null> => {
    try {
      debugLog('Fetching backend data for project', projectId);
      
      const response = await fetch(`${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      debugLog('Backend response', data);

      if (validatePanelLayout(data)) {
        return data;
      } else {
        throw new Error('Invalid panel layout data from backend');
      }
    } catch (error) {
      debugLog('Error fetching backend data', error);
      throw error;
    }
  }, [projectId, debugLog]);

  // Merge backend data with localStorage positions
  const mergeDataWithLocalStorage = useCallback((
    backendPanels: Panel[], 
    localPositions: PanelPositionMap
  ): Panel[] => {
    debugLog('Merging backend data with localStorage', { 
      backendCount: backendPanels.length, 
      localCount: Object.keys(localPositions).length 
    });

    return backendPanels.map(panel => {
      const localPosition = localPositions[panel.id];
      if (localPosition) {
        debugLog(`Applying localStorage position for panel ${panel.id}`, localPosition);
        return {
          ...panel,
          x: localPosition.x,
          y: localPosition.y,
          rotation: localPosition.rotation ?? panel.rotation,
          isValid: true
        };
      }
      return panel;
    });
  }, [debugLog]);

  // Main data loading function
  const loadData = useCallback(async () => {
    setDataState(prev => ({ ...prev, state: 'loading' }));

    try {
      // Load localStorage positions first
      const localPositions = loadLocalStorageData();

      // Fetch backend data
      const backendLayout = await fetchBackendData();
      
      if (!backendLayout || !backendLayout.panels || backendLayout.panels.length === 0) {
        debugLog('No backend data available');
        setDataState({
          state: 'empty',
          panels: [],
          lastUpdated: Date.now()
        });
        return;
      }

      // Merge data
      const mergedPanels = mergeDataWithLocalStorage(backendLayout.panels, localPositions);

      setDataState({
        state: 'loaded',
        panels: mergedPanels,
        lastUpdated: Date.now()
      });

      debugLog('Data loaded successfully', { 
        panelCount: mergedPanels.length,
        hasLocalPositions: Object.keys(localPositions).length > 0
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debugLog('Error loading data', error);
      
      setDataState({
        state: 'error',
        panels: [],
        error: errorMessage,
        lastUpdated: Date.now()
      });
    }
  }, [projectId, loadLocalStorageData, fetchBackendData, mergeDataWithLocalStorage, debugLog]);

  // Atomic panel position update
  const updatePanelPosition = useCallback((panelId: string, position: { x: number; y: number; rotation?: number }) => {
    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;

      const updatedPanels = prev.panels.map(panel =>
        panel.id === panelId 
          ? { ...panel, ...position, isValid: true }
          : panel
      );

      // Update localStorage atomically
      if (flags.ENABLE_PERSISTENCE) {
        const positionMap: PanelPositionMap = {};
        updatedPanels.forEach(panel => {
          positionMap[panel.id] = {
            x: panel.x,
            y: panel.y,
            rotation: panel.rotation
          };
        });
        saveToLocalStorage(positionMap);
      }

      debugLog(`Updated panel ${panelId} position`, position);

      return {
        ...prev,
        panels: updatedPanels,
        lastUpdated: Date.now()
      };
    });
  }, [flags.ENABLE_PERSISTENCE, saveToLocalStorage, debugLog]);

  // Add new panel
  const addPanel = useCallback((panelData: Omit<Panel, 'id'>) => {
    const newPanel: Panel = {
      ...panelData,
      id: `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isValid: true
    };

    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;

      const updatedPanels = [...prev.panels, newPanel];

      // Update localStorage
      if (flags.ENABLE_PERSISTENCE) {
        const positionMap: PanelPositionMap = {};
        updatedPanels.forEach(panel => {
          positionMap[panel.id] = {
            x: panel.x,
            y: panel.y,
            rotation: panel.rotation
          };
        });
        saveToLocalStorage(positionMap);
      }

      debugLog('Added new panel', newPanel);

      return {
        ...prev,
        panels: updatedPanels,
        lastUpdated: Date.now()
      };
    });
  }, [flags.ENABLE_PERSISTENCE, saveToLocalStorage, debugLog]);

  // Remove panel
  const removePanel = useCallback((panelId: string) => {
    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;

      const updatedPanels = prev.panels.filter(panel => panel.id !== panelId);

      // Update localStorage
      if (flags.ENABLE_PERSISTENCE) {
        const positionMap: PanelPositionMap = {};
        updatedPanels.forEach(panel => {
          positionMap[panel.id] = {
            x: panel.x,
            y: panel.y,
            rotation: panel.rotation
          };
        });
        saveToLocalStorage(positionMap);
      }

      debugLog(`Removed panel ${panelId}`);

      return {
        ...prev,
        panels: updatedPanels,
        lastUpdated: Date.now()
      };
    });
  }, [flags.ENABLE_PERSISTENCE, saveToLocalStorage, debugLog]);

  // Clear localStorage
  const clearLocalStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('panelLayoutPositions');
      debugLog('Cleared localStorage');
    }
  }, [debugLog]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Computed values
  const isLoading = dataState.state === 'loading';
  const error = dataState.error || null;
  const panels = dataState.panels;

  return {
    dataState,
    isLoading,
    error,
    panels,
    updatePanelPosition,
    addPanel,
    removePanel,
    refreshData: loadData,
    clearLocalStorage
  };
}
