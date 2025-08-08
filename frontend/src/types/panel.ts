// Canonical panel types (backwards compatible)

// Include legacy shape strings for compatibility with existing components
export type PanelShape = 'rectangle' | 'square' | 'rightTriangle' | 'triangle' | 'right-triangle' | 'circle';

export interface PanelMeta {
  repairs: Array<{ id: string; type: string; description?: string; coords?: { x: number; y: number }; createdAt: string; updatedAt?: string }>;
  destructs?: Array<{ id: string; description?: string; createdAt: string }>;
  airTest?: { performedBy?: string; pressure?: number; durationMins?: number; result: 'pass' | 'fail' | 'pending'; notes?: string; date?: string };
  welder?: { id?: string; name?: string; shift?: string; method?: string; notes?: string };
  location?: { x: number; y: number; gridCell?: { row: number; col: number } };
  installedAt?: string; // ISO date
}

export interface Panel {
  id: string;
  shape: PanelShape;
  x: number; // world units (ft)
  y: number; // world units (ft)
  width: number; // world units (ft)
  height: number; // world units (ft)
  // Legacy dimension used by older components; keep in sync with height
  length: number; // world units (ft)
  rotation?: number; // degrees
  fill?: string;
  color?: string;
  meta: PanelMeta;

  // Legacy/compat fields (optional)
  date?: string;
  panelNumber?: string;
  rollNumber?: string;
  location?: string;
  points?: number[];
  radius?: number;
}