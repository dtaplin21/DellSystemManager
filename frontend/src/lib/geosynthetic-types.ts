// GEOSYNTHETIC LINER SYSTEM TYPES
// Shared type definitions for the geosynthetic liner system

export interface LinerRoll {
  id: string;
  x: number;           // World coordinates in FEET
  y: number;           // World coordinates in FEET  
  width: number;       // Roll width in FEET (typically 15-25 feet)
  length: number;      // Roll length in FEET (varies widely)
  rotation?: number;   // Rotation in degrees
  rollNumber?: string; // Roll identification number
  panelNumber?: string; // Panel/section number (keeping your existing terminology)
  material?: string;   // Liner material type
  thickness?: number;  // Material thickness in mils
}

export interface LinerSystemState {
  rolls: LinerRoll[];
  viewport: import('./viewport-transform').ViewportState;
  selectedRollId: string | null;
  isDirty: boolean;
}

// Backward compatibility types for existing panel system
export interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  panelNumber?: string;
  rollNumber?: string;
}

export interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
}
