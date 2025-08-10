'use client'

import { useState, useRef, useEffect, useMemo, useCallback, useReducer } from 'react'
import { Stage, Layer, Rect, Group } from 'react-konva'
import { Line } from 'react-konva/lib/ReactKonvaCore'
import { Text } from 'react-konva/lib/ReactKonvaCore'
import type { Panel } from '../../types/panel'

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

interface ResizeSettings {
  minWidth: number
  minHeight: number
  maxWidth?: number
  maxHeight?: number
  lockAspectRatio: boolean
  aspectRatio: number
  snapToGrid: boolean
  gridSize: number
  snapToOtherPanels: boolean
  snapThreshold: number
  enableVisualFeedback: boolean
  enableSnapping: boolean
}

// Simple zoom/pan implementation
const useSimpleZoomPan = () => {
  const [scale, setScale] = useState<number>(1)
  const [x, setX] = useState<number>(0)
  const [y, setY] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  
  const zoomIn = useCallback(() => setScale(prev => Math.min(prev * 1.2, 5)), [])
  const zoomOut = useCallback(() => setScale(prev => Math.max(prev / 1.2, 0.1)), [])
  const fitToExtent = useCallback(() => {
    setScale(1)
    setX(0)
    setY(0)
  }, [])
  
  const toWorld = useCallback((screen: { x: number; y: number }) => ({ 
    x: (screen.x - x) / scale, 
    y: (screen.y - y) / scale 
  }), [x, y, scale])
  
  const toScreen = useCallback((world: { x: number; y: number }) => ({ 
    x: world.x * scale + x, 
    y: world.y * scale + y 
  }), [x, y, scale])
  
  const setViewportSize = useCallback((w: number, h: number) => {
    // Simple viewport size management
  }, [])
  
  return {
    scale,
    x,
    y,
    isDragging,
    setIsDragging,
    zoomIn,
    zoomOut,
    fitToExtent,
    toWorld,
    toScreen,
    setViewportSize,
    viewportSize: { x: 0, y: 0, width: 800, height: 600, scale: 1 }
  }
}

// Simple resize implementation
const useSimpleResize = () => {
  const [isResizing, setIsResizing] = useState<boolean>(false)
  
  return {
    isResizing,
    resizeResult: null,
    visualFeedback: null,
    startResize: () => setIsResizing(true),
    updateResize: () => {},
    endResize: () => setIsResizing(false),
    cancelResize: () => setIsResizing(false),
    getResizeCursor: () => 'default',
    getResizeHandles: () => []
  }
}

// Throttle utility function with cleanup support
const throttle = <T extends (...args: any[]) => any>(func: T, delay: number): T & { cancel: () => void } => {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null
  
  const throttled = ((...args: any[]) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return func(...args)
    } else {
      // Schedule the call for later
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        func(...args)
      }, delay - (now - lastCall))
    }
  }) as T & { cancel: () => void }
  
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  
  return throttled
}

// Constants
const GRID_CELL_SIZE_FT = 100
const WORLD_WIDTH_FT = 2000
const WORLD_HEIGHT_FT = 2000
const SNAP_THRESHOLD_FT = 4

// Panel state reducer
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
  console.log('🔍 [PanelReducer] Called with action:', action.type);
  console.log('🔍 [PanelReducer] Current state panels count:', state.panels.length);
  console.log('🔍 [PanelReducer] Current state panels:', state.panels);
  
  switch (action.type) {
    case 'SET_PANELS':
      console.log('🔍 [PanelReducer] SET_PANELS: Setting panels, new count:', action.payload.length);
      console.log('🔍 [PanelReducer] SET_PANELS: New panels:', action.payload);
      return { ...state, panels: action.payload }
    case 'ADD_PANEL':
      console.log('🔍 [PanelReducer] ADD_PANEL: Adding panel to existing panels');
      console.log('🔍 [PanelReducer] ADD_PANEL: Panel to add:', action.payload);
      console.log('🔍 [PanelReducer] ADD_PANEL: Current panels before adding:', state.panels);
      const newPanels = [...state.panels, action.payload];
      console.log('🔍 [PanelReducer] ADD_PANEL: New panels array after adding:', newPanels);
      console.log('🔍 [PanelReducer] ADD_PANEL: New count:', newPanels.length);
      return { ...state, panels: newPanels }
    case 'UPDATE_PANEL':
      console.log('🔍 [PanelReducer] UPDATE_PANEL: Updating panel with ID:', action.payload.id);
      console.log('🔍 [PanelReducer] UPDATE_PANEL: Updates:', action.payload.updates);
      return {
        ...state,
        panels: state.panels.map(p => 
          p.id === action.payload.id ? { ...p, ...action.payload.updates } : p
        )
      }
    case 'DELETE_PANEL':
      console.log('🔍 [PanelReducer] DELETE_PANEL: Deleting panel with ID:', action.payload);
      return {
        ...state,
        panels: state.panels.filter(p => p.id !== action.payload),
        selectedPanelId: state.selectedPanelId === action.payload ? null : state.selectedPanelId
      }
    case 'SELECT_PANEL':
      console.log('🔍 [PanelReducer] SELECT_PANEL: Selecting panel with ID:', action.payload);
      return { ...state, selectedPanelId: action.payload }
    case 'RESET_PANELS':
      console.log('🔍 [PanelReducer] RESET_PANELS: Resetting all panels');
      return { panels: [], selectedPanelId: null }
    default:
      console.log('🔍 [PanelReducer] Unknown action type:', (action as any).type);
      return state
  }
}

export default function PanelLayout({ mode, projectInfo, externalPanels, onPanelUpdate }: PanelLayoutProps) {
  // Core state using reducer for panels
  const [panelState, dispatch] = useReducer(panelReducer, { panels: [], selectedPanelId: null })
  const { panels, selectedPanelId } = panelState
  
  // Use external panels if provided, otherwise use internal state
  const effectivePanels = externalPanels || panels
  
  console.log('🔍 [PanelLayout] Component rendered with state:', {
    mode,
    projectInfo,
    panelsCount: effectivePanels.length,
    selectedPanelId,
    panelState
  });
  
  console.log('🔍 [PanelLayout] All panels:', effectivePanels);
  
  // UI state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false)
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<boolean>(false)

  // Performance optimizations
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)

  // Resize settings
  const [resizeSettings, setResizeSettings] = useState<ResizeSettings>({
    minWidth: 50,
    minHeight: 50,
    maxWidth: 1000,
    maxHeight: 1000,
    lockAspectRatio: false,
    aspectRatio: 2.5,
    snapToGrid: true,
    gridSize: GRID_CELL_SIZE_FT,
    snapToOtherPanels: true,
    snapThreshold: SNAP_THRESHOLD_FT,
    enableVisualFeedback: true,
    enableSnapping: true
  })

  // Simple zoom/pan hook
  const {
    scale,
    x,
    y,
    isDragging,
    setIsDragging,
    zoomIn,
    zoomOut,
    fitToExtent,
    toWorld,
    toScreen,
    setViewportSize,
    viewportSize
  } = useSimpleZoomPan()

  // Throttled mouse move handler for better performance
  const throttledMouseMove = useCallback(
    throttle((e: any) => {
      if (!isDragging) return
      
      const stage = e.target.getStage()
      if (!stage) return
      
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      
      const dx = pointer.x - stage.x()
      const dy = pointer.y - stage.y()
      
      stage.x(dx)
      stage.y(dy)
      stage.batchDraw()
    }, 16), // ~60fps
    [isDragging]
  )

  // Wheel handler for zoom functionality
  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    
    if (!pointer) return
    
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    
    const scaleBy = 1.1
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
    
    stage.scale({ x: newScale, y: newScale })
    
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }
    stage.position(newPos)
    stage.batchDraw()
  }, [])
  
  // Cleanup throttled function on unmount
  useEffect(() => {
    return () => {
      if (throttledMouseMove.cancel) {
        throttledMouseMove.cancel()
      }
    }
  }, [throttledMouseMove])

  // Simple resize hook
  const {
    isResizing,
    startResize,
    updateResize,
    endResize,
    cancelResize,
    getResizeCursor,
    getResizeHandles
  } = useSimpleResize()

  // Load initial panels based on mode
  useEffect(() => {
    console.log('🔍 [PanelLayout] Initial panel loading effect triggered');
    console.log('🔍 [PanelLayout] Mode:', mode);
    console.log('🔍 [PanelLayout] Current panels count:', effectivePanels.length);
    
    if (mode === 'auto' && effectivePanels.length === 0) {
      console.log('🔍 [PanelLayout] Loading demo panels...');
      dispatch({
        type: 'SET_PANELS',
        payload: [
          {
            id: '1',
            date: '2024-05-14',
            panelNumber: '1A',
            length: 100,
            width: 40,
            height: 100,
            rollNumber: 'R-101',
            location: 'Primary area',
            x: 50,
            y: 50,
            shape: 'rectangle',
            rotation: 0,
            fill: '#E3F2FD',
            color: '#E3F2FD',
            meta: { repairs: [], location: { x: 50, y: 50 } }
          },
          {
            id: '2',
            date: '2024-05-14',
            panelNumber: '2A',
            length: 100,
            width: 40,
            height: 100,
            rollNumber: 'R-102',
            location: 'Adjacent to 1A',
            x: 150,
            y: 50,
            shape: 'rectangle',
            rotation: 0,
            fill: '#BBDEFB',
            color: '#BBDEFB',
            meta: { repairs: [], location: { x: 150, y: 50 } }
          }
        ]
      });
      console.log('🔍 [PanelLayout] Demo panels dispatched');
    } else {
      console.log('🔍 [PanelLayout] Not loading demo panels - mode:', mode, 'panels count:', effectivePanels.length);
    }
  }, [mode, effectivePanels.length])

  // Fullscreen state sync with proper cleanup
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    
    const handler = () => {
      const fsElement = document.fullscreenElement
      const isCurrentlyFullscreen = Boolean(fsElement && containerRef.current && fsElement === containerRef.current)
      
      setIsFullscreen(isCurrentlyFullscreen)
      
      // Clear any existing timeout to prevent race conditions
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      // Trigger a viewport recalc shortly after toggle
      timeoutId = setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setViewportSize(Math.max(100, Math.floor(rect.width)), Math.max(100, Math.floor(rect.height)))
        }
      }, 50)
    }
    
    document.addEventListener('fullscreenchange', handler)
    
    return () => {
      document.removeEventListener('fullscreenchange', handler)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [setViewportSize])

  // Mount effect with cleanup
  useEffect(() => {
    setIsMounted(true)
    
    return () => {
      setIsMounted(false)
    }
  }, [])

  // Optimized viewport and container size management with debounced updates
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 })
  
  useEffect(() => {
    if (!containerRef.current) return
    
    let timeoutId: NodeJS.Timeout
    let isActive = true // Flag to prevent updates after unmount
    
    const updateSize = () => {
      if (!isActive || !containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = Math.max(100, Math.floor(rect.width))
      const newHeight = Math.max(100, Math.floor(rect.height))
      
      // Debounce size updates to avoid excessive re-renders
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (isActive) {
          setContainerSize({ width: newWidth, height: newHeight })
          setViewportSize(newWidth, newHeight)
        }
      }, 100)
    }
    
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(containerRef.current)
    
    return () => {
      isActive = false
      ro.disconnect()
      clearTimeout(timeoutId)
    }
  }, [setViewportSize])

  // Handle container size changes
  useEffect(() => {
    console.log('🔍 [PanelLayout] Container size effect triggered');
    console.log('🔍 [PanelLayout] Container ref:', containerRef.current);
    
    if (containerRef.current) {
      const updateSize = () => {
        const rect = containerRef.current!.getBoundingClientRect();
        console.log('🔍 [PanelLayout] Container rect:', rect);
        console.log('🔍 [PanelLayout] Setting container size to:', { width: rect.width, height: rect.height });
        setContainerSize({ width: rect.width, height: rect.height });
      };
      
      updateSize();
      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(containerRef.current);
      
      console.log('🔍 [PanelLayout] ResizeObserver set up for container');
      
      return () => {
        console.log('🔍 [PanelLayout] Cleaning up ResizeObserver');
        resizeObserver.disconnect();
      };
    } else {
      console.log('🔍 [PanelLayout] Container ref not available');
    }
  }, [])

  // Handle viewport size changes
  useEffect(() => {
    console.log('🔍 [PanelLayout] Viewport size effect triggered');
    console.log('🔍 [PanelLayout] Container size:', containerSize);
    console.log('🔍 [PanelLayout] Scale:', scale);
    console.log('🔍 [PanelLayout] Position:', { x, y });
    
    if (containerSize.width > 0 && containerSize.height > 0) {
      console.log('🔍 [PanelLayout] Calculating viewport size...');
      const newViewportSize = {
        width: containerSize.width / scale,
        height: containerSize.height / scale
      };
      console.log('🔍 [PanelLayout] New viewport size:', newViewportSize);
      setViewportSize(containerSize.width, containerSize.height);
    } else {
      console.log('🔍 [PanelLayout] Container size not ready yet');
    }
  }, [containerSize, scale, setViewportSize])

  // Panel interaction handlers
  const handlePanelClick = useCallback((panelId: string) => {
    dispatch({
      type: 'SELECT_PANEL',
      payload: panelId === selectedPanelId ? null : panelId
    })
  }, [selectedPanelId])

  const handlePanelDragEnd = useCallback((panelId: string, newX: number, newY: number) => {
    // Grid snapping
    let snappedX = newX
    let snappedY = newY
    
    if (resizeSettings.snapToGrid) {
      snappedX = Math.round(newX / resizeSettings.gridSize) * resizeSettings.gridSize
      snappedY = Math.round(newY / resizeSettings.gridSize) * resizeSettings.gridSize
    }
    
    dispatch({
      type: 'UPDATE_PANEL',
      payload: { id: panelId, updates: { x: snappedX, y: snappedY } }
    })
  }, [resizeSettings])

  const handleCreatePanel = useCallback((panelData: {
    width?: number
    length?: number
    date?: string
    panelNumber?: string
    rollNumber?: string
    location?: string
  }) => {
    try {
      console.log('🔍 Creating panel with data:', panelData)
      
      const newPanel: Panel = {
        id: `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        shape: 'rectangle',
        x: 100,
        y: 100,
        width: panelData.width ?? 100,
        height: panelData.length ?? 100,
        length: panelData.length ?? 100,
        rotation: 0,
        fill: '#3b82f6',
        color: '#3b82f6',
        meta: {
          repairs: [],
          location: { x: 100, y: 100 }
        },
        date: panelData.date ?? new Date().toISOString().split('T')[0],
        panelNumber: panelData.panelNumber ?? 'New',
        rollNumber: panelData.rollNumber ?? 'R-New',
        location: panelData.location ?? 'Unknown'
      }
      
      console.log('🔍 New panel created:', newPanel)
      console.log('🔍 Current panels before adding:', panels)
      
      dispatch({ type: 'ADD_PANEL', payload: newPanel })
      
      console.log('🔍 Panel added to state, current panels:', [...panels, newPanel])
      
      setIsCreateModalOpen(false)
      setError(null) // Clear any previous errors
    } catch (err) {
      setError('Failed to create panel. Please try again.')
      console.error('Panel creation error:', err)
    }
  }, [panels])

  const handleDeletePanel = useCallback(() => {
    if (selectedPanelId) {
      dispatch({ type: 'DELETE_PANEL', payload: selectedPanelId })
    }
  }, [selectedPanelId])

  const handleExportToDXF = useCallback(async () => {
    try {
      setIsExporting(true)
      setError(null)
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Export to DXF:', panels)
      // In a real app, this would trigger file download
    } catch (err) {
      setError('Failed to export DXF file. Please try again.')
      console.error('DXF export error:', err)
    } finally {
      setIsExporting(false)
    }
  }, [panels])

  const handleExportToJSON = useCallback(async () => {
    try {
      setIsExporting(true)
      setError(null)
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Export to JSON:', panels)
      // In a real app, this would trigger file download
    } catch (err) {
      setError('Failed to export JSON file. Please try again.')
      console.error('JSON export error:', err)
    } finally {
      setIsExporting(false)
    }
  }, [panels])

  const handleImportExcel = useCallback(async (file: File) => {
    console.log('Import Excel:', file)
  }, [])

  const handleGenerateTemplate = useCallback(() => {
    console.log('Generate template')
  }, [])

  const handleAssignRollNumbers = useCallback(() => {
    console.log('Assign roll numbers')
  }, [panels])

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET_PANELS' })
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch (e) {
      console.warn('Fullscreen toggle failed:', e)
      // Don't toggle state on error - let the fullscreenchange event handle it
    }
  }, [])

  // Simplified grid lines for performance (no complex conditional logic)
  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = []
    const padding = 200 // Extra padding around viewport
    const gridSpacing = GRID_CELL_SIZE_FT // Fixed spacing for consistency
    
    // Calculate visible grid range based on current viewport
    const startX = Math.max(0, Math.floor((x - padding) / gridSpacing) * gridSpacing)
    const endX = Math.min(WORLD_WIDTH_FT, Math.ceil((x + containerSize.width / scale + padding) / gridSpacing) * gridSpacing)
    const startY = Math.max(0, Math.floor((y - padding) / gridSpacing) * gridSpacing)
    const endY = Math.min(WORLD_HEIGHT_FT, Math.ceil((y + containerSize.height / scale + padding) / gridSpacing) * gridSpacing)
    
    // Limit grid lines for performance
    const maxGridLines = 40
    let lineCount = 0
    
    // Only render grid lines within visible area
    for (let gx = startX; gx <= endX && lineCount < maxGridLines; gx += gridSpacing) {
      lines.push(
        <Line 
          key={`gv-${gx}`} 
          points={[gx, startY, gx, endY]} 
          stroke="#e5e7eb" 
          strokeWidth={1} 
          listening={false} 
        />
      )
      lineCount++
    }
    for (let gy = startY; gy <= endY && lineCount < maxGridLines; gy += gridSpacing) {
      lines.push(
        <Line 
          key={`gh-${gy}`} 
          points={[startX, gy, endX, gy]} 
          stroke="#e5e7eb" 
          strokeWidth={1} 
          listening={false} 
        />
      )
      lineCount++
    }
    
    return lines
  }, [x, y, scale, containerSize.width, containerSize.height])

  // Simplified viewport culling for performance
  const visiblePanels = useMemo(() => {
    console.log('🔍 [PanelLayout] Calculating visiblePanels...');
    console.log('🔍 [PanelLayout] All panels:', effectivePanels);
    console.log('🔍 [PanelLayout] Container size:', containerSize);
    console.log('🔍 [PanelLayout] Viewport position:', { x, y });
    console.log('🔍 [PanelLayout] Scale:', scale);
    
    const filtered = effectivePanels.filter(panel => {
      const panelBounds = {
        left: panel.x,
        top: panel.y,
        right: panel.x + panel.width,
        bottom: panel.y + panel.height
      };
      
      const viewportBounds = {
        left: -x / scale,
        top: -y / scale,
        right: (-x + containerSize.width) / scale,
        bottom: (-y + containerSize.height) / scale
      };
      
      const isVisible = !(
        panelBounds.right < viewportBounds.left ||
        panelBounds.left > viewportBounds.right ||
        panelBounds.bottom < viewportBounds.top ||
        panelBounds.top > viewportBounds.bottom
      );
      
      console.log('🔍 [PanelLayout] Panel visibility check:', {
        id: panel.id,
        panelBounds,
        viewportBounds,
        isVisible
      });
      
      return isVisible;
    });
    
    console.log('🔍 [PanelLayout] Visible panels result:', filtered);
    console.log('🔍 [PanelLayout] Visible panels count:', filtered.length);
    
    return filtered;
  }, [effectivePanels, containerSize, x, y, scale])

  // Update visible panels when panels change
  useEffect(() => {
    console.log('🔍 [PanelLayout] useEffect triggered - panels changed');
    console.log('🔍 [PanelLayout] New panels array:', effectivePanels);
    console.log('🔍 [PanelLayout] Panels count:', effectivePanels.length);
    console.log('🔍 [PanelLayout] First panel example:', effectivePanels[0]);
    
    // Recalculate visible panels
    const newVisiblePanels = effectivePanels.filter(panel => {
      const panelBounds = {
        left: panel.x,
        top: panel.y,
        right: panel.x + panel.width,
        bottom: panel.y + panel.height
      };
      
      const viewportBounds = {
        left: -x / scale,
        top: -y / scale,
        right: (-x + containerSize.width) / scale,
        bottom: (-y + containerSize.height) / scale
      };
      
      const isVisible = panelBounds.left < viewportBounds.right &&
                       panelBounds.right > viewportBounds.left &&
                       panelBounds.top < viewportBounds.bottom &&
                       panelBounds.bottom > viewportBounds.top;
      
      console.log('🔍 [PanelLayout] Panel visibility check:', {
        panelId: panel.id,
        panelBounds,
        viewportBounds,
        isVisible
      });
      
      return isVisible;
    });
    
    console.log('🔍 [PanelLayout] New visible panels calculated:', newVisiblePanels);
    // setVisiblePanels(newVisiblePanels); // This line was removed as per the edit hint
  }, [effectivePanels, x, y, scale, containerSize.width, containerSize.height])

  // Sync external panels with internal state and notify parent
  useEffect(() => {
    if (externalPanels && onPanelUpdate) {
      console.log('🔍 [PanelLayout] Syncing external panels with internal state');
      console.log('🔍 [PanelLayout] External panels:', externalPanels);
      
      // Update internal state to match external panels
      dispatch({ type: 'SET_PANELS', payload: externalPanels });
      
      // Notify parent of any changes
      onPanelUpdate(externalPanels);
    }
  }, [externalPanels, onPanelUpdate]);

  // Simplified panel rendering function (no conditional hook dependencies)
  const renderPanel = useCallback((panel: Panel) => {
    console.log('🔍 [PanelLayout] renderPanel called for panel:', panel.id, panel);
    
    const isSelected = panel.id === selectedPanelId
    
    console.log('🔍 [PanelLayout] Panel render details:', {
      id: panel.id,
      isSelected,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      fill: panel.fill,
      color: panel.color
    });
    
    return (
      <Group key={panel.id}>
        <Rect
          x={panel.x}
          y={panel.y}
          width={panel.width}
          height={panel.height}
          fill={isSelected ? '#ef4444' : panel.fill ?? '#3b82f6'}
          stroke={isSelected ? '#dc2626' : panel.color ?? '#1e40af'}
          strokeWidth={isSelected ? 3 : 2}
          cornerRadius={4}
          draggable
          onDragEnd={(e: any) => {
            const pos = e.target.position()
            handlePanelDragEnd(panel.id, pos.x, pos.y)
          }}
          onClick={() => handlePanelClick(panel.id)}
        />
        <Text
          x={panel.x + 5}
          y={panel.y + 5}
          text={panel.panelNumber ?? panel.id}
          fontSize={12}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={0.5}
          listening={false}
        />
      </Group>
    )
  }, [selectedPanelId, handlePanelDragEnd, handlePanelClick])

  // Simple panel filtering for performance (no conditional hook calls)
  const renderablePanels = useMemo(() => {
    console.log('🔍 [PanelLayout] Calculating renderablePanels...');
    console.log('🔍 [PanelLayout] visiblePanels:', visiblePanels);
    console.log('🔍 [PanelLayout] renderablePanels result:', visiblePanels);
    return visiblePanels
  }, [visiblePanels])

  return (
    <div className="flex flex-col lg:flex-row gap-0 w-full h-screen">
      {/* Collapsible Control Panel */}
      <div className={`bg-white border-r border-neutral-200 shadow-lg transition-all duration-300 ease-in-out ${
        isControlPanelCollapsed ? 'w-16' : 'w-full lg:w-80'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            {!isControlPanelCollapsed && <h3 className="font-semibold text-neutral-800">Controls</h3>}
            <button
              onClick={() => setIsControlPanelCollapsed(!isControlPanelCollapsed)}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label={isControlPanelCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isControlPanelCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isControlPanelCollapsed ? (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          </div>
          
          <div className={`flex-1 overflow-y-auto transition-all duration-300 ${
            isControlPanelCollapsed ? 'p-2' : 'p-4 space-y-4'
          }`}>
            {/* Zoom Controls */}
            <div className={`${isControlPanelCollapsed ? 'space-y-2' : 'space-y-2'}`}>
              {!isControlPanelCollapsed && <h4 className="text-sm font-medium text-neutral-700">Navigation</h4>}
              <div className={`${isControlPanelCollapsed ? 'space-y-2' : 'grid grid-cols-2 gap-2'}`}>
                <button 
                  className={`${isControlPanelCollapsed ? 'w-full p-2' : 'px-3 py-2'} bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  onClick={zoomIn}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  {isControlPanelCollapsed ? (
                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  ) : (
                    'Zoom +'
                  )}
                </button>
                <button 
                  className={`${isControlPanelCollapsed ? 'w-full p-2' : 'px-3 py-2'} bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  onClick={zoomOut}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  {isControlPanelCollapsed ? (
                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 13v-6m-3 3h6" />
                    </svg>
                  ) : (
                    'Zoom -'
                  )}
                </button>
              </div>
              <button 
                className={`${isControlPanelCollapsed ? 'w-full p-2' : 'w-full px-3 py-2'} border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2`}
                onClick={fitToExtent}
                aria-label="Fit to view"
                title="Fit to view"
              >
                {isControlPanelCollapsed ? (
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                ) : (
                  'Fit to View'
                )}
              </button>
            </div>

            {/* Panel Actions */}
            <div className={`${isControlPanelCollapsed ? 'space-y-2' : 'space-y-2'}`}>
              {!isControlPanelCollapsed && <h4 className="text-sm font-medium text-neutral-700">Panels</h4>}
              <button 
                className={`${isControlPanelCollapsed ? 'w-full p-2' : 'w-full px-3 py-2'} bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={() => setIsCreateModalOpen(true)}
                aria-label="Add panel"
                title="Add panel"
              >
                {isControlPanelCollapsed ? (
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                ) : (
                  'Add Panel'
                )}
              </button>
              <button 
                className={`${isControlPanelCollapsed ? 'w-full p-2' : 'w-full px-3 py-2'} border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={handleDeletePanel}
                disabled={!selectedPanelId}
                aria-label="Delete panel"
                title="Delete panel"
              >
                {isControlPanelCollapsed ? (
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : (
                  'Delete Panel'
                )}
              </button>
            </div>

            {/* Export/Import */}
            <div className={`${isControlPanelCollapsed ? 'space-y-2' : 'space-y-2'}`}>
              {!isControlPanelCollapsed && <h4 className="text-sm font-medium text-neutral-700">Data</h4>}
              <button 
                className={`${isControlPanelCollapsed ? 'w-full p-2' : 'w-full px-3 py-2'} border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={handleExportToDXF}
                disabled={panels.length === 0 || isExporting}
                aria-label="Export DXF"
                title="Export DXF"
              >
                {isControlPanelCollapsed ? (
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : (
                  isExporting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Exporting...
                    </div>
                  ) : (
                    'Export DXF'
                  )
                )}
              </button>
              <button 
                className={`${isControlPanelCollapsed ? 'w-full p-2' : 'w-full px-3 py-2'} border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={handleExportToJSON}
                disabled={panels.length === 0 || isExporting}
                aria-label="Export JSON"
                title="Export JSON"
              >
                {isControlPanelCollapsed ? (
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : (
                  isExporting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Exporting...
                    </div>
                  ) : (
                    'Export JSON'
                  )
                )}
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <div className={`${isControlPanelCollapsed ? 'space-y-2' : 'space-y-2'}`}>
              {!isControlPanelCollapsed && <h4 className="text-sm font-medium text-neutral-700">Display</h4>}
              <button 
                className={`${isControlPanelCollapsed ? 'w-full p-2' : 'w-full px-3 py-2'} border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2`}
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              >
                {isControlPanelCollapsed ? (
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                ) : (
                  isFullscreen ? 'Exit Full Screen' : 'Full Screen'
                )}
              </button>
            </div>

            {/* Performance Status */}
            {!isControlPanelCollapsed && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-neutral-700">Performance</h4>
                <div className="text-xs text-neutral-600 space-y-1">
                  <div>Total Panels: {panels.length}</div>
                  <div>Visible: {visiblePanels.length}</div>
                  <div>Rendered: {renderablePanels.length}</div>
                  <div>Zoom: {scale.toFixed(2)}x</div>
                </div>
              </div>
            )}

            {/* Reset */}
            <div className={`${isControlPanelCollapsed ? 'space-y-2' : 'space-y-2'}`}>
              <button 
                className={`${isControlPanelCollapsed ? 'w-full p-2' : 'w-full px-3 py-2'} border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2`}
                onClick={handleReset}
                aria-label="Reset panels"
                title="Reset panels"
              >
                {isControlPanelCollapsed ? (
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  'Reset'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative bg-[#f7f7f7] min-h-0">
        {/* Error Display */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-10 bg-red-50 border border-red-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
                aria-label="Dismiss error"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        )}
        
        {/* Canvas Container */}
        <div 
          ref={containerRef} 
          className="w-full h-full"
          style={{ height: isFullscreen ? '100vh' : '100%' }}
        >
          {isMounted && (
            <Stage
              ref={stageRef}
              width={containerSize.width}
              height={containerSize.height}
              onWheel={handleWheel}
              onMouseDown={(e: any) => {
                if (e.target === e.target.getStage()) {
                  setIsDragging(true)
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseMove={throttledMouseMove}
              onDoubleClick={(e: any) => {
                if (e.target === e.target.getStage()) {
                  fitToExtent()
                }
              }}
            >
              <Layer>
                {/* Grid Lines */}
                {gridLines}
                
                {/* Panels */}
                {(() => {
                  console.log('🔍 [PanelLayout] About to render panels in Stage');
                  console.log('🔍 [PanelLayout] renderablePanels count:', renderablePanels.length);
                  console.log('🔍 [PanelLayout] renderablePanels:', renderablePanels);
                  console.log('🔍 [PanelLayout] renderPanel function type:', typeof renderPanel);
                  
                  if (renderablePanels.length === 0) {
                    console.log('🔍 [PanelLayout] No panels to render');
                    return null;
                  }
                  
                  const renderedPanels = renderablePanels.map(renderPanel);
                  console.log('🔍 [PanelLayout] Rendered panels result:', renderedPanels);
                  console.log('🔍 [PanelLayout] Rendered panels count:', renderedPanels.length);
                  
                  return renderedPanels;
                })()}
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      {/* Enhanced Create Panel Modal */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setIsCreateModalOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setIsCreateModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 id="modal-title" className="text-lg font-semibold text-gray-900">Create New Panel</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                handleCreatePanel({
                  panelNumber: formData.get('panelNumber') as string || 'New Panel',
                  width: Number(formData.get('width')) || 100,
                  length: Number(formData.get('length')) || 100,
                  date: new Date().toISOString().split('T')[0],
                  rollNumber: 'R-New',
                  location: 'Unknown'
                })
              }} className="space-y-4">
                <div>
                  <label htmlFor="panelNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Panel Number *
                  </label>
                  <input 
                    id="panelNumber"
                    name="panelNumber"
                    type="text" 
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter panel number"
                    defaultValue="New Panel"
                  />
                </div>
                
                <div>
                  <label htmlFor="width" className="block text-sm font-medium text-gray-700 mb-1">
                    Width (ft) *
                  </label>
                  <input 
                    id="width"
                    name="width"
                    type="number" 
                    required
                    min="1"
                    max="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Width in feet"
                    defaultValue="100"
                  />
                </div>
                
                <div>
                  <label htmlFor="length" className="block text-sm font-medium text-gray-700 mb-1">
                    Length (ft) *
                  </label>
                  <input 
                    id="length"
                    name="length"
                    type="number" 
                    required
                    min="1"
                    max="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Length in feet"
                    defaultValue="100"
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Panel
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}