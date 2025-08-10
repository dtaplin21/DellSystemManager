// WARNING: This playground is isolated. Do NOT share panel data with the main layout or backend.
// All panel state here is local and temporary.

'use client';
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect } from 'react';
import { useProjects } from '@/contexts/ProjectsProvider';
import { useZoomPan } from '@/hooks/use-zoom-pan';
import NoProjectSelected from '@/components/ui/no-project-selected';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import type { Panel } from '@/types/panel';
import { useTooltip } from '@/components/ui/tooltip';
import { applyPanelSnapping } from '@/lib/resize-utils';

type PanelShape = 'rectangle' | 'triangle' | 'right-triangle' | 'circle';

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
  const [selectedShape, setSelectedShape] = useState<PanelShape>('rectangle');
  const [rollNumber, setRollNumber] = useState('');
  const [panelNumber, setPanelNumber] = useState('');
  const [dimensions, setDimensions] = useState({ width: 15, length: 100 });
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
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

  // Remove hover state and add tooltip
  const { showTooltip, hideTooltip, TooltipComponent } = useTooltip();

  // Project selection guard
  if (!selectedProjectId || !selectedProject) {
    return <NoProjectSelected message="Select a project to access the panel playground." />;
  }

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Handle resize logic first
    if (dragInfo.isDragging && dragInfo.isResizing && dragInfo.panelId && dragInfo.resizeHandle) {
      const panel = panels.find(p => p.id === dragInfo.panelId);
      if (!panel) return;

      const deltaX = x - dragInfo.startX;
      const deltaY = y - dragInfo.startY;

      setPanels(prevPanels => 
        prevPanels.map(p => {
          if (p.id === dragInfo.panelId) {
            let newX = p.x;
            let newY = p.y;
            let newWidth = p.width;
            let newLength = p.length;

            // Calculate new dimensions based on resize handle
            switch (dragInfo.resizeHandle) {
              case 'nw':
                newX = p.x + deltaX;
                newY = p.y + deltaY;
                newWidth = p.width - deltaX;
                newLength = p.length - deltaY;
                break;
              case 'ne':
                newY = p.y + deltaY;
                newWidth = p.width + deltaX;
                newLength = p.length - deltaY;
                break;
              case 'sw':
                newX = p.x + deltaX;
                newWidth = p.width - deltaX;
                newLength = p.length + deltaY;
                break;
              case 'se':
                newWidth = p.width + deltaX;
                newLength = p.length + deltaY;
                break;
            }

            // Apply minimum size constraints
            newWidth = Math.max(1, newWidth);
            newLength = Math.max(1, newLength);

            // Apply grid snapping if enabled
            if (settings.snapToGrid) {
              newX = snapToGrid(newX, settings.gridSize);
              newY = snapToGrid(newY, settings.gridSize);
              newWidth = snapToGrid(newWidth, settings.gridSize);
              newLength = snapToGrid(newLength, settings.gridSize);
            }

            // Ensure panel stays within container bounds
            // Use actual panel dimensions for bounds checking (not scaled visual dimensions)
            newX = Math.max(0, Math.min(settings.containerWidth - newWidth, newX));
            newY = Math.max(0, Math.min(settings.containerHeight - newLength, newY));

            return {
              ...p,
              x: newX,
              y: newY,
              width: newWidth,
              length: newLength
            };
          }
          return p;
        })
      );

      setDragInfo(prev => ({
        ...prev,
        startX: x,
        startY: y
      }));
      return;
    }

    // Handle drag logic
    if (dragInfo.isDragging && dragInfo.panelId && !dragInfo.isResizing) {
      const deltaX = x - dragInfo.startX;
      const deltaY = y - dragInfo.startY;

      setPanels(prevPanels => 
        prevPanels.map(panel => {
          if (panel.id === dragInfo.panelId) {
            let newX = panel.x + deltaX;
            let newY = panel.y + deltaY;

            if (settings.snapToGrid) {
              newX = snapToGrid(newX, settings.gridSize);
              newY = snapToGrid(newY, settings.gridSize);
            }

            // Apply shape-aware panel-to-panel snapping
            const otherPanels = prevPanels.filter(p => p.id !== panel.id).map(p => ({
              id: p.id,
              x: p.x,
              y: p.y,
              width: p.width,
              height: p.length
            }));

            let snapResult;
            if (panel.shape === 'right-triangle') {
              snapResult = applyPanelSnapping(newX, newY, panel.width, panel.length, otherPanels, 4, 'right-triangle');
            } else {
              snapResult = applyPanelSnapping(newX, newY, panel.width, panel.length, otherPanels, 4, 'rectangle');
            }

            // Use snapped position if available, otherwise use calculated position
            newX = snapResult.x;
            newY = snapResult.y;

            // Ensure panel stays within container bounds during drag
            // Use actual panel dimensions for bounds checking
            newX = Math.max(0, Math.min(settings.containerWidth - panel.width, newX));
            newY = Math.max(0, Math.min(settings.containerHeight - panel.length, newY));

            return {
              ...panel,
              x: newX,
              y: newY
            };
          }
          return panel;
        })
      );

      setDragInfo(prev => ({
        ...prev,
        startX: x,
        startY: y
      }));
      return;
    }

    // Handle tooltip detection
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i];
      const panelWidth = panel.width * 5;
      const panelHeight = panel.length * 2;
      
      let isInside = false;
      
      if (panel.shape === 'right-triangle') {
        // Check if point is inside right triangle
        const x1 = panel.x, y1 = panel.y; // Top-left
        const x2 = panel.x + panelWidth, y2 = panel.y; // Top-right
        const x3 = panel.x, y3 = panel.y + panelHeight; // Bottom-left (right angle)
        
        // Use barycentric coordinates to check if point is inside triangle
        const denominator = ((y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3));
        const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denominator;
        const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denominator;
        const c = 1 - a - b;
        
        isInside = a >= 0 && b >= 0 && c >= 0;
      } else if (panel.shape === 'triangle') {
        // Check if point is inside equilateral triangle
        const centerX = panel.x + panelWidth / 2;
        const centerY = panel.y + panelHeight / 2;
        const radius = Math.min(panelWidth, panelHeight) / 2;
        
        // Check if point is within the triangle bounds
        const dx = Math.abs(x - centerX);
        const dy = Math.abs(y - centerY);
        const slope = Math.sqrt(3); // 60-degree angle
        
        isInside = dx <= radius && dy <= radius * slope / 2 && 
                   (dx + dy * slope) <= radius * slope;
      } else {
        // Default rectangular bounds check
        isInside = x >= panel.x && x <= panel.x + panelWidth &&
                   y >= panel.y && y <= panel.y + panelHeight;
      }
      
      if (isInside) {
        const tooltipContent = `Panel: ${panel.panelNumber}\nRoll: ${panel.rollNumber}\nSize: ${panel.width}' × ${panel.length}'`;
        showTooltip(tooltipContent, e.clientX, e.clientY);
        return;
      }
    }
    
    // Hide tooltip if not hovering over any panel
    hideTooltip();
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

    // Apply scale and translation
    ctx.scale(scale, scale);
    ctx.translate(position.x, position.y);

    // Draw grid
    if (settings.snapToGrid) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      for (let x = 0; x <= settings.containerWidth; x += settings.gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, settings.containerHeight);
        ctx.stroke();
      }

      for (let y = 0; y <= settings.containerHeight; y += settings.gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(settings.containerWidth, y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
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
      ctx.fillStyle = panel.color || '#4f46e5';
      ctx.strokeStyle = isSelected ? '#f97316' : '#000000';
      ctx.lineWidth = isSelected ? 3 : 1;
      
      // Draw different shapes
      if (panel.shape === 'right-triangle') {
        // Draw right triangle with 90-degree angle at bottom-left corner
        ctx.beginPath();
        ctx.moveTo(panel.x, panel.y); // Top-left corner
        ctx.lineTo(panel.x + panelWidth, panel.y); // Top-right corner
        ctx.lineTo(panel.x, panel.y + panelHeight); // Bottom-left corner (right angle)
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (panel.shape === 'triangle') {
        // Draw equilateral triangle
        const centerX = panel.x + panelWidth / 2;
        const centerY = panel.y + panelHeight / 2;
        const radius = Math.min(panelWidth, panelHeight) / 2;
        
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Default rectangle
        ctx.fillRect(panel.x, panel.y, panelWidth, panelHeight);
        ctx.strokeRect(panel.x, panel.y, panelWidth, panelHeight);
      }
      
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
      
      // Draw labels - only panel number
      ctx.fillStyle = '#000';
      ctx.font = `${12 / scale}px Arial`;
      ctx.textAlign = 'center';
      
      // Position text based on shape
      let textX, textY;
      if (panel.shape === 'right-triangle') {
        textX = panel.x + panelWidth / 3;
        textY = panel.y + panelHeight / 3;
      } else if (panel.shape === 'triangle') {
        textX = panel.x + panelWidth / 2;
        textY = panel.y + panelHeight / 2;
      } else {
        textX = panel.x + panelWidth / 2;
        textY = panel.y + panelHeight / 2;
      }
      
      ctx.fillText(panel.panelNumber || 'N/A', textX, textY);
      ctx.fillText(`${panel.width}' × ${panel.length}'`, textX, textY + 15 / scale);
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
      height: dimensions.length, // height should match length for consistency
      length: dimensions.length,
      shape: selectedShape,
      x: 50 + (panels.length * 20),
      y: 50 + (panels.length * 15),
      color: '#3b82f6',
      fill: '#3b82f6',
      date: new Date().toISOString().slice(0, 10),
      location: '',
      rotation: 0,
      meta: {
        repairs: [],
        airTest: { result: 'pending' }
      }
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

    // Check for panel selection with shape-specific hit detection
    const clickedPanel = panels.find(panel => {
      const panelWidth = panel.width * 5;
      const panelHeight = panel.length * 2;
      
      if (panel.shape === 'right-triangle') {
        // Check if point is inside right triangle
        // Right triangle has 90-degree angle at bottom-left corner
        const x1 = panel.x, y1 = panel.y; // Top-left
        const x2 = panel.x + panelWidth, y2 = panel.y; // Top-right
        const x3 = panel.x, y3 = panel.y + panelHeight; // Bottom-left (right angle)
        
        // Use barycentric coordinates to check if point is inside triangle
        const denominator = ((y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3));
        const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denominator;
        const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denominator;
        const c = 1 - a - b;
        
        return a >= 0 && b >= 0 && c >= 0;
      } else if (panel.shape === 'triangle') {
        // Check if point is inside equilateral triangle
        const centerX = panel.x + panelWidth / 2;
        const centerY = panel.y + panelHeight / 2;
        const radius = Math.min(panelWidth, panelHeight) / 2;
        
        // Check if point is within the triangle bounds
        const dx = Math.abs(x - centerX);
        const dy = Math.abs(y - centerY);
        const slope = Math.sqrt(3); // 60-degree angle
        
        return dx <= radius && dy <= radius * slope / 2 && 
               (dx + dy * slope) <= radius * slope;
      } else {
        // Default rectangular bounds check
        return x >= panel.x && x <= panel.x + panelWidth &&
               y >= panel.y && y <= panel.y + panelHeight;
      }
    });

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
    <>
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
                {['rectangle', 'triangle', 'right-triangle', 'circle'].map(shape => (
                  <button
                    key={shape}
                    className={`flex-1 px-3 py-2 text-sm ${
                      selectedShape === shape
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedShape(shape as PanelShape)}
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
                <Button onClick={() => zoomOut()} variant="outline" size="sm">-</Button>
                <Button onClick={() => reset()} variant="outline" size="sm">Reset</Button>
                <Button onClick={() => zoomIn()} variant="outline" size="sm">+</Button>
              </div>
              <div className="mt-2">
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
                }} variant="outline" size="sm" className="w-full">Zoom to Fit</Button>
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
            <div 
              ref={containerRef}
              className="border border-gray-300 rounded overflow-auto" 
              style={{ height: '600px' }}
              onWheel={e => handleWheel(e.nativeEvent)}
              onMouseMove={onMouseMove}
            >
              <canvas
                ref={canvasRef}
                width={settings.containerWidth}
                height={settings.containerHeight}
                className={`${dragInfo.isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
                onMouseDown={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                  transformOrigin: '0 0'
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Tooltip component */}
      <TooltipComponent />
    </>
  );
}