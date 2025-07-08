'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useZoomPan } from '@/hooks/use-zoom-pan'
import { Button } from '@/components/ui/button'
import { parseExcelPanels, generateTemplateFile } from '@/lib/excel-import'
import { exportToDXF, exportToJSON } from '@/lib/dxf-helpers'
import { saveAs } from 'file-saver'
import type { Panel } from '../../types/panel'
import { useTooltip } from '@/components/ui/tooltip'

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

// Optimized constants
const GRID_SIZE = 20;
const MIN_PANEL_SIZE = 50;
const DRAG_THROTTLE_MS = 16; // ~60fps
const CANVAS_BUFFER_MARGIN = 100; // Extra margin for smooth scrolling

export default function SimplePanelLayout({ mode, projectInfo }: PanelLayoutProps) {
  const [panels, setPanels] = useState<Panel[]>([])
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number>()
  const lastDragTimeRef = useRef<number>(0)
  
  const [dragInfo, setDragInfo] = useState<{ isDragging: boolean, panelId: string | null, startX: number, startY: number }>({
    isDragging: false,
    panelId: null,
    startX: 0,
    startY: 0
  })

  // Use the optimized zoom/pan hook
  const {
    scale,
    position,
    viewport,
    setScale,
    setPosition,
    zoomIn,
    zoomOut,
    fitToContent,
    handleWheel,
    onMouseMove,
    reset,
    isInViewport,
  } = useZoomPan();

  // Remove hover state and add tooltip
  const { showTooltip, hideTooltip, TooltipComponent } = useTooltip();

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
          rollNumber: 'R-101',
          location: 'Northeast corner',
          x: 50,
          y: 50,
          shape: 'rectangle',
          rotation: 0,
          fill: '#E3F2FD',
          color: '#E3F2FD'
        },
        {
          id: '2',
          date: '2024-05-14',
          panelNumber: '2A',
          length: 100,
          width: 40,
          rollNumber: 'R-102',
          location: 'Adjacent to 1A',
          x: 150,
          y: 50,
          shape: 'rectangle',
          rotation: 0,
          fill: '#BBDEFB',
          color: '#BBDEFB'
        }
      ])
    }
  }, [mode, panels.length])

  // Optimized canvas rendering with double buffering
  const drawPanelLayout = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Apply scaling and translation
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate(-position.x / scale, -position.y / scale)
    
    // Calculate visible area for culling
    const visibleArea = {
      x: position.x / scale - CANVAS_BUFFER_MARGIN,
      y: position.y / scale - CANVAS_BUFFER_MARGIN,
      width: dimensions.width / scale + CANVAS_BUFFER_MARGIN * 2,
      height: dimensions.height / scale + CANVAS_BUFFER_MARGIN * 2
    }
    
    // Draw optimized grid
    drawOptimizedGrid(ctx, visibleArea)
    
    // Draw only visible panels
    const visiblePanels = panels.filter(panel => 
      isInViewport({
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.length
      })
    )
    
    visiblePanels.forEach(panel => {
      drawPanel(ctx, panel, panel.id === selectedPanelId)
    })
    
    // Restore canvas state
    ctx.restore()
  }, [panels, selectedPanelId, scale, position, dimensions, isInViewport])

  // Optimized grid drawing with viewport culling
  const drawOptimizedGrid = useCallback((ctx: CanvasRenderingContext2D, visibleArea: { x: number, y: number, width: number, height: number }) => {
    const startX = Math.floor(visibleArea.x / GRID_SIZE) * GRID_SIZE
    const endX = Math.ceil((visibleArea.x + visibleArea.width) / GRID_SIZE) * GRID_SIZE
    const startY = Math.floor(visibleArea.y / GRID_SIZE) * GRID_SIZE
    const endY = Math.ceil((visibleArea.y + visibleArea.height) / GRID_SIZE) * GRID_SIZE
    
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 0.5
    
    // Draw vertical lines
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
      ctx.stroke()
    }
    
    // Draw horizontal lines
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
      ctx.stroke()
    }
    
    // Draw axes with better visibility
    ctx.strokeStyle = '#999'
    ctx.lineWidth = 2
    
    // X-axis
    ctx.beginPath()
    ctx.moveTo(startX, 0)
    ctx.lineTo(endX, 0)
    ctx.stroke()
    
    // Y-axis
    ctx.beginPath()
    ctx.moveTo(0, startY)
    ctx.lineTo(0, endY)
    ctx.stroke()
    
    // Draw axis labels with better positioning
    ctx.fillStyle = '#666'
    ctx.font = '12px Arial'
    
    // X-axis labels (every 100 units)
    for (let x = Math.floor(startX / 100) * 100; x <= endX; x += 100) {
      if (x >= startX && x <= endX) {
        ctx.fillText(`${x}'`, x + 5, 15)
      }
    }
    
    // Y-axis labels (every 100 units)
    for (let y = Math.floor(startY / 100) * 100; y <= endY; y += 100) {
      if (y >= startY && y <= endY) {
        ctx.fillText(`${y}'`, 5, y + 15)
      }
    }
  }, [])

  // Optimized panel drawing
  const drawPanel = useCallback((ctx: CanvasRenderingContext2D, panel: Panel, isSelected: boolean) => {
    ctx.save()
    
    // Set panel style
    ctx.fillStyle = panel.fill || '#3b82f6'
    ctx.strokeStyle = isSelected ? '#1d4ed8' : '#000000'
    ctx.lineWidth = isSelected ? 3 : 1
    
    // Apply rotation if needed
    if (panel.rotation !== 0) {
      const centerX = panel.x + panel.width / 2
      const centerY = panel.y + panel.length / 2
      ctx.translate(centerX, centerY)
      ctx.rotate(panel.rotation * Math.PI / 180)
      ctx.translate(-centerX, -centerY)
    }
    
    if (panel.shape === 'triangle') {
      // Draw triangle
      const centerX = panel.x + panel.width / 2
      const centerY = panel.y + panel.length / 2
      const radius = Math.min(panel.width, panel.length) / 2
      
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2
        const x = centerX + radius * Math.cos(angle)
        const y = centerY + radius * Math.sin(angle)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.closePath()
    } else if (panel.shape === 'right-triangle') {
      // Draw right triangle with 90-degree angle
      // The right angle is at the bottom-left corner
      ctx.beginPath()
      ctx.moveTo(panel.x, panel.y) // Top-left corner
      ctx.lineTo(panel.x + panel.width, panel.y) // Top-right corner
      ctx.lineTo(panel.x, panel.y + panel.length) // Bottom-left corner (right angle)
      ctx.closePath()
    } else {
      // Draw rectangle
      ctx.fillRect(panel.x, panel.y, panel.width, panel.length)
      ctx.strokeRect(panel.x, panel.y, panel.width, panel.length)
    }
    
    // Draw panel label - only panel number
    const label = panel.panelNumber || '';
    const fontSize = Math.min(panel.width, panel.length) * 0.3
    ctx.font = `${fontSize}px Arial`
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const centerX = panel.x + panel.width / 2
    const centerY = panel.y + panel.length / 2
    ctx.fillText(label, centerX, centerY)
    
    ctx.restore()
  }, [])

  // Request animation frame for smooth rendering
  useEffect(() => {
    const animate = () => {
      drawPanelLayout()
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animate()
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [drawPanelLayout])

  // Optimized canvas click handler
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale + position.x / scale
    const y = (e.clientY - rect.top) / scale + position.y / scale
    
    // Find clicked panel (reverse order to get top panel first)
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i]
      if (x >= panel.x && x <= panel.x + panel.width &&
          y >= panel.y && y <= panel.y + panel.length) {
        setSelectedPanelId(panel.id)
        return
      }
    }
    
    setSelectedPanelId(null)
  }, [panels, scale, position])

  // Throttled canvas mouse down handler
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedPanelId) return
    
    const now = Date.now()
    if (now - lastDragTimeRef.current < DRAG_THROTTLE_MS) {
      return
    }
    lastDragTimeRef.current = now
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale + position.x / scale
    const y = (e.clientY - rect.top) / scale + position.y / scale
    
    setDragInfo({
      isDragging: true,
      panelId: selectedPanelId,
      startX: x,
      startY: y
    })
  }, [selectedPanelId, scale, position])

  // Add mouse move handler for hover detection and tooltip
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle drag logic first
    if (dragInfo.isDragging && dragInfo.panelId) {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale + position.x / scale
      const y = (e.clientY - rect.top) / scale + position.y / scale
      
      const deltaX = x - dragInfo.startX
      const deltaY = y - dragInfo.startY
      
      setPanels(prevPanels => 
        prevPanels.map(panel => {
          if (panel.id === dragInfo.panelId) {
            return {
              ...panel,
              x: panel.x + deltaX,
              y: panel.y + deltaY
            }
          }
          return panel
        })
      )
      
      setDragInfo({
        ...dragInfo,
        startX: x,
        startY: y
      })
      return
    }
    
    // Handle tooltip detection
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale + position.x / scale
    const y = (e.clientY - rect.top) / scale + position.y / scale
    
    // Find hovered panel for tooltip
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i]
      if (x >= panel.x && x <= panel.x + panel.width &&
          y >= panel.y && y <= panel.y + panel.length) {
        const tooltipContent = `Panel: ${panel.panelNumber || 'N/A'}\nRoll: ${panel.rollNumber || 'N/A'}`;
        showTooltip(tooltipContent, e.clientX, e.clientY);
        return;
      }
    }
    
    // Hide tooltip if not hovering over any panel
    hideTooltip();
  }, [dragInfo, scale, position, panels, showTooltip, hideTooltip])

  // Optimized canvas mouse up handler
  const handleCanvasMouseUp = useCallback(() => {
    setDragInfo({
      isDragging: false,
      panelId: null,
      startX: 0,
      startY: 0
    })
  }, [])

  // Optimized canvas mouse leave handler
  const handleCanvasMouseLeave = useCallback(() => {
    setDragInfo({
      isDragging: false,
      panelId: null,
      startX: 0,
      startY: 0
    })
  }, [])

  // Optimized panel management functions
  const handleAddPanel = useCallback(() => {
    const newPanel: Panel = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      panelNumber: `P${panels.length + 1}`,
      length: 100,
      width: 40,
      rollNumber: `R-${100 + panels.length + 1}`,
      location: 'Auto-generated',
      x: 50 + (panels.length * 20),
      y: 50 + (panels.length * 15),
      shape: 'rectangle',
      rotation: 0,
      fill: '#E3F2FD',
      color: '#E3F2FD'
    }
    setPanels([...panels, newPanel])
  }, [panels])

  const handleDeletePanel = useCallback(() => {
    if (selectedPanelId) {
      setPanels(panels.filter(panel => panel.id !== selectedPanelId))
      setSelectedPanelId(null)
    }
  }, [selectedPanelId, panels])

  const handleReset = useCallback(() => {
    setPanels([])
    setSelectedPanelId(null)
    reset()
  }, [reset])

  const handleExportToDXF = useCallback(() => {
    exportToDXF(panels, projectInfo)
  }, [panels, projectInfo])

  // Memoized fit to content function
  const handleFitToContent = useCallback(() => {
    if (panels.length === 0) {
      fitToContent()
      return
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    panels.forEach(panel => {
      minX = Math.min(minX, panel.x)
      minY = Math.min(minY, panel.y)
      maxX = Math.max(maxX, panel.x + panel.width)
      maxY = Math.max(maxY, panel.y + panel.length)
    })
    
    fitToContent({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, 40)
  }, [panels, fitToContent])

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-3/4 bg-white p-4 rounded-lg shadow-md">
          <div className="flex justify-between mb-4">
            <div className="flex gap-2">
              <Button onClick={() => zoomIn()}>Zoom +</Button>
              <Button onClick={() => zoomOut()}>Zoom -</Button>
              <Button onClick={handleFitToContent}>Fit</Button>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAddPanel}
              >
                Add Panel
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDeletePanel}
                disabled={!selectedPanelId}
              >
                Delete Panel
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportToDXF}
                disabled={panels.length === 0}
              >
                Export DXF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
              >
                Reset
              </Button>
            </div>
          </div>
          
          <div 
            ref={containerRef}
            style={{ 
              border: '1px solid #ccc', 
              overflow: 'hidden', 
              height: '600px',
              position: 'relative',
              backgroundColor: '#f0f0f0'
            }}
            onWheel={(e) => handleWheel(e.nativeEvent)}
            onMouseMove={onMouseMove}
          >
            <canvas
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              style={{
                cursor: dragInfo.isDragging ? 'grabbing' : selectedPanelId ? 'grab' : 'default',
                touchAction: 'none'
              }}
            />
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p>Selected Panel: {selectedPanelId || 'None'}</p>
            <p>Scale: {scale.toFixed(2)}x</p>
            <p>Position: ({Math.round(position.x)}, {Math.round(position.y)})</p>
            <p>Panels: {panels.length}</p>
          </div>
        </div>
        
        <div className="w-full md:w-1/4 bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Panel List</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {panels.map(panel => (
              <div
                key={panel.id}
                className={`p-2 border rounded cursor-pointer ${
                  selectedPanelId === panel.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => setSelectedPanelId(panel.id)}
              >
                <div className="font-medium">{panel.panelNumber}</div>
                <div className="text-sm text-gray-600">{panel.rollNumber}</div>
                <div className="text-xs text-gray-500">
                  {panel.width} × {panel.length} at ({Math.round(panel.x)}, {Math.round(panel.y)})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tooltip component */}
      <TooltipComponent />
    </>
  )
}

// Utility function to generate pastel colors
function generatePastelColor() {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 70%, 80%)`
}