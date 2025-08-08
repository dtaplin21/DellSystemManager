'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useZoomPan } from '@/hooks/use-zoom-pan'
import { Button } from '@/components/ui/button'
import CreatePanelModal from './CreatePanelModal'
import PanelAIChat from './PanelAIChat'
import { exportToDXF } from '@/lib/dxf-helpers'
import { Stage, Layer, Rect, Line as KLine, Group, Text } from 'react-konva'
import type { Panel } from '../../types/panel'
import PanelSidebar from '@/components/panel-layout/panel-sidebar'
import { GRID_CELL_SIZE_FT, WORLD_WIDTH_FT, WORLD_HEIGHT_FT, SNAP_THRESHOLD_FT } from '@/components/panel-layout/panel-grid'

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

export default function PanelLayout({ mode, projectInfo }: PanelLayoutProps) {
  const [panels, setPanels] = useState<Panel[]>([])
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [isMounted, setIsMounted] = useState(false)
  const stageRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use the unified zoom/pan hook
  const { scale, x, y, onWheel, onDragStart, onDragMove, onDragEnd, zoomIn, zoomOut, fitToExtent, setViewportSize, toWorld } = useZoomPan({
    worldWidth: WORLD_WIDTH_FT,
    worldHeight: WORLD_HEIGHT_FT,
    viewportWidth: containerSize.width,
    viewportHeight: containerSize.height,
    initialFit: 'extent',
  })

  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const update = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      const w = Math.max(100, Math.floor(rect.width))
      const h = Math.max(100, Math.floor(rect.height))
      setContainerSize({ width: w, height: h })
      setViewportSize(w, h)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    // Initialize with some sample panels in auto mode
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
  }, [mode])

  const handlePanelSelect = (panelId: string) => {
    setSelectedPanelId(panelId === selectedPanelId ? null : panelId)
  }

  const handleCreatePanel = (panel: any) => {
    const center = { x: containerSize.width / 2, y: containerSize.height / 2 }
    const world = toWorld(center)
    const fill = panel.fill || panel.color || '#3b82f6';
    const newPanel: Panel = {
      id: Date.now().toString(),
      shape: panel.shape ?? 'rectangle',
      x: world.x - (panel.width ?? 40) / 2,
      y: world.y - (panel.length ?? 100) / 2,
      width: panel.width ?? 40,
      height: panel.length ?? 100,
      rotation: 0,
      fill,
      color: fill,
      meta: { repairs: [], location: { x: world.x, y: world.y } },
      panelNumber: panel.panelNumber,
    }
    setPanels([...panels, newPanel])
    setIsCreateModalOpen(false)
    setSelectedPanelId(newPanel.id)
  }

  const handleDeletePanel = () => {
    if (selectedPanelId) {
      setPanels(panels.filter(panel => panel.id !== selectedPanelId))
      setSelectedPanelId(null)
    }
  }

  const snapValue = (v: number) => Math.round(v / GRID_CELL_SIZE_FT) * GRID_CELL_SIZE_FT
  const computeNeighborSnap = (dragId: string, nx: number, ny: number, width: number, height: number) => {
    let bestX = nx
    let bestY = ny
    let bestDx = SNAP_THRESHOLD_FT + 1
    let bestDy = SNAP_THRESHOLD_FT + 1
    panels.forEach(nei => {
      if (nei.id === dragId) return
      const nLeft = nei.x
      const nRight = nei.x + (nei.width ?? 0)
      const nTop = nei.y
      const nBottom = nei.y + (nei.height ?? nei.length ?? 0)
      const dLeft = Math.abs(nx - nRight)
      if (dLeft < bestDx && dLeft <= SNAP_THRESHOLD_FT) { bestDx = dLeft; bestX = nRight }
      const dRight = Math.abs(nx + width - nLeft)
      if (dRight < bestDx && dRight <= SNAP_THRESHOLD_FT) { bestDx = dRight; bestX = nLeft - width }
      const dTop = Math.abs(ny - nBottom)
      if (dTop < bestDy && dTop <= SNAP_THRESHOLD_FT) { bestDy = dTop; bestY = nBottom }
      const dBottom = Math.abs(ny + height - nTop)
      if (dBottom < bestDy && dBottom <= SNAP_THRESHOLD_FT) { bestDy = dBottom; bestY = nTop - height }
    })
    return { x: bestX, y: bestY }
  }
  const handleDragEnd = (id: string, nx: number, ny: number) => {
    const dragged = panels.find(p => p.id === id)
    const width = dragged?.width ?? 0
    const height = dragged?.height ?? dragged?.length ?? 0
    let sx = snapValue(nx)
    let sy = snapValue(ny)
    const nSnap = computeNeighborSnap(id, nx, ny, width, height)
    if (Math.abs(nSnap.x - nx) <= SNAP_THRESHOLD_FT) sx = nSnap.x
    if (Math.abs(nSnap.y - ny) <= SNAP_THRESHOLD_FT) sy = nSnap.y
    setPanels(prev => prev.map(panel => panel.id === id ? { ...panel, x: sx, y: sy, meta: { ...panel.meta, location: { x: sx, y: sy } } } : panel))
  }

  const handleReset = () => { setPanels([]); setSelectedPanelId(null); fitToExtent() }

  const handleExportToDXF = () => {
    exportToDXF(panels, projectInfo)
  }

  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = []
    for (let gx = 0; gx <= WORLD_WIDTH_FT; gx += GRID_CELL_SIZE_FT) {
      lines.push(<KLine key={`gv-${gx}`} points={[gx, 0, gx, WORLD_HEIGHT_FT]} stroke="#e5e7eb" strokeWidth={1} listening={false} />)
    }
    for (let gy = 0; gy <= WORLD_HEIGHT_FT; gy += GRID_CELL_SIZE_FT) {
      lines.push(<KLine key={`gh-${gy}`} points={[0, gy, WORLD_WIDTH_FT, gy]} stroke="#e5e7eb" strokeWidth={1} listening={false} />)
    }
    return lines
  }, [])

  console.log('DEBUG: panels', panels)

  return (
    <div className="flex flex-row gap-0 w-full">
      <PanelSidebar panel={panels.find(p => p.id === selectedPanelId) || null} onClose={() => setSelectedPanelId(null)} />
      <div className="flex-1 bg-white p-4 rounded-lg shadow-md ml-[360px]">
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            <Button onClick={() => zoomIn()}>Zoom +</Button>
            <Button onClick={() => zoomOut()}>Zoom -</Button>
            <Button onClick={() => fitToExtent()}>Fit</Button>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsCreateModalOpen(true)}
            >
              Add Panel
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
        <div ref={containerRef} className="relative border border-neutral-300 bg-[#f7f7f7]" style={{ height: 600 }}>
          {isMounted && <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            scaleX={scale}
            scaleY={scale}
            x={x}
            y={y}
            onWheel={onWheel}
            onDblClick={onDoubleClick}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
          >
            <Layer>
              {gridLines}
              
              {/* X and Y axis indicators */}
              <Line
                points={[0, 0, 5000, 0]}
                stroke="#999"
                strokeWidth={2}
              />
              <Line
                points={[0, 0, 0, 5000]}
                stroke="#999"
                strokeWidth={2}
              />
              
              {/* X-axis labels */}
              {Array.from({ length: Math.floor(gridWidth / 100) + 1 }).map((_, i) => (
                <Text
                  key={`x-label-${i}`}
                  x={i * 100}
                  y={10}
                  text={`${i * 100}'`}
                  fontSize={14}
                  fill="#666"
                />
              ))}
              
              {/* Y-axis labels */}
              {Array.from({ length: Math.floor(gridHeight / 100) + 1 }).map((_, i) => (
                <Text
                  key={`y-label-${i}`}
                  x={10}
                  y={i * 100}
                  text={`${i * 100}'`}
                  fontSize={14}
                  fill="#666"
                />
              ))}
              
              {/* Panels (fixed-size; drag + snap only) */}
              {panels.map((panel) => {
                const isSelected = panel.id === selectedPanelId
                const width = panel.width ?? 0
                const height = panel.height ?? panel.length ?? 0
                if (panel.shape === 'rectangle' || panel.shape === 'square') {
                  return (
                    <Group key={panel.id}>
                      <Rect
                        x={panel.x}
                        y={panel.y}
                        width={width}
                        height={height}
                        fill={panel.fill}
                        stroke={isSelected ? '#0052cc' : '#666'}
                        strokeWidth={isSelected ? 2 : 1}
                        rotation={panel.rotation}
                        draggable
                        onClick={() => handlePanelSelect(panel.id)}
                        onTap={() => handlePanelSelect(panel.id)}
                        onDragEnd={(e: any) => handleDragEnd(panel.id, e.target.x(), e.target.y())}
                      />
                      <Text
                        x={panel.x + width / 2}
                        y={panel.y + height / 2}
                        text={panel.panelNumber ?? panel.id}
                        fontSize={Math.max(10, 16 / scale)}
                        fill="#333"
                        offsetX={(panel.panelNumber ?? panel.id).length * (Math.max(10, 16 / scale)) * 0.3}
                        offsetY={Math.max(10, 16 / scale) / 2}
                        listening={false}
                      />
                    </Group>
                  )
                }
                return null
              })}
            </Layer>
          </Stage>}
        </div>
      </div>
      
      <div className="w-[360px] p-4">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-bold mb-2">AI Assistant</h3>
          <PanelAIChat projectInfo={projectInfo} panels={panels} setPanels={setPanels} />
        </div>
      </div>
      
      {isCreateModalOpen && (
        <CreatePanelModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreatePanel={handleCreatePanel}
        />
      )}
    </div>
  )
}

// Utility function to generate pastel colors
function generatePastelColor() {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 70%, 80%)`
}