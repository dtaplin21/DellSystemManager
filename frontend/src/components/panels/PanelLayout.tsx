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
import { usePanelValidation } from '../../hooks/use-panel-validation'
import { useCanvasRenderer } from '../../hooks/use-canvas-renderer'
import { useFullscreenCanvas } from '../../hooks/use-fullscreen-canvas'

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
  layoutScale?: number
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
  const [panels, dispatch] = useReducer(panelReducer, { panels: [], selectedPanelId: null })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState(0)
  
  // Normalize layout scale
  const normalizedLayoutScale = useMemo(() => {
    if (layoutScale < 0.01) {
      const normalized = 0.01 / layoutScale;
      console.log('[PanelLayout] Layout scale normalized:', { 
        original: layoutScale, 
        normalized, 
        reason: 'Scale too small, normalizing for visibility' 
      });
      return normalized;
    }
    return 1.0;
  }, [layoutScale]);
  
  // Calculate world dimensions
  const worldDimensions = useMemo(() => {
    const worldWidth = 3300; // 150 * 22ft
    const worldHeight = 5000; // 10 * 500ft
    
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
  
  // Refs for preventing infinite loops
  const lastExternalPanels = useRef<string>('')
  const lastInternalPanels = useRef<string>('')
  
  // Memoize panel data
  const panelData = useMemo(() => ({
    panels: panels.panels,
    selectedPanelId: panels.selectedPanelId
  }), [panels.panels, panels.selectedPanelId]);
  
  // Update internal panels ref when panels change
  useEffect(() => {
    lastInternalPanels.current = JSON.stringify(panels.panels);
  }, [panels.panels]);
  
  // Canvas dimensions
  const [canvasWidth, setCanvasWidth] = useState(Math.ceil(worldDimensions.worldWidth * worldDimensions.worldScale))
  const [canvasHeight, setCanvasHeight] = useState(Math.ceil(worldDimensions.worldHeight * worldDimensions.worldScale))
  
  const { toast } = useToast()
  
  // Use hooks
  const { isValidPanel, getPanelValidationErrors, calculatePanelBounds } = usePanelValidation()
  
  // Use fullscreen canvas hook
  const { 
    isFullscreen, 
    fullscreenCanvasRef, 
    toggleFullscreen,
    fullscreenCanvasWidth,
    fullscreenCanvasHeight
  } = useFullscreenCanvas({
    panels: panelData.panels,
    canvasState,
    worldDimensions,
    canvasWidth,
    canvasHeight,
    onCanvasStateChange: (updates) => setCanvasState(prev => ({ ...prev, ...updates })),
    onCanvasDimensionsChange: (width, height) => {
      setCanvasWidth(width);
      setCanvasHeight(height);
    },
    calculatePanelBounds,
    renderCanvas: () => {}, // Will be provided by canvas renderer hook
    toast
  })
  
  // Use canvas renderer hook
  const { renderCanvas, drawGrid, drawPanel, drawSelectionHandles } = useCanvasRenderer({
    panels: panelData.panels,
    canvasState,
    canvasWidth,
    canvasHeight,
    normalizedLayoutScale,
    selectedPanelId: panelData.selectedPanelId,
    getCurrentCanvas: () => isFullscreen ? fullscreenCanvasRef.current : canvasRef.current,
    isValidPanel,
    getPanelValidationErrors
  })
  
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
  
  // Function to create sample panels
  const createSampleGrid = useCallback(() => {
    console.log('[PanelLayout] Creating sample grid with large-scale panels');
    
    const panels: Panel[] = [];
    
    // Create 150 panels at 22ft each (west to east)
    for (let i = 0; i < 150; i++) {
      const panel: Panel = {
        id: `panel-22ft-${i}`,
        shape: 'rectangle',
        x: i * 22,
        y: 0,
        width: 22,
        height: 22,
        length: 22,
        rotation: 0,
        fill: `hsl(${(i * 137.5) % 360}, 70%, 60%)`,
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
        x: 0,
        y: i * 500,
        width: 500,
        height: 500,
        length: 500,
        rotation: 0,
        fill: `hsl(${(i * 36) % 360}, 80%, 50%)`,
        color: '#1e1b4b',
        panelNumber: (i + 151).toString(),
        rollNumber: `R${i + 16}`,
        meta: {
          repairs: [],
          location: { x: 0, y: i * 500, gridCell: { row: i, col: 0 } }
        }
      };
      panels.push(panel);
    }
    
    console.log('[PanelLayout] Created sample grid with', panels.length, 'panels');
    
    // Add all panels to the state
    panels.forEach(panel => {
      dispatch({ type: 'ADD_PANEL', payload: panel });
    });
    
    toast({
      title: "Sample Grid Created",
      description: `Created ${panels.length} panels covering ${150 * 22}ft × ${10 * 500}ft area`
    });
  }, [dispatch, toast]);
  
  // Initialize panels from external source
  useEffect(() => {
    console.log('[PanelLayout] externalPanels received:', externalPanels);
    
    const externalPanelsRef = externalPanels || [];
    const externalPanelsString = JSON.stringify(externalPanelsRef);
    
    if (lastExternalPanels.current !== externalPanelsString) {
      console.log('[PanelLayout] External panels changed, processing update');
      lastExternalPanels.current = externalPanelsString;
      
      if (externalPanelsRef.length > 0) {
        const validExternalPanels = externalPanelsRef.filter(panel => {
          if (!isValidPanel(panel)) {
            const errors = getPanelValidationErrors(panel);
            console.warn('[PanelLayout] Skipping invalid external panel:', { panel, errors });
            return false;
          }
          return true;
        });
        
        if (validExternalPanels.length > 0) {
          dispatch({ type: 'SET_PANELS', payload: validExternalPanels })
        }
      } else {
        const internalPanelsString = lastInternalPanels.current;
        if (internalPanelsString !== '[]') {
          console.log('[PanelLayout] External panels explicitly set to empty, clearing internal state');
          dispatch({ type: 'SET_PANELS', payload: [] })
        }
      }
    }
  }, [externalPanels, isValidPanel, getPanelValidationErrors])
  
  // Notify parent of panel updates
  const onPanelUpdateRef = useRef(onPanelUpdate);
  
  useEffect(() => {
    onPanelUpdateRef.current = onPanelUpdate;
  }, [onPanelUpdate]);
  
  useEffect(() => {
    console.log('[PanelLayout] panels state changed:', panelData.panels);
    if (onPanelUpdateRef.current) {
      onPanelUpdateRef.current(panelData.panels)
    }
  }, [panelData.panels])
  
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
  
  // Auto-fit viewport when panels are loaded
  const autoFitViewport = useCallback(() => {
    if (panelData.panels.length > 0 && canvasWidth > 0 && canvasHeight > 0) {
      const bounds = calculatePanelBounds(panelData.panels);
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
  }, [panelData.panels, canvasWidth, canvasHeight, canvasState.worldScale, calculatePanelBounds]);
  
  useEffect(() => {
    if (panelData.panels.length > 0 && canvasWidth > 0 && canvasHeight > 0) {
      const timer = setTimeout(autoFitViewport, 100);
      return () => clearTimeout(timer);
    }
  }, [panelData.panels.length, canvasWidth, canvasHeight, autoFitViewport]);
  
  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvasState.offsetX) / canvasState.scale
    const y = (e.clientY - rect.top - canvasState.offsetY) / canvasState.scale
    
    const clickedPanel = panelData.panels.find(panel => {
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
  }, [panelData, canvasState, normalizedLayoutScale, isFullscreen])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (isDragging && selectedPanel) {
      const worldX = (x - canvasState.offsetX) / canvasState.scale / canvasState.worldScale;
      const worldY = (y - canvasState.offsetY) / canvasState.scale / canvasState.worldScale;
      
      let newX = worldX;
      let newY = worldY;
      
      if (canvasState.snapToGrid) {
        const gridSize = 100;
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
  }, [isDragging, isResizing, isRotating, selectedPanel, resizeHandle, dragStart, rotationStart, canvasState, normalizedLayoutScale, isFullscreen])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeHandle(null)
  }, [])
  
  // Helper functions
  const getResizeHandle = (x: number, y: number, panel: Panel): string | null => {
    if (!isValidPanel(panel)) {
      return null;
    }
    
    const handleSize = 8 / canvasState.scale
    
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
    if (!isValidPanel(panel)) {
      return false;
    }
    
    const handleSize = 8 / canvasState.scale
    
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
    
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
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
  }, [canvasState, isFullscreen])

  // Add wheel event listener
  useEffect(() => {
    const canvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current
    if (!canvas) return
    
    const wheelHandler = (e: WheelEvent) => handleWheel(e)
    
    canvas.addEventListener('wheel', wheelHandler, { passive: false })
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler)
    }
  }, [handleWheel, isFullscreen])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === 'Delete' && panelData.selectedPanelId) {
        dispatch({ type: 'DELETE_PANEL', payload: panelData.selectedPanelId })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, toggleFullscreen, panelData.selectedPanelId])
  
  // Render canvas when dependencies change
  useEffect(() => {
    const currentCanvas = isFullscreen ? fullscreenCanvasRef.current : canvasRef.current;
    if (currentCanvas && panelData.panels.length > 0) {
      console.log('[PanelLayout] Canvas render effect triggered');
      renderCanvas();
    }
  }, [panelData.panels.length, canvasState, canvasWidth, canvasHeight, isFullscreen, renderCanvas])
  
  // Update canvas state when world dimensions change
  useEffect(() => {
    setCanvasState(prev => ({
      ...prev,
      worldWidth: worldDimensions.worldWidth,
      worldHeight: worldDimensions.worldHeight,
      worldScale: worldDimensions.worldScale
    }));
    
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
  
  return (
    <>
      {/* Fullscreen Canvas Portal */}
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
          
          <canvas
            ref={fullscreenCanvasRef}
            width={fullscreenCanvasWidth}
            height={fullscreenCanvasHeight}
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
              <Button onClick={() => console.log('Current panels state:', panelData.panels)} variant="outline" size="sm">
                Log Panels State
              </Button>
              <Button onClick={() => console.log('Raw external panels:', externalPanels)} variant="outline" size="sm">
                Log External Panels
              </Button>
              <Button onClick={autoFitViewport} variant="outline" size="sm">
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
                onClick={toggleFullscreen}
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