'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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

// Throttle utility function
const throttle = <T extends (...args: any[]) => any>(func: T, delay: number): T => {
  let lastCall = 0
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return func(...args)
    }
  }) as T
}

// Constants
const GRID_CELL_SIZE_FT = 100
const WORLD_WIDTH_FT = 2000
const WORLD_HEIGHT_FT = 2000
const SNAP_THRESHOLD_FT = 4

export default function PanelLayout({ mode, projectInfo }: PanelLayoutProps) {
  // Core state
  const [panels, setPanels] = useState<Panel[]>([])
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false)
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)

  // Performance optimizations
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const frameTimeRef = useRef<number>(0)
  const renderCountRef = useRef<number>(0)

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

  // Initialize with sample panels in auto mode
  useEffect(() => {
    if (mode === 'auto' && panels.length === 0) {
      setPanels([
        {
          id: '1',
          date: '2024-05-14',
          panelNumber: '1A',
          length: 100,
          width: 40,
          height: 100,
          rollNumber: 'R-101',
          location: 'Northeast corner',
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
      ])
    }
  }, [mode, panels.length])

  // Fullscreen state sync
  useEffect(() => {
    const handler = () => {
      const fsElement = document.fullscreenElement
      setIsFullscreen(Boolean(fsElement && containerRef.current && fsElement === containerRef.current))
      // Trigger a viewport recalc shortly after toggle
      setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setViewportSize(Math.max(100, Math.floor(rect.width)), Math.max(100, Math.floor(rect.height)))
        }
      }, 50)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [setViewportSize])

  // Mount effect
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Optimized viewport and container size management with debounced updates
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 })
  
  useEffect(() => {
    if (!containerRef.current) return
    
    let timeoutId: NodeJS.Timeout
    
    const updateSize = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      const newWidth = Math.max(100, Math.floor(rect.width))
      const newHeight = Math.max(100, Math.floor(rect.height))
      
      // Debounce size updates to avoid excessive re-renders
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setContainerSize({ width: newWidth, height: newHeight })
        setViewportSize(newWidth, newHeight)
      }, 100)
    }
    
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(containerRef.current)
    
    return () => {
      ro.disconnect()
      clearTimeout(timeoutId)
    }
  }, [setViewportSize])

  // Panel interaction handlers
  const handlePanelClick = useCallback((panelId: string) => {
    setSelectedPanelId(panelId === selectedPanelId ? null : panelId)
  }, [selectedPanelId])

  const handlePanelDragEnd = useCallback((panelId: string, newX: number, newY: number) => {
    // Grid snapping
    let snappedX = newX
    let snappedY = newY
    
    if (resizeSettings.snapToGrid) {
      snappedX = Math.round(newX / resizeSettings.gridSize) * resizeSettings.gridSize
      snappedY = Math.round(newY / resizeSettings.gridSize) * resizeSettings.gridSize
    }
    
    setPanels(prev => prev.map(p => 
      p.id === panelId ? { ...p, x: snappedX, y: snappedY } : p
    ))
  }, [resizeSettings])

  const handleCreatePanel = useCallback((panelData: {
    width?: number
    length?: number
    date?: string
    panelNumber?: string
    rollNumber?: string
    location?: string
  }) => {
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
    setPanels(prev => [...prev, newPanel])
    setIsCreateModalOpen(false)
  }, [])

  const handleDeletePanel = useCallback(() => {
    if (selectedPanelId) {
      setPanels(prev => prev.filter(panel => panel.id !== selectedPanelId))
      setSelectedPanelId(null)
    }
  }, [selectedPanelId])

  const handleExportToDXF = useCallback(() => {
    console.log('Export to DXF:', panels)
  }, [panels])

  const handleExportToJSON = useCallback(() => {
    console.log('Export to JSON:', panels)
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
    setPanels([])
    setSelectedPanelId(null)
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
      setIsFullscreen(prev => !prev)
    }
  }, [])

  // Adaptive grid lines with dynamic density based on zoom level
  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = []
    const padding = 200 // Extra padding around viewport
    
    // Adaptive grid density based on zoom level
    let gridSpacing = GRID_CELL_SIZE_FT
    if (scale < 0.2) gridSpacing = GRID_CELL_SIZE_FT * 4      // Very zoomed out: sparse grid
    else if (scale < 0.5) gridSpacing = GRID_CELL_SIZE_FT * 2  // Zoomed out: medium grid
    else if (scale < 1.0) gridSpacing = GRID_CELL_SIZE_FT      // Normal: standard grid
    else gridSpacing = GRID_CELL_SIZE_FT / 2                    // Zoomed in: dense grid
    
    // Calculate visible grid range based on current viewport
    const startX = Math.max(0, Math.floor((x - padding) / gridSpacing) * gridSpacing)
    const endX = Math.min(WORLD_WIDTH_FT, Math.ceil((x + containerSize.width / scale + padding) / gridSpacing) * gridSpacing)
    const startY = Math.max(0, Math.floor((y - padding) / gridSpacing) * gridSpacing)
    const endY = Math.min(WORLD_HEIGHT_FT, Math.ceil((y + containerSize.height / scale + padding) / gridSpacing) * gridSpacing)
    
    // Limit grid lines for performance with large viewports
    const maxGridLines = 50
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

  // Spatial indexing for efficient panel culling with 300+ panels
  const panelSpatialIndex = useMemo(() => {
    const index: { [key: string]: Panel[] } = {}
    const cellSize = Math.max(GRID_CELL_SIZE_FT, 200) // Larger cells for better performance
    
    panels.forEach(panel => {
      const cellX = Math.floor(panel.x / cellSize)
      const cellY = Math.floor(panel.y / cellSize)
      const cellKey = `${cellX},${cellY}`
      
      if (!index[cellKey]) {
        index[cellKey] = []
      }
      index[cellKey].push(panel)
    })
    
    return index
  }, [panels])

  // Optimized viewport culling using spatial index
  const visiblePanels = useMemo(() => {
    const padding = 150 // Increased padding for better user experience
    const cellSize = Math.max(GRID_CELL_SIZE_FT, 200)
    
    // Calculate which spatial cells are visible
    const viewportLeft = x - padding
    const viewportRight = x + containerSize.width / scale + padding
    const viewportTop = y - padding
    const viewportBottom = y + containerSize.height / scale + padding
    
    const startCellX = Math.floor(viewportLeft / cellSize)
    const endCellX = Math.floor(viewportRight / cellSize)
    const startCellY = Math.floor(viewportTop / cellSize)
    const endCellY = Math.floor(viewportBottom / cellSize)
    
    const visible: Panel[] = []
    const seen = new Set<string>()
    
    // Check only relevant spatial cells
    for (let cellX = startCellX; cellX <= endCellX; cellX++) {
      for (let cellY = startCellY; cellY <= endCellY; cellY++) {
        const cellKey = `${cellX},${cellY}`
        const cellPanels = panelSpatialIndex[cellKey] || []
        
        cellPanels.forEach(panel => {
          if (!seen.has(panel.id)) {
            seen.add(panel.id)
            // Fine-grained culling check
            const panelRight = panel.x + panel.width
            const panelBottom = panel.y + panel.height
            
            if (panel.x < viewportRight &&
                panelRight > viewportLeft &&
                panel.y < viewportBottom &&
                panelBottom > viewportTop) {
              visible.push(panel)
            }
          }
        })
      }
    }
    
    return visible
  }, [panelSpatialIndex, x, y, scale, containerSize.width, containerSize.height])

  // Optimized panel rendering with batching for 300+ panels
  const renderPanel = useCallback((panel: Panel) => {
    const isSelected = panel.id === selectedPanelId
    
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
        {/* Only render text for selected panels or when zoomed in enough */}
        {(isSelected || scale > 0.5) && (
          <Text
            x={panel.x + 5}
            y={panel.y + 5}
            text={panel.panelNumber ?? panel.id}
            fontSize={Math.max(8, 12 / scale)}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={0.5}
            listening={false}
          />
        )}
      </Group>
    )
  }, [selectedPanelId, handlePanelDragEnd, handlePanelClick, scale])

  // Panel batching for better performance with large datasets
  const batchedPanels = useMemo(() => {
    if (visiblePanels.length <= 100) {
      return visiblePanels
    }
    
    // For very large datasets, implement level-of-detail rendering
    const detailLevel = scale > 0.3 ? 'high' : scale > 0.1 ? 'medium' : 'low'
    
    if (detailLevel === 'low' && visiblePanels.length > 200) {
      // Render only every 3rd panel at low detail
      return visiblePanels.filter((_, index) => index % 3 === 0)
    } else if (detailLevel === 'medium' && visiblePanels.length > 150) {
      // Render only every 2nd panel at medium detail
      return visiblePanels.filter((_, index) => index % 2 === 0)
    }
    
    return visiblePanels
  }, [visiblePanels, scale])

  return (
    <div className="flex flex-row gap-0 w-full h-screen">
      {/* Simple Control Panel */}
      <div className="bg-white border-r border-neutral-200 shadow-lg w-80">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="font-semibold text-neutral-800">Controls</h3>
          </div>
          
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Zoom Controls */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700">Navigation</h4>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={zoomIn}
                >
                  Zoom +
                </button>
                <button 
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={zoomOut}
                >
                  Zoom -
                </button>
              </div>
              <button 
                className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={fitToExtent}
              >
                Fit to View
              </button>
            </div>

            {/* Panel Actions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700">Panels</h4>
              <button 
                className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Add Panel
              </button>
              <button 
                className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={handleDeletePanel}
                disabled={!selectedPanelId}
              >
                Delete Panel
              </button>
            </div>

            {/* Export/Import */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700">Data</h4>
              <button 
                className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={handleExportToDXF}
                disabled={panels.length === 0}
              >
                Export DXF
              </button>
              <button 
                className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={handleExportToJSON}
                disabled={panels.length === 0}
              >
                Export JSON
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700">Display</h4>
              <button 
                className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>

            {/* Performance Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700">Performance</h4>
              <div className="text-xs text-neutral-600 space-y-1">
                <div>Total Panels: {panels.length}</div>
                <div>Visible: {visiblePanels.length}</div>
                <div>Rendered: {batchedPanels.length}</div>
                <div>Zoom: {scale.toFixed(2)}x</div>
              </div>
            </div>

            {/* Reset */}
            <div className="space-y-2">
              <button 
                className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative bg-[#f7f7f7]">
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
              onWheel={useCallback((e: any) => {
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
              }, [])}
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
                {batchedPanels.length > 0 && batchedPanels.map(renderPanel)}
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      {/* Simple Create Panel Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Create New Panel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Panel Number</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Enter panel number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Width</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Width"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Length</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Length"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={() => handleCreatePanel({
                    panelNumber: 'New Panel',
                    width: 100,
                    length: 100,
                    date: new Date().toISOString().split('T')[0],
                    rollNumber: 'R-New',
                    location: 'Unknown'
                  })}
                >
                  Create
                </button>
                <button 
                  className="flex-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}