import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiClient } from '@/lib/apiClient';
import { authManager, AuthState } from '@/lib/authManager';
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
  updatePanelPosition: (panelId: string, position: { x: number; y: number; rotation?: number }) => Promise<void>;
  addPanel: (panel: Omit<Panel, 'id'>) => Promise<void>;
  removePanel: (panelId: string) => Promise<void>;
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

  // Auth state for tracking authentication status
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    error: string | null;
  }>({ isAuthenticated: false, error: null });

  // Debug logging helper - use ref to avoid dependency issues
  const debugLogRef = useRef((message: string, data?: any) => {
    if (flags.ENABLE_DEBUG_LOGGING) {
      console.log(`[usePanelData] ${message}`, data);
    }
  });
  
  // Update debug log function when flags change
  useEffect(() => {
    debugLogRef.current = (message: string, data?: any) => {
      if (flags.ENABLE_DEBUG_LOGGING) {
        console.log(`[usePanelData] ${message}`, data);
      }
    };
  }, [flags.ENABLE_DEBUG_LOGGING]);
  
  const debugLog = useCallback((message: string, data?: any) => {
    debugLogRef.current(message, data);
  }, []);

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
          console.log('🔍 [SHAPE DEBUG] Backend panel shape fields:', {
            id: backendPanel.id,
            shape: backendPanel.shape,
            type: backendPanel.type,
            finalShape: backendPanel.shape || backendPanel.type || 'rectangle'
          });
          
          // Keep coordinates in world units (feet) - let canvas rendering handle scaling
          const widthFeet = Number(backendPanel.width_feet || backendPanel.width || 100);
          const heightFeet = Number(backendPanel.height_feet || backendPanel.height || 100);
          const xFeet = Number(backendPanel.x || 0);
          const yFeet = Number(backendPanel.y || 0);
          
          // Generate stable ID - prioritize non-empty values
          const rollNumber = backendPanel.roll_number && backendPanel.roll_number !== '' ? backendPanel.roll_number : null;
          const panelNumber = backendPanel.panel_number && backendPanel.panel_number !== '' ? backendPanel.panel_number : null;
          const generatedId = `panel-${projectId}-${xFeet}-${yFeet}-${widthFeet}-${heightFeet}`;
          
          const panelId = backendPanel.id || rollNumber || panelNumber || generatedId;
          
          console.log('🔍 [usePanelData] Panel ID generation:', {
            originalId: backendPanel.id,
            rollNumber,
            panelNumber,
            generatedId,
            finalId: panelId
          });
          
          return {
            id: panelId,
            width: widthFeet, // Keep in world units (feet)
            height: heightFeet, // Keep in world units (feet)
            x: xFeet, // Keep in world units (feet)
            y: yFeet, // Keep in world units (feet)
            rotation: backendPanel.rotation || 0,
            isValid: true,
            shape: backendPanel.shape || backendPanel.type || 'rectangle',
            type: backendPanel.type || 'panel',
            model: backendPanel.model || 'Unknown',
            manufacturer: backendPanel.manufacturer || 'Unknown',
            power: backendPanel.power || 0,
            efficiency: backendPanel.efficiency || 0,
            panelNumber: panelNumber || `P${index + 1}`,
            rollNumber: rollNumber || `R${index + 1}`,
            color: backendPanel.color || '#3b82f6',
            fill: backendPanel.fill || '#3b82f6',
            date: backendPanel.date || new Date().toISOString().split('T')[0],
            location: backendPanel.location || 'Unknown'
          };
        }) || []
      };
      
      console.log('🔍 [usePanelData] Mapped layout:', mappedLayout);
      console.log('🔍 [usePanelData] Mapped panels count:', mappedLayout.panels.length);
      
      // Debug validation
      console.log('🔍 [usePanelData] Layout validation:', {
        hasId: !!mappedLayout.id,
        hasProjectId: !!mappedLayout.projectId,
        panelsIsArray: Array.isArray(mappedLayout.panels),
        panelsLength: mappedLayout.panels.length
      });
      
      if (mappedLayout.panels.length > 0) {
        console.log('🔍 [usePanelData] First panel validation:', {
          hasId: !!mappedLayout.panels[0].id,
          width: mappedLayout.panels[0].width,
          height: mappedLayout.panels[0].height,
          x: mappedLayout.panels[0].x,
          y: mappedLayout.panels[0].y,
          widthType: typeof mappedLayout.panels[0].width,
          heightType: typeof mappedLayout.panels[0].height,
          xType: typeof mappedLayout.panels[0].x,
          yType: typeof mappedLayout.panels[0].y
        });
        
        // Test individual panel validation
        const firstPanel = mappedLayout.panels[0];
        console.log('🔍 [usePanelData] Individual panel validation test:', {
          hasPanel: !!firstPanel,
          hasId: !!firstPanel.id,
          idType: typeof firstPanel.id,
          widthValid: typeof firstPanel.width === 'number' && firstPanel.width > 0,
          heightValid: typeof firstPanel.height === 'number' && firstPanel.height > 0,
          xValid: typeof firstPanel.x === 'number',
          yValid: typeof firstPanel.y === 'number',
          width: firstPanel.width,
          height: firstPanel.height,
          x: firstPanel.x,
          y: firstPanel.y
        });
      }

      // Test validation step by step
      console.log('🔍 [usePanelData] Testing validation step by step:');
      console.log('🔍 [usePanelData] Layout exists:', !!mappedLayout);
      console.log('🔍 [usePanelData] Layout ID type:', typeof mappedLayout.id);
      console.log('🔍 [usePanelData] Project ID type:', typeof mappedLayout.projectId);
      console.log('🔍 [usePanelData] Panels is array:', Array.isArray(mappedLayout.panels));
      
      if (mappedLayout.panels.length > 0) {
        console.log('🔍 [usePanelData] Testing first panel validation:');
        const firstPanelValid = validatePanel(mappedLayout.panels[0]);
        console.log('🔍 [usePanelData] First panel valid:', firstPanelValid);
      }
      
      const layoutValid = validatePanelLayout(mappedLayout);
      console.log('🔍 [usePanelData] Layout validation result:', layoutValid);

      if (layoutValid) {
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
        console.log('🔍 [SHAPE DEBUG] Merge logic - panel shape fields:', {
          panelId: panel.id,
          backendShape: panel.shape,
          localShape: localPosition.shape,
          finalShape: localPosition.shape || panel.shape || 'rectangle'
        });
        return {
          ...panel,
          x: localPosition.x,
          y: localPosition.y,
          rotation: localPosition.rotation ?? panel.rotation,
          // Use shape from localStorage if available, otherwise from backend
          shape: localPosition.shape || panel.shape || 'rectangle',
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
  }, [projectId]); // Only depend on projectId - other functions are stable

  // Auth state monitoring
  useEffect(() => {
    console.log('[usePanelData] Setting up auth state monitoring...');
    
    const unsubscribe = authManager.onAuthStateChange((state: AuthState) => {
      console.log('[usePanelData] Auth state changed:', state);
      setAuthState({
        isAuthenticated: state.isAuthenticated,
        error: state.error
      });
    });

    // Initial check
    authManager.getAuthState().then(state => {
      console.log('[usePanelData] Initial auth state:', state);
      setAuthState({
        isAuthenticated: state.isAuthenticated,
        error: state.error
      });
    });

    return unsubscribe;
  }, []);

  // Atomic panel position update with robust authentication
  const updatePanelPosition = useCallback(async (panelId: string, position: { x: number; y: number; rotation?: number }) => {
    // Update local state immediately for responsive UI
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
            rotation: panel.rotation,
            shape: panel.shape // Include shape in localStorage
          };
        });
        saveToLocalStorage(positionMap);
      }

      debugLog(`Updated panel ${panelId} position locally`, position);

      return {
        ...prev,
        panels: updatedPanels,
        lastUpdated: Date.now()
      };
    });

    // Only attempt backend save if authenticated
    console.log('[usePanelData] Auth state check:', { 
      isAuthenticated: authState.isAuthenticated, 
      error: authState.error 
    });
    
    if (!authState.isAuthenticated) {
      debugLog('Not authenticated, skipping backend save', { panelId, position });
      return;
    }

    // Send update to backend using robust API client
    try {
      debugLog(`Sending panel ${panelId} position update to backend`, position);
      
      const result = await apiClient.request('/api/panel-layout/move-panel', {
        method: 'POST',
        body: {
          projectId,
          panelId,
          newPosition: position
        }
      });

      debugLog('Backend panel update successful', result);
      
    } catch (error) {
      console.error('Failed to update panel position in backend:', error);
      
      const apiError = error as any;
      let userMessage = 'Failed to save panel position';
      
      if (apiError.isAuthError) {
        userMessage = 'Authentication expired. Panel saved locally only.';
        // Optionally trigger re-authentication flow
      } else if (apiError.isRetryable) {
        userMessage = 'Server temporarily unavailable. Panel saved locally.';
      }
      
      // You can add toast notification here
      console.warn(userMessage);
      debugLog(`Backend update failed: ${userMessage}`, { panelId, position, error: apiError.message });
    }
  }, [projectId, flags.ENABLE_PERSISTENCE, saveToLocalStorage, debugLog, authState.isAuthenticated]);

  // Add new panel
  const addPanel = useCallback(async (panelData: Omit<Panel, 'id'>) => {
    debugLog('Adding new panel', panelData);

    // If not authenticated, add to local state only
    if (!authState.isAuthenticated) {
      debugLog('Not authenticated, adding panel to local state only');
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

        return {
          ...prev,
          panels: updatedPanels,
          lastUpdated: Date.now()
        };
      });
      return;
    }

    try {
      // Call backend to create panel using authenticated API client
      const result = await apiClient.request('/api/panel-layout/create-panel', {
        method: 'POST',
        body: {
          projectId,
          panelData: {
            x: panelData.x,
            y: panelData.y,
            width: panelData.width,
            height: panelData.height,
            rotation: panelData.rotation || 0,
            type: panelData.shape || 'rectangle',
            shape: panelData.shape || 'rectangle',
            rollNumber: panelData.rollNumber || '',
            panelNumber: panelData.panelNumber || '',
            material: 'HDPE', // Default material for geosynthetic panels
            thickness: 60 // Default thickness
          }
        },
        requireAuth: true
      });

      debugLog('Backend panel creation response:', result);

      const apiResult = result as { success: boolean; panel: any; error?: string };
      
      console.log('🔍 [addPanel] API result:', apiResult);
      
      if (apiResult.success && apiResult.panel) {
        // Convert backend panel to frontend Panel format
        const backendPanel = apiResult.panel;
        console.log('🔍 [addPanel] Backend panel:', backendPanel);
        console.log('🔍 [addPanel] Backend panel ID:', backendPanel.id);
        
        const newPanel: Panel = {
          id: backendPanel.id, // Always use the backend-generated ID
          width: backendPanel.width_feet || panelData.width,
          height: backendPanel.height_feet || panelData.height,
          x: backendPanel.x || panelData.x,
          y: backendPanel.y || panelData.y,
          rotation: backendPanel.rotation || panelData.rotation || 0,
          isValid: true,
          shape: panelData.shape || 'rectangle',
          panelNumber: backendPanel.panel_number || panelData.panelNumber,
          rollNumber: backendPanel.roll_number || panelData.rollNumber,
          color: panelData.color || '#3b82f6',
          fill: panelData.fill || '#3b82f6',
          date: panelData.date,
          location: panelData.location,
          meta: panelData.meta
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

          debugLog('Successfully added panel to state', newPanel);

          return {
            ...prev,
            panels: updatedPanels,
            lastUpdated: Date.now()
          };
        });
      } else {
        throw new Error(apiResult.error || 'Failed to create panel');
      }
    } catch (error) {
      console.error('Failed to create panel in backend:', error);
      
      // Fallback: Add to local state only
      debugLog('Backend creation failed, adding to local state only', error);
      const newPanel: Panel = {
        ...panelData,
        id: `local-panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

        return {
          ...prev,
          panels: updatedPanels,
          lastUpdated: Date.now()
        };
      });
    }
  }, [projectId, flags.ENABLE_PERSISTENCE, saveToLocalStorage, debugLog, authState.isAuthenticated]);

  // Remove panel
  const removePanel = useCallback(async (panelId: string) => {
    try {
      debugLog(`🗑️ [removePanel] Starting deletion of panel ${panelId}`);
      
      // First, update local state optimistically
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
              rotation: panel.rotation,
              shape: panel.shape // Include shape in localStorage
            };
          });
          saveToLocalStorage(positionMap);
          console.log('🔍 [SHAPE DEBUG] Saved to localStorage with shapes:', positionMap);
        }

        debugLog(`Removed panel ${panelId} from local state`);

        return {
          ...prev,
          panels: updatedPanels,
          lastUpdated: Date.now()
        };
      });

      // Then, persist to backend if authenticated and panel is not local-only
      if (authState.isAuthenticated && projectId && !panelId.startsWith('local-panel-')) {
        try {
          debugLog(`🗑️ [removePanel] Calling API to delete panel ${panelId} from backend`);
          console.log('🔍 [removePanel] Deleting panel with ID:', panelId);
          console.log('🔍 [removePanel] Project ID:', projectId);
          const { deletePanel } = await import('../lib/api');
          await deletePanel(projectId, panelId);
          debugLog(`✅ [removePanel] Successfully deleted panel ${panelId} from backend`);
        } catch (apiError) {
          console.error('❌ [removePanel] Failed to delete panel from backend:', apiError);
          // Optionally revert the local state change if API fails
          // For now, we'll keep the local deletion but log the error
          debugLog(`⚠️ [removePanel] Panel ${panelId} deleted locally but failed to persist to backend`);
        }
      } else {
        debugLog(`⚠️ [removePanel] Not authenticated or missing projectId, only deleted locally`);
      }
    } catch (error) {
      console.error('❌ [removePanel] Error during panel deletion:', error);
      debugLog(`❌ [removePanel] Failed to delete panel ${panelId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [flags.ENABLE_PERSISTENCE, saveToLocalStorage, debugLog, authState.isAuthenticated, projectId]);

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
  }, [projectId]); // Only depend on projectId - loadData is stable

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
