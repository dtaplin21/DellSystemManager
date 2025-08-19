'use client'

import { useState, useRef, useEffect, useCallback, useReducer, useMemo } from 'react'
import type { Panel } from '../../types/panel'
import { Button } from '../ui/button'
import { 
  Target, 
  Zap, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Grid,
  Maximize,
  Minimize
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'

interface PanelLayoutProps {
  mode: 'manual' | 'auto'
  projectInfo: {
    projectName: string
    location: string
    description: string
    manager: string
    material: string
  }
  externalPanels?: Panel[]
  onPanelUpdate?: (panels: Panel[]) => void
  layoutScale?: number // Add layout scale from parent component
}

interface CanvasState {
  scale: number
  offsetX: number
  offsetY: number
  showGrid: boolean
  showGuides: boolean
  snapToGrid: boolean
  gridSize: number
  // Add new properties for large-scale grid
  worldWidth: number  // Total world width in feet
  worldHeight: number // Total world height in feet
  worldScale: number  // Scale factor to convert feet to pixels
}

// Panel State Management
interface PanelState {
  panels: Panel[]
  selectedPanelId: string | null
}

type PanelAction = 
  | { type: 'SET_PANELS'; payload: Panel[] }
  | { type: 'ADD_PANEL'; payload: Panel }
  | { type: 'UPDATE_PANEL'; payload: { id: string; updates: Partial<Panel> } }
  | { type: 'DELETE_PANEL'; payload: string }
  | { type: 'SELECT_PANEL'; payload: string | null }
  | { type: 'RESET_PANELS' }

const panelReducer = (state: PanelState, action: PanelAction): PanelState => {
  switch (action.type) {
    case 'SET_PANELS':
      return { ...state, panels: action.payload }
    case 'ADD_PANEL':
      return { ...state, panels: [...state.panels, action.payload] }
    case 'UPDATE_PANEL':
      return {
        ...state,
        panels: state.panels.map(panel =>
          panel.id === action.payload.id
            ? { ...panel, ...action.payload.updates }
            : panel
        )
      }
    case 'DELETE_PANEL':
      return {
        ...state,
        panels: state.panels.filter(panel => panel.id !== action.payload),
        selectedPanelId: state.selectedPanelId === action.payload ? null : state.selectedPanelId
      }
    case 'SELECT_PANEL':
      return { ...state, selectedPanelId: action.payload }
    case 'RESET_PANELS':
      return { ...state, panels: [], selectedPanelId: null }
    default:
      return state
  }
}

export default function PanelLayout({ mode, projectInfo, externalPanels, onPanelUpdate, layoutScale = 1.0 }: PanelLayoutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null)
  const [panels, dispatch] = useReducer(panelReducer, { panels: [], selectedPanelId: null })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState(0)
  
  // Normalize layout scale to ensure panels are always visible
  // If layout scale is extremely small (like 0.0025), normalize it to a reasonable value
  const normalizedLayoutScale = useMemo(() => {
    if (layoutScale < 0.01) {
      // If scale is extremely small, normalize it to make panels visible
      const normalized = 0.01 / layoutScale;
      console.log('[PanelLayout] Layout scale normalized:', { 
        original: layoutScale, 
        normalized, 
        reason: 'Scale too small, normalizing for visibility' 
      });
      return normalized;
    }
    return 1.0; // Use 1.0 for normal scales
  }, [layoutScale]);
  
  // Calculate world dimensions for large-scale grid
  // 150 panels at 22ft each = 3,300ft west to east
  // 10 panels at 500ft each = 5,000ft north to south
  const worldDimensions = useMemo(() => {
    const worldWidth = 3300; // 150 * 22ft
    const worldHeight = 5000; // 10 * 500ft
    
    // Calculate optimal scale to fit world in reasonable canvas size
    // We want the world to fit in a canvas that's at least 1200x800 pixels
    const minCanvasWidth = 1200;
    const minCanvasHeight = 800;
    
    // Calculate scale factors for both dimensions
    const scaleX = minCanvasWidth / worldWidth;
    const scaleY = minCanvasHeight / worldHeight;
    
    // Use the smaller scale to ensure both dimensions fit
    const worldScale = Math.min(scaleX, scaleY);
    
    console.log('[PanelLayout] World dimensions calculated:', {
      worldWidth,
      worldHeight,
      scaleX,
      scaleY,
      worldScale,
      resultingCanvasWidth: worldWidth * worldScale,
      resultingCanvasHeight: worldHeight * worldScale
    });
    
    return {
      worldWidth,
      worldHeight,
      worldScale
    };
  }, []);
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    showGrid: true,
    showGuides: true,
    snapToGrid: true,
    gridSize: 20,
    worldWidth: worldDimensions.worldWidth,
    worldHeight: worldDimensions.worldHeight,
    worldScale: worldDimensions.worldScale
  })
  
  // Refs for preventing infinite loops
  const lastExternalPanels = useRef<string>('')
  const lastInternalPanels = useRef<string>('')
  
  // Memoize panel data to prevent unnecessary re-renders
  const panelData = useMemo(() => ({
    panels: panels.panels,
    selectedPanelId: panels.selectedPanelId
  }), [panels.panels, panels.selectedPanelId]);
  
  // Update internal panels ref when panels change
  useEffect(() => {
    lastInternalPanels.current = JSON.stringify(panels.panels);
  }, [panels.panels]);
  
  // Canvas dimensions - now based on world dimensions
  const [canvasWidth, setCanvasWidth] = useState(Math.ceil(worldDimensions.worldWidth * worldDimensions.worldScale))
  const [canvasHeight, setCanvasHeight] = useState(Math.ceil(worldDimensions.worldHeight * worldDimensions.worldScale))
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenCanvasWidth, setFullscreenCanvasWidth] = useState(0)
  const [fullscreenCanvasHeight, setFullscreenCanvasHeight] = useState(0)
  
  // Initialize fullscreen canvas dimensions when component mounts
  useEffect(() => {
    if (canvasWidth > 0 && canvasHeight > 0 && fullscreenCanvasWidth === 0) {
      console.log('[PanelLayout] Initializing fullscreen canvas dimensions:', { canvasWidth, canvasHeight });
      setFullscreenCanvasWidth(canvasWidth);
      setFullscreenCanvasHeight(canvasHeight);
    }
  }, [canvasWidth, canvasHeight, fullscreenCanvasWidth]);
  
  const { toast } = useToast()
  
  // Debug function to create a test panel
  const createTestPanel = useCallback(() => {
    const testPanel: Panel = {
      id: 'test-panel',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      length: 150,
      rotation: 0,
      fill: '#ff0000',
      color: '#cc0000',
      meta: {
        repairs: [],
        location: { x: 100, y: 100, gridCell: { row: 0, col: 0 } }
      }
    };
    console.log('[PanelLayout] Creating test panel:', testPanel);
    dispatch({ type: 'ADD_PANEL', payload: testPanel });
  }, []);
  
  // Function to create sample panels for the large-scale grid
  const createSampleGrid = useCallback(() => {
    console.log('[PanelLayout] Creating sample grid with large-scale panels');
    
    const panels: Panel[] = [];
    
    // Create 150 panels at 22ft each (west to east)
    for (let i = 0; i < 150; i++) {
      const panel: Panel = {
        id: `panel-22ft-${i}`,
        shape: 'rectangle',
        x: i * 22, // 22ft spacing west to east
        y: 0,      // Start at north edge
        width: 22, // 22ft width
        height: 22, // 22ft height
        length: 22,
        rotation: 0,
        fill: `hsl(${(i * 137.5) % 360}, 70%, 60%)`, // Varying colors
        color: '#1e1b4b',
        panelNumber: (i + 1).toString(),
        rollNumber: `R${Math.floor(i / 10) + 1}`,
        meta: {
          repairs: [],
          location: { x: i * 22, y: 0, gridCell: { row: 0, col: i } }
        }
      };
      panels.push(panel);
    }
    
    // Create 10 panels at 500ft each (north to south)
    for (let i = 0; i < 10; i++) {
      const panel: Panel = {
        id: `panel-500ft-${i}`,
        shape: 'rectangle',
        x: 0,           // Start at west edge
        y: i * 500,     // 500ft spacing north to south
        width: 500,     // 500ft width
        height: 500,    // 500ft height
        length: 500,
        rotation: 0,
        fill: `hsl(${(i * 36) % 360}, 80%, 50%)`, // Varying colors
        color: '#1e1b4b',
        panelNumber: (i + 151).toString(), // Continue numbering from 22ft panels
        rollNumber: `R${i + 16}`, // Different roll numbers
        meta: {
          repairs: [],
          location: { x: 0, y: i * 500, gridCell: { row: i, col: 0 } }
        }
      };
      panels.push(panel);
    }
    
    console.log('[PanelLayout] Created sample grid with', panels.length, 'panels');
    console.log('[PanelLayout] Grid dimensions:', {
      width: 150 * 22, // 3,300ft west to east
      height: 10 * 500 // 5,000ft north to south
    });
    
    // Add all panels to the state
    panels.forEach(panel => {
      dispatch({ type: 'ADD_PANEL', payload: panel });
    });
    
    toast({
      title: "Sample Grid Created",
      description: `Created ${panels.length} panels covering ${150 * 22}ft × ${10 * 500}ft area`
    });
  }, [dispatch, toast]);
  
  // Fullscreen toggle function
  const toggleFullscreen = useCallback(() => {
    console.log('🚀 [FULLSCREEN] toggleFullscreen function called');
    console.log('🚀 [FULLSCREEN] Current state:', {
      isFullscreen,
      canvasWidth,
      canvasHeight,
      fullscreenCanvasWidth,
      fullscreenCanvasHeight,
      windowDimensions: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      }
    });
    
    if (!isFullscreen) {
      console.log('🚀 [FULLSCREEN] Attempting to ENTER fullscreen mode');
      
      // Enter fullscreen mode
      const currentCanvas = getCurrentCanvas();
      const container = currentCanvas?.parentElement;
      console.log('🚀 [FULLSCREEN] Container element:', container);
      
      if (container) {
        console.log('🚀 [FULLSCREEN] Container found, proceeding with fullscreen');
        
        // Store current canvas dimensions
        console.log('🚀 [FULLSCREEN] Storing current canvas dimensions:', {
          width: canvasWidth,
          height: canvasHeight
        });
        setFullscreenCanvasWidth(canvasWidth);
        setFullscreenCanvasHeight(canvasHeight);
        
        // Set canvas to full screen dimensions
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        console.log('🚀 [FULLSCREEN] Screen dimensions:', {
          screenWidth,
          screenHeight,
          currentCanvas: { width: canvasWidth, height: canvasHeight }
        });
        
        console.log('🚀 [FULLSCREEN] Setting canvas dimensions to screen size');
        
        // Update canvas dimensions first
        setCanvasWidth(screenWidth);
        setCanvasHeight(screenHeight);
        
        // Set fullscreen state immediately
        setIsFullscreen(true);
        
        // Add fullscreen styles to body
        console.log('🚀 [FULLSCREEN] Setting body overflow to hidden');
        document.body.style.overflow = 'hidden';
        
        // Force immediate fullscreen canvas render
        console.log('🚀 [FULLSCREEN] Forcing immediate fullscreen canvas render');
        setTimeout(() => {
          if (fullscreenCanvasRef.current) {
            console.log('🚀 [FULLSCREEN] Fullscreen canvas ref found, forcing render');
            // Force the fullscreen canvas to render
            renderCanvas();
          } else {
            console.log('🚀 [FULLSCREEN] Fullscreen canvas ref not found');
          }
        }, 50);
        
        // Reset viewport to fit all panels
        const bounds = calculatePanelBounds(panelData.panels);
        console.log('🚀 [FULLSCREEN] Panel bounds calculated:', bounds);
        
        if (bounds) {
          const { minX, minY, maxX, maxY } = bounds;
          const worldScale = canvasState.worldScale;
          const panelWidth = (maxX - minX) * worldScale;
          const panelHeight = (maxY - minY) * worldScale;
          
          console.log('🚀 [FULLSCREEN] Panel dimensions:', {
            minX, minY, maxX, maxY,
            worldScale,
            panelWidth,
            panelHeight
          });
          
          // Calculate scale to fit all panels with minimal padding
          const padding = 50; // Smaller padding for fullscreen
          const scaleX = (screenWidth - padding) / panelWidth;
          const scaleY = (screenHeight - padding) / panelHeight;
          const newScale = Math.min(scaleX, scaleY, 3.0); // Allow higher zoom in fullscreen
          
          console.log('🚀 [FULLSCREEN] Scale calculations:', {
            padding,
            scaleX,
            scaleY,
            newScale
          });
          
          // Center panels
          const offsetX = (screenWidth - panelWidth * newScale) / 2 - minX * worldScale * newScale;
          const offsetY = (screenHeight - panelHeight * newScale) / 2 - minY * worldScale * newScale;
          
          console.log('🚀 [FULLSCREEN] Offset calculations:', {
            offsetX,
            offsetY
          });
          
          console.log('🚀 [FULLSCREEN] Fullscreen viewport calculated:', {
            panelWidth,
            panelHeight,
            newScale,
            offsetX,
            offsetY
          });
          
          console.log('🚀 [FULLSCREEN] Updating canvas state with new scale and offset');
          setCanvasState(prev => {
            console.log('🚀 [FULLSCREEN] Previous canvas state:', prev);
            const newState = {
              ...prev,
              scale: newScale,
              offsetX,
              offsetY
            };
            console.log('🚀 [FULLSCREEN] New canvas state:', newState);
            return newState;
          });
        } else {
          // No panels - set default viewport for fullscreen
          console.log('🚀 [FULLSCREEN] No panels found - setting default fullscreen viewport');
          const defaultScale = 1.0;
          const defaultOffsetX = (screenWidth - (worldDimensions.worldWidth * worldDimensions.worldScale)) / 2;
          const defaultOffsetY = (screenHeight - (worldDimensions.worldHeight * worldDimensions.worldScale)) / 2;
          
          console.log('🚀 [FULLSCREEN] Default viewport:', {
            scale: defaultScale,
            offsetX: defaultOffsetX,
            offsetY: defaultOffsetY
          });
          
          setCanvasState(prev => ({
            ...prev,
            scale: defaultScale,
            offsetX: defaultOffsetX,
            offsetY: defaultOffsetY
          }));
        }
        
        // Force a re-render of the canvas
        console.log('🚀 [FULLSCREEN] Scheduling canvas re-render');
        setTimeout(() => {
          console.log('🚀 [FULLSCREEN] Executing delayed canvas re-render');
          const currentCanvas = getCurrentCanvas();
          if (currentCanvas) {
            console.log('🚀 [FULLSCREEN] Canvas ref found, triggering re-render');
            
            // Force canvas to use new dimensions
            const canvas = currentCanvas;
            canvas.width = screenWidth;
            canvas.height = screenHeight;
            
            // Trigger a re-render by updating canvas state
            setCanvasState(prev => {
              console.log('🚀 [FULLSCREEN] Forcing canvas state update for re-render');
              return { ...prev };
            });
            
            // Force immediate re-render
            console.log('🚀 [FULLSCREEN] Forcing immediate canvas re-render');
            if (renderCanvas) {
              renderCanvas();
            }
          } else {
            console.log('🚀 [FULLSCREEN] Canvas ref not found during re-render');
          }
        }, 100);
        
        console.log('🚀 [FULLSCREEN] Showing success toast');
        toast({
          title: "Entered Fullscreen Mode",
          description: "Grid now takes up entire screen for better navigation"
        });
        
        console.log('🚀 [FULLSCREEN] Fullscreen entry sequence completed');
      } else {
        console.log('🚀 [FULLSCREEN] ERROR: Container element not found');
      }
    } else {
      console.log('🚀 [FULLSCREEN] Attempting to EXIT fullscreen mode');
      
      // Exit fullscreen mode
      console.log('🚀 [FULLSCREEN] Exiting fullscreen mode, restoring dimensions:', {
        originalWidth: fullscreenCanvasWidth,
        originalHeight: fullscreenCanvasHeight
      });
      
      // Restore original canvas dimensions
      console.log('🚀 [FULLSCREEN] Restoring original canvas dimensions');
      setCanvasWidth(fullscreenCanvasWidth);
      setCanvasHeight(fullscreenCanvasHeight);
      
      // Reset viewport to fit all panels in normal mode
      const bounds = calculatePanelBounds(panelData.panels);
      console.log('🚀 [FULLSCREEN] Panel bounds for normal mode:', bounds);
      
      if (bounds) {
        const { minX, minY, maxX, maxY } = bounds;
        const worldScale = canvasState.worldScale;
        const panelWidth = (maxX - minX) * worldScale;
        const panelHeight = (maxY - minY) * worldScale;
        
        console.log('🚀 [FULLSCREEN] Normal mode panel dimensions:', {
          panelWidth,
          panelHeight,
          worldScale
        });
        
        const padding = 100;
        const scaleX = (fullscreenCanvasWidth - padding) / panelWidth;
        const scaleY = (fullscreenCanvasHeight - padding) / panelHeight;
        const newScale = Math.min(scaleX, scaleY, 2.0);
        
        console.log('🚀 [FULLSCREEN] Normal mode scale calculations:', {
          padding,
          scaleX,
          scaleY,
          newScale
        });
        
        const offsetX = (fullscreenCanvasWidth - panelWidth * newScale) / 2 - minX * worldScale * newScale;
        const offsetY = (fullscreenCanvasHeight - panelHeight * newScale) / 2 - minY * worldScale * newScale;
        
        console.log('🚀 [FULLSCREEN] Normal mode offset calculations:', {
          offsetX,
          offsetY
        });
        
        console.log('🚀 [FULLSCREEN] Updating canvas state for normal mode');
        setCanvasState(prev => {
          console.log('🚀 [FULLSCREEN] Previous canvas state for normal mode:', prev);
          const newState = {
            ...prev,
            scale: newScale,
            offsetX,
            offsetY
          };
          console.log('🚀 [FULLSCREEN] New canvas state for normal mode:', newState);
          return newState;
        });
      }
      
      console.log('🚀 [FULLSCREEN] Setting isFullscreen to false');
      setIsFullscreen(false);
      
      // Remove fullscreen styles from body
      console.log('🚀 [FULLSCREEN] Restoring body overflow');
      document.body.style.overflow = '';
      
      // Force a re-render of the canvas
      console.log('🚀 [FULLSCREEN] Scheduling normal mode canvas re-render');
      setTimeout(() => {
        console.log('🚀 [FULLSCREEN] Executing delayed normal mode canvas re-render');
        const currentCanvas = getCurrentCanvas();
        if (currentCanvas) {
          console.log('🚀 [FULLSCREEN] Canvas ref found for normal mode re-render');
          // Trigger a re-render by updating canvas state
          setCanvasState(prev => {
            console.log('🚀 [FULLSCREEN] Forcing canvas state update for normal mode re-render');
            return { ...prev };
          });
        } else {
          console.log('🚀 [FULLSCREEN] Canvas ref not found during normal mode re-render');
        }
      }, 100);
      
      console.log('🚀 [FULLSCREEN] Showing exit toast');
      toast({
        title: "Exited Fullscreen Mode",
        description: "Grid returned to normal size"
      });
      
      console.log('🚀 [FULLSCREEN] Fullscreen exit sequence completed');
    }
  }, [isFullscreen, canvasWidth, canvasHeight, fullscreenCanvasWidth, fullscreenCanvasHeight, panelData.panels, canvasState.worldScale, canvasState, toast]);
  
  // Initialize panels from external source
  useEffect(() => {
    console.log('[PanelLayout] externalPanels received:', externalPanels);
    
    // Create a stable reference for comparison
    const externalPanelsRef = externalPanels || [];
    const externalPanelsString = JSON.stringify(externalPanelsRef);
    
    // Only proceed if this is a genuine change
    if (lastExternalPanels.current !== externalPanelsString) {
      console.log('[PanelLayout] External panels changed, processing update');
      lastExternalPanels.current = externalPanelsString;
      
      if (externalPanelsRef.length > 0) {
        // Only update if panels actually changed (deep comparison)
        const newPanelIds = externalPanelsRef.map(p => p.id).sort().join(',')
        console.log('[PanelLayout] newPanelIds:', newPanelIds);
        
        // Validate external panels before setting them
        const validExternalPanels = externalPanelsRef.filter(panel => {
          if (!isValidPanel(panel)) {
            const errors = getPanelValidationErrors(panel);
            console.warn('[PanelLayout] Skipping invalid external panel:', { panel, errors });
            return false;
          }
          return true;
        });
        
        if (validExternalPanels.length !== externalPanelsRef.length) {
          console.warn('[PanelLayout] Some external panels were invalid:', {
            total: externalPanelsRef.length,
            valid: validExternalPanels.length,
            skipped: externalPanelsRef.length - validExternalPanels.length
          });
        }
        
        if (validExternalPanels.length > 0) {
          dispatch({ type: 'SET_PANELS', payload: validExternalPanels })
        } else {
          console.warn('[PanelLayout] No valid external panels to set');
        }
      } else {
        // Handle case where external panels is explicitly set to empty array
        // Only clear internal state if it's not already empty to prevent infinite loops
        const internalPanelsString = lastInternalPanels.current;
        if (internalPanelsString !== '[]') {
          console.log('[PanelLayout] External panels explicitly set to empty, clearing internal state');
          dispatch({ type: 'SET_PANELS', payload: [] })
        } else {
          console.log('[PanelLayout] External panels is empty, but internal state is already empty - no action needed');
        }
      }
    } else {
      console.log('[PanelLayout] No external panel changes detected');
    }
  }, [externalPanels]) // Only depend on externalPanels to avoid infinite loops
  
  // Notify parent of panel updates
  const onPanelUpdateRef = useRef(onPanelUpdate);
  
  // Update ref when prop changes
  useEffect(() => {
    onPanelUpdateRef.current = onPanelUpdate;
  }, [onPanelUpdate]);
  
  useEffect(() => {
    console.log('[PanelLayout] panels state changed:', panelData.panels);
    if (onPanelUpdateRef.current) {
      onPanelUpdateRef.current(panelData.panels)
    }
  }, [panelData.panels]) // Only depend on panelData.panels, not onPanelUpdate
  
  // Canvas Functions
  const zoomIn = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 5) }))
  }, [])
  
  const zoomOut = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) }))
  }, [])
  
  const resetView = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: 1, offsetX: 0, offsetY: 0 }))
  }, [])
  
  const toggleGrid = useCallback(() => {
    setCanvasState(prev => ({ ...prev, showGrid: !prev.showGrid }))
  }, [])
  
  const toggleGuides = useCallback(() => {
    setCanvasState(prev => ({ ...prev, showGuides: !prev.showGuides }))
  }, [])
  
  const toggleSnap = useCallback(() => {
    setCanvasState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }))
  }, [])
  
  // Utility function to validate panel data
  const isValidPanel = (panel: any): panel is Panel => {
    if (!panel || typeof panel !== 'object') {
      return false;
    }
    
    // Check required properties
    if (typeof panel.id !== 'string' || !panel.id) {
      return false;
    }
    
    // Check coordinates
    if (typeof panel.x !== 'number' || !isFinite(panel.x)) {
      return false;
    }
    
    if (typeof panel.y !== 'number' || !isFinite(panel.y)) {
      return false;
    }
    
    // Check dimensions
    if (typeof panel.width !== 'number' || !isFinite(panel.width) || panel.width <= 0) {
      return false;
    }
    
    if (typeof panel.height !== 'number' || !isFinite(panel.height) || panel.height <= 0) {
      return false;
    }
    
    // Check reasonable limits
    const MAX_DIMENSION = 10000;
    const MIN_DIMENSION = 0.1;
    const MAX_COORDINATE = 100000;
    
    if (panel.width > MAX_DIMENSION || panel.height > MAX_DIMENSION) {
      return false;
    }
    
    if (panel.width < MIN_DIMENSION || panel.height < MIN_DIMENSION) {
      return false;
    }
    
    if (Math.abs(panel.x) > MAX_COORDINATE || Math.abs(panel.y) > MAX_COORDINATE) {
      return false;
    }
    
    // Check rotation if present
    if (panel.rotation !== undefined && panel.rotation !== null) {
      if (typeof panel.rotation !== 'number' || !isFinite(panel.rotation)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Utility function to get validation errors for a panel
  const getPanelValidationErrors = (panel: any): string[] => {
    const errors: string[] = [];
    
    if (!panel || typeof panel !== 'object') {
      errors.push('Panel is not a valid object');
      return errors;
    }
    
    if (typeof panel.id !== 'string' || !panel.id) {
      errors.push('Panel missing or invalid ID');
    }
    
    if (typeof panel.x !== 'number' || !isFinite(panel.x)) {
      errors.push('Panel has invalid X coordinate');
    }
    
    if (typeof panel.y !== 'number' || !isFinite(panel.y)) {
      errors.push('Panel has invalid Y coordinate');
    }
    
    if (typeof panel.width !== 'number' || !isFinite(panel.width) || panel.width <= 0) {
      errors.push('Panel has invalid width');
    }
    
    if (typeof panel.height !== 'number' || !isFinite(panel.height) || panel.height <= 0) {
      errors.push('Panel has invalid height');
    }
    
    if (panel.width > 10000 || panel.height > 10000) {
      errors.push('Panel dimensions too large (max 10,000 units)');
    }
    
    if (panel.width < 0.1 || panel.height < 0.1) {
      errors.push('Panel dimensions too small (min 0.1 units)');
    }
    
    if (Math.abs(panel.x) > 100000 || Math.abs(panel.y) > 100000) {
      errors.push('Panel coordinates out of bounds (max ±100,000 units)');
    }
    
    if (panel.rotation !== undefined && panel.rotation !== null) {
      if (typeof panel.rotation !== 'number' || !isFinite(panel.rotation)) {
        errors.push('Panel has invalid rotation');
      }
    }
    
    return errors;
  }
  
  // Utility function to calculate panel bounds
  const calculatePanelBounds = useCallback((panels: Panel[]) => {
    if (!panels || panels.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    panels.forEach(panel => {
      if (isValidPanel(panel)) {
        minX = Math.min(minX, panel.x);
        minY = Math.min(minY, panel.y);
        maxX = Math.max(maxX, panel.x + panel.width);
        maxY = Math.max(maxY, panel.y + panel.height);
      }
    });
    
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      return null;
    }
    
    return { minX, minY, maxX, maxY };
  }, []);

  // Auto-fit viewport when panels are loaded
  useEffect(() => {
    if (panelData.panels.length > 0 && canvasWidth > 0 && canvasHeight > 0) {
      // Small delay to ensure canvas is ready
      const timer = setTimeout(() => {
        // Call autoFitViewport directly instead of depending on it
        if (canvasRef.current) {
          // Calculate bounds and fit viewport
          const bounds = calculatePanelBounds(panelData.panels);
          if (bounds) {
            const { minX, minY, maxX, maxY } = bounds;
            
            // Convert world coordinates to canvas coordinates
            const worldScale = canvasState.worldScale;
            const panelWidth = (maxX - minX) * worldScale;
            const panelHeight = (maxY - minY) * worldScale;
            
            // Calculate scale to fit all panels with some padding
            const padding = 100; // pixels
            const scaleX = (canvasWidth - padding) / panelWidth;
            const scaleY = (canvasHeight - padding) / panelHeight;
            const newScale = Math.min(scaleX, scaleY, 2.0);
            
            // Calculate offset to center panels
            const offsetX = (canvasWidth - panelWidth * newScale) / 2 - minX * worldScale * newScale;
            const offsetY = (canvasHeight - panelHeight * newScale) / 2 - minY * worldScale * newScale;
            
            console.log('[PanelLayout] Auto-fit viewport calculated:', {
              worldBounds: { minX, minY, maxX, maxY },
              canvasDimensions: { width: canvasWidth, height: canvasHeight },
              panelDimensions: { width: panelWidth, height: panelHeight },
              newScale,
              offsetX,
              offsetY
            });
            
            // Update canvas state
            setCanvasState(prev => ({
              ...prev,
              scale: newScale,
              offsetX,
              offsetY
            }));
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [panelData.panels.length, canvasWidth, canvasHeight, canvasState.worldScale]); // Add worldScale dependency
  
  // Update canvas state when world dimensions change
  useEffect(() => {
    setCanvasState(prev => ({
      ...prev,
      worldWidth: worldDimensions.worldWidth,
      worldHeight: worldDimensions.worldHeight,
      worldScale: worldDimensions.worldScale
    }));
    
    // Update canvas dimensions
    setCanvasWidth(Math.ceil(worldDimensions.worldWidth * worldDimensions.worldScale));
    setCanvasHeight(Math.ceil(worldDimensions.worldHeight * worldDimensions.worldScale));
  }, [worldDimensions]);
  
  // Cleanup fullscreen mode on unmount
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        document.body.style.overflow = '';
      }
    };
  }, [isFullscreen]);
  
  // Monitor fullscreen state changes
  useEffect(() => {
    console.log('🚀 [FULLSCREEN] isFullscreen state changed to:', isFullscreen);
    console.log('🚀 [FULLSCREEN] Current canvas dimensions:', { canvasWidth, canvasHeight });
    
    const currentCanvas = getCurrentCanvas();
    console.log('🚀 [FULLSCREEN] Canvas ref exists:', !!currentCanvas);
    
    if (isFullscreen) {
      console.log('🚀 [FULLSCREEN] Fullscreen mode activated - checking canvas wrapper');
      const canvasWrapper = document.querySelector('.canvas-wrapper');
      console.log('🚀 [FULLSCREEN] Canvas wrapper element:', canvasWrapper);
      if (canvasWrapper) {
        console.log('🚀 [FULLSCREEN] Canvas wrapper styles:', {
          position: getComputedStyle(canvasWrapper).position,
          width: getComputedStyle(canvasWrapper).width,
          height: getComputedStyle(canvasWrapper).height,
          zIndex: getComputedStyle(canvasWrapper).zIndex
        });
      }
      
      // Also check canvas element
      if (currentCanvas) {
        console.log('🚀 [FULLSCREEN] Canvas element in fullscreen mode:', {
          width: currentCanvas.width,
          height: currentCanvas.height,
          styleWidth: currentCanvas.style.width,
          styleHeight: currentCanvas.style.height
        });
        
        // Force apply fullscreen styles to canvas element
        const canvas = currentCanvas;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Set canvas dimensions directly
        canvas.width = screenWidth;
        canvas.height = screenHeight;
        
        // Force apply fullscreen styles
        canvas.style.setProperty('width', '100vw', 'important');
        canvas.style.setProperty('height', '100vh', 'important');
        canvas.style.setProperty('position', 'absolute', 'important');
        canvas.style.setProperty('top', '0', 'important');
        canvas.style.setProperty('left', '0', 'important');
        canvas.style.setProperty('z-index', '1', 'important');
        
        console.log('🚀 [FULLSCREEN] Forced fullscreen styles applied to canvas element:', {
          width: canvas.width,
          height: canvas.height,
          styleWidth: canvas.style.width,
          styleHeight: canvas.style.height
        });
      }
    } else {
      // Exit fullscreen - restore canvas to normal dimensions
      if (currentCanvas) {
        const canvas = currentCanvas;
        
        // Restore original dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Restore normal styles
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
        canvas.style.removeProperty('position');
        canvas.style.removeProperty('top');
        canvas.style.removeProperty('left');
        canvas.style.removeProperty('z-index');
        
        console.log('🚀 [FULLSCREEN] Canvas restored to normal mode:', {
          width: canvas.width,
          height: canvas.height
        });
      }
    }
  }, [isFullscreen, canvasWidth, canvasHeight]);
  
  // Monitor canvas element changes
  useEffect(() => {
    if (canvasRef.current) {
      console.log('🚀 [FULLSCREEN] Canvas element updated:', {
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        styleWidth: canvasRef.current.style.width,
        styleHeight: canvasRef.current.style.height,
        className: canvasRef.current.className,
        isFullscreen
      });
      
      // Log computed styles
      const computedStyle = getComputedStyle(canvasRef.current);
      console.log('🚀 [FULLSCREEN] Canvas computed styles:', {
        position: computedStyle.position,
        width: computedStyle.width,
        height: computedStyle.height,
        zIndex: computedStyle.zIndex,
        top: computedStyle.top,
        left: computedStyle.left
      });
    }
  }, [canvasRef.current, canvasWidth, canvasHeight, isFullscreen]);
  
  // Canvas rendering function
  const renderCanvas = useCallback(() => {
    const canvas = getCurrentCanvas()
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Get actual canvas dimensions (important for fullscreen mode)
    const actualCanvasWidth = canvas.width;
    const actualCanvasHeight = canvas.height;
    
    console.log('[PanelLayout] renderCanvas called with:', {
      canvasWidth,
      canvasHeight,
      actualCanvasWidth,
      actualCanvasHeight,
      canvasState,
      panelsCount: panelData.panels.length,
      layoutScale,
      normalizedLayoutScale,
      isFullscreen
    });
    
    // Clear canvas using actual dimensions
    ctx.clearRect(0, 0, actualCanvasWidth, actualCanvasHeight)
    
    // Save context for transformations
    ctx.save()
    
    // Apply viewport transformations in the correct order:
    // 1. Pan (offset)
    // 2. Scale (zoom)
    // Note: We don't apply layoutScale globally anymore to avoid scaling issues
    ctx.translate(canvasState.offsetX, canvasState.offsetY)
    ctx.scale(canvasState.scale, canvasState.scale)
    
    console.log('[PanelLayout] Canvas transformations applied:', {
      offsetX: canvasState.offsetX,
      offsetY: canvasState.offsetY,
      zoomScale: canvasState.scale,
      layoutScale,
      actualCanvasDimensions: { width: actualCanvasWidth, height: actualCanvasHeight }
    });
    
    // Draw grid
    if (canvasState.showGrid) {
      drawGrid(ctx)
    }
    
    // Draw panels
    console.log('[PanelLayout] Rendering canvas with panels:', panelData.panels);
    console.log('[PanelLayout] Canvas drawing area:', {
      width: actualCanvasWidth,
      height: actualCanvasHeight,
      offsetX: canvasState.offsetX,
      offsetY: canvasState.offsetY,
      zoomScale: canvasState.scale,
      layoutScale
    });
    
    // Filter and validate panels before rendering
    const validPanels = panelData.panels.filter(panel => {
      if (!isValidPanel(panel)) {
        const errors = getPanelValidationErrors(panel);
        console.warn('[PanelLayout] Skipping invalid panel:', { panel, errors });
        return false;
      }
      return true;
    });
    
    console.log('[PanelLayout] Valid panels for rendering:', validPanels.length, 'out of', panelData.panels.length);
    
    validPanels.forEach(panel => {
      console.log('[PanelLayout] Drawing panel:', panel);
      
      // Check if panel coordinates are reasonable
      const worldX = panel.x;
      const worldY = panel.y;
      // Calculate screen coordinates considering zoom and offset only
      const screenX = (worldX * normalizedLayoutScale * canvasState.scale) + canvasState.offsetX;
      const screenY = (worldY * normalizedLayoutScale * canvasState.scale) + canvasState.offsetY;
      
      console.log('[PanelLayout] Panel coordinates:', {
        world: { x: worldX, y: worldY },
        screen: { x: screenX, y: screenY },
        canvasBounds: { width: canvasWidth, height: canvasHeight },
        isVisible: screenX >= 0 && screenX <= canvasWidth && screenY >= 0 && screenY <= canvasHeight
      });
      
      drawPanel(ctx, panel, panel.id === panelData.selectedPanelId)
    })
    
    // Draw selection handles
    if (panelData.selectedPanelId) {
      const selectedPanel = panelData.panels.find(p => p.id === panelData.selectedPanelId)
      if (selectedPanel) {
        // Validate the selected panel before drawing handles
        if (isValidPanel(selectedPanel)) {
          drawSelectionHandles(ctx, selectedPanel)
        } else {
          const errors = getPanelValidationErrors(selectedPanel);
          console.warn('[PanelLayout] Selected panel has validation errors, skipping handles:', { panel: selectedPanel, errors });
        }
      }
    }
    
    // Draw AI guides
    if (canvasState.showGuides) {
      // Removed AI guides as per edit hint
    }
    
    // Restore context
    ctx.restore()
  }, [panelData, canvasState, canvasWidth, canvasHeight, normalizedLayoutScale])
  
  // Draw grid
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e0e0e0'
    // Use zoom scale for line width since layout scale is applied globally
    ctx.lineWidth = 1 / canvasState.scale
    
    // Get actual canvas dimensions (important for fullscreen mode)
    const currentCanvas = getCurrentCanvas();
    const actualCanvasWidth = currentCanvas?.width || canvasWidth;
    const actualCanvasHeight = currentCanvas?.height || canvasHeight;
    
    console.log('[PanelLayout] drawGrid called with canvas dimensions:', {
      canvasWidth,
      canvasHeight,
      actualCanvasWidth,
      actualCanvasHeight,
      isFullscreen
    });
    
    // Calculate grid spacing based on world scale
    // We want grid lines that represent meaningful real-world distances
    const worldScale = canvasState.worldScale;
    
    // Major grid lines every 500ft (for 500ft panels)
    const majorGridSpacing = 500 * worldScale;
    // Minor grid lines every 100ft (for better readability)
    const minorGridSpacing = 100 * worldScale;
    
    // Draw minor grid lines (lighter)
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 0.5 / canvasState.scale
    
    // Vertical lines (west to east) - cover entire canvas width
    for (let x = 0; x <= actualCanvasWidth; x += minorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, actualCanvasHeight)
      ctx.stroke()
    }
    
    // Horizontal lines (north to south) - cover entire canvas height
    for (let y = 0; y <= actualCanvasHeight; y += minorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(actualCanvasWidth, y)
      ctx.stroke()
    }
    
    // Draw major grid lines (darker)
    ctx.strokeStyle = '#d0d0d0'
    ctx.lineWidth = 1.5 / canvasState.scale
    
    // Vertical major lines every 500ft - cover entire canvas width
    for (let x = 0; x <= actualCanvasWidth; x += majorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, actualCanvasHeight)
      ctx.stroke()
    }
    
    // Horizontal major lines every 500ft - cover entire canvas height
    for (let y = 0; y <= actualCanvasHeight; y += majorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(actualCanvasWidth, y)
      ctx.stroke()
    }
    
    // Draw grid labels for major lines
    ctx.fillStyle = '#666666'
    ctx.font = `${Math.max(10, 12 / canvasState.scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Label vertical lines (west to east distances)
    for (let x = 0; x <= actualCanvasWidth; x += majorGridSpacing) {
      const worldX = x / worldScale;
      const label = `${worldX.toFixed(0)}ft`;
      ctx.fillText(label, x, 15 / canvasState.scale);
    }
    
    // Label horizontal lines (north to south distances)
    for (let y = 0; y <= actualCanvasHeight; y += majorGridSpacing) {
      const worldY = y / worldScale;
      const label = `${worldY.toFixed(0)}ft`;
      ctx.save();
      ctx.translate(15 / canvasState.scale, y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }
  
  // Draw panel
  const drawPanel = (ctx: CanvasRenderingContext2D, panel: Panel, isSelected: boolean) => {
    console.log('[PanelLayout] Drawing panel with properties:', {
      id: panel.id,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      rotation: panel.rotation,
      zoomScale: canvasState.scale,
      layoutScale,
      worldScale: canvasState.worldScale
    });
    
    // Panel dimension validation using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot draw invalid panel:', { panel, errors });
      return;
    }
    
    // Calculate effective coordinates and dimensions using world scale
    // Convert world coordinates (feet) to canvas coordinates (pixels)
    const effectiveX = panel.x * canvasState.worldScale;
    const effectiveY = panel.y * canvasState.worldScale;
    const effectiveWidth = panel.width * canvasState.worldScale;
    const effectiveHeight = panel.height * canvasState.worldScale;
    
    // Calculate panel bounds in screen coordinates
    const panelLeft = effectiveX * canvasState.scale + canvasState.offsetX;
    const panelTop = effectiveY * canvasState.scale + canvasState.offsetY;
    const panelRight = (effectiveX + effectiveWidth) * canvasState.scale + canvasState.offsetX;
    const panelBottom = (effectiveY + effectiveHeight) * canvasState.scale + canvasState.offsetY;
    
    // Check if panel is completely outside canvas bounds (with some margin)
    const margin = 100; // pixels
    if (panelRight < -margin || panelLeft > canvasWidth + margin || 
        panelBottom < -margin || panelTop > canvasHeight + margin) {
      console.log('[PanelLayout] Panel outside canvas bounds, skipping render:', { 
        id: panel.id, 
        bounds: { left: panelLeft, top: panelTop, right: panelRight, bottom: panelBottom },
        canvasBounds: { width: canvasWidth, height: canvasHeight }
      });
      return;
    }
    
    console.log('[PanelLayout] Panel validation passed, rendering:', {
      id: panel.id,
      worldCoords: { x: panel.x, y: panel.y },
      worldDimensions: { width: panel.width, height: panel.height },
      effectiveCoords: { x: effectiveX, y: effectiveY },
      effectiveDimensions: { width: effectiveWidth, height: effectiveHeight },
      screenBounds: { left: panelLeft, top: panelTop, right: panelRight, bottom: panelBottom }
    });
    
    ctx.save()
    
    // Apply panel transformations
    // Convert world coordinates to canvas coordinates
    ctx.translate(effectiveX, effectiveY)
    ctx.rotate((panel.rotation || 0) * Math.PI / 180)
    
    // Draw panel rectangle
    ctx.fillStyle = panel.fill || '#4f46e5'
    ctx.fillRect(0, 0, effectiveWidth, effectiveHeight)
    
    // Draw panel border
    ctx.strokeStyle = isSelected ? '#f59e0b' : panel.color || '#1e1b4b'
    // Use zoom scale for line width
    ctx.lineWidth = isSelected ? 3 / canvasState.scale : 2 / canvasState.scale
    ctx.strokeRect(0, 0, effectiveWidth, effectiveHeight)
    
    // Draw panel text
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(12, 16 / canvasState.scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const centerX = effectiveWidth / 2
    const centerY = effectiveHeight / 2
    
    if (panel.panelNumber) {
      ctx.fillText(panel.panelNumber.toString(), centerX, centerY - 10 / canvasState.scale)
    }
    
    if (panel.rollNumber) {
      ctx.fillText(panel.rollNumber.toString(), centerX, centerY + 10 / canvasState.scale)
    }
    
    // Draw panel dimensions label
    const dimensionsText = `${panel.width.toFixed(0)}' × ${panel.height.toFixed(0)}'`;
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(10, 14 / canvasState.scale)}px Arial`
    ctx.fillText(dimensionsText, centerX, centerY + 25 / canvasState.scale)
    
    ctx.restore()
  }
  
  // Draw selection handles
  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, panel: Panel) => {
    // Validate panel before drawing handles using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot draw selection handles for invalid panel:', { panel, errors });
      return;
    }
    
    // Use zoom scale for handle sizes
    const handleSize = 8 / canvasState.scale
    
    // Calculate effective coordinates and dimensions using world scale
    const effectiveX = panel.x * canvasState.worldScale;
    const effectiveY = panel.y * canvasState.worldScale;
    const effectiveWidth = panel.width * canvasState.worldScale;
    const effectiveHeight = panel.height * canvasState.worldScale;
    
    const handles = [
      { x: 0, y: 0, cursor: 'nw-resize' },
      { x: effectiveWidth / 2, y: 0, cursor: 'n-resize' },
      { x: effectiveWidth, y: 0, cursor: 'ne-resize' },
      { x: effectiveWidth, y: effectiveHeight / 2, cursor: 'e-resize' },
      { x: effectiveWidth, y: effectiveHeight, cursor: 'se-resize' },
      { x: effectiveWidth / 2, y: effectiveHeight, cursor: 's-resize' },
      { x: 0, y: effectiveHeight, cursor: 'sw-resize' },
      { x: 0, y: effectiveHeight / 2, cursor: 'w-resize' }
    ]
    
    ctx.save()
    ctx.translate(effectiveX, effectiveY)
    ctx.rotate((panel.rotation || 0) * Math.PI / 180)
    
    handles.forEach(handle => {
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1 / canvasState.scale
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
    })
    
    // Draw rotation handle
    const rotationHandleY = -30 / canvasState.scale
    ctx.fillStyle = '#10b981'
    ctx.fillRect(effectiveWidth / 2 - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    ctx.strokeStyle = '#ffffff'
    ctx.strokeRect(effectiveWidth / 2 - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    
    ctx.restore()
  }
  
  // Draw AI guides
  const drawAIGuides = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.strokeStyle = '#10b981'
    // Use zoom scale for line width since layout scale is applied globally
    ctx.lineWidth = 2 / canvasState.scale
    ctx.setLineDash([5, 5])
    
    // Removed AI guides as per edit hint
    
    ctx.restore()
  }
  
  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    // Calculate world coordinates considering zoom only (layout scale is applied per panel)
    const x = (e.clientX - rect.left - canvasState.offsetX) / canvasState.scale
    const y = (e.clientY - rect.top - canvasState.offsetY) / canvasState.scale
    
    const clickedPanel = panelData.panels.find(panel => {
      // Convert panel coordinates to effective coordinates for hit testing
      const effectiveX = panel.x * normalizedLayoutScale;
      const effectiveY = panel.y * normalizedLayoutScale;
      const effectiveWidth = panel.width * normalizedLayoutScale;
      const effectiveHeight = panel.height * normalizedLayoutScale;
      
      const panelCenterX = effectiveX + effectiveWidth / 2
      const panelCenterY = effectiveY + effectiveHeight / 2
      const distance = Math.sqrt((x - panelCenterX) ** 2 + (y - panelCenterY) ** 2)
      return distance <= Math.max(effectiveWidth, effectiveHeight) / 2
    })
    
    if (clickedPanel) {
      dispatch({ type: 'SELECT_PANEL', payload: clickedPanel.id })
      setSelectedPanel(clickedPanel)
      
      const handle = getResizeHandle(x, y, clickedPanel)
      if (handle) {
        setIsResizing(true)
        setResizeHandle(handle)
        setDragStart({ x, y })
        return
      }
      
      if (isRotationHandle(x, y, clickedPanel)) {
        setIsRotating(true)
        setRotationStart(Math.atan2(y - (clickedPanel.y * normalizedLayoutScale + (clickedPanel.height * normalizedLayoutScale) / 2), x - (clickedPanel.x * normalizedLayoutScale + (clickedPanel.width * normalizedLayoutScale) / 2)))
        return
      }
      
      setIsDragging(true)
      setDragStart({ x: x - (clickedPanel.x * normalizedLayoutScale), y: y - (clickedPanel.y * normalizedLayoutScale) })
    } else {
      dispatch({ type: 'SELECT_PANEL', payload: null })
      setSelectedPanel(null)
    }
  }, [panelData, canvasState, normalizedLayoutScale])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (isDragging && selectedPanel) {
      // Convert screen coordinates to world coordinates
      const worldX = (x - canvasState.offsetX) / canvasState.scale / canvasState.worldScale;
      const worldY = (y - canvasState.offsetY) / canvasState.scale / canvasState.worldScale;
      
      // Snap to grid if enabled
      let newX = worldX;
      let newY = worldY;
      
      if (canvasState.snapToGrid) {
        const gridSize = 100; // 100ft grid for snapping
        newX = Math.round(worldX / gridSize) * gridSize;
        newY = Math.round(worldY / gridSize) * gridSize;
      }
      
      dispatch({
        type: 'UPDATE_PANEL',
        payload: {
          id: selectedPanel.id,
          updates: { x: newX, y: newY }
        }
      })
    } else if (isResizing && selectedPanel && resizeHandle) {
      const updates = getResizeUpdates(x, y, selectedPanel, resizeHandle, dragStart)
      if (updates) {
        dispatch({
          type: 'UPDATE_PANEL',
          payload: {
            id: selectedPanel.id,
            updates
          }
        })
      }
    } else if (isRotating && selectedPanel) {
      // Convert screen coordinates to world coordinates for rotation calculation
      const worldX = (x - canvasState.offsetX) / canvasState.scale / canvasState.worldScale;
      const worldY = (y - canvasState.offsetY) / canvasState.scale / canvasState.worldScale;
      
      const panelCenterX = selectedPanel.x + (selectedPanel.width / 2);
      const panelCenterY = selectedPanel.y + (selectedPanel.height / 2);
      
      const angle = Math.atan2(worldY - panelCenterY, worldX - panelCenterX);
      const rotation = ((angle - rotationStart) * 180) / Math.PI;
      
      dispatch({
        type: 'UPDATE_PANEL',
        payload: {
          id: selectedPanel.id,
          updates: { rotation: ((selectedPanel.rotation ?? 0) + rotation) % 360 }
        }
      })
    }
  }, [isDragging, isResizing, isRotating, selectedPanel, resizeHandle, dragStart, rotationStart, canvasState, normalizedLayoutScale])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeHandle(null)
  }, [])
  
  // Helper functions
  const getResizeHandle = (x: number, y: number, panel: Panel): string | null => {
    // Validate panel before processing using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot get resize handle for invalid panel:', { panel, errors });
      return null;
    }
    
    // Use zoom scale for handle sizes
    const handleSize = 8 / canvasState.scale
    
    // Calculate effective coordinates and dimensions using world scale
    const effectiveX = panel.x * canvasState.worldScale;
    const effectiveY = panel.y * canvasState.worldScale;
    const effectiveWidth = panel.width * canvasState.worldScale;
    const effectiveHeight = panel.height * canvasState.worldScale;
    
    const handles = {
      'nw': { x: effectiveX, y: effectiveY },
      'n': { x: effectiveX + effectiveWidth / 2, y: effectiveY },
      'ne': { x: effectiveX + effectiveWidth, y: effectiveY },
      'e': { x: effectiveX + effectiveWidth, y: effectiveY + effectiveHeight / 2 },
      'se': { x: effectiveX + effectiveWidth, y: effectiveY + effectiveHeight },
      's': { x: effectiveX + effectiveWidth / 2, y: effectiveY + effectiveHeight },
      'sw': { x: effectiveX, y: effectiveY + effectiveHeight },
      'w': { x: effectiveX, y: effectiveY + effectiveHeight / 2 }
    }
    
    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
        return handle
      }
    }
    
    return null
  }
  
  const isRotationHandle = (x: number, y: number, panel: Panel): boolean => {
    // Validate panel before processing using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot check rotation handle for invalid panel:', { panel, errors });
      return false;
    }
    
    // Use zoom scale for handle sizes
    const handleSize = 8 / canvasState.scale
    
    // Calculate effective coordinates and dimensions using world scale
    const effectiveX = panel.x * canvasState.worldScale;
    const effectiveY = panel.y * canvasState.worldScale;
    const effectiveWidth = panel.width * canvasState.worldScale;
    
    const rotationHandleY = effectiveY - 30 / canvasState.scale
    const rotationHandleX = effectiveX + effectiveWidth / 2
    
    return Math.abs(x - rotationHandleX) <= handleSize && Math.abs(y - rotationHandleY) <= handleSize
  }
  
  const getResizeUpdates = (x: number, y: number, panel: Panel, handle: string, start: { x: number; y: number }): Partial<Panel> | null => {
    const deltaX = x - start.x
    const deltaY = y - start.y
    
    switch (handle) {
      case 'nw':
        return { x: panel.x + deltaX, y: panel.y + deltaY, width: panel.width - deltaX, height: panel.height - deltaY }
      case 'n':
        return { y: panel.y + deltaY, height: panel.height - deltaY }
      case 'ne':
        return { y: panel.y + deltaY, width: panel.width + deltaX, height: panel.height - deltaY }
      case 'e':
        return { width: panel.width + deltaX }
      case 'se':
        return { width: panel.width + deltaX, height: panel.height + deltaY }
      case 's':
        return { height: panel.height + deltaY }
      case 'sw':
        return { x: panel.x + deltaX, width: panel.width - deltaX, height: panel.height + deltaY }
      case 'w':
        return { x: panel.x + deltaX, width: panel.width - deltaX }
      default:
        return null
    }
  }
  
  // Wheel event for zooming
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, canvasState.scale * zoomFactor))
    
    const newOffsetX = mouseX - (mouseX - canvasState.offsetX) * (newScale / canvasState.scale)
    const newOffsetY = mouseY - (mouseY - canvasState.offsetY) * (newScale / canvasState.scale)
    
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    }))
  }, [canvasState])

  // Add wheel event listener manually to avoid passive event issues
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const wheelHandler = (e: WheelEvent) => handleWheel(e)
    
    // Add event listener with non-passive option
    canvas.addEventListener('wheel', wheelHandler, { passive: false })
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler)
    }
  }, [handleWheel])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);
  
  // Keyboard shortcuts for panel selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && panelData.selectedPanelId) {
        dispatch({ type: 'DELETE_PANEL', payload: panelData.selectedPanelId })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [panelData.selectedPanelId])
  
  // Render canvas when dependencies change - use a more stable approach
  useEffect(() => {
    // Only render if we have a canvas and panels
    const currentCanvas = getCurrentCanvas();
    if (currentCanvas && panelData.panels.length > 0) {
      console.log('[PanelLayout] Canvas render effect triggered:', {
        canvasWidth,
        canvasHeight,
        isFullscreen,
        panelsCount: panelData.panels.length
      });
      renderCanvas();
    }
  }, [panelData.panels.length, canvasState, canvasWidth, canvasHeight, isFullscreen]) // Add isFullscreen dependency
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const currentCanvas = getCurrentCanvas();
      if (currentCanvas) {
        const container = currentCanvas.parentElement
        if (container) {
          const rect = container.getBoundingClientRect()
          console.log('[PanelLayout] Canvas resize - container dimensions:', rect);
          
          // Don't resize canvas if we're in fullscreen mode
          if (isFullscreen) {
            console.log('[PanelLayout] Canvas resize skipped - in fullscreen mode');
            return;
          }
          
          // Calculate new canvas dimensions maintaining world scale
          const newCanvasWidth = Math.ceil(worldDimensions.worldWidth * worldDimensions.worldScale);
          const newCanvasHeight = Math.ceil(worldDimensions.worldHeight * worldDimensions.worldScale);
          
          // If container is smaller than calculated canvas, scale down proportionally
          let finalWidth = newCanvasWidth;
          let finalHeight = newCanvasHeight;
          
          if (rect.width < newCanvasWidth || rect.height < newCanvasHeight) {
            const scaleX = rect.width / newCanvasWidth;
            const scaleY = rect.height / newCanvasHeight;
            const scale = Math.min(scaleX, scaleY);
            
            finalWidth = Math.ceil(newCanvasWidth * scale);
            finalHeight = Math.ceil(newCanvasHeight * scale);
            
            console.log('[PanelLayout] Canvas scaled down to fit container:', {
              containerSize: { width: rect.width, height: rect.height },
              calculatedSize: { width: newCanvasWidth, height: newCanvasHeight },
              scale,
              finalSize: { width: finalWidth, height: finalHeight }
            });
          }
          
          setCanvasWidth(finalWidth);
          setCanvasHeight(finalHeight);
        }
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [worldDimensions, isFullscreen])
  
  // Get the appropriate canvas ref based on fullscreen state
  const getCurrentCanvasRef = () => {
    return isFullscreen ? fullscreenCanvasRef : canvasRef;
  };
  
  // Get the current canvas element
  const getCurrentCanvas = () => {
    return getCurrentCanvasRef().current;
  };
  
  return (
    <>
      {/* Fullscreen Canvas Portal - Renders outside any container */}
      {isFullscreen && (
        <div
          className="fullscreen-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'white',
            zIndex: 9999,
            overflow: 'hidden'
          }}
        >
          {/* Fullscreen Indicator */}
          <div 
            className="absolute top-4 left-4 z-70 bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-medium shadow-lg"
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              zIndex: '70'
            }}
          >
            Fullscreen Mode - Press ESC to exit
          </div>
          
          {/* Fullscreen Canvas */}
          <canvas
            ref={fullscreenCanvasRef}
            width={window.innerWidth}
            height={window.innerHeight}
            className="fullscreen-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              cursor: isDragging ? 'grabbing' : 
                     isResizing ? 'nw-resize' : 
                     isRotating ? 'crosshair' : 'default',
              display: 'block',
              width: '100vw',
              height: '100vh',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1
            }}
          />
        </div>
      )}
      
      {/* Normal Panel Layout Container */}
      <div className="panel-layout-container">
        {/* Fullscreen CSS Styles */}
        <style jsx>{`
          .fullscreen-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 9999 !important;
            overflow: hidden !important;
            background-color: white !important;
          }
          
          .fullscreen-canvas {
            width: 100vw !important;
            height: 100vh !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 1 !important;
          }
        `}</style>
        
        {/* Canvas Wrapper - Only shown when NOT in fullscreen */}
        {!isFullscreen && (
          <div className="canvas-wrapper relative border border-gray-200 rounded-lg overflow-auto" style={{
            width: '100%',
            height: 'calc(100vh - 400px)',
            minHeight: '600px'
          }}>
            {/* Debug Controls */}
            <div className="mb-4 flex gap-2 p-2 border-b bg-gray-50">
              <Button onClick={createTestPanel} variant="outline" size="sm">
                Create Test Panel
              </Button>
              <Button onClick={createSampleGrid} variant="outline" size="sm">
                Create Sample Grid
              </Button>
              <Button onClick={() => console.log('Current panels state:', panelData.panels)} variant="outline" size="sm">
                Log Panels State
              </Button>
              <Button onClick={() => console.log('Raw external panels:', externalPanels)} variant="outline" size="sm">
                Log External Panels
              </Button>
              <Button onClick={() => {
                      // Calculate bounds and fit viewport
                      const bounds = calculatePanelBounds(panelData.panels);
                      if (bounds) {
                        const { minX, minY, maxX, maxY } = bounds;
                        
                        // Convert world coordinates to canvas coordinates
                        const worldScale = canvasState.worldScale;
                        const panelWidth = (maxX - minX) * worldScale;
                        const panelHeight = (maxY - minY) * worldScale;
                        
                        // Calculate scale to fit all panels with some padding
                        const padding = 100; // pixels
                        const scaleX = (canvasWidth - padding) / panelWidth;
                        const scaleY = (canvasHeight - padding) / panelHeight;
                        const newScale = Math.min(scaleX, scaleY, 2.0);
                        
                        // Calculate offset to center panels
                        const offsetX = (canvasWidth - panelWidth * newScale) / 2 - minX * worldScale * newScale;
                        const offsetY = (canvasHeight - panelHeight * newScale) / 2 - minY * worldScale * newScale;
                        
                        console.log('[PanelLayout] Manual auto-fit viewport:', {
                          worldBounds: { minX, minY, maxX, maxY },
                          canvasDimensions: { width: canvasWidth, height: canvasHeight },
                          panelDimensions: { width: panelWidth, height: panelHeight },
                          newScale,
                          offsetX,
                          offsetY
                        });
                        
                        // Update canvas state
                        setCanvasState(prev => ({
                          ...prev,
                          scale: newScale,
                          offsetX,
                          offsetY
                        }));
                      }
                    }} variant="outline" size="sm">
                Auto-Fit Viewport
              </Button>
            </div>
            
            {/* Normal Canvas */}
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="panel-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                cursor: isDragging ? 'grabbing' : 
                       isResizing ? 'nw-resize' : 
                       isRotating ? 'crosshair' : 'default',
                display: 'block',
                width: '100%',
                height: '100%',
                position: 'relative',
                zIndex: 'auto'
              }}
            />
          </div>
        )}
        
        {/* Enhanced Control Toolbar */}
        <div className="control-toolbar mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex flex-wrap items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={zoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(canvasState.scale * 100)}%
              </span>
              <Button size="sm" variant="outline" onClick={zoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={resetView}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            
            {/* View Controls */}
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant={canvasState.showGrid ? "default" : "outline"} 
                onClick={toggleGrid}
              >
                <Grid className="h-4 w-4 mr-2" />
                Grid
              </Button>
              <Button 
                size="sm" 
                variant={canvasState.showGuides ? "default" : "outline"} 
                onClick={toggleGuides}
              >
                <Target className="h-4 w-4 mr-2" />
                Guides
              </Button>
              <Button 
                size="sm" 
                variant={canvasState.snapToGrid ? "default" : "outline"} 
                onClick={toggleSnap}
              >
                <Zap className="h-4 w-4 mr-2" />
                Snap
              </Button>
              <Button 
                size="sm" 
                variant={isFullscreen ? "default" : "outline"} 
                onClick={() => {
                  console.log('🚀 [FULLSCREEN] Fullscreen button clicked!');
                  console.log('🚀 [FULLSCREEN] Button state before click:', { isFullscreen });
                  toggleFullscreen();
                  console.log('🚀 [FULLSCREEN] toggleFullscreen() called from button');
                }}
                className="ml-2"
              >
                {isFullscreen ? (
                  <>
                    <Minimize className="h-4 w-4 mr-2" />
                    Exit Fullscreen
                  </>
                ) : (
                  <>
                    <Maximize className="h-4 w-4 mr-2" />
                    Fullscreen
                  </>
                )}
              </Button>
            </div>
            
            {/* Project Info */}
            <div className="ml-auto text-right">
              <p className="text-sm font-medium">{projectInfo.projectName}</p>
              <p className="text-xs text-gray-500">{panelData.panels.length} panels</p>
              <p className="text-xs text-gray-400">
                Grid: {canvasState.worldWidth.toFixed(0)}ft × {canvasState.worldHeight.toFixed(0)}ft
              </p>
              <p className="text-xs text-gray-400">
                Scale: 1:{Math.round(1 / canvasState.worldScale)} ({canvasState.worldScale.toFixed(4)})
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}