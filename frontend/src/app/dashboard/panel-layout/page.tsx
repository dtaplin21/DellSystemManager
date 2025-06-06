'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: string;
  thickness?: number;
  material?: string;
}

export default function PanelLayoutPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dragInfo, setDragInfo] = useState<{
    isDragging: boolean;
    panelId: string | null;
    offsetX: number;
    offsetY: number;
  }>({
    isDragging: false,
    panelId: null,
    offsetX: 0,
    offsetY: 0
  });
  
  const [siteConfig, setSiteConfig] = useState({
    width: 800,
    height: 600,
    scale: 1,
    gridSize: 20
  });

  const [newPanel, setNewPanel] = useState({
    label: '',
    width: 100,
    height: 80,
    thickness: 60,
    material: 'HDPE'
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const addPanel = () => {
    if (!newPanel.label) return;
    
    const panel: Panel = {
      id: `panel-${Date.now()}`,
      x: 50,
      y: 50,
      width: newPanel.width,
      height: newPanel.height,
      label: newPanel.label,
      thickness: newPanel.thickness,
      material: newPanel.material,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    };
    
    setPanels(prev => [...prev, panel]);
    setNewPanel({ label: '', width: 100, height: 80, thickness: 60, material: 'HDPE' });
  };

  const deletePanel = (id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id));
    if (selectedPanel?.id === id) {
      setSelectedPanel(null);
    }
  };

  const updatePanel = (id: string, updates: Partial<Panel>) => {
    setPanels(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
    if (selectedPanel?.id === id) {
      setSelectedPanel(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, panel: Panel) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragInfo({
        isDragging: true,
        panelId: panel.id,
        offsetX: e.clientX - rect.left - panel.x,
        offsetY: e.clientY - rect.top - panel.y
      });
      setSelectedPanel(panel);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragInfo.isDragging && dragInfo.panelId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = Math.max(0, Math.min(siteConfig.width - 100, e.clientX - rect.left - dragInfo.offsetX));
        const newY = Math.max(0, Math.min(siteConfig.height - 80, e.clientY - rect.top - dragInfo.offsetY));
        
        updatePanel(dragInfo.panelId, { x: newX, y: newY });
      }
    }
  };

  const handleMouseUp = () => {
    setDragInfo({
      isDragging: false,
      panelId: null,
      offsetX: 0,
      offsetY: 0
    });
  };

  const testOptimization = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/panel-api/api/panel-layout/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteConfig,
          panels,
          strategy: 'balanced'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Optimization result:', result);
        alert('Panel optimization completed successfully!');
      } else {
        alert('Optimization failed - please check panel service connection');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      alert('Network error during optimization');
    } finally {
      setIsLoading(false);
    }
  };

  const renderGrid = () => {
    const lines = [];
    const { gridSize, width, height } = siteConfig;
    
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      lines.push(
        <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={height} 
              stroke="#e5e7eb" strokeWidth="1" />
      );
    }
    
    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      lines.push(
        <line key={`h-${y}`} x1={0} y1={y} x2={width} y2={y} 
              stroke="#e5e7eb" strokeWidth="1" />
      );
    }
    
    return lines;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-600">Panel Layout Designer</h1>
          <p className="text-navy-300">Design and optimize geosynthetic panel arrangements</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" className="border-navy-600 text-navy-600 hover:bg-navy-600 hover:text-white">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Add Panel Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-navy-600">Add Panel</CardTitle>
              <CardDescription>Create new geosynthetic panels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-navy-600">Panel Label</label>
                <Input
                  placeholder="e.g., P-001"
                  value={newPanel.label}
                  onChange={(e) => setNewPanel(prev => ({ ...prev, label: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-navy-600">Width (ft)</label>
                  <Input
                    type="number"
                    value={newPanel.width}
                    onChange={(e) => setNewPanel(prev => ({ ...prev, width: parseInt(e.target.value) || 100 }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-navy-600">Height (ft)</label>
                  <Input
                    type="number"
                    value={newPanel.height}
                    onChange={(e) => setNewPanel(prev => ({ ...prev, height: parseInt(e.target.value) || 80 }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-navy-600">Material</label>
                <select
                  className="w-full h-10 px-3 py-2 border-2 border-gray-300 rounded-md text-sm"
                  value={newPanel.material}
                  onChange={(e) => setNewPanel(prev => ({ ...prev, material: e.target.value }))}
                >
                  <option value="HDPE">HDPE 60 mil</option>
                  <option value="LLDPE">LLDPE 40 mil</option>
                  <option value="PVC">PVC 30 mil</option>
                  <option value="EPDM">EPDM 45 mil</option>
                </select>
              </div>
              <Button onClick={addPanel} className="btn-navy w-full" disabled={!newPanel.label}>
                Add Panel
              </Button>
            </CardContent>
          </Card>

          {/* Site Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-navy-600">Site Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-navy-600">Width (ft)</label>
                  <Input
                    type="number"
                    value={siteConfig.width}
                    onChange={(e) => setSiteConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 800 }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-navy-600">Height (ft)</label>
                  <Input
                    type="number"
                    value={siteConfig.height}
                    onChange={(e) => setSiteConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 600 }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-navy-600">Grid Size</label>
                <Input
                  type="number"
                  value={siteConfig.gridSize}
                  onChange={(e) => setSiteConfig(prev => ({ ...prev, gridSize: parseInt(e.target.value) || 20 }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-navy-600">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={testOptimization} className="btn-orange w-full" disabled={isLoading}>
                {isLoading ? 'Optimizing...' : 'Optimize Layout'}
              </Button>
              <Button onClick={() => setPanels([])} variant="outline" className="w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
                Clear All Panels
              </Button>
            </CardContent>
          </Card>

          {/* Panel List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-navy-600">Panels ({panels.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {panels.map((panel) => (
                <div key={panel.id} className="flex items-center justify-between p-2 border border-navy-100 rounded">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: panel.color }}
                    />
                    <div>
                      <p className="text-sm font-medium text-navy-600">{panel.label}</p>
                      <p className="text-xs text-navy-300">{panel.width}×{panel.height}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedPanel(panel); setIsEditing(true); }}
                      className="text-xs px-2 py-1"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deletePanel(panel.id)}
                      className="text-xs px-2 py-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      Del
                    </Button>
                  </div>
                </div>
              ))}
              {panels.length === 0 && (
                <p className="text-sm text-navy-300 text-center py-4">No panels added yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Canvas Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-navy-600">Layout Canvas</CardTitle>
              <CardDescription>
                Drag panels to reposition. Click to select and edit properties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-navy-200 rounded-lg overflow-hidden bg-white">
                <div
                  ref={canvasRef}
                  className="relative cursor-crosshair"
                  style={{ width: `${siteConfig.width}px`, height: `${siteConfig.height}px` }}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {/* Grid */}
                  <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                    {renderGrid()}
                  </svg>
                  
                  {/* Panels */}
                  {panels.map((panel) => (
                    <div
                      key={panel.id}
                      className={`absolute border-2 cursor-move transition-all duration-150 flex items-center justify-center text-xs font-bold ${
                        selectedPanel?.id === panel.id 
                          ? 'border-orange-500 shadow-lg z-10' 
                          : 'border-navy-400 hover:border-navy-600'
                      }`}
                      style={{
                        left: `${panel.x}px`,
                        top: `${panel.y}px`,
                        width: `${panel.width}px`,
                        height: `${panel.height}px`,
                        backgroundColor: panel.color,
                        opacity: 0.8
                      }}
                      onMouseDown={(e) => handleMouseDown(e, panel)}
                      onClick={() => setSelectedPanel(panel)}
                    >
                      <div className="text-center text-navy-800">
                        <div className="font-bold">{panel.label}</div>
                        <div className="text-xs">{panel.width}×{panel.height}</div>
                        <div className="text-xs">{panel.material}</div>
                      </div>
                    </div>
                  ))}
                  
                  {panels.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-navy-300">
                      <div className="text-center">
                        <p className="text-lg mb-2">Empty Canvas</p>
                        <p className="text-sm">Add panels using the form on the left</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Panel Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Panel: {selectedPanel?.label}</DialogTitle>
            <DialogDescription>
              Modify panel properties and specifications
            </DialogDescription>
          </DialogHeader>
          {selectedPanel && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Label</label>
                <Input
                  value={selectedPanel.label}
                  onChange={(e) => updatePanel(selectedPanel.id, { label: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Width (ft)</label>
                  <Input
                    type="number"
                    value={selectedPanel.width}
                    onChange={(e) => updatePanel(selectedPanel.id, { width: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Height (ft)</label>
                  <Input
                    type="number"
                    value={selectedPanel.height}
                    onChange={(e) => updatePanel(selectedPanel.id, { height: parseInt(e.target.value) || 80 })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Material</label>
                <select
                  className="w-full h-10 px-3 py-2 border-2 border-gray-300 rounded-md text-sm"
                  value={selectedPanel.material || 'HDPE'}
                  onChange={(e) => updatePanel(selectedPanel.id, { material: e.target.value })}
                >
                  <option value="HDPE">HDPE 60 mil</option>
                  <option value="LLDPE">LLDPE 40 mil</option>
                  <option value="PVC">PVC 30 mil</option>
                  <option value="EPDM">EPDM 45 mil</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsEditing(false)} className="btn-navy">
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}