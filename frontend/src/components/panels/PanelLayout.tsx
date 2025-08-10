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

  // Viewport size management
  useEffect(() => {
    if (!containerRef.current) return
    const update = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      const w = Math.max(100, Math.floor(rect.width))
      const h = Math.max(100, Math.floor(rect.height))
      setViewportSize(w, h)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [setViewportSize])

  // Update container size for Stage
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 })
  
  useEffect(() => {
    if (!containerRef.current) return
    const updateSize = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      setContainerSize({
        width: Math.max(100, Math.floor(rect.width)),
        height: Math.max(100, Math.floor(rect.height))
      })
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

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

  // Simple grid lines - render in world coordinates (Konva will handle transformation)
  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = []
    const startX = 0
    const endX = WORLD_WIDTH_FT
    const startY = 0
    const endY = WORLD_HEIGHT_FT
    
    for (let gx = startX; gx <= endX; gx += GRID_CELL_SIZE_FT) {
      lines.push(
        <Line 
          key={`gv-${gx}`} 
          points={[gx, startY, gx, endY]} 
          stroke="#e5e7eb" 
          strokeWidth={1} 
          listening={false} 
        />
      )
    }
    for (let gy = startY; gy <= endY; gy += GRID_CELL_SIZE_FT) {
      lines.push(
        <Line 
          key={`gh-${gy}`} 
          points={[startX, gy, endX, gy]} 
          stroke="#e5e7eb" 
          strokeWidth={1} 
          listening={false} 
        />
      )
    }
    
    return lines
  }, [])

  // Simple panel rendering - use world coordinates (Konva will handle transformation)
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
              onWheel={(e: any) => {
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
              }}
              onMouseDown={(e: any) => {
                if (e.target === e.target.getStage()) {
                  setIsDragging(true)
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseMove={(e: any) => {
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
              }}
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
                {panels.length > 0 && panels.map(renderPanel)}
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