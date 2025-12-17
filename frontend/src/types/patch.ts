// Patch Type Definition
// Patches are distinct from Panels - always labeled "Patch" never "Panel"

export interface Patch {
  id: string;
  x: number; // World units (feet) - real measurements
  y: number; // World units (feet) - real measurements
  radius: number; // World units (feet) - for circle
  rotation: number; // Rotation in degrees
  isValid: boolean;
  patchNumber: string; // NOT panelNumber - always use patchNumber
  date: string;
  location?: string;
  notes?: string;
  color?: string;
  fill?: string;
  material?: string;
  thickness?: number;
  meta?: {
    repairs?: any[];
    airTest?: { result: string };
  };
  asbuiltRecordId?: string; // Link to the form that created this patch
  panelId?: string; // Link to panel if patch is associated with a panel
}

// Patch dimensions - 3ft x 3ft patches
export const PATCH_CONFIG = {
  DIAMETER: 3, // 3 feet diameter
  RADIUS: 1.5, // 1.5 feet radius
} as const;

// Utility function to create a patch with correct dimensions
export function createPatch(id: string, x: number, y: number, patchNumber?: string): Patch {
  return {
    id,
    x,
    y,
    radius: PATCH_CONFIG.RADIUS,
    rotation: 0,
    isValid: true,
    patchNumber: patchNumber || `PATCH-${id.slice(0, 8)}`,
    date: new Date().toISOString().slice(0, 10),
    fill: '#ef4444', // Red color to distinguish from panels
    color: '#b91c1c',
  };
}

// Validation function
export function validatePatch(patch: any): patch is Patch {
  return (
    patch &&
    typeof patch.id === 'string' &&
    typeof patch.x === 'number' &&
    typeof patch.y === 'number' &&
    typeof patch.radius === 'number' &&
    typeof patch.rotation === 'number' &&
    typeof patch.isValid === 'boolean' &&
    typeof patch.patchNumber === 'string' &&
    patch.radius > 0
  );
}

// Patch layout interface
export interface PatchLayout {
  id: string;
  projectId: string;
  patches: Patch[];
  createdAt?: string;
  updatedAt?: string;
}

