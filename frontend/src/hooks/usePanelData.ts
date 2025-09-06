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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';

export function usePanelData({ projectId, featureFlags = {} }: UsePanelDataOptions): UsePanelDataReturn {
  // console.log('🔍 [usePanelData] ===== HOOK INITIALIZED =====');
  // console.log('🔍 [usePanelData] Project ID:', projectId);
  // console.log('🔍 [usePanelData] Feature flags:', featureFlags);
  
  const flags = useMemo(() => ({ ...DEFAULT_FEATURE_FLAGS, ...featureFlags }), [featureFlags]);
  
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
      console.log('🔍 [usePanelData] Fetching backend data for project', projectId);
      console.log('🔍 [usePanelData] Backend URL:', `${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
      
      const response = await fetch(`${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
      console.log('🔍 [usePanelData] Response status:', response.status, response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 [usePanelData] ===== BACKEND RESPONSE RECEIVED =====');
      console.log('🔍 [usePanelData] Full response:', JSON.stringify(data, null, 2));
      console.log('🔍 [usePanelData] Success:', data.success);
      console.log('🔍 [usePanelData] Layout exists:', !!data.layout);
      console.log('🔍 [usePanelData] Panels count:', data.layout?.panels?.length || 0);
      console.log('🔍 [usePanelData] First panel:', data.layout?.panels?.[0]);

      // Map backend data structure to frontend interface
      console.log('🔍 [usePanelData] Mapping backend data...');
      console.log('🔍 [usePanelData] data.layout:', data.layout);
      console.log('🔍 [usePanelData] data.layout.panels:', data.layout?.panels);
      
      // CRITICAL FIX: The API returns { success: true, layout: { panels: [...] } }
      // But we were trying to access data.panels instead of data.layout.panels
      const mappedLayout = {
        id: data.layout?.id || `layout-${projectId}`,
        projectId: projectId,
        panels: data.layout?.panels?.map((backendPanel: any, index: number) => {
          console.log('🔍 [usePanelData] Mapping panel:', backendPanel);
          return {
            id: backendPanel.id || `panel-${projectId}-${index}-${Date.now()}`,
            width: backendPanel.width_feet || backendPanel.width || 1,
            height: backendPanel.height_feet || backendPanel.height || 1,
            x: backendPanel.x || 0,
            y: backendPanel.y || 0,
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
            rollNumber: backendPanel.roll_number || backendPanel.rollNumber || 'Unknown'
          };
        }) || []
      };
      
      console.log('🔍 [usePanelData] Mapped layout:', mappedLayout);
      console.log('🔍 [usePanelData] Mapped panels count:', mappedLayout.panels.length);

      if (validatePanelLayout(mappedLayout)) {
        return mappedLayout;
      } else {
        throw new Error('Invalid panel layout data from backend after mapping');
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
    console.log('🔍 [usePanelData] ===== STARTING LOAD DATA =====');
    console.log('🔍 [usePanelData] Project ID:', projectId);
    setDataState(prev => ({ ...prev, state: 'loading' }));

    try {
      // Load localStorage positions first
      const localPositions = loadLocalStorageData();
      console.log('🔍 [usePanelData] Local positions:', localPositions);

      // Fetch backend data
      console.log('🔍 [usePanelData] About to call fetchBackendData...');
      const backendLayout = await fetchBackendData();
      console.log('🔍 [usePanelData] Backend layout received:', backendLayout);
      console.log('🔍 [usePanelData] Backend layout panels:', backendLayout?.panels);
      console.log('🔍 [usePanelData] Backend layout panels length:', backendLayout?.panels?.length);
      
      if (!backendLayout || !backendLayout.panels || backendLayout.panels.length === 0) {
        console.log('🔍 [usePanelData] ❌ No backend data available - setting empty state');
        console.log('🔍 [usePanelData] backendLayout exists:', !!backendLayout);
        console.log('🔍 [usePanelData] backendLayout.panels exists:', !!backendLayout?.panels);
        console.log('🔍 [usePanelData] backendLayout.panels.length:', backendLayout?.panels?.length);
        setDataState({
          state: 'empty',
          panels: [],
          lastUpdated: Date.now()
        });
        return;
      }

      // Merge data
      console.log('🔍 [usePanelData] About to merge data...');
      const mergedPanels = mergeDataWithLocalStorage(backendLayout.panels, localPositions);
      console.log('🔍 [usePanelData] Merged panels:', mergedPanels);
      console.log('🔍 [usePanelData] Merged panels length:', mergedPanels.length);

      setDataState({
        state: 'loaded',
        panels: mergedPanels,
        lastUpdated: Date.now()
      });
      
      console.log('🔍 [usePanelData] ✅ Data state set to loaded with', mergedPanels.length, 'panels');

      debugLog('Data loaded successfully', { 
        panelCount: mergedPanels.length,
        hasLocalPositions: Object.keys(localPositions).length > 0
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('🔍 [usePanelData] ❌ ERROR loading panel data:', error);
      console.error('🔍 [usePanelData] Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        projectId
      });
      
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

  // Load data on mount - only on client side
  useEffect(() => {
    console.log('🔍 [usePanelData] useEffect triggered - calling loadData');
    console.log('🔍 [usePanelData] typeof window:', typeof window);
    console.log('🔍 [usePanelData] isClient:', typeof window !== 'undefined');
    
    if (typeof window !== 'undefined') {
      loadData().catch(error => {
        console.error('🔍 [usePanelData] loadData failed:', error);
        setDataState({
          state: 'error',
          panels: [],
          lastUpdated: Date.now(),
          error: error.message
        });
      });
    } else {
      console.log('🔍 [usePanelData] Skipping loadData - not on client side');
    }
  }, [projectId]); // Only depend on projectId, not loadData

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
