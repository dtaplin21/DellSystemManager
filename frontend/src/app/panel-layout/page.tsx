'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import './panel-layout.css';

interface Panel {
  id: string;
  rollNumber: string;
  panelNumber: string;
  width: number;
  length: number;
  material: string;
  shape: string;
  x: number;
  y: number;
  base?: number;
  height?: number;
}

export default function PanelLayoutPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [rollNumber, setRollNumber] = useState('');
  const [panelNumber, setPanelNumber] = useState('');
  const [dimensions, setDimensions] = useState({
    width: 15,
    length: 100,
    base: 15,
    height: 12
  });
  const [zoomLevel, setZoomLevel] = useState(1);

  const addPanel = () => {
    if (!rollNumber || !panelNumber) {
      alert('Please enter both roll number and panel number.');
      return;
    }

    const newPanel: Panel = {
      id: panelNumber,
      rollNumber,
      panelNumber,
      width: dimensions.width,
      length: dimensions.length,
      material: 'Standard',
      shape: selectedShape,
      x: 50 + (panels.length * 20),
      y: 50 + (panels.length * 15),
      ...(selectedShape === 'triangle' && {
        base: dimensions.base,
        height: dimensions.height
      })
    };

    setPanels([...panels, newPanel]);
    setRollNumber('');
    setPanelNumber('');
  };

  const clearAllPanels = () => {
    setPanels([]);
  };

  const updateZoom = (delta: number) => {
    const newZoom = Math.max(0.2, Math.min(3, zoomLevel + delta));
    setZoomLevel(newZoom);
  };

  return (
    <div className="panel-layout-page">
      <header className="panel-header">
        <div className="logo">GeoQC</div>
        <nav className="panel-nav">
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/projects">Projects</a>
          <a href="/panel-layout" className="active">Panel Layout</a>
        </nav>
      </header>

      <div className="container">
        <div className="panel-layout-interface">
          <div className="panel-controls">
            <div className="control-section">
              <h2 className="section-title">Panel Management</h2>
              
              {/* Shape Selection */}
              <div className="form-group">
                <label>Panel Shape</label>
                <div className="shape-toggle">
                  <div 
                    className={`shape-option ${selectedShape === 'rectangle' ? 'selected' : ''}`}
                    onClick={() => setSelectedShape('rectangle')}
                  >
                    Rectangle
                  </div>
                  <div 
                    className={`shape-option ${selectedShape === 'triangle' ? 'selected' : ''}`}
                    onClick={() => setSelectedShape('triangle')}
                  >
                    Triangle
                  </div>
                  <div 
                    className={`shape-option ${selectedShape === 'hexagon' ? 'selected' : ''}`}
                    onClick={() => setSelectedShape('hexagon')}
                  >
                    Hexagon
                  </div>
                </div>
              </div>

              {/* Panel Identification */}
              <div className="form-group">
                <label htmlFor="panel-roll">Roll Number</label>
                <input 
                  type="text" 
                  id="panel-roll" 
                  placeholder="e.g. R-102" 
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="panel-number">Panel Number</label>
                <input 
                  type="text" 
                  id="panel-number" 
                  placeholder="e.g. P-001" 
                  value={panelNumber}
                  onChange={(e) => setPanelNumber(e.target.value)}
                  required 
                />
              </div>

              {/* Rectangle Controls */}
              {selectedShape === 'rectangle' && (
                <div className="shape-controls">
                  <div className="form-group">
                    <label>Add Rectangular Panel</label>
                    <div className="dimensions-grid">
                      <div>
                        <label htmlFor="panel-width">Width (ft)</label>
                        <input 
                          type="number" 
                          id="panel-width" 
                          value={dimensions.width} 
                          min="1" 
                          max="100"
                          onChange={(e) => setDimensions({...dimensions, width: parseFloat(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label htmlFor="panel-length">Length (ft)</label>
                        <input 
                          type="number" 
                          id="panel-length" 
                          value={dimensions.length} 
                          min="1" 
                          max="500"
                          onChange={(e) => setDimensions({...dimensions, length: parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Triangle Controls */}
              {selectedShape === 'triangle' && (
                <div className="shape-controls">
                  <div className="form-group">
                    <label>Add Triangle Panel</label>
                    <div className="input-row">
                      <div className="input-wrapper">
                        <label htmlFor="triangle-base">Base (ft)</label>
                        <input 
                          type="number" 
                          id="triangle-base" 
                          value={dimensions.base} 
                          min="1" 
                          max="100"
                          onChange={(e) => setDimensions({...dimensions, base: parseFloat(e.target.value)})}
                        />
                      </div>
                      <div className="input-wrapper">
                        <label htmlFor="triangle-height">Height (ft)</label>
                        <input 
                          type="number" 
                          id="triangle-height" 
                          value={dimensions.height} 
                          min="1" 
                          max="100"
                          onChange={(e) => setDimensions({...dimensions, height: parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>
                    <small>Enter base and height for triangle panel</small>
                  </div>
                </div>
              )}

              {/* Hexagon Controls */}
              {selectedShape === 'hexagon' && (
                <div className="shape-controls">
                  <div className="form-group">
                    <label>Add Hexagon Panel</label>
                    <p>Hexagon panels coming soon...</p>
                  </div>
                </div>
              )}

              <Button onClick={addPanel} className="btn-primary w-full mt-4">
                Add Panel
              </Button>

              <Button onClick={clearAllPanels} className="btn-secondary w-full mt-2">
                Clear All Panels
              </Button>
            </div>
          </div>

          {/* Panel Viewer */}
          <div className="panel-viewer-container">
            <div className="viewer-header">
              <h3>Layout Viewer</h3>
              <div className="zoom-controls">
                <Button onClick={() => updateZoom(-0.1)} className="zoom-btn">-</Button>
                <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <Button onClick={() => updateZoom(0.1)} className="zoom-btn">+</Button>
              </div>
            </div>
            
            <div 
              className="panel-viewer"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className={`panel-item ${panel.shape}`}
                  style={{
                    left: panel.x,
                    top: panel.y,
                    width: panel.shape === 'triangle' ? panel.base : panel.width,
                    height: panel.shape === 'triangle' ? panel.height : panel.length
                  }}
                >
                  <div className="panel-content">
                    <div className="roll-text">{panel.rollNumber}</div>
                    <div className="panel-text">{panel.panelNumber}</div>
                    <div className="size-text">
                      {panel.shape === 'triangle' 
                        ? `${panel.base}' × ${panel.height}'`
                        : `${panel.width}' × ${panel.length}'`
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel List */}
        <div className="panel-list">
          <h3>Panel List ({panels.length})</h3>
          {panels.length === 0 ? (
            <p>No panels added yet.</p>
          ) : (
            <div className="panel-items">
              {panels.map((panel) => (
                <div key={panel.id} className="panel-list-item">
                  <span>{panel.rollNumber} - {panel.panelNumber}</span>
                  <span>
                    {panel.shape === 'triangle' 
                      ? `${panel.base}' × ${panel.height}' (Triangle)`
                      : `${panel.width}' × ${panel.length}' (Rectangle)`
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}