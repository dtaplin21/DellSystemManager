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
import { cleanupStalePanelIdsSilent } from '@/lib/localStorage-cleanup';

interface UsePanelDataOptions {
  projectId: string;
  featureFlags?: Partial<typeof DEFAULT_FEATURE_FLAGS>;
}

interface UsePanelDataReturn {
  dataState: PanelDataState;
  isLoading: boolean;
  error: string | null;
  panels: Panel[];
  updatePanelPosition: (panelId: string, position: { x: number; y: number; rotation: number }) => Promise<void>;
  addPanel: (panel: Omit<Panel, 'id'>) => Promise<void>;
  removePanel: (panelId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  clearLocalStorage: () => void;
  cleanupStalePanelIds: () => Promise<{ removed: number; kept: number; errors: string[] }>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';

export function usePanelData({ projectId, featureFlags = {} }: UsePanelDataOptions): UsePanelDataReturn {
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

  const debugLog = useCallback((...args: any[]) => {
    if (flags.ENABLE_DEBUG_LOGGING) {
      console.log('[usePanelData]', ...args);
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
      debugLog('🔍 [usePanelData] Fetching backend data for project', projectId);
      debugLog('🔍 [usePanelData] Backend URL:', `${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
      
      const response = await fetch(`${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
      debugLog('🔍 [usePanelData] Response status:', response.status, response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      debugLog('🔍 [usePanelData] ===== BACKEND RESPONSE RECEIVED =====');
      debugLog('🔍 [usePanelData] Full response:', JSON.stringify(data, null, 2));
      debugLog('🔍 [usePanelData] Success:', data.success);
      debugLog('🔍 [usePanelData] Layout exists:', !!data.layout);
      debugLog('🔍 [usePanelData] Panels count:', data.layout?.panels?.length || 0);
      debugLog('🔍 [usePanelData] First panel:', data.layout?.panels?.[0]);

      // Map backend data structure to frontend interface
      debugLog('🔍 [usePanelData] Mapping backend data...');
      debugLog('🔍 [usePanelData] data.layout:', data.layout);
      debugLog('🔍 [usePanelData] data.layout.panels:', data.layout?.panels);
      
      // CRITICAL FIX: The API returns { success: true, layout: { panels: [...] } }
      // But we were trying to access data.panels instead of data.layout.panels
      const mappedLayout = {
        id: data.layout?.id || `layout-${projectId}`,
        projectId: projectId,
        panels: data.layout?.panels?.map((backendPanel: any, index: number) => {
          debugLog('🔍 [usePanelData] Mapping panel:', backendPanel);
          debugLog('🔍 [SHAPE DEBUG] Backend panel shape fields:', {
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
          
          debugLog('🔍 [usePanelData] Panel ID generation:', {
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
            panelNumber: panelNumber || `${index + 1}`,
            rollNumber: rollNumber || `R${index + 1}`,
            color: backendPanel.color || '#87CEEB',
            fill: backendPanel.fill || '#87CEEB',
            date: backendPanel.date || new Date().toISOString().split('T')[0],
            location: backendPanel.location || 'Unknown'
          };
        }) || []
      };
      
      debugLog('🔍 [usePanelData] Mapped layout:', mappedLayout);
      debugLog('🔍 [usePanelData] Mapped panels count:', mappedLayout.panels.length);
      
      // Debug validation
      debugLog('🔍 [usePanelData] Layout validation:', {
        hasId: !!mappedLayout.id,
        hasProjectId: !!mappedLayout.projectId,
        panelsIsArray: Array.isArray(mappedLayout.panels),
        panelsLength: mappedLayout.panels.length
      });
      
      if (mappedLayout.panels.length > 0) {
        debugLog('🔍 [usePanelData] First panel validation:', {
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
        debugLog('🔍 [usePanelData] Individual panel validation test:', {
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
      debugLog('🔍 [usePanelData] Testing validation step by step:');
      debugLog('🔍 [usePanelData] Layout exists:', !!mappedLayout);
      debugLog('🔍 [usePanelData] Layout ID type:', typeof mappedLayout.id);
      debugLog('🔍 [usePanelData] Project ID type:', typeof mappedLayout.projectId);
      debugLog('🔍 [usePanelData] Panels is array:', Array.isArray(mappedLayout.panels));
      
      if (mappedLayout.panels.length > 0) {
        debugLog('🔍 [usePanelData] Testing first panel validation:');
        const firstPanelValid = validatePanel(mappedLayout.panels[0]);
        debugLog('🔍 [usePanelData] First panel valid:', firstPanelValid);
      }
      
      const layoutValid = validatePanelLayout(mappedLayout);
      debugLog('🔍 [usePanelData] Layout validation result:', layoutValid);

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
        debugLog('🔍 [SHAPE DEBUG] Merge logic - panel shape fields:', {
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
    debugLog('🔍 [usePanelData] ===== STARTING LOAD DATA =====');
    debugLog('🔍 [usePanelData] Project ID:', projectId);
    setDataState(prev => ({ ...prev, state: 'loading' }));

    try {
      // Load localStorage positions first
      const localPositions = loadLocalStorageData();
      debugLog('🔍 [usePanelData] Local positions:', localPositions);

      // Fetch backend data
      debugLog('🔍 [usePanelData] About to call fetchBackendData...');
      const backendLayout = await fetchBackendData();
      debugLog('🔍 [usePanelData] Backend layout received:', backendLayout);
      debugLog('🔍 [usePanelData] Backend layout panels:', backendLayout?.panels);
      debugLog('🔍 [usePanelData] Backend layout panels length:', backendLayout?.panels?.length);
      
      if (!backendLayout || !backendLayout.panels || backendLayout.panels.length === 0) {
        debugLog('🔍 [usePanelData] ❌ No backend data available - setting empty state');
        debugLog('🔍 [usePanelData] backendLayout exists:', !!backendLayout);
        debugLog('🔍 [usePanelData] backendLayout.panels exists:', !!backendLayout?.panels);
        debugLog('🔍 [usePanelData] backendLayout.panels.length:', backendLayout?.panels?.length);
        setDataState({
          state: 'empty',
          panels: [],
          lastUpdated: Date.now()
        });
        return;
      }

      // Merge data
      debugLog('🔍 [usePanelData] About to merge data...');
      const mergedPanels = mergeDataWithLocalStorage(backendLayout.panels, localPositions);
      debugLog('🔍 [usePanelData] Merged panels:', mergedPanels);
      debugLog('🔍 [usePanelData] Merged panels length:', mergedPanels.length);

      setDataState({
        state: 'loaded',
        panels: mergedPanels,
        lastUpdated: Date.now()
      });
      
      debugLog('🔍 [usePanelData] ✅ Data state set to loaded with', mergedPanels.length, 'panels');

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
    debugLog('[usePanelData] Setting up auth state monitoring...');
    
    const unsubscribe = authManager.onAuthStateChange((state: AuthState) => {
      debugLog('[usePanelData] Auth state changed:', state);
      setAuthState({
        isAuthenticated: state.isAuthenticated,
        error: state.error
      });
    });

    // Initial check
    authManager.getAuthState().then(state => {
      debugLog('[usePanelData] Initial auth state:', state);
      setAuthState({
        isAuthenticated: state.isAuthenticated,
        error: state.error
      });
    });

    return unsubscribe;
  }, []);

  // Atomic panel position update with robust authentication
  const updatePanelPosition = useCallback(async (panelId: string, position: { x: number; y: number; rotation: number }) => {
    // Validate panel exists in local state
    setDataState(prev => {
      if (prev.state !== 'loaded') return prev;
      
      const panel = prev.panels.find(p => p.id === panelId);
      if (!panel) {
        console.error('⚠️ [updatePanelPosition] Panel not found in local state:', panelId);
        console.error('⚠️ [updatePanelPosition] Available panel IDs:', prev.panels.map(p => p.id));
        return prev; // Don't update if panel doesn't exist locally
      }
      
      // Check if it's a local-only panel (never saved to backend)
      // Local panels have IDs like: 'local-panel-...' or 'panel-{timestamp}-{random}'
      const isLocalOnly = panelId.startsWith('local-panel-') || 
                         (panelId.startsWith('panel-') && !panelId.includes(projectId));
      
      if (isLocalOnly) {
        console.warn('⚠️ [updatePanelPosition] Panel is local-only, skipping backend update:', panelId);
        // Still update local state for UI responsiveness, but don't send to backend
        const updatedPanels = prev.panels.map(p =>
          p.id === panelId 
            ? { ...p, ...position, isValid: true }
            : p
        );
        
        // Update localStorage
        if (flags.ENABLE_PERSISTENCE) {
          const positionMap: PanelPositionMap = {};
          updatedPanels.forEach(p => {
            positionMap[p.id] = {
              x: p.x,
              y: p.y,
              rotation: p.rotation,
              shape: p.shape
            };
          });
          saveToLocalStorage(positionMap);
        }
        
        debugLog(`Updated local-only panel ${panelId} position locally`, position);
        return {
          ...prev,
          panels: updatedPanels,
          lastUpdated: Date.now()
        };
      }

      // Update local state immediately for responsive UI
      const updatedPanels = prev.panels.map(p =>
        p.id === panelId 
          ? { ...p, ...position, isValid: true }
          : p
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

    // Get current panel state to check if it's local-only
    // Note: We need to check the current state, not the updated state
    const currentPanel = dataState.state === 'loaded' 
      ? dataState.panels.find(p => p.id === panelId)
      : null;
    
    if (!currentPanel) {
      console.error('⚠️ [updatePanelPosition] Panel not found in current state:', panelId);
      return;
    }
    
    // Check if it's a local-only panel (never saved to backend)
    // Local panels have IDs like: 'local-panel-...' or 'panel-{timestamp}-{random}' (without projectId)
    const isLocalOnly = panelId.startsWith('local-panel-') || 
                       (panelId.startsWith('panel-') && !panelId.includes(projectId));
    
    if (isLocalOnly) {
      debugLog('Panel is local-only, skipping backend update', { panelId, position });
      return; // Local panels can't be moved in backend
    }

    // Only attempt backend save if authenticated
    debugLog('[usePanelData] Auth state check:', { 
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
          newPosition: {
            x: position.x,
            y: position.y,
            rotation: position.rotation || 0  // Ensure rotation is always included
          }
        }
      });

      debugLog('Backend panel update successful', result);
      
    } catch (error) {
      console.error('Failed to update panel position in backend:', error);
      
      const apiError = error as any;
      let userMessage = 'Failed to save panel position';
      
      // Check if the error is because the panel doesn't exist in the backend
      const errorMessage = apiError.message || '';
      const isPanelNotFound = errorMessage.includes('does not exist') || 
                             errorMessage.includes('not found') ||
                             (apiError.status === 500 && errorMessage.includes('Panel'));
      
      if (isPanelNotFound) {
        console.warn('⚠️ [updatePanelPosition] Panel does not exist in backend, removing from local state:', panelId);
        userMessage = 'Panel was deleted from server. Removing from view.';
        
        // Remove the panel from local state since it doesn't exist in backend
        setDataState(prev => {
          if (prev.state !== 'loaded') return prev;
          
          const filteredPanels = prev.panels.filter(p => p.id !== panelId);
          
          // Update localStorage to remove the deleted panel
          if (flags.ENABLE_PERSISTENCE) {
            const positionMap: PanelPositionMap = {};
            filteredPanels.forEach(panel => {
              positionMap[panel.id] = {
                x: panel.x,
                y: panel.y,
                rotation: panel.rotation,
                shape: panel.shape
              };
            });
            saveToLocalStorage(positionMap);
          }
          
          return {
            ...prev,
            panels: filteredPanels,
            lastUpdated: Date.now()
          };
        });
        
        debugLog(`Removed non-existent panel from state: ${panelId}`);
        return; // Don't show error message, panel has been removed
      }
      
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
  }, [projectId, flags.ENABLE_PERSISTENCE, saveToLocalStorage, debugLog, authState.isAuthenticated, dataState.panels, dataState.state]);

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
      
      debugLog('🔍 [addPanel] API result:', apiResult);
      
      if (apiResult.success && apiResult.panel) {
        // Convert backend panel to frontend Panel format
        const backendPanel = apiResult.panel;
        debugLog('🔍 [addPanel] Backend panel:', backendPanel);
        debugLog('🔍 [addPanel] Backend panel ID:', backendPanel.id);
        
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
          color: panelData.color || '#87CEEB',
          fill: panelData.fill || '#87CEEB',
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
          debugLog('🔍 [SHAPE DEBUG] Saved to localStorage with shapes:', positionMap);
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
          debugLog('🔍 [removePanel] Deleting panel with ID:', panelId);
          debugLog('🔍 [removePanel] Project ID:', projectId);
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

  // Cleanup stale panel IDs from localStorage
  const cleanupStalePanelIds = useCallback(async (): Promise<{ removed: number; kept: number; errors: string[] }> => {
    if (!projectId || typeof window === 'undefined') {
      return { removed: 0, kept: 0, errors: ['No projectId or not in browser'] };
    }

    debugLog('Starting cleanup of stale panel IDs');
    const result = await cleanupStalePanelIdsSilent(projectId);
    
    if (result.removed > 0) {
      debugLog(`Cleaned up ${result.removed} stale panel IDs, kept ${result.kept} valid IDs`);
      // Reload data after cleanup to refresh positions
      if (result.errors.length === 0) {
        // Small delay to ensure localStorage is updated
        setTimeout(() => {
          loadData().catch(err => {
            console.error('Failed to reload data after cleanup:', err);
          });
        }, 100);
      }
    } else {
      debugLog('No stale panel IDs found');
    }
    
    return result;
  }, [projectId, debugLog, loadData]);


  // Load data on mount - only on client side
  useEffect(() => {
    debugLog('🔍 [usePanelData] useEffect triggered - calling loadData');
    debugLog('🔍 [usePanelData] typeof window:', typeof window);
    debugLog('🔍 [usePanelData] isClient:', typeof window !== 'undefined');
    
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
      debugLog('🔍 [usePanelData] Skipping loadData - not on client side');
    }
  }, [projectId]); // Only depend on projectId - loadData is stable

  // Computed values
  const isLoading = dataState.state === 'loading';
  const error = dataState.error || null;
  const panels = dataState.panels;

  // Run cleanup on initial load (only once per project)
  const hasRunCleanup = useRef(false);
  useEffect(() => {
    if (!hasRunCleanup.current && projectId && typeof window !== 'undefined' && flags.ENABLE_LOCAL_STORAGE) {
      hasRunCleanup.current = true;
      // Run cleanup asynchronously after initial load
      setTimeout(() => {
        cleanupStalePanelIds().catch(err => {
          console.error('Cleanup failed on initial load:', err);
        });
      }, 2000); // Wait 2 seconds after load to avoid blocking
    }
  }, [projectId, cleanupStalePanelIds, flags.ENABLE_LOCAL_STORAGE]);

  return {
    dataState,
    isLoading,
    error,
    panels,
    updatePanelPosition,
    addPanel,
    removePanel,
    refreshData: loadData,
    clearLocalStorage,
    cleanupStalePanelIds
  };
}
