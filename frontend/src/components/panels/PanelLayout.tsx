'use client'

import { useState, useRef, useEffect } from 'react'
import { useZoomPan } from '@/hooks/use-zoom-pan'
import { Button } from '@/components/ui/button'
import CreatePanelModal from './CreatePanelModal'
import PanelAIChat from './PanelAIChat'
import { parseExcelPanels, generateTemplateFile } from '@/lib/excel-import'
import { exportToDXF, exportToJSON } from '@/lib/dxf-helpers'
import { saveAs } from 'file-saver'
import { Stage, Layer, Rect } from 'react-konva'
import { Line, Text, Circle } from 'react-konva/lib/ReactKonvaCore'
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

export default function PanelLayout({ mode, projectInfo }: PanelLayoutProps) {
  const [panels, setPanels] = useState<Panel[]>([])
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [isMounted, setIsMounted] = useState(false)
  const stageRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use the unified zoom/pan hook
  const {
    scale,
    position,
    setScale,
    setPosition,
    zoomIn,
    zoomOut,
    fitToContent,
    handleWheel,
    onMouseMove,
    reset,
  } = useZoomPan();

  useEffect(() => {
    setIsMounted(true)
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
    // Compute the center of the viewport in world coordinates
    const centerX = (dimensions.width / 2 - position.x) / scale;
    const centerY = (dimensions.height / 2 - position.y) / scale;
    const fill = panel.fill || panel.color || '#3b82f6';
    const newPanel: Panel = {
      ...panel,
      id: Date.now().toString(),
      x: centerX - panel.width / 2,
      y: centerY - panel.length / 2,
      rotation: 0,
      fill,
      color: fill
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

  const handleDragEnd = (id: string, x: number, y: number) => {
    setPanels(
      panels.map(panel => {
        if (panel.id === id) {
          return { ...panel, x, y }
        }
        return panel
      })
    )
  }

  const handleReset = () => {
    setPanels([])
    setSelectedPanelId(null)
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleExportToDXF = () => {
    exportToDXF(panels, projectInfo)
  }

  const grid = []
  const gridSize = 20
  const gridWidth = dimensions.width * 5
  const gridHeight = dimensions.height * 5
  
  // Create the grid lines
  for (let i = 0; i < gridWidth; i += gridSize) {
    grid.push(
      <Line
        key={`v${i}`}
        points={[i, 0, i, gridHeight]}
        stroke="#ddd"
        strokeWidth={1}
      />
    )
  }
  
  for (let i = 0; i < gridHeight; i += gridSize) {
    grid.push(
      <Line
        key={`h${i}`}
        points={[0, i, gridWidth, i]}
        stroke="#ddd"
        strokeWidth={1}
      />
    )
  }

  console.log('DEBUG: panels', panels)

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="w-full md:w-3/4 bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            <Button onClick={() => zoomIn()}>Zoom +</Button>
            <Button onClick={() => zoomOut()}>Zoom -</Button>
            <Button onClick={() => {
              if (panels.length === 0) return fitToContent();
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              panels.forEach(panel => {
                minX = Math.min(minX, panel.x);
                minY = Math.min(minY, panel.y);
                maxX = Math.max(maxX, panel.x + (panel.width || 0));
                maxY = Math.max(maxY, panel.y + (panel.length || 0));
              });
              fitToContent({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, 40);
            }}>
              Fit to Scale
            </Button>
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
          style={{ 
            border: '1px solid #ccc', 
            overflow: 'hidden', 
            height: '600px',
            position: 'relative',
            backgroundColor: '#f0f0f0'
          }}
        >
          {isMounted && <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            onWheel={(e: import('konva/lib/Node').KonvaEventObject<WheelEvent>) => {
              if (containerRef.current) {
                handleWheel(e.evt, containerRef.current.getBoundingClientRect());
              }
            }}
          >
            <Layer>
              {grid}
              
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
              
              {/* Panels */}
              {panels.map((panel) => {
                const isSelected = panel.id === selectedPanelId
                
                if (panel.shape === 'rectangle') {
                  return (
                    <Rect
                      key={panel.id}
                      x={panel.x}
                      y={panel.y}
                      width={panel.width}
                      height={panel.length}
                      fill={panel.fill}
                      stroke={isSelected ? '#0052cc' : '#666'}
                      strokeWidth={isSelected ? 2 : 1}
                      rotation={panel.rotation}
                      draggable
                      onClick={() => handlePanelSelect(panel.id)}
                      onTap={() => handlePanelSelect(panel.id)}
                      onDragEnd={(e: any) => {
                        handleDragEnd(panel.id, e.target.x(), e.target.y())
                      }}
                    />
                  )
                } else if (panel.shape === 'triangle' && panel.points && panel.points.length >= 6) {
                  return (
                    <Line
                      key={panel.id}
                      points={[...panel.points, panel.points[0], panel.points[1]]} // Close the triangle
                      fill={panel.fill}
                      stroke={isSelected ? '#0052cc' : '#666'}
                      strokeWidth={isSelected ? 2 : 1}
                      closed={true}
                      draggable
                      onClick={() => handlePanelSelect(panel.id)}
                      onTap={() => handlePanelSelect(panel.id)}
                      onDragEnd={(e) => {
                        handleDragEnd(panel.id, e.target.x(), e.target.y())
                      }}
                    />
                  )
                } else if (panel.shape === 'circle' && panel.radius) {
                  return (
                    <Circle
                      key={panel.id}
                      x={panel.x}
                      y={panel.y}
                      radius={panel.radius}
                      fill={panel.fill}
                      stroke={isSelected ? '#0052cc' : '#666'}
                      strokeWidth={isSelected ? 2 : 1}
                      draggable
                      onClick={() => handlePanelSelect(panel.id)}
                      onTap={() => handlePanelSelect(panel.id)}
                      onDragEnd={(e) => {
                        handleDragEnd(panel.id, e.target.x(), e.target.y())
                      }}
                    />
                  )
                }
                
                return null
              })}
              
              {/* Panel labels */}
              {panels.map((panel) => (
                <Text
                  key={`label-${panel.id}`}
                  x={panel.x + (panel.width / 2) - 20}
                  y={panel.y + (panel.length / 2) - 10}
                  text={panel.panelNumber}
                  fontSize={16}
                  fontStyle="bold"
                  fill="#333"
                />
              ))}
            </Layer>
          </Stage>}
        </div>
      </div>
      
      <div className="w-full md:w-1/4">
        <div className="bg-white p-4 rounded-lg shadow-md mb-4">
          <h3 className="text-lg font-bold mb-2">Panel Information</h3>
          {selectedPanelId ? (
            <div>
              {panels.filter(p => p.id === selectedPanelId).map(panel => (
                <div key={panel.id} className="space-y-2">
                  <div>
                    <span className="font-medium">Panel #:</span> {panel.panelNumber}
                  </div>
                  <div>
                    <span className="font-medium">Length:</span> {panel.length} ft
                  </div>
                  <div>
                    <span className="font-medium">Width:</span> {panel.width} ft
                  </div>
                  <div>
                    <span className="font-medium">Roll Number:</span> {panel.rollNumber}
                  </div>
                  <div>
                    <span className="font-medium">Location:</span> {panel.location}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {panel.date}
                  </div>
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedPanelId(null)}
                    >
                      Deselect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">
              {panels.length > 0 
                ? "Select a panel to view details" 
                : "No panels added yet"}
            </div>
          )}
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-bold mb-2">AI Assistant</h3>
          <PanelAIChat 
            projectInfo={projectInfo} 
            panels={panels} 
            setPanels={setPanels}
          />
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