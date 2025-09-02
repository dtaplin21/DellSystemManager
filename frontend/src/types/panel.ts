// Panel Layout System Types
// This file defines all the types used in the panel layout system

export interface Panel {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation?: number;
  isValid: boolean;
  shape?: 'rectangle' | 'triangle' | 'right-triangle';
  // Additional panel properties
  type?: string;
  model?: string;
  manufacturer?: string;
  power?: number;
  efficiency?: number;
}

export interface PanelLayout {
  id: string;
  projectId: string;
  panels: Panel[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Data state management types
export type DataState = 'loading' | 'loaded' | 'error' | 'empty';

export interface PanelDataState {
  state: DataState;
  panels: Panel[];
  error?: string;
  lastUpdated?: number;
}

// localStorage position data
export interface PanelPosition {
  x: number;
  y: number;
  rotation?: number;
}

export interface PanelPositionMap {
  [panelId: string]: PanelPosition;
}

// Feature flags
export interface FeatureFlags {
  ENABLE_PERSISTENCE: boolean;
  ENABLE_DRAGGING: boolean;
  ENABLE_LOCAL_STORAGE: boolean;
  ENABLE_DEBUG_LOGGING: boolean;
  ENABLE_WEBSOCKET_UPDATES: boolean;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PanelLayoutResponse extends ApiResponse<PanelLayout> {}
export interface ProjectResponse extends ApiResponse<Project> {}

// Validation functions
export function validatePanel(panel: any): panel is Panel {
  return (
    panel &&
    typeof panel.id === 'string' &&
    typeof panel.width === 'number' &&
    typeof panel.height === 'number' &&
    typeof panel.x === 'number' &&
    typeof panel.y === 'number' &&
    panel.width > 0 &&
    panel.height > 0
  );
}

export function validatePanelLayout(layout: any): layout is PanelLayout {
  return (
    layout &&
    typeof layout.id === 'string' &&
    typeof layout.projectId === 'string' &&
    Array.isArray(layout.panels) &&
    layout.panels.every(validatePanel)
  );
}

export function validatePanelPosition(position: any): position is PanelPosition {
  return (
    position &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    (position.rotation === undefined || typeof position.rotation === 'number')
  );
}

export function validatePanelPositionMap(positionMap: any): positionMap is PanelPositionMap {
  if (!positionMap || typeof positionMap !== 'object') return false;
  
  return Object.values(positionMap).every(validatePanelPosition);
}

// Utility functions
export function createEmptyPanel(id: string): Panel {
  return {
    id,
    width: 1,
    height: 1,
    x: 0,
    y: 0,
    rotation: 0,
    isValid: true,
    shape: 'rectangle'
  };
}

export function createEmptyLayout(projectId: string): PanelLayout {
  return {
    id: `layout-${Date.now()}`,
    projectId,
    panels: []
  };
}

// Default feature flags
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  ENABLE_PERSISTENCE: true,
  ENABLE_DRAGGING: true,
  ENABLE_LOCAL_STORAGE: true,
  ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
  ENABLE_WEBSOCKET_UPDATES: true
};