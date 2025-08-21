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
  Minimize,
  Move
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import { usePanelValidation } from '../../hooks/use-panel-validation'
import { useCanvasRenderer } from '../../hooks/use-canvas-renderer'
import { useFullscreenCanvas } from '../../hooks/use-fullscreen-canvas'
import { useInteractiveGrid, type GridConfig } from '../../hooks/use-interactive-grid'
import { snapToGrid, clamp } from '../../lib/geometry'

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
}

interface CanvasState {
  scale: number
  offsetX: number
  offsetY: number
  showGrid: boolean
  showGuides: boolean
  snapToGrid: boolean
  gridSize: number
  worldWidth: number
  worldHeight: number
  worldScale: number
}

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

interface MouseState {
  x: number
  y: number
  isPanning: boolean
  isDragging: boolean
  dragStartX: number
  dragStartY: number
}

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

const WORLD_SIZE = 4000 // feet - using the new 4000x4000 world
const GRID_MINOR = 50 // feet
const GRID_MAJOR = 250 // feet
const SNAP_SIZE = 25 // feet

export default function PanelLayout({ mode, projectInfo, externalPanels, onPanelUpdate }: PanelLayoutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [panels, dispatch] = useReducer(panelReducer, { panels: [], selectedPanelId: null })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState(0)
  
  // Get the selected panel from the reducer state
  const selectedPanel = panels.selectedPanelId ? panels.panels.find(p => p.id === panels.selectedPanelId) : null
  
  // Debug selected panel changes
  useEffect(() => {
    console.log('[DEBUG] Selected panel changed:', {
      selectedPanelId: panels.selectedPanelId,
      selectedPanel: selectedPanel,
      totalPanels: panels.panels.length
    });
  }, [panels.selectedPanelId, selectedPanel, panels.panels.length]);
  
  // New mouse state for enhanced interactivity
  const [mouseState, setMouseState] = useState<MouseState>({
    x: 0,
    y: 0,
    isPanning: false,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  })
  
  // Use ref for immediate access to drag state (simplified - only use ref)
  const isDraggingRef = useRef(false)

  const [spacePressed, setSpacePressed] = useState(false)
  
  // Calculate world dimensions - updated to 4000x4000
  const worldDimensions = useMemo(() => {
    const worldWidth = WORLD_SIZE; // 4000ft
    const worldHeight = WORLD_SIZE; // 4000ft
    
    const minCanvasWidth = 1200;
    const minCanvasHeight = 800;
    
    const scaleX = minCanvasWidth / worldWidth;
    const scaleY = minCanvasHeight / worldHeight;
    const worldScale = Math.min(scaleX, scaleY);
    
    console.log('[PanelLayout] World dimensions calculated:', {
      worldWidth,
      worldHeight,
      worldScale,
      resultingCanvasWidth: worldWidth * worldScale,
      resultingCanvasHeight: worldHeight * worldScale
    });
    
    return { worldWidth, worldHeight, worldScale };
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

  // Grid configuration
  const gridConfig: GridConfig = useMemo(() => ({
    minorSpacing: GRID_MINOR,
    majorSpacing: GRID_MAJOR,
    snapSize: SNAP_SIZE
  }), [])
  
  // Refs for preventing infinite loops
  const lastExternalPanels = useRef<string>('')
  const lastInternalPanels = useRef<string>('')
  
  // Update internal panels ref when panels change
  useEffect(() => {
    console.log('[DEBUG] Internal panels updated:', {
      count: panels.panels.length,
      panels: panels.panels.map(p => ({ id: p.id, x: p.x, y: p.y, width: p.width, height: p.height }))
    });
    lastInternalPanels.current = JSON.stringify(panels.panels);
  }, [panels.panels]);
  
  // Canvas dimensions
  const [canvasWidth, setCanvasWidth] = useState(Math.ceil(worldDimensions.worldWidth * worldDimensions.worldScale))
  const [canvasHeight, setCanvasHeight] = useState(Math.ceil(worldDimensions.worldHeight * worldDimensions.worldScale))
  
  const { toast } = useToast()
  
  // Use hooks
  const { isValidPanel, getPanelValidationErrors, calculatePanelBounds } = usePanelValidation()
  
  // Create a ref to store the getCurrentCanvas function
  const getCurrentCanvasRef = useRef<(() => HTMLCanvasElement | null)>(() => canvasRef.current)
  
  // Create a ref to store the renderCanvas function to avoid dependency loops
  const renderCanvasRef = useRef<(() => void) | null>(null)
  
  // Removed panelsRef - no longer needed since we pass panels directly to useCanvasRenderer

  // Use interactive grid hook
  const { drawGrid, setupCanvas: setupGridCanvas, getWorldScale } = useInteractiveGrid({
    worldSize: WORLD_SIZE,
    gridConfig,
    canvasState: {
      worldScale: canvasState.worldScale,
      scale: canvasState.scale,
      offsetX: canvasState.offsetX,
      offsetY: canvasState.offsetY,
      showGrid: canvasState.showGrid,
      snapEnabled: canvasState.snapToGrid
    }
  })
  
  // Use canvas renderer hook FIRST to get renderCanvas function
  const { renderCanvas, drawPanel, drawSelectionHandles, worldToScreen, screenToWorld } = useCanvasRenderer({
    panels: panels.panels, // Pass panels directly instead of using ref
    canvasState,
    canvasWidth,
    canvasHeight,
    selectedPanelId: panels.selectedPanelId, // Use panels.selectedPanelId directly instead of panelData.selectedPanelId
    getCurrentCanvas: () => getCurrentCanvasRef.current(),
    isValidPanel,
    getPanelValidationErrors,
    drawGrid
  })
  
  // Debug when useCanvasRenderer is recreated
  useEffect(() => {
    console.log('[DEBUG] useCanvasRenderer recreated with new panels:', {
      panelCount: panels.panels.length,
      panelPositions: panels.panels.map(p => ({ id: p.id, x: p.x, y: p.y }))
    });
  }, [panels.panels]);
  
  // Store the renderCanvas function in the ref
  useEffect(() => {
    console.log('[DEBUG] Updating renderCanvasRef with new renderCanvas function');
    renderCanvasRef.current = renderCanvas
  }, [renderCanvas])
  
  // Use fullscreen canvas hook SECOND with the actual renderCanvas function
  const { 
      isFullscreen,
    fullscreenCanvasRef, 
    toggleFullscreen,
    fullscreenCanvasWidth,
    fullscreenCanvasHeight
  } = useFullscreenCanvas({
      canvasWidth,
      canvasHeight,
    toast
  })
  
  // Update the getCurrentCanvas function to use the fullscreen state
  useEffect(() => {
    getCurrentCanvasRef.current = () => isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
  }, [isFullscreen])
  
  // Consolidated fullscreen state management
  useEffect(() => {
    console.log('🔍 [PanelLayout] Fullscreen state changed:', { 
      isFullscreen, 
      fullscreenCanvasWidth, 
      fullscreenCanvasHeight,
      fullscreenCanvasRef: fullscreenCanvasRef.current ? 'exists' : 'null'
    });
    
    if (isFullscreen && fullscreenCanvasRef.current) {
      console.log('🔍 [PanelLayout] Setting up fullscreen canvas...');
      
      // Setup canvas immediately
      const canvas = fullscreenCanvasRef.current;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      try {
        // Set display size
        canvas.style.width = screenWidth + 'px';
        canvas.style.height = screenHeight + 'px';
        
        // Set actual size in memory (scaled for HiDPI)
        const dpr = window.devicePixelRatio || 1;
        canvas.width = screenWidth * dpr;
        canvas.height = screenHeight * dpr;
        
        // Get the context and scale for HiDPI
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        } else {
          throw new Error('Failed to get canvas context');
        }
      } catch (error) {
        console.error('🔍 [PanelLayout] Fullscreen canvas setup failed:', error);
        // Log error but continue - let the hook handle state reset
        return;
      }
      
              console.log('🔍 [PanelLayout] Fullscreen canvas setup complete:', { 
          screenWidth, 
          screenHeight, 
          dpr: window.devicePixelRatio || 1,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        });
      
      // Force render after setup with a longer delay to ensure state is stable
      setTimeout(() => {
        if (renderCanvasRef.current && isFullscreen) {
          console.log('🔍 [PanelLayout] Calling renderCanvas in fullscreen mode');
          renderCanvasRef.current();
        }
      }, 200);
    }
  }, [isFullscreen]); // Only depend on isFullscreen
  
  // Initialize panels from external source
  useEffect(() => {
    const externalPanelsRef = externalPanels || [];
    const externalPanelsString = JSON.stringify(externalPanelsRef);
    
    console.log('[DEBUG] External panels received:', externalPanelsRef);
    
    // Only process if external panels actually changed
    if (lastExternalPanels.current !== externalPanelsString) {
      console.log('[PanelLayout] External panels changed, processing...');
      lastExternalPanels.current = externalPanelsString;
      
      // Check if internal panels are already the same
      const internalPanelsString = lastInternalPanels.current;
      if (externalPanelsString === internalPanelsString) {
        console.log('[PanelLayout] Internal panels already match, skipping');
        return;
      }
      
      if (externalPanelsRef.length > 0) {
        const validExternalPanels = externalPanelsRef.filter(panel => {
          if (!isValidPanel(panel)) {
            const errors = getPanelValidationErrors(panel);
            console.warn('[PanelLayout] Skipping invalid external panel:', { panel, errors });
            return false;
          }
          return true;
        });
        
        console.log('[DEBUG] Valid external panels:', validExternalPanels);
        console.log('[DEBUG] Invalid external panels:', externalPanelsRef.filter(p => !isValidPanel(p)));
        
        if (validExternalPanels.length > 0) {
          console.log('[PanelLayout] Setting internal panels from external source');
          // Set a flag to prevent the notification useEffect from running
          lastInternalPanels.current = externalPanelsString;
          dispatch({ type: 'SET_PANELS', payload: validExternalPanels })
        }
      } else {
        // Only clear if internal panels are not already empty
        if (internalPanelsString !== '[]') {
          console.log('[PanelLayout] Clearing internal panels from external source');
          // Set a flag to prevent the notification useEffect from running
          lastInternalPanels.current = '[]';
          dispatch({ type: 'SET_PANELS', payload: [] })
        }
      }
    }
  }, [externalPanels]) // Only depend on externalPanels
  
  // Notify parent of panel updates
  const onPanelUpdateRef = useRef(onPanelUpdate);
  const lastNotifiedPanels = useRef<string>('')
  
  useEffect(() => {
    onPanelUpdateRef.current = onPanelUpdate;
  }, [onPanelUpdate]);
  
  useEffect(() => {
    // Only notify parent if panels actually changed
    const currentPanelsString = JSON.stringify(panels.panels);
    
    // Skip if this change was triggered by external panels update
    if (currentPanelsString === lastInternalPanels.current) {
      console.log('[PanelLayout] Skipping notification - change was from external source');
      return;
    }
    
    if (currentPanelsString !== lastNotifiedPanels.current && onPanelUpdateRef.current) {
      console.log('[PanelLayout] Notifying parent of panel changes');
      // Additional check: only update if the change is meaningful
      const currentPanels = panels.panels;
      const lastNotifiedPanelsParsed = lastNotifiedPanels.current ? JSON.parse(lastNotifiedPanels.current) : [];
      
      // Check if panels are actually different (not just reference changes)
      const panelsActuallyChanged = currentPanels.length !== lastNotifiedPanelsParsed.length || 
        currentPanels.some((panel, index) => {
          const lastPanel = lastNotifiedPanelsParsed[index];
          return !lastPanel || panel.id !== lastPanel.id || 
                 panel.x !== lastPanel.x || panel.y !== lastPanel.y ||
                 panel.width !== lastPanel.width || panel.height !== lastPanel.height;
        });
      
      if (panelsActuallyChanged) {
        lastNotifiedPanels.current = currentPanelsString;
        onPanelUpdateRef.current(currentPanels);
      }
    }
  }, [panels.panels]) // Only depend on panels.panels
  
  // Canvas Functions
  const zoomIn = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: clamp(prev.scale * 1.25, 0.1, 6) }))
  }, [])
  
  const zoomOut = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: clamp(prev.scale * 0.8, 0.1, 6) }))
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
  
  // New zoom functions
  const zoomToFitSite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = 100;
    const availableWidth = canvas.clientWidth - padding;
    const availableHeight = canvas.clientHeight - padding;

    const newWorldScale = Math.min(availableWidth / WORLD_SIZE, availableHeight / WORLD_SIZE);
    const worldSizeScreen = WORLD_SIZE * newWorldScale;

    setCanvasState(prev => ({
      ...prev,
      worldScale: newWorldScale,
      scale: 1.0,
      offsetX: (canvas.clientWidth - worldSizeScreen) / 2,
      offsetY: (canvas.clientHeight - worldSizeScreen) / 2,
    }));
  }, []);

  const zoomToFitPanels = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || panels.panels.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    panels.panels.forEach(panel => {
        minX = Math.min(minX, panel.x);
        minY = Math.min(minY, panel.y);
        maxX = Math.max(maxX, panel.x + panel.width);
        maxY = Math.max(maxY, panel.y + panel.height);
    });

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const padding = 200; // feet

    const availableWidth = canvas.clientWidth - 100; // screen padding
    const availableHeight = canvas.clientHeight - 100;

    const scaleX = availableWidth / (boundsWidth + padding);
    const scaleY = availableHeight / (boundsHeight + padding);
    const newWorldScale = Math.min(scaleX, scaleY);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setCanvasState(prev => ({
      ...prev,
      worldScale: newWorldScale,
      scale: 1.0,
      offsetX: canvas.clientWidth / 2 - centerX * newWorldScale,
      offsetY: canvas.clientHeight / 2 - centerY * newWorldScale,
    }));
  }, [panels.panels]);

  // Auto-fit viewport when panels are loaded
  const autoFitViewport = useCallback(() => {
    if (panels.panels.length > 0 && canvasWidth > 0 && canvasHeight > 0) {
      const bounds = calculatePanelBounds(panels.panels);
          if (bounds) {
            const { minX, minY, maxX, maxY } = bounds;
            
            const worldScale = canvasState.worldScale;
            const panelWidth = (maxX - minX) * worldScale;
            const panelHeight = (maxY - minY) * worldScale;
            
        const padding = 100;
            const scaleX = (canvasWidth - padding) / panelWidth;
            const scaleY = (canvasHeight - padding) / panelHeight;
            const newScale = Math.min(scaleX, scaleY, 2.0);
            
            const offsetX = (canvasWidth - panelWidth * newScale) / 2 - minX * worldScale * newScale;
            const offsetY = (canvasHeight - panelHeight * newScale) / 2 - minY * worldScale * newScale;
            
            setCanvasState(prev => ({
              ...prev,
              scale: newScale,
              offsetX,
              offsetY
            }));
          }
        }
  }, [panels.panels, canvasWidth, canvasHeight, canvasState.worldScale, calculatePanelBounds]);
  
  // Auto-fit viewport when panels are loaded (with stable dependencies)
  // Temporarily disabled to prevent infinite loops
  // useEffect(() => {
  //   if (panelData.panels.length > 0 && canvasWidth > 0 && canvasHeight > 0) {
  //     const timer = setTimeout(autoFitViewport, 100);
  //     return () => clearTimeout(timer);
  //   }
  // }, [panelData.panels.length, canvasWidth, canvasHeight, autoFitViewport])
  
  // Local coordinate transformation functions with access to current canvas state
  // Use the EXACT same logic as the canvas renderer for consistency
  const localScreenToWorld = useCallback((sx: number, sy: number) => {
    // Match the exact transformation used in use-canvas-renderer.ts
    const worldX = (sx - canvasState.offsetX) / (canvasState.worldScale * canvasState.scale);
    const worldY = (sy - canvasState.offsetY) / (canvasState.worldScale * canvasState.scale);
    
    const result = { x: worldX, y: worldY };
    console.log('[DEBUG] localScreenToWorld:', { 
      input: { sx, sy }, 
      canvasState: { offsetX: canvasState.offsetX, offsetY: canvasState.offsetY, worldScale: canvasState.worldScale, scale: canvasState.scale },
      totalScale: canvasState.worldScale * canvasState.scale,
      result 
    });
    return result;
  }, [canvasState]);

  const localWorldToScreen = useCallback((wx: number, wy: number) => {
    const totalScale = canvasState.worldScale * canvasState.scale;
    return {
      x: wx * totalScale + canvasState.offsetX,
      y: wy * totalScale + canvasState.offsetY
    };
  }, [canvasState]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    console.log('[DEBUG] Mouse click detected:', { x, y, button: e.button, spacePressed });
    console.log('[DEBUG] Current panels:', panels.panels);
    console.log('[DEBUG] Canvas state:', canvasState);
    
    if (e.button === 1 || (e.button === 0 && spacePressed)) {
      // Middle click or space + left click for panning
      setMouseState(prev => ({
        ...prev,
        isPanning: true,
        dragStartX: x,
        dragStartY: y,
      }));
      e.preventDefault();
    } else if (e.button === 0) {
      // Left click for selection/dragging
      
      console.log('[DEBUG] Starting hit test with panels:', panels.panels.length);
      console.log('[DEBUG] Canvas state for hit test:', canvasState);
      
      // Check panels in reverse order (top to bottom)
      for (let i = panels.panels.length - 1; i >= 0; i--) {
        const panel = panels.panels[i];
        
        // Convert screen coordinates to world coordinates for hit testing
        const worldPos = localScreenToWorld(x, y);
        
        // More detailed debugging
        console.log('[DEBUG] Testing panel:', {
          id: panel.id,
          shape: panel.shape,
          bounds: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
          worldClick: worldPos
        });
        
        // Enhanced hit test based on panel shape
        let isHit = false;
        
        switch (panel.shape) {
          case 'triangle':
            // Point-in-triangle test for equilateral triangle
            const centerX = panel.x + panel.width / 2;
            const topY = panel.y;
            const leftX = panel.x;
            const rightX = panel.x + panel.width;
            const bottomY = panel.y + panel.height;
            
            console.log('[DEBUG] Triangle hit test:', {
              panelBounds: { centerX, topY, leftX, rightX, bottomY },
              worldPos
            });
            
            // Check if point is inside triangle using barycentric coordinates
            const v0x = rightX - leftX;
            const v0y = bottomY - topY;
            const v1x = centerX - leftX;
            const v1y = topY - topY;
            const v2x = worldPos.x - leftX;
            const v2y = worldPos.y - topY;
            
            const dot00 = v0x * v0x + v0y * v0y;
            const dot01 = v0x * v1x + v0y * v1y;
            const dot02 = v0x * v2x + v0y * v2y;
            const dot11 = v1x * v1x + v1y * v1y;
            const dot12 = v1x * v2x + v1y * v2y;
            
            const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
            const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
            const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
            
            console.log('[DEBUG] Triangle barycentric calculation:', { u, v, uPlusV: u + v });
            
            isHit = (u >= 0) && (v >= 0) && (u + v <= 1);
            break;
            
          case 'right-triangle':
            // Point-in-right-triangle test
            // Right triangle has right angle at top-right, hypotenuse from top-left to bottom-right
            const rightTopX = panel.x + panel.width;
            const rightTopY = panel.y;
            const leftTopX = panel.x;
            const leftTopY = panel.y;
            const rightBottomX = panel.x + panel.width;
            const rightBottomY = panel.y + panel.height;
            
            console.log('[DEBUG] Right triangle hit test:', {
              panelBounds: { leftTopX, leftTopY, rightTopX, rightTopY, rightBottomX, rightBottomY },
              worldPos,
              boundingBoxCheck: {
                xInBounds: worldPos.x >= leftTopX && worldPos.x <= rightTopX,
                yInBounds: worldPos.y >= leftTopY && worldPos.y <= rightBottomY
              }
            });
            
            // Check if point is inside the bounding box
            if (worldPos.x >= leftTopX && worldPos.x <= rightTopX && 
                worldPos.y >= leftTopY && worldPos.y <= rightBottomY) {
              
              // Calculate the hypotenuse line: from top-left to bottom-right
              // For a point to be inside the triangle, it must be below the hypotenuse
              const hypotenuseSlope = (rightBottomY - leftTopY) / (rightBottomX - leftTopX);
              const hypotenuseY = leftTopY + hypotenuseSlope * (worldPos.x - leftTopX);
              
              console.log('[DEBUG] Right triangle hypotenuse calculation:', {
                hypotenuseSlope,
                hypotenuseY,
                pointY: worldPos.y,
                isBelowHypotenuse: worldPos.y >= hypotenuseY
              });
              
              // Point is inside if it's below the hypotenuse
              isHit = worldPos.y >= hypotenuseY;
            } else {
              isHit = false;
            }
            break;
            
          case 'rectangle':
          default:
            // Simple AABB hit test for rectangles
            console.log('[DEBUG] Rectangle hit test:', {
              panelBounds: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
              worldPos,
              hitTestResults: {
                xInBounds: worldPos.x >= panel.x && worldPos.x <= panel.x + panel.width,
                yInBounds: worldPos.y >= panel.y && worldPos.y <= panel.y + panel.height
              }
            });
            isHit = worldPos.x >= panel.x && worldPos.x <= panel.x + panel.width &&
                    worldPos.y >= panel.y && worldPos.y <= panel.y + panel.height;
            break;
        }
        
        console.log('[DEBUG] Final hit test result for', panel.shape, ':', isHit);
        
        if (isHit) {
          console.log('[DEBUG] Panel hit! Panel ID:', panel.id);
          console.log('[DEBUG] Dispatching SELECT_PANEL for:', panel.id);
          dispatch({ type: 'SELECT_PANEL', payload: panel.id })
          
          if (isRotationHandle(x, y, panel)) {
            console.log('[DEBUG] Rotation handle detected, starting rotation');
            setIsRotating(true)
            // Convert screen coordinates to world coordinates for rotation calculation
            const worldPos = localScreenToWorld(x, y);
            const panelCenterX = panel.x + panel.width / 2;
            const panelCenterY = panel.y + panel.height / 2;
            setRotationStart(Math.atan2(worldPos.y - panelCenterY, worldPos.x - panelCenterX));
            return
          }
          
          console.log('[DEBUG] Starting drag for panel:', panel.id);
          // Only set the ref - simplified state management
          isDraggingRef.current = true;
          // Convert screen coordinates to world coordinates for drag calculation
          const worldPos = localScreenToWorld(x, y);
          setDragStart({ x: worldPos.x - panel.x, y: worldPos.y - panel.y });
          console.log('[DEBUG] Drag start position set:', { x: worldPos.x - panel.x, y: worldPos.y - panel.y });
          return
        }
      }
      
      console.log('[DEBUG] No panel hit');
      // No panel hit - clear selection
      dispatch({ type: 'SELECT_PANEL', payload: null })
    }
  }, [panels, canvasState, isFullscreen, spacePressed, localScreenToWorld])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setMouseState(prev => ({ ...prev, x, y }))
    
    console.log('[DEBUG] Mouse move - current state:', { 
      isDraggingRef: isDraggingRef.current,
      selectedPanel: selectedPanel?.id,
      mousePos: { x, y }
    });
    
    if (mouseState.isPanning) {
      const deltaX = x - mouseState.dragStartX;
      const deltaY = y - mouseState.dragStartY;

      setCanvasState(prev => ({
        ...prev,
        offsetX: prev.offsetX + deltaX,
        offsetY: prev.offsetY + deltaY,
      }));

      setMouseState(prev => ({
        ...prev,
        dragStartX: x,
        dragStartY: y,
      }));
    } else if (isDraggingRef.current && selectedPanel) {
      console.log('[DEBUG] Drag in progress - updating panel position');
      console.log('[DEBUG] Drag details:', {
        isDraggingRef: isDraggingRef.current,
        selectedPanelId: selectedPanel.id,
        dragStart,
        currentMousePos: { x, y }
      });
      
      const worldPos = localScreenToWorld(x, y);
      console.log('[DEBUG] World position:', worldPos);
      
      // Use the dragStart state that was set when the panel was clicked
      const newX = worldPos.x - dragStart.x;
      const newY = worldPos.y - dragStart.y;
      console.log('[DEBUG] Calculated new position:', { newX, newY });

      // Apply snap if enabled
      let finalX = newX;
      let finalY = newY;
      if (canvasState.snapToGrid) {
        finalX = snapToGrid(newX, SNAP_SIZE);
        finalY = snapToGrid(newY, SNAP_SIZE);
        console.log('[DEBUG] After snapping:', { finalX, finalY });
      }
      
      console.log('[DEBUG] Dispatching UPDATE_PANEL with:', {
        id: selectedPanel.id,
        updates: { x: finalX, y: finalY }
      });
      
      dispatch({
        type: 'UPDATE_PANEL',
        payload: {
          id: selectedPanel.id,
          updates: { x: finalX, y: finalY }
        }
      })
    } else if (isRotating && selectedPanel) {
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
  }, [isRotating, selectedPanel, dragStart, rotationStart, canvasState, isFullscreen, mouseState, localScreenToWorld])
  
  const handleMouseUp = useCallback(() => {
    console.log('[DEBUG] Mouse up - resetting states');
    console.log('[DEBUG] Previous drag state:', isDraggingRef.current);
    
    setIsRotating(false)
    isDraggingRef.current = false; // Reset ref immediately
    
    setMouseState(prev => ({
      ...prev,
      isPanning: false,
      // Remove isDragging since we're only using the ref now
    }))
    
    console.log('[DEBUG] States reset - isDraggingRef:', isDraggingRef.current);
  }, [])
  

  
  const isRotationHandle = (x: number, y: number, panel: Panel): boolean => {
    if (!isValidPanel(panel)) {
      return false;
    }
    
    // Convert world coordinates to screen coordinates for handle detection
    const screenPos = localWorldToScreen(panel.x, panel.y);
    const screenWidth = panel.width * canvasState.worldScale * canvasState.scale;
    
    const handleSize = 8
    const rotationHandleY = screenPos.y - 30
    const rotationHandleX = screenPos.x + screenWidth / 2
    
    // x and y are already in screen coordinates from handleMouseDown
    return Math.abs(x - rotationHandleX) <= handleSize && Math.abs(y - rotationHandleY) <= handleSize
  }
  

  
  // Wheel event for zooming
  const handleWheel = useCallback((e: WheelEvent) => {
    // Prevent default scrolling behavior
    e.preventDefault()
    
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(6, canvasState.scale * zoomFactor))
    
    // Keep mouse position invariant
    const sOld = canvasState.worldScale * canvasState.scale;
    const sNew = canvasState.worldScale * newScale;
    const wx = (mouseX - canvasState.offsetX) / sOld;
    const wy = (mouseY - canvasState.offsetY) / sOld;
    
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      offsetX: mouseX - wx * sNew,
      offsetY: mouseY - wy * sNew,
    }))
  }, [canvasState, isFullscreen])

  // Add wheel event listener
  useEffect(() => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const wheelHandler = (e: WheelEvent) => {
      try {
        handleWheel(e)
      } catch (error) {
        console.warn('[PanelLayout] Error in wheel handler:', error)
      }
    }
    
    canvas.addEventListener('wheel', wheelHandler, { passive: false })
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler)
    }
  }, [handleWheel, isFullscreen])
  
  // Quick test click handler for debugging coordinate transformation
  const testClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const worldPos = localScreenToWorld(x, y)
    console.log('[DEBUG] Test click coordinates:', { 
      screen: {x, y}, 
      world: worldPos, 
      panels: panels.panels,
      canvasState 
    })
  }, [isFullscreen, localScreenToWorld, panels.panels, canvasState])
  
  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(true);
        e.preventDefault();
      } else if (e.key === 'f' || e.key === 'F') {
        // Toggle fullscreen with F key
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          toggleFullscreen();
        }
      } else if (e.key === 'Delete' && panels.selectedPanelId) {
        dispatch({ type: 'DELETE_PANEL', payload: panels.selectedPanelId });
        dispatch({ type: 'SELECT_PANEL', payload: null });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isFullscreen, toggleFullscreen, panels.selectedPanelId]);
  
  // Render canvas when dependencies change
  useEffect(() => {
    const currentCanvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current;
    console.log('[DEBUG] Canvas render effect triggered:', {
      hasCanvas: !!currentCanvas,
      panelCount: panels.panels.length,
      isFullscreen,
      canvasWidth,
      canvasHeight,
      panelPositions: panels.panels.map(p => ({ id: p.id, x: p.x, y: p.y }))
    });
    
    if (currentCanvas) {
      console.log('[DEBUG] Calling renderCanvas...');
      // Use the ref to avoid dependency loop
      renderCanvasRef.current?.();
    }
  }, [panels.panels, canvasState, canvasWidth, canvasHeight, isFullscreen]) // Changed from panels.panels.length to panels.panels
  
  // Update canvas state when world dimensions change
  useEffect(() => {
    setCanvasState(prev => ({
      ...prev,
      worldWidth: worldDimensions.worldWidth,
      worldHeight: worldDimensions.worldHeight,
      worldScale: worldDimensions.worldScale
    }));
    
    // Set canvas dimensions based on world dimensions (for normal mode)
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

  // Fullscreen canvas setup is now handled in the consolidated effect above
  
  // Setup canvas with HiDPI support
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      setupGridCanvas(canvas, container);
    }
  }, [setupGridCanvas]);

  // Calculate status values
  const zoomPercentage = Math.round(canvasState.scale * 100);
  const worldPos = screenToWorld ? screenToWorld(mouseState.x, mouseState.y) : { x: 0, y: 0 };
  
  return (
    <>
      {/* Debug Fullscreen State - TEMPORARY */}
      <div className="fixed top-0 right-0 bg-blue-500 text-white p-2 z-[10000] text-xs">
        Fullscreen: {isFullscreen ? 'TRUE' : 'FALSE'} | 
        Width: {fullscreenCanvasWidth} | 
        Height: {fullscreenCanvasHeight}
      </div>
      
            {/* Fullscreen Canvas Portal */}
      {isFullscreen && (
        <>
        <div
          className="fixed inset-0 w-screen h-screen bg-gray-900 z-50 overflow-hidden"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999
          }}
        >
          {/* Fullscreen Toolbar */}
          <div className="absolute top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-10">
            <div className="flex items-center space-x-4">
              {/* Zoom Controls */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={zoomOut}
                  className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm font-medium transition-colors text-white"
                >
                  Zoom -
                </button>
                <button 
                  onClick={zoomIn}
                  className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm font-medium transition-colors text-white"
                >
                  Zoom +
                </button>
                <div className="border-l border-gray-600 h-6 mx-2"></div>
                <button 
                  onClick={zoomToFitSite}
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-sm font-medium transition-colors text-white"
                >
                  Fit Site
                </button>
                <button 
                  onClick={zoomToFitPanels}
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-sm font-medium transition-colors text-white"
                >
                  Fit Panels
                </button>
              </div>
              
              {/* Grid Controls */}
              <div className="flex items-center space-x-2">
                <div className="border-l border-gray-600 h-6 mx-2"></div>
                <button 
                  onClick={() => setCanvasState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
                  className={`${canvasState.showGrid ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'} px-3 py-2 rounded text-sm font-medium transition-colors text-white`}
                >
                  Grid: {canvasState.showGrid ? 'ON' : 'OFF'}
                </button>
                <button 
                  onClick={() => setCanvasState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
                  className={`${canvasState.snapToGrid ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'} px-3 py-2 rounded text-sm font-medium transition-colors text-white`}
                >
                  Snap: {canvasState.snapToGrid ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            
            {/* Status and Exit */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-6 text-sm font-mono text-white">
                <div className="text-gray-300">
                  Zoom: <span className="text-white font-medium">{zoomPercentage}%</span>
                </div>
                <div className="text-gray-300">
                  Scale: <span className="text-white font-medium">{canvasState.worldScale.toFixed(3)}</span> px/ft
                </div>
                <div className="text-gray-300">
                  Panels: <span className="text-white font-medium">{panels.panels.length}</span>
                </div>
                <div className="text-gray-300">
                  Cursor: <span className="text-white font-medium">{Math.round(worldPos.x)}', {Math.round(worldPos.y)}'</span>
                </div>
              </div>
              
              <div className="border-l border-gray-600 h-6 mx-2"></div>
              
              <button 
                onClick={() => toggleFullscreen()}
                className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-medium transition-colors text-white flex items-center space-x-2"
              >
                <span>Exit Fullscreen</span>
                <span className="text-xs">(ESC)</span>
              </button>
            </div>
          </div>
          
          {/* Fullscreen Canvas */}
          <div className="w-full h-full pt-16"> {/* pt-16 accounts for toolbar height */}
            <canvas
              ref={fullscreenCanvasRef}
              width={fullscreenCanvasWidth || window.innerWidth}
              height={fullscreenCanvasHeight || window.innerHeight}
              className="w-full h-full bg-white"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                cursor: mouseState.isPanning ? 'grabbing' : 
                       spacePressed ? 'grab' : 
                       isDraggingRef.current ? 'grabbing' : 
                       isRotating ? 'crosshair' : 'crosshair',
                display: 'block',
                width: '100%',
                height: '100%'
              }}
            />
          </div>
          
                                             {/* Help Overlay */}
             <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm pointer-events-none z-20">
               <div className="font-medium mb-1">Controls:</div>
               <div className="text-xs text-gray-300 space-y-1">
                 <div>Wheel: Zoom</div>
                 <div>Space + Drag: Pan</div>
                 <div>Middle Click + Drag: Pan</div>
                 <div>Click: Select Panel</div>
                 <div>Drag: Move Panel</div>
                 <div>ESC: Exit Fullscreen</div>
                 <div>Ctrl+F: Toggle Fullscreen</div>
                 <div>Delete: Remove Selected Panel</div>
               </div>
             </div>
        </div>
        </>
      )}
      
      {/* Normal Panel Layout Container */}
      <div className="h-screen flex flex-col bg-gray-900 text-white">
        {/* Enhanced Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={zoomOut}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm font-medium transition-colors"
                data-testid="button-zoom-out"
              >
                Zoom -
              </button>
              <button 
                onClick={zoomIn}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm font-medium transition-colors"
                data-testid="button-zoom-in"
              >
                Zoom +
              </button>
              <div className="border-l border-gray-600 h-6 mx-2"></div>
              <button 
                onClick={zoomToFitSite}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-sm font-medium transition-colors"
                data-testid="button-fit-site"
              >
                Fit Site
              </button>
              <button 
                onClick={zoomToFitPanels}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-sm font-medium transition-colors"
                data-testid="button-fit-panels"
              >
                Fit Panels
              </button>
              <button 
                onClick={resetView}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </button>
            </div>

            {/* Toggle Controls */}
            <div className="flex items-center space-x-2">
              <div className="border-l border-gray-600 h-6 mx-2"></div>
              <button 
                onClick={toggleGrid}
                className={`${canvasState.showGrid ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'} px-3 py-2 rounded text-sm font-medium transition-colors`}
                data-testid="button-toggle-grid"
              >
                <Grid className="h-4 w-4 mr-2" />
                Grid: {canvasState.showGrid ? 'ON' : 'OFF'}
              </button>
              <button 
                onClick={toggleSnap}
                className={`${canvasState.snapToGrid ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'} px-3 py-2 rounded text-sm font-medium transition-colors`}
                data-testid="button-toggle-snap"
              >
                <Zap className="h-4 w-4 mr-2" />
                Snap: {canvasState.snapToGrid ? 'ON' : 'OFF'}
              </button>
              <button 
                onClick={toggleGuides}
                className={`${canvasState.showGuides ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'} px-3 py-2 rounded text-sm font-medium transition-colors`}
              >
                <Target className="h-4 w-4 mr-2" />
                Guides: {canvasState.showGuides ? 'ON' : 'OFF'}
              </button>
              

              

              
              <button 
                onClick={() => {
                  console.log('�� [PanelLayout] Fullscreen button clicked, current state:', isFullscreen);
                  toggleFullscreen();
                  console.log('🔍 [PanelLayout] toggleFullscreen called');
                }}
                className={`${isFullscreen ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'} px-3 py-2 rounded text-sm font-medium transition-colors ml-2`}
                title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen (Ctrl+F)"}
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
              </button>
            </div>
          </div>

          {/* Status Readout */}
          <div className="flex items-center space-x-6 text-sm font-mono">
            <div className="text-gray-300">
              Zoom: <span className="text-white font-medium" data-testid="text-zoom-percentage">{zoomPercentage}%</span>
            </div>
            <div className="text-gray-300">
              Scale: <span className="text-white font-medium" data-testid="text-base-scale">{canvasState.worldScale.toFixed(3)}</span> px/ft
            </div>
            <div className="text-gray-300">
              Panels: <span className="text-white font-medium" data-testid="text-panel-count">{panels.panels.length}</span>
            </div>
            <div className="text-gray-300">
              Cursor: <span className="text-white font-medium" data-testid="text-cursor-coords">{Math.round(worldPos.x)}', {Math.round(worldPos.y)}'</span>
            </div>
          </div>
            </div>
            
        {/* Canvas Container */}
        <div className="flex-1 bg-gray-800 relative overflow-hidden">
          <div 
            ref={containerRef}
            className={`w-full h-full relative ${mouseState.isPanning ? 'cursor-grabbing' : spacePressed ? 'cursor-grab' : 'cursor-crosshair'}`}
          >
            {/* Normal Canvas - Only shown when NOT in fullscreen */}
            {!isFullscreen && (
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
                className="absolute inset-0 bg-white"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                data-testid="canvas-main"
                              style={{
                  cursor: mouseState.isPanning ? 'grabbing' : 
                         spacePressed ? 'grab' : 
                         isDraggingRef.current ? 'grabbing' : 
                         isRotating ? 'crosshair' : 'crosshair',
                display: 'block',
                width: '100%',
                height: '100%',
                position: 'relative',
                zIndex: 'auto'
              }}
            />
            )}

            {/* Coordinate Display */}
            <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm font-mono pointer-events-none">
              <div data-testid="text-world-coords">World: {Math.round(worldPos.x)}', {Math.round(worldPos.y)}'</div>
              <div data-testid="text-screen-coords">Screen: {Math.round(mouseState.x)}, {Math.round(mouseState.y)}</div>
            </div>
            
            {/* Help Overlay */}
            <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm pointer-events-none">
              <div className="font-medium mb-1">Controls:</div>
              <div className="text-xs text-gray-300 space-y-1">
                <div>Wheel: Zoom</div>
                <div>Space + Drag: Pan</div>
                <div>Middle Click + Drag: Pan</div>
                <div>Click: Select Panel</div>
                <div>Drag: Move Panel</div>
                <div>Ctrl+F: Fullscreen</div>
                <div>Delete: Remove Panel</div>
              </div>
            </div>
            
            {/* Temporary Test Button for Debugging */}
            <button
              onClick={() => {
                console.log('[DEBUG] Test button clicked');
                console.log('[DEBUG] Current panels:', panels.panels);
                console.log('[DEBUG] Canvas state:', canvasState);
                console.log('[DEBUG] Drag ref state:', isDraggingRef.current);
              }}
              className="absolute top-4 right-4 bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm font-medium transition-colors z-10"
            >
              Debug Info
            </button>
          </div>
        </div>
      </div>
    </>
  )
}