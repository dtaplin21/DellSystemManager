'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface LinerRoll {
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

interface ViewportState {
  // Viewport transforms - handles all scaling
  scale: number;        // Pixels per foot (dynamic)
  centerX: number;      // World X coordinate at viewport center (feet)
  centerY: number;      // World Y coordinate at viewport center (feet)
  canvasWidth: number;  // Canvas pixel dimensions
  canvasHeight: number;
}

interface LinerSystemState {
  rolls: LinerRoll[];
  viewport: ViewportState;
  selectedRollId: string | null;
  isDirty: boolean;
}

// SITE CONFIGURATION FOR GEOSYNTHETIC LINERS
const SITE_CONFIG = {
  // Typical liner roll dimensions (feet)
  TYPICAL_ROLL_WIDTH: 20,    // 20 feet wide rolls are common
  TYPICAL_ROLL_LENGTH: 100,  // Variable length, 100ft example
  
  // Site dimensions for 200 rolls east-west, 50 north-south
  SITE_WIDTH: 4000,   // 200 rolls × 20ft width
  SITE_HEIGHT: 5000,  // 50 rolls × 100ft length
  
  // Viewport limits
  MIN_SCALE: 0.02,    // Very zoomed out to see entire large site
  MAX_SCALE: 10,      // Zoomed in for detail work
  
  // Grid settings (feet)
  GRID_SIZE: 10,      // 10-foot grid lines
  MAJOR_GRID: 50,     // 50-foot major grid lines
  
  // Roll spacing
  MIN_OVERLAP: 1,     // Minimum 1-foot overlap between rolls
  SEAM_WIDTH: 2       // 2-foot seam allowance
};

// VIEWPORT UTILITIES
class ViewportTransform {
  constructor(private viewport: ViewportState) {}
  
  // Convert world coordinates (feet) to screen coordinates (pixels)
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const screenX = (worldX - this.viewport.centerX) * this.viewport.scale + this.viewport.canvasWidth / 2;
    const screenY = (worldY - this.viewport.centerY) * this.viewport.scale + this.viewport.canvasHeight / 2;
    return { x: screenX, y: screenY };
  }
  
  // Convert screen coordinates (pixels) to world coordinates (feet)
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const worldX = (screenX - this.viewport.canvasWidth / 2) / this.viewport.scale + this.viewport.centerX;
    const worldY = (screenY - this.viewport.canvasHeight / 2) / this.viewport.scale + this.viewport.centerY;
    return { x: worldX, y: worldY };
  }
  
  // Get visible world bounds
  getVisibleBounds(): { left: number; top: number; right: number; bottom: number } {
    const halfWidth = this.viewport.canvasWidth / (2 * this.viewport.scale);
    const halfHeight = this.viewport.canvasHeight / (2 * this.viewport.scale);
    
    return {
      left: this.viewport.centerX - halfWidth,
      right: this.viewport.centerX + halfWidth,
      top: this.viewport.centerY - halfHeight,
      bottom: this.viewport.centerY + halfHeight
    };
  }
  
  // Zoom to fit entire site
  fitToSite(): Partial<ViewportState> {
    const scaleX = this.viewport.canvasWidth / SITE_CONFIG.SITE_WIDTH;
    const scaleY = this.viewport.canvasHeight / SITE_CONFIG.SITE_HEIGHT;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add padding
    
    return {
      scale: Math.max(SITE_CONFIG.MIN_SCALE, Math.min(SITE_CONFIG.MAX_SCALE, scale)),
      centerX: SITE_CONFIG.SITE_WIDTH / 2,
      centerY: SITE_CONFIG.SITE_HEIGHT / 2
    };
  }
}

// GEOSYNTHETIC LINER SYSTEM HOOK - Single source of truth
export function useLinerSystem(projectId: string) {
  const [state, setState] = useState<LinerSystemState>({
    rolls: [],
    viewport: {
      scale: 0.1,
      centerX: SITE_CONFIG.SITE_WIDTH / 2,
      centerY: SITE_CONFIG.SITE_HEIGHT / 2,
      canvasWidth: 800,
      canvasHeight: 600
    },
    selectedRollId: null,
    isDirty: false
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debounced persistence
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const updateRoll = useCallback((rollId: string, updates: Partial<LinerRoll>) => {
    setState(prev => ({
      ...prev,
      rolls: prev.rolls.map(r => 
        r.id === rollId ? { ...r, ...updates } : r
      ),
      isDirty: true
    }));
    
    // Debounced save to backend
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/panels/${rollId}`, {  // Keep your existing API endpoint
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Convert to your backend format
            x: updates.x,
            y: updates.y,
            width_feet: updates.width,
            height_feet: updates.length,  // Map length to height for backend
            rotation: updates.rotation,
            roll_number: updates.rollNumber,
            panel_number: updates.panelNumber
          })
        });
        setState(prev => ({ ...prev, isDirty: false }));
      } catch (err) {
        console.error('Failed to save roll:', err);
      }
    }, 500);
  }, []);
  
  const updateViewport = useCallback((viewportUpdates: Partial<ViewportState>) => {
    setState(prev => ({
      ...prev,
      viewport: { ...prev.viewport, ...viewportUpdates }
    }));
    
    // Persist viewport to localStorage
    const newViewport = { ...state.viewport, ...viewportUpdates };
    localStorage.setItem(`viewport_${projectId}`, JSON.stringify({
      scale: newViewport.scale,
      centerX: newViewport.centerX,
      centerY: newViewport.centerY
    }));
  }, [state.viewport, projectId]);
  
  const selectRoll = useCallback((rollId: string | null) => {
    setState(prev => ({ ...prev, selectedRollId: rollId }));
  }, []);
  
  // Generate automatic roll layout (for when no positions exist)
  const generateRollLayout = useCallback((rollCount: number): LinerRoll[] => {
    const rolls: LinerRoll[] = [];
    const rollsPerRow = 200; // Your requirement: 200 east-west
    const rowsCount = 50;    // Your requirement: 50 north-south
    
    for (let i = 0; i < rollCount; i++) {
      const row = Math.floor(i / rollsPerRow);
      const col = i % rollsPerRow;
      
      // Calculate position with proper spacing
      const x = col * SITE_CONFIG.TYPICAL_ROLL_WIDTH;
      const y = row * SITE_CONFIG.TYPICAL_ROLL_LENGTH;
      
      rolls.push({
        id: `roll-${i + 1}`,
        x,
        y,
        width: SITE_CONFIG.TYPICAL_ROLL_WIDTH,
        length: SITE_CONFIG.TYPICAL_ROLL_LENGTH,
        rotation: 0,
        rollNumber: `R${i + 1}`,
        panelNumber: `P${Math.floor(i / 20) + 1}`, // Group into panels of 20 rolls
        material: 'HDPE',
        thickness: 60  // 60 mil typical
      });
    }
    
    return rolls;
  }, []);
  
  const fitToSite = useCallback(() => {
    const transform = new ViewportTransform(state.viewport);
    const updates = transform.fitToSite();
    updateViewport(updates);
  }, [state.viewport, updateViewport]);
  
  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        
        // Load rolls from backend (using your existing API)
        const response = await fetch(`/api/panel-layout/ssr-layout/${projectId}`);
        const backendData = await response.json();
        
        let rolls: LinerRoll[] = [];
        
        if (backendData.success && backendData.layout?.panels?.length > 0) {
          // Convert backend panel data to liner rolls
          rolls = backendData.layout.panels.map((p: any, index: number) => ({
            id: p.id || `roll-${index + 1}`,
            x: p.x || 0,
            y: p.y || 0,
            width: p.width_feet || p.width || SITE_CONFIG.TYPICAL_ROLL_WIDTH,
            length: p.height_feet || p.height || SITE_CONFIG.TYPICAL_ROLL_LENGTH,
            rotation: p.rotation || 0,
            rollNumber: p.roll_number || p.rollNumber || `R${index + 1}`,
            panelNumber: p.panel_number || p.panelNumber || `P${Math.floor(index / 20) + 1}`,
            material: p.material || 'HDPE',
            thickness: p.thickness || 60
          }));
        } else {
          // Generate default layout if no backend data
          rolls = generateRollLayout(1000); // Generate 1000 rolls as example
        }
        
        // Load viewport from localStorage
        const savedViewport = localStorage.getItem(`viewport_${projectId}`);
        let viewport = state.viewport;
        
        if (savedViewport) {
          const parsed = JSON.parse(savedViewport);
          viewport = {
            ...viewport,
            scale: parsed.scale || 0.1,
            centerX: parsed.centerX || SITE_CONFIG.SITE_WIDTH / 2,
            centerY: parsed.centerY || SITE_CONFIG.SITE_HEIGHT / 2
          };
        }
        
        setState({
          rolls,
          viewport,
          selectedRollId: null,
          isDirty: false
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load liner data');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [projectId, generateRollLayout]);
  
  return {
    state,
    isLoading,
    error,
    updateRoll,
    updateViewport,
    selectRoll,
    fitToSite,
    generateRollLayout,
    // Backward compatibility aliases
    updatePanel: updateRoll,
    updateCanvas: updateViewport,
    selectPanel: selectRoll,
    // Backward compatibility state aliases
    panels: state.rolls.map(roll => ({
      id: roll.id,
      x: roll.x,
      y: roll.y,
      width: roll.width,
      height: roll.length, // Map length to height for compatibility
      rotation: roll.rotation,
      panelNumber: roll.panelNumber,
      rollNumber: roll.rollNumber
    })),
    canvas: {
      scale: state.viewport.scale,
      offsetX: state.viewport.centerX,
      offsetY: state.viewport.centerY
    },
    selectedPanelId: state.selectedRollId
  };
}

// Backward compatibility - export the old function name
export const usePanelSystem = useLinerSystem;
