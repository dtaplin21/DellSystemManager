'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface Panel {
  id: string;
  width: number;
  length: number;
  material: string;
  shape: 'rectangle' | 'polygon';
  corners?: number[][];
}

interface OptimizationResults {
  placements: any[];
  summary: any;
}

export default function PanelLayoutPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [panelCounter, setPanelCounter] = useState(1);
  const [selectedStrategy, setSelectedStrategy] = useState('balanced');
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [isCreatingPolygon, setIsCreatingPolygon] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<{x: number, y: number}[]>([]);
  const [contourImageData, setContourImageData] = useState<string | null>(null);
  const [optimizationResults, setOptimizationResults] = useState<OptimizationResults | null>(null);
  const [showPanels, setShowPanels] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{show: boolean, title: string, message: string}>({
    show: false, title: '', message: ''
  });

  const [siteConfig, setSiteConfig] = useState({
    width: 1000,
    length: 1000
  });

  const [newPanel, setNewPanel] = useState({
    width: 15,
    length: 100,
    material: 'HDPE 60 mil'
  });

  const panelViewerRef = useRef<HTMLDivElement>(null);

  const showToast = (title: string, message: string) => {
    setToast({ show: true, title, message });
    setTimeout(() => setToast({ show: false, title: '', message: '' }), 3000);
  };

  const showLoading = (loading: boolean) => {
    setIsLoading(loading);
  };

  const updatePanelList = () => {
    // Panel list is managed by React state, so this is automatic
  };

  const clearPolygonPoints = () => {
    setPolygonPoints([]);
    setIsCreatingPolygon(false);
  };

  const removePolygonPoint = (index: number) => {
    setPolygonPoints(prev => prev.filter((_, i) => i !== index));
  };

  const finishPolygon = () => {
    if (polygonPoints.length >= 3) {
      const minX = Math.min(...polygonPoints.map(p => p.x));
      const maxX = Math.max(...polygonPoints.map(p => p.x));
      const minY = Math.min(...polygonPoints.map(p => p.y));
      const maxY = Math.max(...polygonPoints.map(p => p.y));

      const width = maxX - minX;
      const height = maxY - minY;

      const panel: Panel = {
        id: `panel-${panelCounter}`,
        width: width || 15,
        length: height || 100,
        material: newPanel.material,
        shape: 'polygon',
        corners: polygonPoints.map(p => [p.x, p.y])
      };

      setPanels(prev => [...prev, panel]);
      setPanelCounter(prev => prev + 1);
      clearPolygonPoints();
      showToast('Polygon Created', `Custom polygon panel added with ${polygonPoints.length} points.`);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (selectedShape === 'polygon' && panelViewerRef.current) {
      if (!isCreatingPolygon) {
        setIsCreatingPolygon(true);
      }

      const rect = panelViewerRef.current.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);

      setPolygonPoints(prev => [...prev, { x, y }]);
      showToast('Point Added', `Added point at (${x}, ${y}). Right-click to finish or add more points.`);
    }
  };

  const handleCanvasRightClick = (e: React.MouseEvent) => {
    if (selectedShape === 'polygon' && isCreatingPolygon && polygonPoints.length >= 3) {
      e.preventDefault();
      finishPolygon();
    }
  };

  const addPanel = () => {
    if (selectedShape === 'rectangle') {
      if (isNaN(newPanel.width) || isNaN(newPanel.length) || newPanel.width <= 0 || newPanel.length <= 0) {
        showToast('Invalid Input', 'Please enter valid width and length values.');
        return;
      }

      const panel: Panel = {
        id: `panel-${panelCounter}`,
        width: newPanel.width,
        length: newPanel.length,
        material: newPanel.material,
        shape: 'rectangle'
      };

      setPanels(prev => [...prev, panel]);
      setPanelCounter(prev => prev + 1);
      showToast('Panel Added', `Rectangular panel ${panel.id} added successfully.`);

    } else if (selectedShape === 'polygon') {
      if (polygonPoints.length === 0) {
        showToast('Create Polygon', 'Click on the viewer area to start creating polygon points. Right-click when finished.');
        setIsCreatingPolygon(true);
      } else if (polygonPoints.length >= 3) {
        finishPolygon();
      } else {
        showToast('Need More Points', 'Add at least 3 points to create a polygon.');
      }
    }
  };

  const clearAllPanels = () => {
    if (window.confirm('Are you sure you want to clear all panels?')) {
      setPanels([]);
      showToast('Info', 'All panels cleared');
    }
  };

  const visualizeTerrain = async () => {
    if (isNaN(siteConfig.width) || isNaN(siteConfig.length) || siteConfig.width <= 0 || siteConfig.length <= 0) {
      showToast('Error', 'Please enter valid site dimensions');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/panel-api/api/panel-layout/visualize-terrain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width: siteConfig.width,
          length: siteConfig.length,
          noGoZones: []
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setContourImageData(data.imageData);
      displayContourImage(data.imageData);
      showToast('Success', 'Terrain visualization generated');

    } catch (error) {
      console.error('Error visualizing terrain:', error);
      showToast('Error', 'Failed to visualize terrain');
    } finally {
      showLoading(false);
    }
  };

  const runOptimization = async () => {
    if (isNaN(siteConfig.width) || isNaN(siteConfig.length) || siteConfig.width <= 0 || siteConfig.length <= 0) {
      showToast('Error', 'Please enter valid site dimensions');
      return;
    }

    if (panels.length === 0) {
      showToast('Error', 'Please add at least one panel');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/panel-api/api/panel-layout/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteConfig: {
            width: siteConfig.width,
            length: siteConfig.length,
            noGoZones: []
          },
          panels: panels,
          strategy: selectedStrategy
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setOptimizationResults(data);
      showToast('Success', `Optimized ${data.placements.length} panels with ${selectedStrategy} strategy`);

    } catch (error) {
      console.error('Error running optimization:', error);
      showToast('Error', 'Failed to run optimization');
    } finally {
      showLoading(false);
    }
  };

  const exportDXF = async () => {
    if (!optimizationResults || optimizationResults.placements.length === 0) {
      showToast('Error', 'No optimized panels to export');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/panel-api/api/panel-layout/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'dxf',
          panels: optimizationResults.placements,
          summary: optimizationResults.summary
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'panel_layout.dxf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Success', 'DXF export generated');

    } catch (error) {
      console.error('Error exporting to DXF:', error);
      showToast('Error', 'Failed to export to DXF');
    } finally {
      showLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!optimizationResults || optimizationResults.placements.length === 0) {
      showToast('Error', 'No optimized panels to export');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/panel-api/api/panel-layout/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'csv',
          panels: optimizationResults.placements,
          summary: optimizationResults.summary
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'panel_layout.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Success', 'CSV export generated');

    } catch (error) {
      console.error('Error exporting to CSV:', error);
      showToast('Error', 'Failed to export to CSV');
    } finally {
      showLoading(false);
    }
  };

  const visualize3D = async () => {
    if (isNaN(siteConfig.width) || isNaN(siteConfig.length) || siteConfig.width <= 0 || siteConfig.length <= 0) {
      showToast('Error', 'Please enter valid site dimensions');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/panel-api/api/panel-layout/visualize-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteConfig: {
            width: siteConfig.width,
            length: siteConfig.length,
            noGoZones: []
          },
          panels: optimizationResults ? optimizationResults.placements : null
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      displayContourImage(data.imageData);
      showToast('Success', '3D visualization generated');

    } catch (error) {
      console.error('Error generating 3D visualization:', error);
      showToast('Error', 'Failed to generate 3D visualization');
    } finally {
      showLoading(false);
    }
  };

  const displayContourImage = (imageData: string) => {
    if (panelViewerRef.current) {
      panelViewerRef.current.innerHTML = '';
      const img = document.createElement('img');
      img.src = `data:image/png;base64,${imageData}`;
      img.alt = 'Terrain Contour Map';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      panelViewerRef.current.appendChild(img);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div className="text-2xl font-bold text-[#0a2463]">GeoQC</div>
        <nav className="flex gap-6">
          <Link href="/dashboard" className="text-[#486581] hover:text-[#ff7f11] transition-colors">Dashboard</Link>
          <Link href="/dashboard/projects" className="text-[#486581] hover:text-[#ff7f11] transition-colors">Projects</Link>
          <span className="text-[#0a2463] font-medium">Panel Layout</span>
          <Link href="/dashboard/qc-data" className="text-[#486581] hover:text-[#ff7f11] transition-colors">QC Data</Link>
          <Link href="/dashboard/documents" className="text-[#486581] hover:text-[#ff7f11] transition-colors">Documents</Link>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-[400px_1fr] gap-8 min-h-[800px]">
          {/* Left Panel - Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col max-h-[800px] overflow-y-auto">
            
            {/* Site Configuration */}
            <div className="mb-6 pb-6 border-b border-[#d9e2ec]">
              <h2 className="text-lg font-semibold mb-4 text-[#243b53]">Site Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#334e68] mb-2">Site Width (ft)</label>
                  <Input
                    type="number"
                    value={siteConfig.width}
                    onChange={(e) => setSiteConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 1000 }))}
                    min="500"
                    max="2000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#334e68] mb-2">Site Length (ft)</label>
                  <Input
                    type="number"
                    value={siteConfig.length}
                    onChange={(e) => setSiteConfig(prev => ({ ...prev, length: parseInt(e.target.value) || 1000 }))}
                    min="500"
                    max="2000"
                  />
                </div>
                <Button 
                  onClick={visualizeTerrain}
                  className="w-full bg-white text-[#0a2463] border border-[#9fb3c8] hover:bg-[#f0f4f8]"
                >
                  Visualize Terrain
                </Button>
              </div>
            </div>

            {/* Panel Management */}
            <div className="mb-6 pb-6 border-b border-[#d9e2ec]">
              <h2 className="text-lg font-semibold mb-4 text-[#243b53]">Panel Management</h2>
              
              {/* Shape Toggle */}
              <div className="mb-4">
                <label className="block text-sm text-[#334e68] mb-2">Panel Shape</label>
                <div className="flex border border-[#bcccdc] rounded overflow-hidden">
                  <button
                    className={`flex-1 py-2 px-3 text-xs font-medium transition-colors ${
                      selectedShape === 'rectangle' 
                        ? 'bg-[#0a2463] text-white' 
                        : 'bg-white text-[#0a2463]'
                    }`}
                    onClick={() => {
                      setSelectedShape('rectangle');
                      clearPolygonPoints();
                    }}
                  >
                    Rectangle
                  </button>
                  <button
                    className={`flex-1 py-2 px-3 text-xs font-medium transition-colors ${
                      selectedShape === 'polygon' 
                        ? 'bg-[#0a2463] text-white' 
                        : 'bg-white text-[#0a2463]'
                    }`}
                    onClick={() => setSelectedShape('polygon')}
                  >
                    Custom Polygon
                  </button>
                </div>
              </div>

              {/* Rectangle Controls */}
              {selectedShape === 'rectangle' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#334e68] mb-2">Add Rectangular Panel</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#334e68] mb-1">Width (ft)</label>
                        <Input
                          type="number"
                          value={newPanel.width}
                          onChange={(e) => setNewPanel(prev => ({ ...prev, width: parseInt(e.target.value) || 15 }))}
                          min="1"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#334e68] mb-1">Length (ft)</label>
                        <Input
                          type="number"
                          value={newPanel.length}
                          onChange={(e) => setNewPanel(prev => ({ ...prev, length: parseInt(e.target.value) || 100 }))}
                          min="1"
                          max="500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Polygon Controls */}
              {selectedShape === 'polygon' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#334e68] mb-2">Create Custom Polygon</label>
                    <p className="text-xs text-[#627d98] mb-2">
                      Click on the viewer to add polygon points. Right-click to finish.
                    </p>
                    <div className="max-h-32 overflow-y-auto border border-[#bcccdc] rounded p-2 bg-[#f0f4f8] text-xs">
                      {polygonPoints.map((point, index) => (
                        <div key={index} className="flex justify-between items-center py-1 border-b border-[#d9e2ec] last:border-b-0">
                          <span className="text-[#334e68]">Point {index + 1}: ({point.x}, {point.y})</span>
                          <button
                            onClick={() => removePolygonPoint(index)}
                            className="text-[#ff7f11] hover:text-[#e36a00] text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={clearPolygonPoints}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Clear Points
                      </Button>
                      <Button
                        onClick={finishPolygon}
                        disabled={polygonPoints.length < 3}
                        size="sm"
                        className="text-xs bg-[#0a2463] text-white"
                      >
                        Finish Polygon
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Material Selection */}
              <div className="mt-4">
                <label className="block text-sm text-[#334e68] mb-2">Material Type</label>
                <select
                  value={newPanel.material}
                  onChange={(e) => setNewPanel(prev => ({ ...prev, material: e.target.value }))}
                  className="w-full p-2 border border-[#bcccdc] rounded text-sm"
                >
                  <option>HDPE 60 mil</option>
                  <option>HDPE 80 mil</option>
                  <option>LLDPE 40 mil</option>
                  <option>PVC 30 mil</option>
                  <option>GCL</option>
                </select>
              </div>

              <Button
                onClick={addPanel}
                className="w-full mt-4 bg-[#0a2463] text-white hover:bg-[#041640]"
              >
                Add Panel
              </Button>

              {/* Panel List */}
              <div className="mt-4 max-h-48 overflow-y-auto border border-[#bcccdc] rounded">
                {panels.map((panel) => (
                  <div key={panel.id} className="p-3 border-b border-[#d9e2ec] last:border-b-0 text-sm flex justify-between">
                    <span>{panel.id}</span>
                    <span className="text-[#627d98]">{panel.width}' x {panel.length}' {panel.material}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={clearAllPanels}
                variant="outline"
                className="w-full mt-3"
              >
                Clear All
              </Button>
            </div>

            {/* Python Optimization */}
            <div className="mb-6 pb-6 border-b border-[#d9e2ec]">
              <h2 className="text-lg font-semibold mb-4 text-[#243b53]">Python Optimization</h2>
              <div className="flex border border-[#bcccdc] rounded overflow-hidden mb-4">
                {['material', 'labor', 'balanced'].map((strategy) => (
                  <button
                    key={strategy}
                    className={`flex-1 py-2 px-2 text-xs font-medium transition-colors capitalize ${
                      selectedStrategy === strategy 
                        ? 'bg-[#0a2463] text-white' 
                        : 'bg-white text-[#0a2463]'
                    }`}
                    onClick={() => setSelectedStrategy(strategy)}
                  >
                    {strategy}
                  </button>
                ))}
              </div>
              <Button
                onClick={runOptimization}
                className="w-full bg-[#ff7f11] text-white hover:bg-[#e36a00]"
              >
                Run Python Optimization
              </Button>
              
              {optimizationResults && (
                <div className="mt-4 p-3 bg-[#f0f4f8] rounded text-sm">
                  <div className="font-semibold mb-2">Optimization Results</div>
                  <div className="grid grid-cols-[auto_1fr] gap-2 text-xs">
                    <div className="font-medium">Strategy:</div>
                    <div>{selectedStrategy}</div>
                    <div className="font-medium">Total Panels:</div>
                    <div>{optimizationResults.placements.length}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Export Options */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-[#243b53]">Export Options</h2>
              <div className="space-y-2">
                <Button
                  onClick={exportDXF}
                  variant="outline"
                  className="w-full"
                >
                  Export DXF
                </Button>
                <Button
                  onClick={exportCSV}
                  variant="outline"
                  className="w-full"
                >
                  Export CSV
                </Button>
                <Button
                  onClick={visualize3D}
                  className="w-full bg-[#0a2463] text-white"
                >
                  3D Visualization
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel - Viewer */}
          <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-[#d9e2ec]">
              <h2 className="text-xl font-semibold text-[#243b53]">Python-Powered Panel Layout</h2>
              <Button
                onClick={() => setShowPanels(!showPanels)}
                variant="outline"
              >
                Toggle Panel View
              </Button>
            </div>

            <div className="flex-grow bg-[#f8fafc] border-2 border-dashed border-[#9fb3c8] rounded relative overflow-hidden">
              <div
                ref={panelViewerRef}
                className={`w-full h-full flex items-center justify-center ${
                  selectedShape === 'polygon' ? 'cursor-crosshair' : ''
                }`}
                onClick={handleCanvasClick}
                onContextMenu={handleCanvasRightClick}
                style={{
                  backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <div className="w-10 h-10 border-4 border-[#0a2463]/20 border-l-[#0a2463] rounded-full animate-spin" />
                  </div>
                )}
                {!contourImageData && !isLoading && (
                  <div className="text-center text-[#9fb3c8]">
                    <p className="text-lg mb-2">Empty Canvas</p>
                    <p className="text-sm">Visualize terrain or add panels to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-5 right-5 max-w-sm bg-white rounded-lg shadow-lg p-4 z-50 transition-all duration-300">
          <div className="flex justify-between items-start mb-2">
            <div className="font-semibold text-[#243b53]">{toast.title}</div>
            <button
              onClick={() => setToast({ show: false, title: '', message: '' })}
              className="text-[#627d98] hover:text-[#243b53] text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="text-[#627d98] text-sm">{toast.message}</div>
        </div>
      )}
    </div>
  );
}