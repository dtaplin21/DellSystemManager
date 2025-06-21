'use client';

import { useState, useRef, useEffect } from 'react';
import { useProjects } from '@/contexts/ProjectsProvider';
import NoProjectSelected from '@/components/ui/no-project-selected';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

interface Panel {
  id: string;
  rollNumber: string;
  panelNumber: string;
  width: number;
  length: number;
  shape: string;
  x: number;
  y: number;
  color: string;
  rotation?: number;
  material?: string;
  thickness?: number;
}

interface DragInfo {
  isDragging: boolean;
  startX: number;
  startY: number;
  panelId: string | null;
  isResizing: boolean;
  resizeHandle: string | null;
  offsetX: number;
  offsetY: number;
}

interface PanelLayoutSettings {
  gridSize: number;
  containerWidth: number;
  containerHeight: number;
  snapToGrid: boolean;
  scale: number;
  units: 'ft' | 'm';
}

export default function PanelPlaygroundPage() {
  const { selectedProjectId, selectedProject } = useProjects();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [rollNumber, setRollNumber] = useState('');
  const [panelNumber, setPanelNumber] = useState('');
  const [dimensions, setDimensions] = useState({ width: 15, length: 100 });
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [dragInfo, setDragInfo] = useState<DragInfo>({
    isDragging: false,
    startX: 0,
    startY: 0,
    panelId: null,
    isResizing: false,
    resizeHandle: null,
    offsetX: 0,
    offsetY: 0,
  });
  
  const [settings, setSettings] = useState<PanelLayoutSettings>({
    gridSize: 20,
    containerWidth: 2000,
    containerHeight: 1500,
    snapToGrid: true,
    scale: 1,
    units: 'ft'
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Project selection guard
  if (!selectedProjectId || !selectedProject) {
    return <NoProjectSelected message="Select a project to access the panel playground." />;
  }

  // Load panels from selected project
  useEffect(() => {
    if (selectedProject?.panels) {
      // Convert project panels to playground format
      const playgroundPanels: Panel[] = selectedProject.panels.map((panel: any) => ({
        id: panel.id,
        rollNumber: panel.roll_number || '',
        panelNumber: panel.panel_number || '',
        width: panel.width_feet || panel.width || 15,
        length: panel.height_feet || panel.length || 100,
        shape: panel.type || 'rectangle',
        x: panel.x || 0,
        y: panel.y || 0,
        color: panel.fill || '#3b82f6',
        rotation: panel.rotation || 0,
        material: panel.material || '',
        thickness: panel.thickness || 0
      }));
      setPanels(playgroundPanels);
    }
  }, [selectedProject]);

  useEffect(() => {
    drawCanvas();
  }, [panels, scale, settings, selectedPanel]);

  // Snap to grid utility function
  const snapToGrid = (value: number, gridSize: number): number => {
    return Math.round(value / gridSize) * gridSize;
  };

  // Mouse event handlers for drag and drop
  const handleMouseDown = (e: React.MouseEvent, panelId: string, isResizeHandle = false, handle: string | null = null) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return;
    
    // Calculate offset within panel to maintain cursor position during drag
    const offsetX = mouseX - panel.x;
    const offsetY = mouseY - panel.y;
    
    setSelectedPanel(panelId);
    setDragInfo({
      isDragging: true,
      startX: mouseX,
      startY: mouseY,
      panelId,
      isResizing: isResizeHandle,
      resizeHandle: handle,
      offsetX,
      offsetY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragInfo.isDragging || !dragInfo.panelId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    
    setPanels(prevPanels => {
      const newPanels = [...prevPanels];
      const panelIndex = newPanels.findIndex(p => p.id === dragInfo.panelId);
      if (panelIndex === -1) return prevPanels;
      
      const panel = { ...newPanels[panelIndex] };
      
      if (dragInfo.isResizing && dragInfo.resizeHandle) {
        // Handle resizing
        const deltaX = mouseX - dragInfo.startX;
        const deltaY = mouseY - dragInfo.startY;
        
        switch (dragInfo.resizeHandle) {
          case 'se':
            panel.width = Math.max(20, panel.width + deltaX / 5);
            panel.length = Math.max(20, panel.length + deltaY / 2);
            break;
          case 'sw':
            const newWidth = Math.max(20, panel.width - deltaX / 5);
            panel.x += (panel.width - newWidth) * 5;
            panel.width = newWidth;
            panel.length = Math.max(20, panel.length + deltaY / 2);
            break;
          case 'ne':
            panel.width = Math.max(20, panel.width + deltaX / 5);
            const newLength = Math.max(20, panel.length - deltaY / 2);
            panel.y += (panel.length - newLength) * 2;
            panel.length = newLength;
            break;
          case 'nw':
            const newWidthNW = Math.max(20, panel.width - deltaX / 5);
            const newLengthNW = Math.max(20, panel.length - deltaY / 2);
            panel.x += (panel.width - newWidthNW) * 5;
            panel.y += (panel.length - newLengthNW) * 2;
            panel.width = newWidthNW;
            panel.length = newLengthNW;
            break;
        }
        
        if (settings.snapToGrid) {
          panel.width = Math.round(panel.width);
          panel.length = Math.round(panel.length);
        }
      } else {
        // Handle dragging
        let newX = mouseX - dragInfo.offsetX;
        let newY = mouseY - dragInfo.offsetY;
        
        if (settings.snapToGrid) {
          newX = snapToGrid(newX, settings.gridSize);
          newY = snapToGrid(newY, settings.gridSize);
        }
        
        // Keep within bounds
        newX = Math.max(0, Math.min(settings.containerWidth - panel.width * 5, newX));
        newY = Math.max(0, Math.min(settings.containerHeight - panel.length * 2, newY));
        
        panel.x = newX;
        panel.y = newY;
      }
      
      newPanels[panelIndex] = panel;
      return newPanels;
    });
  };

  const handleMouseUp = () => {
    setDragInfo({
      isDragging: false,
      startX: 0,
      startY: 0,
      panelId: null,
      isResizing: false,
      resizeHandle: null,
      offsetX: 0,
      offsetY: 0,
    });
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);

    // Draw grid
    ctx.strokeStyle = settings.snapToGrid ? '#e5e7eb' : '#f3f4f6';
    ctx.lineWidth = 1;
    const gridStep = settings.snapToGrid ? settings.gridSize : 50;
    
    for (let x = 0; x <= settings.containerWidth; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, settings.containerHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= settings.containerHeight; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(settings.containerWidth, y);
      ctx.stroke();
    }

    // Draw panels with enhanced styling
    panels.forEach(panel => {
      const isSelected = selectedPanel === panel.id;
      const panelWidth = panel.width * 5;
      const panelHeight = panel.length * 2;
      
      // Panel shadow
      if (isSelected) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
      }
      
      // Panel body
      ctx.fillStyle = panel.color;
      ctx.strokeStyle = isSelected ? '#f97316' : '#374151';
      ctx.lineWidth = isSelected ? 3 : 1;
      
      ctx.fillRect(panel.x, panel.y, panelWidth, panelHeight);
      ctx.strokeRect(panel.x, panel.y, panelWidth, panelHeight);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw resize handles for selected panel
      if (isSelected) {
        const handleSize = 8 / scale;
        ctx.fillStyle = '#f97316';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / scale;
        
        // Corner handles
        const handles = [
          { x: panel.x - handleSize/2, y: panel.y - handleSize/2, id: 'nw' },
          { x: panel.x + panelWidth - handleSize/2, y: panel.y - handleSize/2, id: 'ne' },
          { x: panel.x - handleSize/2, y: panel.y + panelHeight - handleSize/2, id: 'sw' },
          { x: panel.x + panelWidth - handleSize/2, y: panel.y + panelHeight - handleSize/2, id: 'se' },
        ];
        
        handles.forEach(handle => {
          ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
          ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });
      }
      
      // Draw labels
      ctx.fillStyle = '#000';
      ctx.font = `${12 / scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(panel.rollNumber, panel.x + panelWidth / 2, panel.y + panelHeight / 2 - 10 / scale);
      ctx.fillText(panel.panelNumber, panel.x + panelWidth / 2, panel.y + panelHeight / 2 + 5 / scale);
      ctx.fillText(`${panel.width}' × ${panel.length}'`, panel.x + panelWidth / 2, panel.y + panelHeight / 2 + 20 / scale);
    });

    ctx.restore();
  };

  const addPanel = () => {
    if (!rollNumber || !panelNumber) {
      alert('Please enter both roll number and panel number.');
      return;
    }

    const newPanel: Panel = {
      id: Date.now().toString(),
      rollNumber,
      panelNumber,
      width: dimensions.width,
      length: dimensions.length,
      shape: selectedShape,
      x: 50 + (panels.length * 20),
      y: 50 + (panels.length * 15),
      color: `hsl(${Math.random() * 360}, 70%, 80%)`
    };

    setPanels([...panels, newPanel]);
    setRollNumber('');
    setPanelNumber('');
  };

  const clearAllPanels = () => {
    setPanels([]);
    setSelectedPanel(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Check if clicking on resize handle first
    if (selectedPanel) {
      const panel = panels.find(p => p.id === selectedPanel);
      if (panel) {
        const handleSize = 8 / scale;
        const panelWidth = panel.width * 5;
        const panelHeight = panel.length * 2;
        
        const handles = [
          { x: panel.x - handleSize/2, y: panel.y - handleSize/2, id: 'nw' },
          { x: panel.x + panelWidth - handleSize/2, y: panel.y - handleSize/2, id: 'ne' },
          { x: panel.x - handleSize/2, y: panel.y + panelHeight - handleSize/2, id: 'sw' },
          { x: panel.x + panelWidth - handleSize/2, y: panel.y + panelHeight - handleSize/2, id: 'se' },
        ];
        
        for (const handle of handles) {
          if (x >= handle.x && x <= handle.x + handleSize && 
              y >= handle.y && y <= handle.y + handleSize) {
            handleMouseDown(e, selectedPanel, true, handle.id);
            return;
          }
        }
      }
    }

    // Check for panel selection
    const clickedPanel = panels.find(panel => 
      x >= panel.x && x <= panel.x + panel.width * 5 &&
      y >= panel.y && y <= panel.y + panel.length * 2
    );

    if (clickedPanel) {
      handleMouseDown(e, clickedPanel.id);
    } else {
      setSelectedPanel(null);
    }
  };

  const deleteSelectedPanel = () => {
    if (selectedPanel) {
      setPanels(panels.filter(panel => panel.id !== selectedPanel));
      setSelectedPanel(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel Layout Playground</h1>
            <p className="text-gray-600">Sandbox environment for testing panel designs</p>
          </div>
          <div className="text-sm text-gray-500">
            Draft mode - designs are not saved
          </div>
        </div>
      </div>
      
      <div className="flex gap-6 p-6">
        {/* Controls Panel */}
        <div className="w-80 bg-white rounded-lg shadow-md p-6 space-y-6">
          <h2 className="text-lg font-semibold">Panel Management</h2>
          
          {/* Layout Settings */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-medium mb-3">Layout Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="snap-grid" className="text-sm">Snap to Grid</Label>
                <Switch
                  id="snap-grid"
                  checked={settings.snapToGrid}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, snapToGrid: checked }))
                  }
                />
              </div>
              
              <div>
                <Label className="text-sm">Grid Size: {settings.gridSize}px</Label>
                <Slider
                  value={[settings.gridSize]}
                  onValueChange={(values) => 
                    setSettings(prev => ({ ...prev, gridSize: values[0] }))
                  }
                  max={50}
                  min={10}
                  step={5}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
          
          {/* Shape Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Panel Shape</label>
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              {['rectangle', 'triangle', 'hexagon'].map(shape => (
                <button
                  key={shape}
                  className={`flex-1 px-3 py-2 text-sm ${
                    selectedShape === shape
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedShape(shape)}
                >
                  {shape.charAt(0).toUpperCase() + shape.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Panel Identification */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Roll Number</label>
            <input
              type="text"
              placeholder="e.g. R-102"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Panel Number</label>
            <input
              type="text"
              placeholder="e.g. P-001"
              value={panelNumber}
              onChange={(e) => setPanelNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Dimensions */}
          {selectedShape === 'rectangle' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Dimensions</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Width (ft)</label>
                  <input
                    type="number"
                    value={dimensions.width}
                    onChange={(e) => setDimensions({...dimensions, width: parseFloat(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Length (ft)</label>
                  <input
                    type="number"
                    value={dimensions.length}
                    onChange={(e) => setDimensions({...dimensions, length: parseFloat(e.target.value) || 0})}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    min="1"
                    max="500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button onClick={addPanel} className="w-full bg-orange-500 hover:bg-orange-600">
              Add Panel
            </Button>
            <Button 
              onClick={deleteSelectedPanel} 
              variant="outline" 
              className="w-full"
              disabled={!selectedPanel}
            >
              Delete Selected
            </Button>
            <Button onClick={clearAllPanels} variant="outline" className="w-full">
              Clear All
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">Zoom: {Math.round(scale * 100)}%</label>
            <div className="flex gap-2">
              <Button 
                onClick={() => setScale(Math.max(0.25, scale - 0.25))} 
                variant="outline"
                size="sm"
              >
                -
              </Button>
              <Button 
                onClick={() => setScale(1)} 
                variant="outline"
                size="sm"
              >
                Reset
              </Button>
              <Button 
                onClick={() => setScale(Math.min(3, scale + 0.25))} 
                variant="outline"
                size="sm"
              >
                +
              </Button>
            </div>
          </div>

          {/* Panel List */}
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Panels ({panels.length})</h3>
            <div className="max-h-40 overflow-y-auto">
              {panels.map(panel => (
                <div 
                  key={panel.id} 
                  className={`p-2 mb-1 text-xs border rounded cursor-pointer ${
                    selectedPanel === panel.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedPanel(panel.id)}
                >
                  <div className="font-medium">{panel.rollNumber} - {panel.panelNumber}</div>
                  <div className="text-gray-600">{panel.width}' × {panel.length}'</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-white rounded-lg shadow-md p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Layout Viewer</h3>
          </div>
          <div className="border border-gray-300 rounded overflow-auto" style={{ height: '600px' }}>
            <canvas
              ref={canvasRef}
              width={settings.containerWidth}
              height={settings.containerHeight}
              className={`${dragInfo.isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
              onMouseDown={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}