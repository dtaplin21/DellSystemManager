'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
  material?: string;
  thickness?: number;
  seamsType?: 'heat' | 'fusion' | 'extrusion' | 'other';
  notes?: string;
  date: string;
  panelNumber: string;
  length: number;
  rollNumber: string;
  location: string;
  shape: string;
  rotation: number;
  fill: string;
}

interface PanelLayoutSettings {
  gridSize: number;
  containerWidth: number;
  containerHeight: number;
  snapToGrid: boolean;
  scale: number; // Scale factor (e.g., 1 unit = 1 ft)
  units: 'ft' | 'm';
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

  // State for layout settings
  const [settings, setSettings] = useState<PanelLayoutSettings>({
    gridSize: gridSize,
    containerWidth: containerWidth,
    containerHeight: containerHeight,
    snapToGrid: snapToGrid,
    scale: 0.25, // 1 unit = 0.25 ft
    units: 'ft'
  });

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
        label: 'Panel 1',
        material: 'HDPE',
        thickness: 60,
        seamsType: 'fusion',
        notes: 'North section primary panel',
        date: new Date().toISOString().slice(0, 10),
        panelNumber: 'P1',
        length: 100,
        rollNumber: 'R-101',
        location: 'Auto-generated',
        shape: 'rectangle',
        rotation: 0,
        fill: '#3b82f6'
      },
      {
        id: '2',
        x: 300,
        y: 150,
        width: 150,
        height: 150,
        color: '#10b981',
        label: 'Panel 2',
        material: 'HDPE',
        thickness: 60,
        seamsType: 'extrusion',
        notes: 'Corner section with drainage connection',
        date: new Date().toISOString().slice(0, 10),
        panelNumber: 'P2',
        length: 150,
        rollNumber: 'R-102',
        location: 'Auto-generated',
        shape: 'rectangle',
        rotation: 0,
        fill: '#10b981'
      },
      {
        id: '3',
        x: 100,
        y: 300,
        width: 250,
        height: 120,
        color: '#f59e0b',
        label: 'Panel 3',
        material: 'LLDPE',
        thickness: 40,
        seamsType: 'heat',
        notes: 'South connection panel',
        date: new Date().toISOString().slice(0, 10),
        panelNumber: 'P3',
        length: 120,
        rollNumber: 'R-103',
        location: 'Auto-generated',
        shape: 'rectangle',
        rotation: 0,
        fill: '#f59e0b'
      }
    ]);
  }, []);

  const addNewPanel = () => {
    const color = getRandomColor();
    const newPanel: Panel = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      panelNumber: `P${panels.length + 1}`,
      length: 100,
      width: 40,
      height: 100,
      rollNumber: `R-${100 + panels.length + 1}`,
      location: 'Auto-generated',
      x: 50,
      y: 50,
      shape: 'rectangle',
      rotation: 0,
      fill: color,
      color: color,
      label: `Panel ${panels.length + 1}`,
      material: 'HDPE',
      thickness: 60,
      seamsType: 'fusion',
      notes: `Auto-generated panel ${panels.length + 1}`
    };
    setPanels([...panels, newPanel]);
    toast({
      title: 'Panel Added',
      description: `Added new panel: ${newPanel.panelNumber} (${newPanel.material} ${newPanel.thickness} mil)`,
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
    let lastX = startPanelX;
    let lastY = startPanelY;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      lastX = startPanelX + dx;
      lastY = startPanelY + dy;
      // Do not update state here; just let the panel visually follow the mouse if you have a ref
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Only update state on drag end
      setPanels(panels.map(p => p.id === id ? { ...p, x: lastX, y: lastY } : p));
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
    const startPanelLength = panel.length;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      let newX = startPanelX;
      let newY = startPanelY;
      let newWidth = startPanelWidth;
      let newLength = startPanelLength;
      
      if (corner === 'nw') {
        newX = startPanelX + dx;
        newY = startPanelY + dy;
        newWidth = startPanelWidth - dx;
        newLength = startPanelLength - dy;
      } else if (corner === 'ne') {
        newY = startPanelY + dy;
        newWidth = startPanelWidth + dx;
        newLength = startPanelLength - dy;
      } else if (corner === 'sw') {
        newX = startPanelX + dx;
        newWidth = startPanelWidth - dx;
        newLength = startPanelLength + dy;
      } else if (corner === 'se') {
        newWidth = startPanelWidth + dx;
        newLength = startPanelLength + dy;
      }
      
      // Ensure minimum size
      newWidth = Math.max(50, newWidth);
      newLength = Math.max(50, newLength);
      
      // Apply grid snapping if enabled
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
        newWidth = Math.round(newWidth / gridSize) * gridSize;
        newLength = Math.round(newLength / gridSize) * gridSize;
      }
      
      // Ensure panel stays within container bounds
      newX = Math.max(0, Math.min(containerWidth - newWidth, newX));
      newY = Math.max(0, Math.min(containerHeight - newLength, newY));
      
      setPanels(panels.map(p => 
        p.id === id ? { ...p, x: newX, y: newY, width: newWidth, length: newLength } : p
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
        <CardContent>
          <div className="pt-6">
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
                      height: `${panel.length}px`,
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
                                  <Label htmlFor="panel-length">Length</Label>
                                  <Input 
                                    id="panel-length" 
                                    type="number" 
                                    value={panel.length} 
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value);
                                      setPanels(panels.map(p => 
                                        p.id === selectedPanel 
                                          ? { ...p, length: value } 
                                          : p
                                      ));
                                    }}
                                  />
                                </div>
                              </div>
                              
                              {/* Material Properties Section */}
                              <div className="mt-6 pt-4 border-t border-gray-200">
                                <h3 className="text-sm font-medium mb-3">Material Properties</h3>
                                
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="panel-material">Material Type</Label>
                                    <select 
                                      id="panel-material"
                                      className="w-full border border-gray-300 rounded-md p-2"
                                      value={panel.material || ''}
                                      onChange={(e) => {
                                        setPanels(panels.map(p => 
                                          p.id === selectedPanel 
                                            ? { ...p, material: e.target.value } 
                                            : p
                                        ));
                                      }}
                                    >
                                      <option value="">Select Material</option>
                                      <option value="HDPE">HDPE</option>
                                      <option value="LLDPE">LLDPE</option>
                                      <option value="PVC">PVC</option>
                                      <option value="GCL">GCL</option>
                                      <option value="EPDM">EPDM</option>
                                    </select>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="panel-thickness">Thickness (mil)</Label>
                                      <Input 
                                        id="panel-thickness" 
                                        type="number" 
                                        value={panel.thickness || ''} 
                                        onChange={(e) => {
                                          const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                          setPanels(panels.map(p => 
                                            p.id === selectedPanel 
                                              ? { ...p, thickness: value } 
                                              : p
                                          ));
                                        }}
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label htmlFor="panel-seams">Seams Type</Label>
                                      <select 
                                        id="panel-seams"
                                        className="w-full border border-gray-300 rounded-md p-2"
                                        value={panel.seamsType || ''}
                                        onChange={(e) => {
                                          const value = e.target.value === '' ? undefined : e.target.value as 'heat' | 'fusion' | 'extrusion' | 'other';
                                          setPanels(panels.map(p => 
                                            p.id === selectedPanel 
                                              ? { ...p, seamsType: value } 
                                              : p
                                          ));
                                        }}
                                      >
                                        <option value="">Select Type</option>
                                        <option value="heat">Heat Seam</option>
                                        <option value="fusion">Fusion Weld</option>
                                        <option value="extrusion">Extrusion Weld</option>
                                        <option value="other">Other</option>
                                      </select>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="panel-notes">Notes</Label>
                                    <Textarea 
                                      id="panel-notes" 
                                      value={panel.notes || ''}
                                      rows={3}
                                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                        setPanels(panels.map(p => 
                                          p.id === selectedPanel 
                                            ? { ...p, notes: e.target.value } 
                                            : p
                                        ));
                                      }}
                                    />
                                  </div>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}