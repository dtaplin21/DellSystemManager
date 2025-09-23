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
  Move,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import { usePanelValidation } from '../../hooks/use-panel-validation'
import { useCanvasRenderer } from '../../hooks/use-canvas-renderer'
import { useFullscreenCanvas } from '../../hooks/use-fullscreen-canvas'
import { useInteractiveGrid, type GridConfig } from '../../hooks/use-interactive-grid'
import { snapToGrid, clamp } from '../../lib/geometry'
import PanelSidebar from '../panel-layout/panel-sidebar'

// CRITICAL FIX #12: Comprehensive position persistence debugging
const DEBUG_POSITION_PERSISTENCE = false; // Temporarily disabled to restore panels

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
  projectId?: string
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
      // CRITICAL FIX #12: Debug position persistence
      if (DEBUG_POSITION_PERSISTENCE) {
        console.log('[PanelLayout] SET_PANELS action:', {
          action: 'SET_PANELS',
          panelCount: action.payload.length,
          firstPanel: action.payload[0] ? { id: action.payload[0].id, x: action.payload[0].x, y: action.payload[0].y } : null,
          lastPanel: action.payload[action.payload.length - 1] ? { id: action.payload[action.payload.length - 1].id, x: action.payload[action.payload.length - 1].x, y: action.payload[action.payload.length - 1].y } : null
        });
      }
      return { ...state, panels: action.payload }
    case 'ADD_PANEL':
      return { ...state, panels: [...state.panels, action.payload] }
    case 'UPDATE_PANEL':
      // CRITICAL DEBUG: Track panel updates
      if (DEBUG_POSITION_PERSISTENCE) {
        console.log('🚨 [PanelLayout] UPDATE_PANEL action:', {
          action: 'UPDATE_PANEL',
          panelId: action.payload.id,
          updates: action.payload.updates,
          currentPanel: state.panels.find(p => p.id === action.payload.id),
          totalPanels: state.panels.length
        });
      }
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

const WORLD_SIZE = 15000 // feet - using the 15000x15000 world to match backend and parent component
const GRID_MINOR = 50 // feet
const GRID_MAJOR = 250 // feet
const SNAP_SIZE = 25 // feet

export default function PanelLayout({ mode, projectInfo, externalPanels, onPanelUpdate, projectId }: PanelLayoutProps) {
  // Temporarily disabled excessive logging to restore panels
  // console.log('🚨 [PanelLayout] === COMPONENT RENDER START ===');
  // console.log('🚨 [PanelLayout] Rendering with props:', { mode, projectInfo, externalPanels, onPanelUpdate, projectId });
  // console.log('🚨 [PanelLayout] externalPanels received:', externalPanels);
  // console.log('🚨 [PanelLayout] externalPanels.length:', externalPanels?.length || 0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [panels, dispatch] = useReducer(panelReducer, { panels: [], selectedPanelId: null })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState(0)
  
  // Get the selected panel from the reducer state
  const selectedPanel = panels.selectedPanelId ? panels.panels.find(p => p.id === panels.selectedPanelId) : null
  
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
  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 800 })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedPanelForSidebar, setSelectedPanelForSidebar] = useState<Panel | null>(null)
  
  // Calculate world dimensions - updated to 15000x15000
  // Use stable world scale to prevent coordinate system changes on re-render
  const worldDimensions = useMemo(() => {
    const worldWidth = WORLD_SIZE; // 15000ft
    const worldHeight = WORLD_SIZE; // 15000ft
    
    // Use a stable world scale that doesn't change on container resize
    // This prevents panels from jumping around when the coordinate system changes
    const stableWorldScale = 0.3; // Fixed scale that works well for most use cases
    
    return { worldWidth, worldHeight, worldScale: stableWorldScale };
  }, []); // No dependencies - stable world scale
  
  const [canvasState, setCanvasState] = useState<CanvasState>(() => {
    // Try to restore zoom state and panel view from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('panelLayoutZoomState');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            scale: parsed.scale || 1,
            offsetX: parsed.offsetX || 0,
            offsetY: parsed.offsetY || 0,
            showGrid: parsed.showGrid !== undefined ? parsed.showGrid : true,
            showGuides: parsed.showGuides !== undefined ? parsed.showGuides : true,
            snapToGrid: parsed.snapToGrid !== undefined ? parsed.snapToGrid : true,
            gridSize: parsed.gridSize || 20,
            worldWidth: WORLD_SIZE, // Use constant values to avoid race condition
            worldHeight: WORLD_SIZE,
            worldScale: 0.3 // Use stable world scale
          };
        }
      } catch (error) {
        console.warn('Failed to restore zoom state from localStorage:', error);
      }
    }
    
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      showGrid: true,
      showGuides: true,
      snapToGrid: true,
      gridSize: 20,
      worldWidth: WORLD_SIZE, // Use constant values to avoid race condition
      worldHeight: WORLD_SIZE,
      worldScale: 0.3 // Use stable world scale
    };
  });

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
    lastInternalPanels.current = JSON.stringify(panels.panels);
  }, [panels.panels]);
  
  // CRITICAL DEBUG: Track component lifecycle
  useEffect(() => {
    // Temporarily disabled excessive logging
    // console.log('🚨 [PanelLayout] === COMPONENT MOUNTED ===');
    // console.log('🚨 [PanelLayout] Initial externalPanels:', externalPanels);
    // console.log('🚨 [PanelLayout] Initial panels state:', panels);
    
    return () => {
      // console.log('🚨 [PanelLayout] === COMPONENT UNMOUNTING ===');
      // console.log('🚨 [PanelLayout] Final panels state:', panels);
      // console.log('🚨 [PanelLayout] Final externalPanels:', externalPanels);
    };
  }, []);
  
  // Canvas dimensions - use stable values to prevent circular dependencies
  const [canvasWidth, setCanvasWidth] = useState(1200) // Start with reasonable defaults
  const [canvasHeight, setCanvasHeight] = useState(800)
  
  const { toast } = useToast()
  
  // Use hooks
  const { isValidPanel, getPanelValidationErrors, calculatePanelBounds } = usePanelValidation()
  
  // Create a ref to store the getCurrentCanvas function
  const getCurrentCanvasRef = useRef<(() => HTMLCanvasElement | null)>(() => canvasRef.current)
  
  // Create a ref to store the renderCanvas function to avoid dependency loops
  const renderCanvasRef = useRef<(() => void) | null>(null)
  
  // Removed panelsRef - no longer needed since we pass panels directly to useCanvasRenderer


  
  // Memoize canvas state to prevent unnecessary hook recreations
  const memoizedCanvasState = useMemo(() => ({
    // Use worldDimensions.worldScale for consistency with rendering
    worldScale: worldDimensions.worldScale,
    scale: canvasState.scale,
    offsetX: canvasState.offsetX,
    offsetY: canvasState.offsetY,
    showGrid: canvasState.showGrid,
    snapEnabled: canvasState.snapToGrid
  }), [
    // Use the actual worldDimensions.worldScale to ensure consistency
    worldDimensions.worldScale,
    canvasState.scale,
    canvasState.offsetX,
    canvasState.offsetY,
    canvasState.showGrid,
    canvasState.snapToGrid
  ]);

  // Use interactive grid hook with stable dependencies
  const { drawGrid, setupCanvas: setupGridCanvas, getWorldScale } = useInteractiveGrid({
    worldSize: WORLD_SIZE,
    gridConfig,
    canvasState: {
      // Use stable values to prevent hook recreation
      worldScale: worldDimensions.worldScale,
      scale: canvasState.scale,
      offsetX: canvasState.offsetX,
      offsetY: canvasState.offsetY,
      showGrid: canvasState.showGrid,
      snapEnabled: canvasState.snapToGrid
    }
  })
  

  
  // Create a stable reference to canvas state to prevent hook recreation
  const canvasStateRef = useRef(canvasState);
  canvasStateRef.current = canvasState;
  
  // Memoize canvas renderer options to prevent unnecessary hook recreations
  const canvasRendererOptions = useMemo(() => ({
    panels: panels.panels,
    canvasState, // Use the full canvasState
    canvasWidth,
    canvasHeight,
    selectedPanelId: panels.selectedPanelId,
    getCurrentCanvas: () => getCurrentCanvasRef.current(),
    isValidPanel,
    getPanelValidationErrors,
    drawGrid
  }), [
    panels.panels,
    // Only depend on specific canvasState properties that affect rendering
    // Use stable references to prevent unnecessary hook recreations
    // REMOVED worldDimensions.worldScale dependency to prevent hook recreation
    // Use stable references to prevent hook recreation
    canvasStateRef.current.scale,
    canvasStateRef.current.offsetX,
    canvasStateRef.current.offsetY,
    canvasStateRef.current.showGrid,
    canvasStateRef.current.showGuides,
    canvasStateRef.current.snapToGrid,
    canvasWidth,
    canvasHeight,
    panels.selectedPanelId,
    isValidPanel,
    getPanelValidationErrors,
    drawGrid
  ]);

  // Use canvas renderer hook FIRST to get renderCanvas function
  const { renderCanvas, drawPanel, drawSelectionHandles, worldToScreen, screenToWorld } = useCanvasRenderer({
    ...canvasRendererOptions,
    // Pass functions to get current state instead of values to prevent hook recreation
    getWorldDimensions: () => worldDimensions,
    getCanvasState: () => canvasStateRef.current
  })
  
  // Store the renderCanvas function in the ref
  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas])
  
  // Use fullscreen canvas hook SECOND with the actual renderCanvas function
  const { 
      isFullscreen,
    fullscreenCanvasRef, 
    toggleFullscreen,
    fullscreenCanvasWidth,
    fullscreenCanvasHeight,
    // NEW: Panel interaction properties from fullscreen hook
    selectedPanel: fullscreenSelectedPanel,
    sidebarOpen: fullscreenSidebarOpen,
    handlePanelClick: fullscreenHandlePanelClick,
    toggleSidebar: fullscreenToggleSidebar,
    openSidebar: fullscreenOpenSidebar,
    closeSidebar: fullscreenCloseSidebar,

    // NEW: Mini-sidebar state and controls
    miniSidebarVisible: fullscreenMiniSidebarVisible,
    miniSidebarExpanded: fullscreenMiniSidebarExpanded,
    toggleMiniSidebar: fullscreenToggleMiniSidebar,
    expandMiniSidebar: fullscreenExpandMiniSidebar,
    collapseMiniSidebar: fullscreenCollapseMiniSidebar,
    hideMiniSidebar: fullscreenHideMiniSidebar
  } = useFullscreenCanvas({
      canvasWidth,
      canvasHeight,
    toast
  })
  
  // Debug logging for fullscreen state
  useEffect(() => {
    if (isFullscreen) {
      console.log('🚀 [PanelLayout] Fullscreen state changed. Current values:', {
        fullscreenMiniSidebarVisible,
        fullscreenMiniSidebarExpanded,
        fullscreenSelectedPanel: fullscreenSelectedPanel?.id,
        fullscreenSelectedPanelNumber: fullscreenSelectedPanel?.panelNumber
      });
    }
  }, [isFullscreen, fullscreenMiniSidebarVisible, fullscreenMiniSidebarExpanded, fullscreenSelectedPanel]);
  

  
  // Update the getCurrentCanvas function to use the fullscreen state
  useEffect(() => {
    getCurrentCanvasRef.current = () => isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
  }, [isFullscreen])
  
  // Consolidated fullscreen state management
  useEffect(() => {
    if (isFullscreen && fullscreenCanvasRef.current) {
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
        // Log error but continue - let the hook handle state reset
        return;
      }
      
      // Force render immediately after setup
      if (renderCanvasRef.current && isFullscreen) {
        renderCanvasRef.current();
      }
    }
  }, [isFullscreen]); // Only depend on isFullscreen
  
  // CRITICAL DEBUG: Initialize panels from external source with position persistence
  useEffect(() => {
    // Temporarily disabled excessive logging to restore panels
    // console.log('🚨 [PanelLayout] === PANEL RE-RENDER DEBUG START ===');
    // console.log('🚨 [PanelLayout] externalPanels changed, processing...');
    // console.log('🚨 [PanelLayout] externalPanels:', externalPanels);
    // console.log('🚨 [PanelLayout] externalPanels.length:', externalPanels?.length || 0);
    
    const externalPanelsRef = externalPanels || [];
    const externalPanelsString = JSON.stringify(externalPanelsRef);
    
    // Temporarily disabled excessive logging
    // console.log('🚨 [PanelLayout] externalPanelsString:', externalPanelsString);
    // console.log('🚨 [PanelLayout] lastExternalPanels.current:', lastExternalPanels.current);
    
    // Only process if external panels actually changed
    if (lastExternalPanels.current !== externalPanelsString) {
      // console.log('🚨 [PanelLayout] External panels changed, processing update...');
      lastExternalPanels.current = externalPanelsString;
      
      // Check if internal panels are already the same
      const internalPanelsString = lastInternalPanels.current;
      // console.log('🚨 [PanelLayout] internalPanelsString:', internalPanelsString);
      // console.log('🚨 [PanelLayout] externalPanelsString === internalPanelsString:', externalPanelsString === internalPanelsString);
      
      if (externalPanelsString === internalPanelsString) {
        // console.log('🚨 [PanelLayout] No change detected, skipping update');
        return;
      }
      
      // CRITICAL DEBUG: localStorage position check with detailed logging
      // Temporarily disabled excessive logging
      // console.log('🚨 [PanelLayout] === localStorage POSITION CHECK ===');
      const savedPositions = localStorage.getItem('panelLayoutPositions');
      // console.log('🚨 [PanelLayout] savedPositions from localStorage:', savedPositions);
      
      // CRITICAL FIX: Only process localStorage if we have valid external panels
      if (savedPositions && externalPanelsRef.length > 0) {
        try {
          const positionMap = JSON.parse(savedPositions);
          const hasValidSavedPositions = Object.keys(positionMap).length > 0;
          
          console.log('🚨 [PanelLayout] positionMap parsed:', positionMap);
          console.log('🚨 [PanelLayout] hasValidSavedPositions:', hasValidSavedPositions);
          console.log('🚨 [PanelLayout] localStorage panel count:', Object.keys(positionMap).length);
          
          if (hasValidSavedPositions) {
            // Check if external panels are all at default positions
            console.log('🚨 [PanelLayout] Checking for default positions in external panels...');
            const defaultPositionDetails = externalPanelsRef.map(panel => ({
              id: panel.id,
              x: panel.x,
              y: panel.y,
              isDefault: (panel.x === 50 && panel.y === 50) || 
                        (panel.x === 0 && panel.y === 0) ||
                        (Math.abs(panel.x - 50) < 10 && Math.abs(panel.y - 50) < 10)
            }));
            
            console.log('🚨 [PanelLayout] Default position analysis:', defaultPositionDetails);
            
            const allAtDefaultPositions = externalPanelsRef.every(panel => {
              const isDefaultPosition = (panel.x === 50 && panel.y === 50) || 
                                      (panel.x === 0 && panel.y === 0) ||
                                      (Math.abs(panel.x - 50) < 10 && Math.abs(panel.y - 50) < 10);
              return isDefaultPosition;
            });
            
            console.log('🚨 [PanelLayout] allAtDefaultPositions:', allAtDefaultPositions);
            
            if (allAtDefaultPositions) {
              console.log('🚨 [PanelLayout] 🚨🚨🚨 CRITICAL: Backend sent default positions, but localStorage has valid positions. IGNORING backend data. 🚨🚨🚨');
              console.log('🚨 [PanelLayout] Keeping current localStorage positions to prevent panel stacking.');
              console.log('🚨 [PanelLayout] === PANEL RE-RENDER DEBUG END (IGNORED) ===');
              return; // Don't update panels, keep current localStorage positions
            }
            
            // Even if not all default, check if we have more valid positions in localStorage
            const localStoragePanelCount = Object.keys(positionMap).length;
            const externalPanelCount = externalPanelsRef.length;
            
            console.log('🚨 [PanelLayout] Panel count comparison: localStorage vs external:', localStoragePanelCount, 'vs', externalPanelCount);
            
            if (localStoragePanelCount >= externalPanelCount) {
              console.log('🚨 [PanelLayout] 🚨🚨🚨 localStorage has more/equal panels vs backend. Prioritizing localStorage. 🚨🚨🚨');
              console.log('🚨 [PanelLayout] === PANEL RE-RENDER DEBUG END (IGNORED) ===');
              return; // Don't update panels, localStorage has more complete data
            }
          }
        } catch (error) {
          console.warn('🚨 [PanelLayout] Error checking localStorage positions:', error);
        }
      } else {
        console.log('🚨 [PanelLayout] No localStorage positions or no external panels');
      }
      
      if (externalPanelsRef.length > 0) {
        console.log('🚨 [PanelLayout] === PANEL VALIDATION ===');
        const validExternalPanels = externalPanelsRef.filter(panel => {
          if (!isValidPanel(panel)) {
            const errors = getPanelValidationErrors(panel);
            console.warn('🚨 [PanelLayout] Skipping invalid external panel:', { panel, errors });
            return false;
          }
          return true;
        });
        
        console.log('🚨 [PanelLayout] Valid external panels count:', validExternalPanels.length);
        
        if (validExternalPanels.length > 0) {
          // CRITICAL DEBUG: Enhanced external panels processing with localStorage priority
          console.log('🚨 [PanelLayout] === PANEL PROCESSING WITH localStorage ===');
          let panelsWithPositions = validExternalPanels;
          try {
            const savedPositions = localStorage.getItem('panelLayoutPositions');
            console.log('🚨 [PanelLayout] Processing savedPositions:', savedPositions);
            
            if (savedPositions) {
              const positionMap = JSON.parse(savedPositions);
              console.log('🚨 [PanelLayout] Processing positionMap:', positionMap);
              console.log(`🚨 [PanelLayout] Processing ${validExternalPanels.length} external panels with ${Object.keys(positionMap).length} localStorage positions`);
              
              panelsWithPositions = validExternalPanels.map(panel => {
                const saved = positionMap[panel.id];
                if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                  // CRITICAL FIX #8: Relaxed validation - localStorage positions are trusted
                  // Only reject completely invalid coordinates (NaN, Infinity, etc.)
                  const isValidX = !isNaN(saved.x) && isFinite(saved.x);
                  const isValidY = !isNaN(saved.y) && isFinite(saved.y);
                  
                  if (isValidX && isValidY) {
                    // localStorage positions ALWAYS win over backend defaults
                    const finalX = saved.x;
                    const finalY = saved.y;
                    
                    if (finalX !== panel.x || finalY !== panel.y) {
                      console.log(`[PanelLayout] localStorage OVERRIDE: panel ${panel.id}: backend(${panel.x}, ${panel.y}) -> localStorage(${finalX}, ${finalY})`);
                    }
                    
                    return { ...panel, x: finalX, y: finalY };
                  } else {
                    console.warn(`[PanelLayout] Invalid localStorage position for panel ${panel.id}: x=${saved.x}, y=${saved.y}`);
                  }
                }
                
                // If no localStorage position, check if this is a default stacking position
                const isDefaultPosition = (panel.x === 50 && panel.y === 50) || 
                                        (panel.x === 0 && panel.y === 0) ||
                                        (Math.abs(panel.x - 50) < 10 && Math.abs(panel.y - 50) < 10);
                
                if (isDefaultPosition) {
                  // Find a unique position that doesn't conflict with localStorage positions
                  let uniqueX = panel.x;
                  let uniqueY = panel.y;
                  let attempts = 0;
                  
                  while (attempts < 100) { // Prevent infinite loop
                    const conflictingPanel = Object.values(positionMap).find((pos: any) => 
                      Math.abs(pos.x - uniqueX) < 50 && Math.abs(pos.y - uniqueY) < 50
                    );
                    
                    if (!conflictingPanel) break;
                    
                    uniqueX = Math.random() * 1000 + 100;
                    uniqueY = Math.random() * 1000 + 100;
                    attempts++;
                  }
                  
                  console.log(`[PanelLayout] Auto-spread panel ${panel.id} from default (${panel.x}, ${panel.y}) to unique (${uniqueX}, ${uniqueY})`);
                  return { ...panel, x: uniqueX, y: uniqueY };
                }
                
                return panel;
              });
              console.log('[PanelLayout] Processed external panels with localStorage priority');
            } else {
              // If no localStorage data, spread out panels to prevent stacking
              console.log('[PanelLayout] No localStorage positions found, spreading out panels to prevent stacking');
              panelsWithPositions = validExternalPanels.map((panel, index) => {
                // Check if panel has default stacking position (50,50 or similar)
                const isDefaultPosition = (panel.x === 50 && panel.y === 50) || 
                                        (panel.x === 0 && panel.y === 0) ||
                                        (Math.abs(panel.x - 50) < 10 && Math.abs(panel.y - 50) < 10);
                
                if (isDefaultPosition) {
                  const spreadX = index * 300 + 100;
                  const spreadY = 100;
                  console.log(`[PanelLayout] Spreading panel ${panel.id} from (${panel.x}, ${panel.y}) to (${spreadX}, ${spreadY})`);
                  return { ...panel, x: spreadX, y: spreadY };
                }
                return panel;
              });
            }
          } catch (error) {
            console.warn('[PanelLayout] Failed to process external panels with localStorage:', error);
          }
          
          // CRITICAL DEBUG: Final panel dispatch
          console.log('🚨 [PanelLayout] === FINAL PANEL DISPATCH ===');
          console.log('🚨 [PanelLayout] panelsWithPositions to be dispatched:', panelsWithPositions);
          console.log('🚨 [PanelLayout] Panel positions after processing:');
          panelsWithPositions.forEach((panel, index) => {
            console.log(`🚨 [PanelLayout] Panel ${index}: id=${panel.id}, x=${panel.x}, y=${panel.y}`);
          });
          
          // Set a flag to prevent the notification useEffect from running
          lastInternalPanels.current = externalPanelsString;
          console.log('🚨 [PanelLayout] Dispatching SET_PANELS action...');
          dispatch({ type: 'SET_PANELS', payload: panelsWithPositions });
          console.log('🚨 [PanelLayout] === PANEL RE-RENDER DEBUG END (PROCESSED) ===');
        }
      } else {
        // Only clear if internal panels are not already empty
        if (internalPanelsString !== '[]') {
          // Set a flag to prevent the notification useEffect from running
          lastInternalPanels.current = '[]';
          dispatch({ type: 'SET_PANELS', payload: [] })
        }
      }
    }
  }, [externalPanels, getPanelValidationErrors, isValidPanel]) // Include all dependencies
  
  // Notify parent of panel updates and save positions to localStorage
  const onPanelUpdateRef = useRef(onPanelUpdate);
  const lastNotifiedPanels = useRef<string>('')
  
  useEffect(() => {
    onPanelUpdateRef.current = onPanelUpdate;
  }, [onPanelUpdate]);
  
  useEffect(() => {
    // CRITICAL DEBUG: Track localStorage saving
    // Temporarily disabled excessive logging
    // console.log('🚨 [PanelLayout] === localStorage SAVING DEBUG ===');
    // console.log('🚨 [PanelLayout] panels.panels changed, checking if save needed...');
    // console.log('🚨 [PanelLayout] Current panels:', panels.panels);
    // console.log('🚨 [PanelLayout] panels.panels.length:', panels.panels.length);
    
    // Only notify parent if panels actually changed
    const currentPanelsString = JSON.stringify(panels.panels);
    // Temporarily disabled excessive logging
    // console.log('🚨 [PanelLayout] currentPanelsString:', currentPanelsString);
    // console.log('🚨 [PanelLayout] lastInternalPanels.current:', lastInternalPanels.current);
    
    // Skip if this change was triggered by external panels update
    if (currentPanelsString === lastInternalPanels.current) {
      // console.log('🚨 [PanelLayout] ⚠️ SKIPPING localStorage save - panels unchanged from external update');
      return;
    }
    
    // console.log('🚨 [PanelLayout] ✅ Proceeding with localStorage save...');
    
    // Save panel positions to localStorage whenever they change
    try {
      const positionMap: Record<string, { x: number; y: number }> = {};
      panels.panels.forEach(panel => {
        positionMap[panel.id] = { x: panel.x, y: panel.y };
        console.log(`🚨 [PanelLayout] Saving panel ${panel.id}: x=${panel.x}, y=${panel.y}`);
      });
      
      const positionMapString = JSON.stringify(positionMap);
      console.log('🚨 [PanelLayout] About to save positionMap to localStorage:', positionMapString);
      
      localStorage.setItem('panelLayoutPositions', positionMapString);
      console.log('🚨 [PanelLayout] ✅ SUCCESS: Saved panel positions to localStorage');
      console.log('🚨 [PanelLayout] Saved', Object.keys(positionMap).length, 'panel positions');
      
      // Verify the save worked
      const verification = localStorage.getItem('panelLayoutPositions');
      console.log('🚨 [PanelLayout] Verification - localStorage now contains:', verification);
      
    } catch (error) {
      console.error('🚨 [PanelLayout] ❌ FAILED to save panel positions:', error);
    }
    
    if (currentPanelsString !== lastNotifiedPanels.current && onPanelUpdateRef.current) {
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
  
  // Canvas Functions with automatic state persistence
  const saveCanvasState = useCallback((newState: Partial<CanvasState>) => {
    try {
      const currentSaved = localStorage.getItem('panelLayoutZoomState');
      const current = currentSaved ? JSON.parse(currentSaved) : {};
      const updated = { ...current, ...newState };
      localStorage.setItem('panelLayoutZoomState', JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to save canvas state:', error);
    }
  }, []);
  
  const zoomIn = useCallback(() => {
    setCanvasState(prev => {
      const newState = { ...prev, scale: clamp(prev.scale * 1.25, 0.1, 10) };
      saveCanvasState(newState);
      return newState;
    });
  }, [saveCanvasState]);
  
  const zoomOut = useCallback(() => {
    setCanvasState(prev => {
      const newState = { ...prev, scale: clamp(prev.scale * 0.8, 0.1, 10) };
      saveCanvasState(newState);
      return newState;
    });
  }, [saveCanvasState]);
  
  const resetView = useCallback(() => {
    setCanvasState(prev => {
      const newState = { ...prev, scale: 1, offsetX: 0, offsetY: 0 };
      saveCanvasState(newState);
      return newState;
    });
  }, [saveCanvasState]);
  
  const toggleGrid = useCallback(() => {
    setCanvasState(prev => {
      const newState = { ...prev, showGrid: !prev.showGrid };
      saveCanvasState(newState);
      return newState;
    });
  }, [saveCanvasState]);
  
  const toggleGuides = useCallback(() => {
    setCanvasState(prev => {
      const newState = { ...prev, showGuides: !prev.showGuides };
      saveCanvasState(newState);
      return newState;
    });
  }, [saveCanvasState]);
  
  const toggleSnap = useCallback(() => {
    setCanvasState(prev => {
      const newState = { ...prev, snapToGrid: !prev.snapToGrid };
      saveCanvasState(newState);
      return newState;
    });
  }, [saveCanvasState]);
  
  // New zoom functions with automatic state persistence
  const zoomToFitSite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = 100;
    const availableWidth = canvas.clientWidth - padding;
    const availableHeight = canvas.clientHeight - padding;

    // Use the current worldScale from worldDimensions, don't change it
    const worldScale = worldDimensions.worldScale;
    const worldSizeScreen = WORLD_SIZE * worldScale;

    setCanvasState(prev => {
      const newState = {
        ...prev,
        scale: 1.0,
        offsetX: (canvas.clientWidth - worldSizeScreen) / 2,
        offsetY: (canvas.clientHeight - worldSizeScreen) / 2,
      };
      saveCanvasState(newState);
      return newState;
    });
  }, [worldDimensions.worldScale, saveCanvasState]);

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

    // Use the current worldScale from worldDimensions, don't change it
    const worldScale = worldDimensions.worldScale;
    
    // Calculate the scale factor needed to fit panels within the available space
    const scaleX = availableWidth / (boundsWidth + padding);
    const scaleY = availableHeight / (boundsHeight + padding);
    const fitScale = Math.min(scaleX, scaleY) / worldScale;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setCanvasState(prev => {
      const newState = {
        ...prev,
        scale: fitScale,
        offsetX: canvas.clientWidth / 2 - centerX * worldScale,
        offsetY: canvas.clientHeight / 2 - centerY * worldScale,
      };
      saveCanvasState(newState);
      return newState;
    });
  }, [panels.panels, worldDimensions.worldScale, saveCanvasState]);

  // Auto-fit viewport when panels are loaded
  const autoFitViewport = useCallback(() => {
    if (panels.panels.length > 0 && canvasWidth > 0 && canvasHeight > 0) {
      const bounds = calculatePanelBounds(panels.panels);
          if (bounds) {
            const { minX, minY, maxX, maxY } = bounds;
            
            // Use worldDimensions.worldScale for consistency with rendering
            const worldScale = worldDimensions.worldScale;
            const panelWidth = (maxX - minX) * worldScale;
            const panelHeight = (maxY - minY) * worldScale;
            
        const padding = 100;
            const scaleX = (canvasWidth - padding) / panelWidth;
            const scaleY = (canvasHeight - padding) / panelHeight;
            const newScale = Math.min(scaleX, scaleY, 10.0);
            
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
  }, [panels.panels, canvasWidth, canvasHeight, worldDimensions.worldScale, calculatePanelBounds]);
  
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
    // Use worldDimensions.worldScale for consistency with rendering
    const worldX = (sx - canvasState.offsetX) / (worldDimensions.worldScale * canvasState.scale);
    const worldY = (sy - canvasState.offsetY) / (worldDimensions.worldScale * canvasState.scale);
    
    return { x: worldX, y: worldY };
  }, [canvasState.offsetX, canvasState.offsetY, canvasState.scale, worldDimensions.worldScale]);

  const localWorldToScreen = useCallback((wx: number, wy: number) => {
    // Use worldDimensions.worldScale for consistency with rendering
    const totalScale = worldDimensions.worldScale * canvasState.scale;
    return {
      x: wx * totalScale + canvasState.offsetX,
      y: wy * totalScale + canvasState.offsetY
    };
  }, [worldDimensions.worldScale, canvasState.scale, canvasState.offsetX, canvasState.offsetY]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
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
      
      // Check panels in reverse order (top to bottom)
      for (let i = panels.panels.length - 1; i >= 0; i--) {
        const panel = panels.panels[i];
        
        // Convert screen coordinates to world coordinates for hit testing
        const worldPos = localScreenToWorld(x, y);
        
        // Enhanced hit test based on panel shape
        let isHit = false;
        
        switch (panel.
          shape) {
          case 'right-triangle':
            // Point-in-triangle test for equilateral triangle
            const centerX = panel.x + panel.width / 2;
            const topY = panel.y;
            const leftX = panel.x;
            const rightX = panel.x + panel.width;
            const bottomY = panel.y + panel.height;
            
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
            
            // Check if point is inside the bounding box
            if (worldPos.x >= leftTopX && worldPos.x <= rightTopX && 
                worldPos.y >= leftTopY && worldPos.y <= rightBottomY) {
              
              // Calculate the hypotenuse line: from top-left to bottom-right
              // For a point to be inside the triangle, it must be below the hypotenuse
              const hypotenuseSlope = (rightBottomY - leftTopY) / (rightBottomX - leftTopX);
              const hypotenuseY = leftTopY + hypotenuseSlope * (worldPos.x - leftTopX);
              
              // Point is inside if it's below the hypotenuse
              isHit = worldPos.y >= hypotenuseY;
            } else {
              isHit = false;
            }
            break;
            
          case 'rectangle':
          default:
            // Simple AABB hit test for rectangles
            isHit = worldPos.x >= panel.x && worldPos.x <= panel.x + panel.width &&
                    worldPos.y >= panel.y && worldPos.y <= panel.y + panel.height;
            break;
        }
        
        if (isHit) {
          console.log('🎯 [PanelLayout] Panel hit:', panel);
          dispatch({ type: 'SELECT_PANEL', payload: panel.id })
          
          // Handle panel interaction based on mode
          if (isFullscreen) {
            // In fullscreen mode: use fullscreen hook's panel interaction
            console.log('🎯 [PanelLayout] Panel clicked in fullscreen, calling fullscreenHandlePanelClick');
            fullscreenHandlePanelClick(panel);
          } else {
            console.log('🎯 [PanelLayout] In normal mode, no sidebar');
            // In normal mode: no sidebar (clean interface)
            // Could add other interactions here if needed
          }
          
          if (isRotationHandle(x, y, panel)) {
            setIsRotating(true)
            // Convert screen coordinates to world coordinates for rotation calculation
            const worldPos = localScreenToWorld(x, y);
            const panelCenterX = panel.x + panel.width / 2;
            const panelCenterY = panel.y + panel.height / 2;
            setRotationStart(Math.atan2(worldPos.y - panelCenterY, worldPos.x - panelCenterX));
            return
          }
          
          // Only set the ref - simplified state management
          isDraggingRef.current = true;
          // Convert screen coordinates to world coordinates for drag calculation
          const worldPos = localScreenToWorld(x, y);
          setDragStart({ x: worldPos.x - panel.x, y: worldPos.y - panel.y });
          return
        }
      }
      
      // No panel hit - clear selection
      dispatch({ type: 'SELECT_PANEL', payload: null })
    }
  }, [panels, canvasState, isFullscreen, spacePressed, localScreenToWorld, fullscreenHandlePanelClick])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setMouseState(prev => ({ ...prev, x, y }))
    
    if (mouseState.isPanning) {
      const deltaX = x - mouseState.dragStartX;
      const deltaY = y - mouseState.dragStartY;

      setCanvasState(prev => {
        const newState = {
          ...prev,
          offsetX: prev.offsetX + deltaX,
          offsetY: prev.offsetY + deltaY,
        };
        saveCanvasState(newState);
        return newState;
      });

      setMouseState(prev => ({
        ...prev,
        dragStartX: x,
        dragStartY: y,
      }));
    } else if (isDraggingRef.current && selectedPanel) {
      const worldPos = localScreenToWorld(x, y);
      
      // Use the dragStart state that was set when the panel was clicked
      const newX = worldPos.x - dragStart.x;
      const newY = worldPos.y - dragStart.y;

      // Apply snap if enabled
      let finalX = newX;
      let finalY = newY;
      if (canvasState.snapToGrid) {
        finalX = snapToGrid(newX, SNAP_SIZE);
        finalY = snapToGrid(newY, SNAP_SIZE);
      }
      
      // CRITICAL DEBUG: Track panel dragging
      // Temporarily disabled excessive logging
      // console.log('🚨 [PanelLayout] === PANEL DRAGGING ===');
      // console.log('🚨 [PanelLayout] Dragging panel:', selectedPanel.id);
      // console.log('🚨 [PanelLayout] Old position:', { x: selectedPanel.x, y: selectedPanel.y });
      // console.log('🚨 [PanelLayout] New position:', { x: finalX, y: finalY });
      // console.log('🚨 [PanelLayout] Dispatching UPDATE_PANEL action...');
      
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
    setIsRotating(false)
    isDraggingRef.current = false; // Reset ref immediately
    
    setMouseState(prev => ({
      ...prev,
      isPanning: false,
      // Remove isDragging since we're only using the ref now
    }))
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
    
    setCanvasState(prev => {
      const newState = {
        ...prev,
        scale: newScale,
        offsetX: mouseX - wx * sNew,
        offsetY: mouseY - wy * sNew,
      };
      saveCanvasState(newState);
      return newState;
    });
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
      } else if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
        setSelectedPanelForSidebar(null);
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
  }, [isFullscreen, toggleFullscreen, panels.selectedPanelId, sidebarOpen]);
  
  // Render canvas when dependencies change
  useEffect(() => {
    const currentCanvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current;
    if (currentCanvas && renderCanvasRef.current) {
      renderCanvasRef.current();
    }
  }, [panels.panels, canvasState, canvasWidth, canvasHeight, isFullscreen]) // Changed from panels.panels.length to panels.panels
  
  // Update canvas state when world dimensions change
  useEffect(() => {
    // Only update canvasState if worldScale actually changed significantly
    setCanvasState(prev => {
      const scaleChanged = Math.abs(prev.worldScale - worldDimensions.worldScale) > 0.001;
      
      if (scaleChanged) {
        return {
          ...prev,
          worldWidth: worldDimensions.worldWidth,
          worldHeight: worldDimensions.worldHeight,
          worldScale: worldDimensions.worldScale
        };
      }
      
      // Only update width/height if they changed
      if (prev.worldWidth !== worldDimensions.worldWidth || prev.worldHeight !== worldDimensions.worldHeight) {
        return {
          ...prev,
          worldWidth: worldDimensions.worldWidth,
          worldHeight: worldDimensions.worldHeight
        };
      }
      
      return prev;
    });
    
    // Update canvas dimensions only when worldScale changes significantly
    const newWidth = Math.ceil(worldDimensions.worldWidth * worldDimensions.worldScale);
    const newHeight = Math.ceil(worldDimensions.worldHeight * worldDimensions.worldScale);
    
    setCanvasWidth(prev => {
      if (Math.abs(prev - newWidth) > 1) {
        return newWidth;
      }
      return prev;
    });
    
    setCanvasHeight(prev => {
      if (Math.abs(prev - newHeight) > 1) {
        return newHeight;
      }
      return prev;
    });
  }, [worldDimensions]);
  
  // Handle click-outside to hide mini-sidebar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isFullscreen && fullscreenMiniSidebarVisible && !fullscreenMiniSidebarExpanded) {
        // Check if click is outside the mini-sidebar
        const target = e.target as Element;
        const miniSidebar = document.querySelector('[data-mini-sidebar]');
        
        if (miniSidebar && !miniSidebar.contains(target)) {
          fullscreenHideMiniSidebar();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFullscreen, fullscreenMiniSidebarVisible, fullscreenMiniSidebarExpanded, fullscreenHideMiniSidebar]);

  // Update container dimensions when container ref is available
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      let timeoutId: NodeJS.Timeout;
      
      const updateDimensions = () => {
        const rect = container.getBoundingClientRect();
        
        // Debounce dimension updates to prevent excessive recalculations
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setContainerDimensions(prev => {
            const newDimensions = {
              width: rect.width,
              height: rect.height
            };
            
            // Only update if dimensions actually changed significantly (more than 1px)
            if (Math.abs(prev.width - newDimensions.width) > 1 || 
                Math.abs(prev.height - newDimensions.height) > 1) {
              return newDimensions;
            }
            return prev;
          });
        }, 100); // 100ms debounce
      };
      
      updateDimensions();
      
      // Create a ResizeObserver to watch for container size changes
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(container);
      
      return () => {
        clearTimeout(timeoutId);
        resizeObserver.disconnect();
      };
    }
  }, []);
  
  // Persist zoom state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('panelLayoutZoomState', JSON.stringify({
          scale: canvasState.scale,
          offsetX: canvasState.offsetX,
          offsetY: canvasState.offsetY,
          showGrid: canvasState.showGrid,
          showGuides: canvasState.showGuides,
          snapToGrid: canvasState.snapToGrid,
          gridSize: canvasState.gridSize
        }));
      } catch (error) {
        console.warn('Failed to save zoom state to localStorage:', error);
      }
    }
  }, [canvasState.scale, canvasState.offsetX, canvasState.offsetY, canvasState.showGrid, canvasState.showGuides, canvasState.snapToGrid, canvasState.gridSize]);
  
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
      {/* Fullscreen Canvas Portal */}
      {isFullscreen && (
        <>
        <div
          className="fixed inset-0 w-screen h-screen overflow-hidden"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 50
          }}
        >
          {/* Fullscreen Toolbar */}
          <div className="bottom-toolbar absolute top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-10">
            <div className="bottom-toolbar-group flex items-center space-x-4">
              {/* Zoom Controls */}
              <div className="bottom-toolbar-group flex items-center space-x-2">
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
              <div className="bottom-toolbar-group flex items-center space-x-2">
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
            <div className="bottom-toolbar-group flex items-center space-x-6">
              <div className="bottom-toolbar-group flex items-center space-x-6 text-sm font-mono text-white">
                <div className="text-gray-300">
                  Zoom: <span className="text-white font-medium">{zoomPercentage}%</span>
                </div>
                <div className="text-gray-300">
                  Scale: <span className="text-white font-medium">{worldDimensions.worldScale.toFixed(3)}</span> px/ft
                </div>
                <div className="text-gray-300">
                  Panels: <span className="text-white font-medium">{panels.panels.length}</span>
                </div>
                <div className="text-gray-300">
                  Cursor: <span className="text-white font-medium">{Math.round(worldPos.x)}&apos;, {Math.round(worldPos.y)}&apos;</span>
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
          <div className="w-full h-full pt-16 bg-white"> {/* pt-16 accounts for toolbar height, white background */}
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
          
          {/* Selected Panel Indicator - Shows when panel is selected but mini-sidebar is not expanded */}
          {fullscreenSelectedPanel && !fullscreenMiniSidebarExpanded && (
            <div className="fixed top-20 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-30 pointer-events-none">
              <div className="text-sm font-medium">
                Panel {fullscreenSelectedPanel.panelNumber || 'Unknown'} Selected
              </div>
              <div className="text-xs opacity-90">
                Click panel again or press ESC to open sidebar
              </div>
            </div>
          )}
          
                                             {/* Help Overlay - REMOVED in fullscreen to maximize grid space */}
          {/* Footer removed in fullscreen mode to maximize grid area */}
        </div>
        </>
      )}
      
            {/* Mini-Sidebar - Shows when panel is clicked in fullscreen mode */}
      {isFullscreen && fullscreenMiniSidebarVisible && (
        <>
          {console.log('🚀 [PanelLayout] Rendering mini-sidebar button. State:', {
            isFullscreen,
            fullscreenMiniSidebarVisible,
            fullscreenMiniSidebarExpanded,
            fullscreenSelectedPanel: fullscreenSelectedPanel?.id
          })}
          <div 
          data-mini-sidebar
          className="fixed left-0 top-1/2 transform -translate-y-1/2 bg-white border-r border-gray-200 shadow-lg z-[9999] rounded-r-lg animate-in slide-in-from-left-mini"
        >
          <button 
            onClick={() => {
              console.log('🚀 [PanelLayout] Arrow button clicked! Current state:', {
                fullscreenMiniSidebarVisible,
                fullscreenMiniSidebarExpanded,
                fullscreenSelectedPanel: fullscreenSelectedPanel?.id
              });
              fullscreenToggleMiniSidebar();
            }}
            className="p-3 hover:bg-blue-50 transition-colors rounded-r-lg"
            title={fullscreenMiniSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {fullscreenMiniSidebarExpanded ? (
              <ChevronLeft className="h-6 w-6 text-blue-600" />
            ) : (
              <ChevronRight className="h-6 w-6 text-blue-600" />
            )}
          </button>
        </div>
        </>
      )}
      
      {/* Normal Panel Layout Container - Hidden in fullscreen mode */}
      {!isFullscreen && (
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
                  toggleFullscreen();
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
              Cursor: <span className="text-white font-medium" data-testid="text-cursor-coords">{Math.round(worldPos.x)}&apos;, {Math.round(worldPos.y)}&apos;</span>
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

            {/* CRITICAL DEBUG OVERLAY */}
            {DEBUG_POSITION_PERSISTENCE && (
              <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-2 rounded text-sm font-mono pointer-events-none max-w-xs">
                <div className="font-bold mb-1">🚨 DEBUG INFO</div>
                <div className="text-xs space-y-1">
                  <div>External Panels: {externalPanels?.length || 0}</div>
                  <div>Internal Panels: {panels.panels.length}</div>
                  <div>localStorage: {(() => {
                    try {
                      const saved = localStorage.getItem('panelLayoutPositions');
                      return saved ? `${Object.keys(JSON.parse(saved)).length} saved` : 'None';
                    } catch { return 'Error'; }
                  })()}</div>
                  <div>Last Update: {new Date().toLocaleTimeString()}</div>
                </div>
              </div>
            )}
            
            {/* Coordinate Display */}
            <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm font-mono pointer-events-none">
              <div data-testid="text-world-coords">World: {Math.round(worldPos.x)}&apos;, {Math.round(worldPos.y)}&apos;</div>
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
          </div>
        </div>
        


                </div>
      )}
      
      {/* Panel Sidebar - ONLY in fullscreen mode when mini-sidebar is expanded */}
      {fullscreenMiniSidebarVisible && fullscreenMiniSidebarExpanded && fullscreenSelectedPanel && (
        <>
          {console.log('🚀 [PanelLayout] Rendering PanelSidebar with:', {
            fullscreenMiniSidebarVisible,
            fullscreenMiniSidebarExpanded,
            fullscreenSelectedPanel: fullscreenSelectedPanel?.id,
            panelNumber: fullscreenSelectedPanel?.panelNumber
          })}
          
          <PanelSidebar
            isOpen={true}
            miniMode={false}
            onToggle={fullscreenToggleMiniSidebar}
            projectId={projectId || 'default'}
            panelId={fullscreenSelectedPanel.id}
            panelNumber={fullscreenSelectedPanel.panelNumber || 'Unknown'}
            onClose={fullscreenCollapseMiniSidebar}
          />
        </>
      )}
    </>
  )
}