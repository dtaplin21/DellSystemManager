'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}

export default function PanelLayoutDesigner() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(20);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(600);
  const [snapToGrid, setSnapToGrid] = useState(true);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initial setup with some example panels
    setPanels([
      {
        id: '1',
        x: 50,
        y: 50,
        width: 200,
        height: 100,
        color: '#3b82f6',
        label: 'Panel 1'
      },
      {
        id: '2',
        x: 300,
        y: 150,
        width: 150,
        height: 150,
        color: '#10b981',
        label: 'Panel 2'
      },
      {
        id: '3',
        x: 100,
        y: 300,
        width: 250,
        height: 120,
        color: '#f59e0b',
        label: 'Panel 3'
      }
    ]);
  }, []);

  const addNewPanel = () => {
    const newPanel: Panel = {
      id: Date.now().toString(),
      x: 50,
      y: 50,
      width: 150,
      height: 100,
      color: getRandomColor(),
      label: `Panel ${panels.length + 1}`
    };
    
    setPanels([...panels, newPanel]);
    toast({
      title: 'Panel Added',
      description: `Added new panel: ${newPanel.label}`,
    });
  };

  const deleteSelectedPanel = () => {
    if (!selectedPanel) return;
    
    setPanels(panels.filter(panel => panel.id !== selectedPanel));
    setSelectedPanel(null);
    toast({
      title: 'Panel Deleted',
      description: 'The selected panel has been removed',
    });
  };

  const optimizePanelLayout = () => {
    setIsOptimizing(true);
    
    // Simulating an API call to optimize the panel layout
    setTimeout(() => {
      // This is where we would normally call the backend optimization algorithm
      // For now, we'll just rearrange the panels in a grid pattern as a simple simulation
      const optimizedPanels = [...panels].map((panel, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        
        return {
          ...panel,
          x: col * 250 + 50,
          y: row * 200 + 50
        };
      });
      
      setPanels(optimizedPanels);
      setIsOptimizing(false);
      
      toast({
        title: 'Layout Optimized',
        description: 'Panel layout has been optimized for maximum efficiency',
      });
    }, 2000);
  };

  const handlePanelSelect = (id: string) => {
    setSelectedPanel(id === selectedPanel ? null : id);
  };

  const handlePanelDrag = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    
    if (!canvasRef.current) return;
    
    const panel = panels.find(p => p.id === id);
    if (!panel) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startPanelX = panel.x;
    const startPanelY = panel.y;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      let newX = startPanelX + dx;
      let newY = startPanelY + dy;
      
      // Apply grid snapping if enabled
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }
      
      // Ensure panel stays within container bounds
      newX = Math.max(0, Math.min(containerWidth - panel.width, newX));
      newY = Math.max(0, Math.min(containerHeight - panel.height, newY));
      
      setPanels(panels.map(p => 
        p.id === id ? { ...p, x: newX, y: newY } : p
      ));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handlePanelResize = (e: React.MouseEvent, id: string, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!canvasRef.current) return;
    
    const panel = panels.find(p => p.id === id);
    if (!panel) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startPanelX = panel.x;
    const startPanelY = panel.y;
    const startPanelWidth = panel.width;
    const startPanelHeight = panel.height;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      let newX = startPanelX;
      let newY = startPanelY;
      let newWidth = startPanelWidth;
      let newHeight = startPanelHeight;
      
      if (corner === 'nw') {
        newX = startPanelX + dx;
        newY = startPanelY + dy;
        newWidth = startPanelWidth - dx;
        newHeight = startPanelHeight - dy;
      } else if (corner === 'ne') {
        newY = startPanelY + dy;
        newWidth = startPanelWidth + dx;
        newHeight = startPanelHeight - dy;
      } else if (corner === 'sw') {
        newX = startPanelX + dx;
        newWidth = startPanelWidth - dx;
        newHeight = startPanelHeight + dy;
      } else if (corner === 'se') {
        newWidth = startPanelWidth + dx;
        newHeight = startPanelHeight + dy;
      }
      
      // Ensure minimum size
      newWidth = Math.max(50, newWidth);
      newHeight = Math.max(50, newHeight);
      
      // Apply grid snapping if enabled
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
        newWidth = Math.round(newWidth / gridSize) * gridSize;
        newHeight = Math.round(newHeight / gridSize) * gridSize;
      }
      
      // Ensure panel stays within container bounds
      newX = Math.max(0, Math.min(containerWidth - newWidth, newX));
      newY = Math.max(0, Math.min(containerHeight - newHeight, newY));
      
      setPanels(panels.map(p => 
        p.id === id ? { ...p, x: newX, y: newY, width: newWidth, height: newHeight } : p
      ));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const exportToCAD = () => {
    toast({
      title: 'Exporting to CAD',
      description: 'Panel layout is being prepared for CAD export',
    });
    
    // This would normally trigger an API call to create a CAD file
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: 'Panel layout has been exported to CAD format',
      });
    }, 1500);
  };

  const getRandomColor = () => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Panel Layout Designer</h2>
        <div className="flex space-x-2">
          <Button onClick={exportToCAD} variant="outline">Export to CAD</Button>
          <Button onClick={optimizePanelLayout} disabled={isOptimizing}>
            {isOptimizing ? 'Optimizing...' : 'Optimize Layout'}
          </Button>
        </div>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-4 mb-4">
            <Button onClick={addNewPanel}>Add Panel</Button>
            <Button 
              onClick={deleteSelectedPanel} 
              variant="destructive" 
              disabled={!selectedPanel}
            >
              Delete Selected
            </Button>
            <div className="flex items-center space-x-2 ml-4">
              <input 
                type="checkbox" 
                id="snap-grid" 
                checked={snapToGrid} 
                onChange={(e) => setSnapToGrid(e.target.checked)} 
              />
              <Label htmlFor="snap-grid">Snap to Grid</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="grid-size">Grid Size:</Label>
              <Input
                id="grid-size"
                type="number"
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="w-20"
              />
              <span>px</span>
            </div>
          </div>
          
          <div className="flex space-x-6">
            <div 
              ref={canvasRef}
              className="panel-grid relative border border-gray-300 rounded-md"
              style={{ 
                width: `${containerWidth}px`, 
                height: `${containerHeight}px`,
                backgroundSize: `${gridSize}px ${gridSize}px` 
              }}
            >
              {panels.map((panel) => (
                <div 
                  key={panel.id}
                  className={`panel ${selectedPanel === panel.id ? 'selected' : ''}`}
                  style={{
                    left: `${panel.x}px`,
                    top: `${panel.y}px`,
                    width: `${panel.width}px`,
                    height: `${panel.height}px`,
                    borderColor: panel.color,
                    backgroundColor: `${panel.color}20`
                  }}
                  onClick={() => handlePanelSelect(panel.id)}
                  onMouseDown={(e) => handlePanelDrag(e, panel.id)}
                >
                  {panel.label}
                  
                  {selectedPanel === panel.id && (
                    <>
                      <div 
                        className="panel-resize-handle nw" 
                        onMouseDown={(e) => handlePanelResize(e, panel.id, 'nw')}
                      />
                      <div 
                        className="panel-resize-handle ne" 
                        onMouseDown={(e) => handlePanelResize(e, panel.id, 'ne')}
                      />
                      <div 
                        className="panel-resize-handle sw" 
                        onMouseDown={(e) => handlePanelResize(e, panel.id, 'sw')}
                      />
                      <div 
                        className="panel-resize-handle se" 
                        onMouseDown={(e) => handlePanelResize(e, panel.id, 'se')}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            
            <div className="w-80">
              <Card>
                <CardHeader>
                  <CardTitle>Panel Properties</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedPanel ? (
                    <>
                      {panels
                        .filter(panel => panel.id === selectedPanel)
                        .map(panel => (
                          <div key={panel.id} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="panel-label">Label</Label>
                              <Input 
                                id="panel-label" 
                                value={panel.label} 
                                onChange={(e) => {
                                  setPanels(panels.map(p => 
                                    p.id === selectedPanel 
                                      ? { ...p, label: e.target.value } 
                                      : p
                                  ));
                                }}
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="panel-x">X Position</Label>
                                <Input 
                                  id="panel-x" 
                                  type="number" 
                                  value={panel.x} 
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    setPanels(panels.map(p => 
                                      p.id === selectedPanel 
                                        ? { ...p, x: value } 
                                        : p
                                    ));
                                  }}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="panel-y">Y Position</Label>
                                <Input 
                                  id="panel-y" 
                                  type="number" 
                                  value={panel.y} 
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    setPanels(panels.map(p => 
                                      p.id === selectedPanel 
                                        ? { ...p, y: value } 
                                        : p
                                    ));
                                  }}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="panel-width">Width</Label>
                                <Input 
                                  id="panel-width" 
                                  type="number" 
                                  value={panel.width} 
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    setPanels(panels.map(p => 
                                      p.id === selectedPanel 
                                        ? { ...p, width: value } 
                                        : p
                                    ));
                                  }}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="panel-height">Height</Label>
                                <Input 
                                  id="panel-height" 
                                  type="number" 
                                  value={panel.height} 
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    setPanels(panels.map(p => 
                                      p.id === selectedPanel 
                                        ? { ...p, height: value } 
                                        : p
                                    ));
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      }
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Select a panel to edit its properties
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}