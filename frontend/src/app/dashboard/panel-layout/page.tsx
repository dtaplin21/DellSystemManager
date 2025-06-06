'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: string;
}

export default function PanelLayoutPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [siteConfig, setSiteConfig] = useState({
    width: 500,
    height: 400,
    scale: 1
  });

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  const addSamplePanel = () => {
    const newPanel: Panel = {
      id: `panel-${Date.now()}`,
      x: Math.random() * 300,
      y: Math.random() * 200,
      width: 100,
      height: 80,
      label: `Panel ${panels.length + 1}`,
      color: '#3b82f6'
    };
    setPanels(prev => [...prev, newPanel]);
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
        alert('Optimization successful! Check console for details.');
      } else {
        alert('Optimization failed');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      alert('Network error during optimization');
    } finally {
      setIsLoading(false);
    }
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

      {/* Controls */}
      <div className="bg-white shadow-md rounded-lg border border-navy-100">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-600">Controls</h2>
        </div>
        <div className="p-6">
          <div className="flex gap-4">
            <Button onClick={addSamplePanel} className="btn-navy">
              Add Sample Panel
            </Button>
            <Button onClick={testOptimization} className="btn-orange" disabled={isLoading}>
              {isLoading ? 'Optimizing...' : 'Test Optimization'}
            </Button>
            <Button onClick={() => setPanels([])} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
              Clear All
            </Button>
          </div>
          <p className="text-sm text-navy-300 mt-4">Current panels: {panels.length}</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="bg-white shadow-md rounded-lg border border-navy-100">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-600">Layout Canvas</h2>
        </div>
        <div className="p-6">
          <div 
            className="relative border-2 border-navy-200 bg-navy-50" 
            style={{ 
              width: `${siteConfig.width}px`, 
              height: `${siteConfig.height}px` 
            }}
          >
            {panels.map((panel) => (
              <div
                key={panel.id}
                className="absolute border-2 border-navy-600 bg-blue-100 opacity-80 hover:opacity-100 cursor-move flex items-center justify-center text-xs font-medium text-navy-600"
                style={{
                  left: `${panel.x}px`,
                  top: `${panel.y}px`,
                  width: `${panel.width}px`,
                  height: `${panel.height}px`,
                  backgroundColor: panel.color
                }}
              >
                {panel.label}
              </div>
            ))}
            {panels.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-navy-300">
                Click "Add Sample Panel" to get started
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white shadow-md rounded-lg border border-navy-100">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-600">Status</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-navy-300">Site Dimensions</p>
              <p className="text-lg font-medium text-navy-600">{siteConfig.width} × {siteConfig.height}</p>
            </div>
            <div>
              <p className="text-sm text-navy-300">Total Panels</p>
              <p className="text-lg font-medium text-navy-600">{panels.length}</p>
            </div>
            <div>
              <p className="text-sm text-navy-300">Panel Service</p>
              <p className="text-lg font-medium text-orange-600">Connected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}