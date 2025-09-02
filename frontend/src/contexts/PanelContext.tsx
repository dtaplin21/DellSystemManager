'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Panel, PanelPositionMap, FeatureFlags } from '@/types/panel';

// State interfaces
interface CanvasState {
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
  isDragging: boolean;
  isPanning: boolean;
  selectedPanelId: string | null;
  dragStartX: number;
  dragStartY: number;
  lastMouseX: number;
  lastMouseY: number;
}

interface PanelState {
  panels: Panel[];
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
}

interface FullscreenState {
  isFullscreen: boolean;
  miniSidebarVisible: boolean;
  miniSidebarExpanded: boolean;
  selectedPanel: Panel | null;
}

interface AppState {
  canvas: CanvasState;
  panels: PanelState;
  fullscreen: FullscreenState;
  featureFlags: FeatureFlags;
}

// Action types
type CanvasAction = 
  | { type: 'SET_WORLD_SCALE'; payload: number }
  | { type: 'SET_WORLD_OFFSET'; payload: { x: number; y: number } }
  | { type: 'START_DRAG'; payload: { x: number; y: number; panelId: string } }
  | { type: 'UPDATE_DRAG'; payload: { x: number; y: number } }
  | { type: 'END_DRAG' }
  | { type: 'START_PAN'; payload: { x: number; y: number } }
  | { type: 'UPDATE_PAN'; payload: { x: number; y: number } }
  | { type: 'END_PAN' }
  | { type: 'SELECT_PANEL'; payload: string | null };

type PanelAction =
  | { type: 'SET_PANELS'; payload: Panel[] }
  | { type: 'UPDATE_PANEL'; payload: { id: string; updates: Partial<Panel> } }
  | { type: 'ADD_PANEL'; payload: Panel }
  | { type: 'REMOVE_PANEL'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean };

type FullscreenAction =
  | { type: 'SET_FULLSCREEN'; payload: boolean }
  | { type: 'TOGGLE_MINI_SIDEBAR' }
  | { type: 'SET_MINI_SIDEBAR_EXPANDED'; payload: boolean }
  | { type: 'SET_SELECTED_PANEL'; payload: Panel | null };

type AppAction = 
  | { type: 'CANVAS'; payload: CanvasAction }
  | { type: 'PANELS'; payload: PanelAction }
  | { type: 'FULLSCREEN'; payload: FullscreenAction };

// Initial state
const initialCanvasState: CanvasState = {
  worldScale: 1,
  worldOffsetX: 0,
  worldOffsetY: 0,
  isDragging: false,
  isPanning: false,
  selectedPanelId: null,
  dragStartX: 0,
  dragStartY: 0,
  lastMouseX: 0,
  lastMouseY: 0,
};

const initialPanelState: PanelState = {
  panels: [],
  isLoading: false,
  error: null,
  hasUnsavedChanges: false,
};

const initialFullscreenState: FullscreenState = {
  isFullscreen: false,
  miniSidebarVisible: false,
  miniSidebarExpanded: false,
  selectedPanel: null,
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
    ENABLE_WEBSOCKET_UPDATES: true,
  },
};

// Reducers
function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'SET_WORLD_SCALE':
      return { ...state, worldScale: action.payload };
    
    case 'SET_WORLD_OFFSET':
      return { ...state, worldOffsetX: action.payload.x, worldOffsetY: action.payload.y };
    
    case 'START_DRAG':
      return {
        ...state,
        isDragging: true,
        selectedPanelId: action.payload.panelId,
        dragStartX: action.payload.x,
        dragStartY: action.payload.y,
        lastMouseX: action.payload.x,
        lastMouseY: action.payload.y,
      };
    
    case 'UPDATE_DRAG':
      return {
        ...state,
        lastMouseX: action.payload.x,
        lastMouseY: action.payload.y,
      };
    
    case 'END_DRAG':
      return {
        ...state,
        isDragging: false,
        selectedPanelId: null,
      };
    
    case 'START_PAN':
      return {
        ...state,
        isPanning: true,
        lastMouseX: action.payload.x,
        lastMouseY: action.payload.y,
      };
    
    case 'UPDATE_PAN':
      return {
        ...state,
        lastMouseX: action.payload.x,
        lastMouseY: action.payload.y,
      };
    
    case 'END_PAN':
      return {
        ...state,
        isPanning: false,
      };
    
    case 'SELECT_PANEL':
      return {
        ...state,
        selectedPanelId: action.payload,
      };
    
    default:
      return state;
  }
}

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'SET_PANELS':
      return { ...state, panels: action.payload, hasUnsavedChanges: false };
    
    case 'UPDATE_PANEL':
      return {
        ...state,
        panels: state.panels.map(panel =>
          panel.id === action.payload.id
            ? { ...panel, ...action.payload.updates }
            : panel
        ),
        hasUnsavedChanges: true,
      };
    
    case 'ADD_PANEL':
      return {
        ...state,
        panels: [...state.panels, action.payload],
        hasUnsavedChanges: true,
      };
    
    case 'REMOVE_PANEL':
      return {
        ...state,
        panels: state.panels.filter(panel => panel.id !== action.payload),
        hasUnsavedChanges: true,
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.payload };
    
    default:
      return state;
  }
}

function fullscreenReducer(state: FullscreenState, action: FullscreenAction): FullscreenState {
  switch (action.type) {
    case 'SET_FULLSCREEN':
      return { ...state, isFullscreen: action.payload };
    
    case 'TOGGLE_MINI_SIDEBAR':
      return { ...state, miniSidebarVisible: !state.miniSidebarVisible };
    
    case 'SET_MINI_SIDEBAR_EXPANDED':
      return { ...state, miniSidebarExpanded: action.payload };
    
    case 'SET_SELECTED_PANEL':
      return { 
        ...state, 
        selectedPanel: action.payload,
        miniSidebarVisible: !!action.payload,
      };
    
    default:
      return state;
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CANVAS':
      return { ...state, canvas: canvasReducer(state.canvas, action.payload) };
    
    case 'PANELS':
      return { ...state, panels: panelReducer(state.panels, action.payload) };
    
    case 'FULLSCREEN':
      return { ...state, fullscreen: fullscreenReducer(state.fullscreen, action.payload) };
    
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

  return (
    <PanelContext.Provider value={{ state, dispatch }}>
      {children}
    </PanelContext.Provider>
  );
}

// Custom hooks for accessing context
export function usePanelContext() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a PanelProvider');
  }
  return context;
}

export function useCanvasState() {
  const { state, dispatch } = usePanelContext();
  return {
    canvas: state.canvas,
    dispatchCanvas: (action: CanvasAction) => dispatch({ type: 'CANVAS', payload: action }),
  };
}

export function usePanelState() {
  const { state, dispatch } = usePanelContext();
  return {
    panels: state.panels,
    dispatchPanels: (action: PanelAction) => dispatch({ type: 'PANELS', payload: action }),
  };
}

export function useFullscreenState() {
  const { state, dispatch } = usePanelContext();
  return {
    fullscreen: state.fullscreen,
    dispatchFullscreen: (action: FullscreenAction) => dispatch({ type: 'FULLSCREEN', payload: action }),
  };
}

export function useFeatureFlags() {
  const { state } = usePanelContext();
  return state.featureFlags;
}
