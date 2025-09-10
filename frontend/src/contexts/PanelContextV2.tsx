'use client';

import React, { createContext, useContext, useReducer, ReactNode, useCallback, useMemo, useRef } from 'react';
import { Panel, PanelLayout, FeatureFlags } from '@/types/panel';
import { validatePanel, WORLD_CONSTANTS } from '@/lib/world-coordinates';
import { debounce } from 'lodash';

// State interfaces for Phase 2
interface CanvasState {
  // Transform state (managed by useZoomPan)
  transform: {
    x: number;
    y: number;
    scale: number;
  };
  
  // UI state
  selectedPanelId: string | null;
  isDragging: boolean;
  isPanning: boolean;
  
  // Performance state
  isLowPerformance: boolean;
  renderingQuality: 'high' | 'medium' | 'low';
}

interface PanelState {
  panels: Panel[];
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  lastUpdated: number;
}

interface FullscreenState {
  isFullscreen: boolean;
  miniSidebar: boolean;
}

interface AppState {
  canvas: CanvasState;
  panels: PanelState;
  fullscreen: FullscreenState;
  featureFlags: FeatureFlags;
}

// Action types
type CanvasAction = 
  | { type: 'SET_TRANSFORM'; payload: { x: number; y: number; scale: number } }
  | { type: 'SELECT_PANEL'; payload: string | null }
  | { type: 'START_DRAG'; payload: { panelId: string; x: number; y: number } }
  | { type: 'END_DRAG' }
  | { type: 'START_PAN' }
  | { type: 'END_PAN' }
  | { type: 'SET_PERFORMANCE_MODE'; payload: { isLowPerformance: boolean; renderingQuality: 'high' | 'medium' | 'low' } };

type PanelAction = 
  | { type: 'SET_PANELS'; payload: Panel[] }
  | { type: 'UPDATE_PANEL'; payload: { id: string; updates: Partial<Panel> } }
  | { type: 'ADD_PANEL'; payload: Panel }
  | { type: 'REMOVE_PANEL'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'BATCH_UPDATE_PANELS'; payload: Record<string, Partial<Panel>> };

type FullscreenAction = 
  | { type: 'SET_FULLSCREEN'; payload: boolean }
  | { type: 'TOGGLE_MINI_SIDEBAR' };

type AppAction = 
  | { type: 'CANVAS'; payload: CanvasAction }
  | { type: 'PANELS'; payload: PanelAction }
  | { type: 'FULLSCREEN'; payload: FullscreenAction }
  | { type: 'SET_FEATURE_FLAGS'; payload: FeatureFlags };

// Initial state
const initialCanvasState: CanvasState = {
  transform: { x: 0, y: 0, scale: 1 },
  selectedPanelId: null,
  isDragging: false,
  isPanning: false,
  isLowPerformance: false,
  renderingQuality: 'high'
};

const initialPanelState: PanelState = {
  panels: [],
  isLoading: false,
  error: null,
  hasUnsavedChanges: false,
  lastUpdated: Date.now()
};

const initialFullscreenState: FullscreenState = {
  isFullscreen: false,
  miniSidebar: false
};

const initialState: AppState = {
  canvas: initialCanvasState,
  panels: initialPanelState,
  fullscreen: initialFullscreenState,
  featureFlags: {
    ENABLE_PERSISTENCE: true,
    ENABLE_DRAGGING: true,
    ENABLE_LOCAL_STORAGE: true,
    ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
    ENABLE_WEBSOCKET_UPDATES: true
  }
};

// Reducers
function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'SET_TRANSFORM':
      return {
        ...state,
        transform: action.payload
      };
    
    case 'SELECT_PANEL':
      return {
        ...state,
        selectedPanelId: action.payload
      };
    
    case 'START_DRAG':
      return {
        ...state,
        isDragging: true,
        selectedPanelId: action.payload.panelId
      };
    
    case 'END_DRAG':
      return {
        ...state,
        isDragging: false,
        selectedPanelId: null
      };
    
    case 'START_PAN':
      return {
        ...state,
        isPanning: true
      };
    
    case 'END_PAN':
      return {
        ...state,
        isPanning: false
      };
    
    case 'SET_PERFORMANCE_MODE':
      return {
        ...state,
        isLowPerformance: action.payload.isLowPerformance,
        renderingQuality: action.payload.renderingQuality
      };
    
    default:
      return state;
  }
}

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'SET_PANELS':
      return {
        ...state,
        panels: action.payload.map(validatePanel),
        hasUnsavedChanges: false,
        lastUpdated: Date.now()
      };
    
    case 'UPDATE_PANEL':
      return {
        ...state,
        panels: state.panels.map(panel =>
          panel.id === action.payload.id
            ? validatePanel({ ...panel, ...action.payload.updates })
            : panel
        ),
        hasUnsavedChanges: true,
        lastUpdated: Date.now()
      };
    
    case 'BATCH_UPDATE_PANELS':
      return {
        ...state,
        panels: state.panels.map(panel => {
          const updates = action.payload[panel.id];
          return updates ? validatePanel({ ...panel, ...updates }) : panel;
        }),
        hasUnsavedChanges: true,
        lastUpdated: Date.now()
      };
    
    case 'ADD_PANEL':
      return {
        ...state,
        panels: [...state.panels, validatePanel(action.payload)],
        hasUnsavedChanges: true,
        lastUpdated: Date.now()
      };
    
    case 'REMOVE_PANEL':
      return {
        ...state,
        panels: state.panels.filter(panel => panel.id !== action.payload),
        hasUnsavedChanges: true,
        lastUpdated: Date.now()
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
    
    case 'SET_UNSAVED_CHANGES':
      return {
        ...state,
        hasUnsavedChanges: action.payload
      };
    
    default:
      return state;
  }
}

function fullscreenReducer(state: FullscreenState, action: FullscreenAction): FullscreenState {
  switch (action.type) {
    case 'SET_FULLSCREEN':
      return { ...state, isFullscreen: action.payload };
    
    case 'TOGGLE_MINI_SIDEBAR':
      return { ...state, miniSidebar: !state.miniSidebar };
    
    default:
      return state;
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CANVAS':
      return {
        ...state,
        canvas: canvasReducer(state.canvas, action.payload)
      };
    
    case 'PANELS':
      return {
        ...state,
        panels: panelReducer(state.panels, action.payload)
      };
    
    case 'FULLSCREEN':
      return {
        ...state,
        fullscreen: fullscreenReducer(state.fullscreen, action.payload)
      };
    
    case 'SET_FEATURE_FLAGS':
      return {
        ...state,
        featureFlags: action.payload
      };
    
    default:
      return state;
  }
}

// Context
const PanelContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider component
interface PanelProviderProps {
  children: ReactNode;
  initialPanels?: Panel[];
  featureFlags?: Partial<FeatureFlags>;
}

export function PanelProvider({ children, initialPanels = [], featureFlags = {} }: PanelProviderProps) {
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    panels: { ...initialPanelState, panels: initialPanels },
    featureFlags: { ...initialState.featureFlags, ...featureFlags },
  });

  // Sync initial panels with state
  const initialPanelsRef = useRef(initialPanels);
  const lastSyncedPanelsRef = useRef<Panel[]>([]);

  useEffect(() => {
    if (initialPanelsRef.current !== initialPanels) {
      initialPanelsRef.current = initialPanels;
      const currentPanels = state.panels.panels;
      if (currentPanels.length !== initialPanels.length ||
          !currentPanels.every((panel, index) =>
            initialPanels[index] && panel.id === initialPanels[index].id
          )) {
        lastSyncedPanelsRef.current = initialPanels;
        dispatch({ type: 'PANELS', payload: { type: 'SET_PANELS', payload: initialPanels } });
      }
    }
  }, [initialPanels, state.panels.panels]);

  return (
    <PanelContext.Provider value={{ state, dispatch }}>
      {children}
    </PanelContext.Provider>
  );
}

// Custom hooks
export function usePanelContext() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a PanelProvider');
  }
  return context;
}

export function useCanvasState() {
  const { state, dispatch } = usePanelContext();
  
  const setTransform = useCallback((transform: { x: number; y: number; scale: number }) => {
    dispatch({ type: 'CANVAS', payload: { type: 'SET_TRANSFORM', payload: transform } });
  }, [dispatch]);

  const selectPanel = useCallback((panelId: string | null) => {
    dispatch({ type: 'CANVAS', payload: { type: 'SELECT_PANEL', payload: panelId } });
  }, [dispatch]);

  const startDrag = useCallback((panelId: string, x: number, y: number) => {
    dispatch({ type: 'CANVAS', payload: { type: 'START_DRAG', payload: { panelId, x, y } } });
  }, [dispatch]);

  const endDrag = useCallback(() => {
    dispatch({ type: 'CANVAS', payload: { type: 'END_DRAG' } });
  }, [dispatch]);

  const startPan = useCallback(() => {
    dispatch({ type: 'CANVAS', payload: { type: 'START_PAN' } });
  }, [dispatch]);

  const endPan = useCallback(() => {
    dispatch({ type: 'CANVAS', payload: { type: 'END_PAN' } });
  }, [dispatch]);

  const setPerformanceMode = useCallback((isLowPerformance: boolean, renderingQuality: 'high' | 'medium' | 'low') => {
    dispatch({ type: 'CANVAS', payload: { type: 'SET_PERFORMANCE_MODE', payload: { isLowPerformance, renderingQuality } } });
  }, [dispatch]);

  return {
    canvas: state.canvas,
    setTransform,
    selectPanel,
    startDrag,
    endDrag,
    startPan,
    endPan,
    setPerformanceMode
  };
}

export function usePanelState() {
  const { state, dispatch } = usePanelContext();

  // Debounced panel updates to prevent excessive re-renders
  const debouncedUpdatePanel = useMemo(
    () => debounce((panelId: string, updates: Partial<Panel>) => {
      dispatch({ type: 'PANELS', payload: { type: 'UPDATE_PANEL', payload: { id: panelId, updates } } });
    }, 16),
    [dispatch]
  );

  const debouncedBatchUpdate = useMemo(
    () => debounce((updates: Record<string, Partial<Panel>>) => {
      dispatch({ type: 'PANELS', payload: { type: 'BATCH_UPDATE_PANELS', payload: updates } });
    }, 16),
    [dispatch]
  );

  const setPanels = useCallback((panels: Panel[]) => {
    dispatch({ type: 'PANELS', payload: { type: 'SET_PANELS', payload: panels } });
  }, [dispatch]);

  const updatePanel = useCallback((panelId: string, updates: Partial<Panel>) => {
    debouncedUpdatePanel(panelId, updates);
  }, [debouncedUpdatePanel]);

  const batchUpdatePanels = useCallback((updates: Record<string, Partial<Panel>>) => {
    debouncedBatchUpdate(updates);
  }, [debouncedBatchUpdate]);

  const addPanel = useCallback((panel: Panel) => {
    dispatch({ type: 'PANELS', payload: { type: 'ADD_PANEL', payload: panel } });
  }, [dispatch]);

  const removePanel = useCallback((panelId: string) => {
    dispatch({ type: 'PANELS', payload: { type: 'REMOVE_PANEL', payload: panelId } });
  }, [dispatch]);

  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: 'PANELS', payload: { type: 'SET_LOADING', payload: isLoading } });
  }, [dispatch]);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'PANELS', payload: { type: 'SET_ERROR', payload: error } });
  }, [dispatch]);

  const setUnsavedChanges = useCallback((hasUnsavedChanges: boolean) => {
    dispatch({ type: 'PANELS', payload: { type: 'SET_UNSAVED_CHANGES', payload: hasUnsavedChanges } });
  }, [dispatch]);

  // Cleanup debounced functions on unmount
  useEffect(() => {
    return () => {
      debouncedUpdatePanel.cancel();
      debouncedBatchUpdate.cancel();
    };
  }, [debouncedUpdatePanel, debouncedBatchUpdate]);

  return {
    panels: state.panels,
    setPanels,
    updatePanel,
    batchUpdatePanels,
    addPanel,
    removePanel,
    setLoading,
    setError,
    setUnsavedChanges
  };
}

export function useFullscreenState() {
  const { state, dispatch } = usePanelContext();

  const setFullscreen = useCallback((isFullscreen: boolean) => {
    dispatch({ type: 'FULLSCREEN', payload: { type: 'SET_FULLSCREEN', payload: isFullscreen } });
  }, [dispatch]);

  const toggleMiniSidebar = useCallback(() => {
    dispatch({ type: 'FULLSCREEN', payload: { type: 'TOGGLE_MINI_SIDEBAR' } });
  }, [dispatch]);

  return {
    fullscreen: state.fullscreen,
    setFullscreen,
    toggleMiniSidebar
  };
}

export function useFeatureFlags() {
  const { state } = usePanelContext();
  return state.featureFlags;
}

// Utility hooks
export function useSelectedPanel() {
  const { state } = usePanelContext();
  const selectedPanelId = state.canvas.selectedPanelId;
  
  return useMemo(() => {
    if (!selectedPanelId) return null;
    return state.panels.panels.find(panel => panel.id === selectedPanelId) || null;
  }, [selectedPanelId, state.panels.panels]);
}

export function usePanelById(panelId: string) {
  const { state } = usePanelContext();
  
  return useMemo(() => {
    return state.panels.panels.find(panel => panel.id === panelId) || null;
  }, [panelId, state.panels.panels]);
}

export function useValidPanels() {
  const { state } = usePanelContext();
  
  return useMemo(() => {
    return state.panels.panels.filter(panel => panel.isValid);
  }, [state.panels.panels]);
}

export default PanelContext;
