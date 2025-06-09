'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

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
}

export default function PanelPlaygroundPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [rollNumber, setRollNumber] = useState('');
  const [panelNumber, setPanelNumber] = useState('');
  const [dimensions, setDimensions] = useState({ width: 15, length: 100 });
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    drawCanvas();
  }, [panels, scale]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 2000; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1500);
      ctx.stroke();
    }
    for (let y = 0; y <= 1500; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2000, y);
      ctx.stroke();
    }

    // Draw panels
    panels.forEach(panel => {
      ctx.fillStyle = panel.color;
      ctx.strokeStyle = selectedPanel === panel.id ? '#f97316' : '#374151';
      ctx.lineWidth = selectedPanel === panel.id ? 3 : 1;
      
      ctx.fillRect(panel.x, panel.y, panel.width * 5, panel.length * 2);
      ctx.strokeRect(panel.x, panel.y, panel.width * 5, panel.length * 2);
      
      // Draw labels
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(panel.rollNumber, panel.x + (panel.width * 5) / 2, panel.y + (panel.length * 2) / 2 - 10);
      ctx.fillText(panel.panelNumber, panel.x + (panel.width * 5) / 2, panel.y + (panel.length * 2) / 2 + 5);
      ctx.fillText(`${panel.width}' × ${panel.length}'`, panel.x + (panel.width * 5) / 2, panel.y + (panel.length * 2) / 2 + 20);
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

    const clickedPanel = panels.find(panel => 
      x >= panel.x && x <= panel.x + panel.width * 5 &&
      y >= panel.y && y <= panel.y + panel.length * 2
    );

    setSelectedPanel(clickedPanel ? clickedPanel.id : null);
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
        <div className="w-80 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Panel Management</h2>
          
          {/* Shape Selection */}
          <div className="mb-4">
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
              width={2000}
              height={1500}
              className="cursor-pointer"
              onClick={handleCanvasClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}