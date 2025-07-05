'use client'

import { useState, useRef, useEffect } from 'react'
import { useZoomPan } from '@/hooks/use-zoom-pan'
import { Button } from '@/components/ui/button'
import { parseExcelPanels, generateTemplateFile } from '@/lib/excel-import'
import { exportToDXF, exportToJSON } from '@/lib/dxf-helpers'
import { saveAs } from 'file-saver'

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

interface Panel {
  id: string
  date: string
  panelNumber: string
  length: number
  width: number
  rollNumber: string
  location: string
  x: number
  y: number
  shape: 'rectangle' | 'triangle' | 'circle'
  points?: number[]
  radius?: number
  rotation: number
  color: string
}

export default function SimplePanelLayout({ mode, projectInfo }: PanelLayoutProps) {
  const [panels, setPanels] = useState<Panel[]>([])
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragInfo, setDragInfo] = useState<{ isDragging: boolean, panelId: string | null, startX: number, startY: number }>({
    isDragging: false,
    panelId: null,
    startX: 0,
    startY: 0
  })

  // Use the new zoom/pan hook
  const {
    scale,
    position,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomToFit,
    setScale,
    setPosition,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isPanning,
  } = useZoomPan({
    minScale: 0.1,
    maxScale: 3.0,
    initialScale: 1.0,
    initialPosition: { x: 0, y: 0 },
    containerWidth: dimensions.width,
    containerHeight: dimensions.height,
  });

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
          color: '#BBDEFB'
        }
      ])
    }
  }, [mode])

  useEffect(() => {
    // Draw the panel layout whenever panels change
    drawPanelLayout()
  }, [panels, selectedPanelId, scale])

  const drawPanelLayout = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Apply scaling
    ctx.save()
    ctx.scale(scale, scale)
    
    // Draw grid
    drawGrid(ctx)
    
    // Draw panels
    panels.forEach(panel => {
      drawPanel(ctx, panel, panel.id === selectedPanelId)
    })
    
    // Restore canvas state
    ctx.restore()
  }

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = 20
    const width = dimensions.width
    const height = dimensions.height
    
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 0.5
    
    // Draw vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    
    // Draw axes
    ctx.strokeStyle = '#999'
    ctx.lineWidth = 2
    
    // X-axis
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(width, 0)
    ctx.stroke()
    
    // Y-axis
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, height)
    ctx.stroke()
    
    // Draw axis labels
    ctx.fillStyle = '#666'
    ctx.font = '12px Arial'
    
    // X-axis labels
    for (let x = 0; x <= width; x += 100) {
      ctx.fillText(`${x}'`, x + 5, 15)
    }
    
    // Y-axis labels
    for (let y = 0; y <= height; y += 100) {
      ctx.fillText(`${y}'`, 5, y + 15)
    }
  }

  const drawPanel = (ctx: CanvasRenderingContext2D, panel: Panel, isSelected: boolean) => {
    const { x, y, width, length, panelNumber, shape, color } = panel
    
    // Set styles
    ctx.fillStyle = color
    ctx.strokeStyle = isSelected ? '#0052cc' : '#666'
    ctx.lineWidth = isSelected ? 2 : 1
    
    // Draw based on shape
    if (shape === 'rectangle') {
      // Draw rectangle
      ctx.beginPath()
      ctx.rect(x, y, width, length)
      ctx.fill()
      ctx.stroke()
      
      // Draw panel number
      ctx.fillStyle = '#333'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(
        panelNumber,
        x + width / 2 - ctx.measureText(panelNumber).width / 2,
        y + length / 2 + 6
      )
    } 
    else if (shape === 'circle' && panel.radius) {
      // Draw circle
      ctx.beginPath()
      ctx.arc(x, y, panel.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      
      // Draw panel number
      ctx.fillStyle = '#333'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(
        panelNumber,
        x - ctx.measureText(panelNumber).width / 2,
        y + 6
      )
    }
    else if (shape === 'triangle' && panel.points && panel.points.length >= 6) {
      // Draw triangle
      ctx.beginPath()
      ctx.moveTo(panel.points[0], panel.points[1])
      ctx.lineTo(panel.points[2], panel.points[3])
      ctx.lineTo(panel.points[4], panel.points[5])
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      
      // Calculate centroid for the panel number
      const xCoords = panel.points.filter((_, i) => i % 2 === 0)
      const yCoords = panel.points.filter((_, i) => i % 2 === 1)
      
      const centroidX = xCoords.reduce((sum, x) => sum + x, 0) / xCoords.length
      const centroidY = yCoords.reduce((sum, y) => sum + y, 0) / yCoords.length
      
      // Draw panel number
      ctx.fillStyle = '#333'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(
        panelNumber,
        centroidX - ctx.measureText(panelNumber).width / 2,
        centroidY + 6
      )
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
    // Check if we clicked on a panel
    let clickedPanelId: string | null = null
    
    // Check in reverse order so we select the top-most panel
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i]
      
      if (panel.shape === 'rectangle') {
        if (
          x >= panel.x && 
          x <= panel.x + panel.width && 
          y >= panel.y && 
          y <= panel.y + panel.length
        ) {
          clickedPanelId = panel.id
          break
        }
      }
      else if (panel.shape === 'circle' && panel.radius) {
        const distance = Math.sqrt(Math.pow(x - panel.x, 2) + Math.pow(y - panel.y, 2))
        if (distance <= panel.radius) {
          clickedPanelId = panel.id
          break
        }
      }
      else if (panel.shape === 'triangle' && panel.points) {
        // Triangle hit detection using point-in-triangle algorithm
        // For simplicity, using bounding box check first
        const xCoords = panel.points.filter((_, i) => i % 2 === 0)
        const yCoords = panel.points.filter((_, i) => i % 2 === 1)
        
        const minX = Math.min(...xCoords)
        const maxX = Math.max(...xCoords)
        const minY = Math.min(...yCoords)
        const maxY = Math.max(...yCoords)
        
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          clickedPanelId = panel.id
          break
        }
      }
    }
    
    setSelectedPanelId(clickedPanelId === selectedPanelId ? null : clickedPanelId)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedPanelId) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
    setDragInfo({
      isDragging: true,
      panelId: selectedPanelId,
      startX: x,
      startY: y
    })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragInfo.isDragging || !dragInfo.panelId) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
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
  }

  const handleCanvasMouseUp = () => {
    setDragInfo({
      isDragging: false,
      panelId: null,
      startX: 0,
      startY: 0
    })
  }

  const handleCanvasMouseLeave = () => {
    setDragInfo({
      isDragging: false,
      panelId: null,
      startX: 0,
      startY: 0
    })
  }

  const handleDeletePanel = () => {
    if (selectedPanelId) {
      setPanels(panels.filter(panel => panel.id !== selectedPanelId))
      setSelectedPanelId(null)
    }
  }

  const handleCreatePanel = (panel: Omit<Panel, 'id' | 'x' | 'y' | 'rotation' | 'color'>) => {
    const newPanel: Panel = {
      ...panel,
      id: Date.now().toString(),
      x: Math.random() * (dimensions.width - panel.width),
      y: Math.random() * (dimensions.height - panel.length),
      rotation: 0,
      color: generatePastelColor()
    }
    
    setPanels([...panels, newPanel])
    setIsCreateModalOpen(false)
    setSelectedPanelId(newPanel.id)
  }

  const handleZoomIn = () => {
    setScale(scale * 1.2)
  }

  const handleZoomOut = () => {
    setScale(scale / 1.2)
  }

  const handleFitToScale = () => {
    setScale(1)
  }

  const handleExportToDXF = () => {
    exportToDXF(panels, projectInfo)
  }

  const handleExportToJSON = () => {
    exportToJSON(panels, projectInfo)
  }

  const handleReset = () => {
    setPanels([])
    setSelectedPanelId(null)
    setScale(1)
  }

  const handleImportExcel = (file: File) => {
    parseExcelPanels(file)
      .then(panelRecords => {
        // Convert records to panels
        const newPanels = panelRecords.map((record, index) => {
          return {
            id: Date.now() + index.toString(),
            date: record.date,
            panelNumber: record.panelNumber,
            length: record.length,
            width: record.width,
            rollNumber: record.rollNumber,
            location: record.location,
            x: 50 + (index % 5) * 50,  // Layout in a grid
            y: 50 + Math.floor(index / 5) * 120,
            shape: 'rectangle' as const,
            rotation: 0,
            color: generatePastelColor()
          }
        })
        
        setPanels(newPanels)
      })
      .catch(error => {
        console.error('Failed to parse Excel file:', error)
        alert('Failed to parse Excel file: ' + error.message)
      })
  }

  // Simple panel create UI for demo (would be replaced by CreatePanelModal)
  const handleAddPanel = () => {
    const panelNumber = prompt('Enter Panel Number:')
    if (!panelNumber) return
    
    const length = parseInt(prompt('Enter Length (ft):', '100') || '100')
    const width = parseInt(prompt('Enter Width (ft):', '40') || '40')
    const rollNumber = prompt('Enter Roll Number:')
    const location = prompt('Enter Panel Location/Comment:')
    
    handleCreatePanel({
      date: new Date().toISOString().slice(0, 10),
      panelNumber,
      length,
      width,
      rollNumber: rollNumber || '',
      location: location || '',
      shape: 'rectangle'
    })
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="w-full md:w-3/4 bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              Zoom +
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              Zoom -
            </Button>
            <Button variant="outline" size="sm" onClick={handleFitToScale}>
              Fit
            </Button>
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
          style={{ 
            border: '1px solid #ccc', 
            overflow: 'hidden', 
            height: '600px',
            position: 'relative',
            backgroundColor: '#f0f0f0'
          }}
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
              width: '100%',
              height: '100%',
              cursor: dragInfo.isDragging ? 'grabbing' : (selectedPanelId ? 'grab' : 'default')
            }}
          />
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
          <h3 className="text-lg font-bold mb-2">Instructions</h3>
          <ul className="space-y-1 text-sm">
            <li>• Click <strong>Add Panel</strong> to create a new panel</li>
            <li>• Click on a panel to select it</li>
            <li>• Drag selected panels to reposition them</li>
            <li>• Click <strong>Export DXF</strong> to save for CAD software</li>
            <li>• Use <strong>Zoom</strong> controls to adjust view</li>
          </ul>
          
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Import from Excel</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="text-sm"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImportExcel(e.target.files[0])
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const templateBlob = generateTemplateFile()
                  saveAs(templateBlob, 'panel_template.xlsx')
                }}
              >
                Get Template
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Utility function to generate pastel colors
function generatePastelColor() {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 70%, 80%)`
}