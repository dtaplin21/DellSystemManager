'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import './panel-layout.css';

interface Panel {
  id: string;
  width: number;
  length: number;
  material: string;
  shape: 'rectangle' | 'polygon';
  corners?: number[][];
  x?: number;
  y?: number;
  rotation?: number;
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
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [snapThreshold] = useState(15); // Distance in pixels for snap detection
  const [showSnapGuides, setShowSnapGuides] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{x?: number, y?: number}>({});
  const [toast, setToast] = useState<{show: boolean, title: string, message: string}>({
    show: false, title: '', message: ''
  });

  const [siteConfig, setSiteConfig] = useState({
    width: 1000,
    length: 1000,
    panelNumber: '',
    rollNumber: ''
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

  // Effect to initialize viewer canvas
  useEffect(() => {
    if (panelViewerRef.current && !contourImageData) {
      initializeViewer();
    }
  }, []);

  const initializeViewer = () => {
    // This will be handled by React JSX instead of DOM manipulation
  };

  const clearPolygonPoints = () => {
    setPolygonPoints([]);
    setIsCreatingPolygon(false);
  };

  const removePolygonPoint = (index: number) => {
    setPolygonPoints(prev => prev.filter((_, i) => i !== index));
  };

  const finishPolygon = () => {
    // Validate mandatory fields for polygons too
    if (!siteConfig.panelNumber.trim() || !siteConfig.rollNumber.trim()) {
      showToast('Missing Information', 'Please enter panel number and roll number before creating polygons.');
      return;
    }

    if (polygonPoints.length >= 3) {
      const minX = Math.min(...polygonPoints.map(p => p.x));
      const maxX = Math.max(...polygonPoints.map(p => p.x));
      const minY = Math.min(...polygonPoints.map(p => p.y));
      const maxY = Math.max(...polygonPoints.map(p => p.y));

      const width = maxX - minX;
      const height = maxY - minY;

      const panel: Panel = {
        id: `${siteConfig.panelNumber}-${siteConfig.rollNumber}-${panelCounter}`,
        width: width || 15,
        length: height || 100,
        material: newPanel.material,
        shape: 'polygon',
        corners: polygonPoints.map(p => [p.x, p.y]),
        x: minX,
        y: minY,
        rotation: 0
      };

      setPanels(prev => [...prev, panel]);
      setPanelCounter(prev => prev + 1);
      clearPolygonPoints();
      showToast('Polygon Created', `Custom polygon panel ${panel.id} added with ${polygonPoints.length} points.`);
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
    // Validate mandatory fields first
    if (!siteConfig.panelNumber.trim()) {
      showToast('Missing Panel Number', 'Please enter a panel number before adding panels.');
      return;
    }

    if (!siteConfig.rollNumber.trim()) {
      showToast('Missing Roll Number', 'Please enter a roll number before adding panels.');
      return;
    }

    if (selectedShape === 'rectangle') {
      if (isNaN(newPanel.width) || isNaN(newPanel.length) || newPanel.width <= 0 || newPanel.length <= 0) {
        showToast('Invalid Input', 'Please enter valid width and length values.');
        return;
      }

      const panel: Panel = {
        id: `${siteConfig.panelNumber}-${siteConfig.rollNumber}-${panelCounter}`,
        width: newPanel.width,
        length: newPanel.length,
        material: newPanel.material,
        shape: 'rectangle',
        x: 30 + (panelCounter * 20) % 300,
        y: 30 + Math.floor(panelCounter / 6) * 50,
        rotation: 0
      };

      setPanels(prev => [...prev, panel]);
      setPanelCounter(prev => prev + 1);
      showToast('Panel Added', `Panel ${panel.id} added successfully.`);

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

    setIsLoading(true);

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
      setIsLoading(false);
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

    setIsLoading(true);

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
      setIsLoading(false);
    }
  };

  const exportDXF = async () => {
    if (!optimizationResults || optimizationResults.placements.length === 0) {
      showToast('Error', 'No optimized panels to export');
      return;
    }

    setIsLoading(true);

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
      setIsLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!optimizationResults || optimizationResults.placements.length === 0) {
      showToast('Error', 'No optimized panels to export');
      return;
    }

    setIsLoading(true);

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
      setIsLoading(false);
    }
  };

  const visualize3D = async () => {
    if (isNaN(siteConfig.width) || isNaN(siteConfig.length) || siteConfig.width <= 0 || siteConfig.length <= 0) {
      showToast('Error', 'Please enter valid site dimensions');
      return;
    }

    setIsLoading(true);

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
      setIsLoading(false);
    }
  };

  const displayContourImage = (imageData: string) => {
    setContourImageData(imageData);
  };

  const updatePanel = (panelId: string, updates: Partial<Panel>) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, ...updates } : panel
    ));
  };

  const handlePanelMouseDown = (e: React.MouseEvent, panelId: string, action: 'drag' | 'resize' | 'rotate') => {
    e.stopPropagation();
    setSelectedPanelId(panelId);
    
    const rect = panelViewerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });

    if (action === 'drag') {
      setIsDragging(true);
    } else if (action === 'resize') {
      setIsResizing(true);
    } else if (action === 'rotate') {
      setIsRotating(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !selectedPanelId) return;
    
    const rect = panelViewerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const deltaX = currentX - dragStart.x;
    const deltaY = currentY - dragStart.y;
    
    const selectedPanel = panels.find(p => p.id === selectedPanelId);
    if (!selectedPanel) return;

    if (isDragging) {
      let newX = Math.max(0, (selectedPanel.x || 0) + deltaX);
      let newY = Math.max(0, (selectedPanel.y || 0) + deltaY);
      
      // Find snap targets
      const snapTargets = findSnapTargets(selectedPanel, newX, newY);
      
      // Apply snapping
      if (snapTargets.x !== undefined) {
        newX = snapTargets.x;
        setShowSnapGuides(true);
        setSnapGuides(prev => ({ ...prev, x: snapTargets.x }));
      } else {
        setSnapGuides(prev => ({ ...prev, x: undefined }));
      }
      
      if (snapTargets.y !== undefined) {
        newY = snapTargets.y;
        setShowSnapGuides(true);
        setSnapGuides(prev => ({ ...prev, y: snapTargets.y }));
      } else {
        setSnapGuides(prev => ({ ...prev, y: undefined }));
      }
      
      // Update panel position
      updatePanel(selectedPanelId, { x: newX, y: newY });
      setDragStart({ x: currentX, y: currentY });
    } else if (isResizing) {
      const scale = 0.3;
      updatePanel(selectedPanelId, {
        width: Math.max(5, selectedPanel.width + deltaX / scale),
        length: Math.max(5, selectedPanel.length + deltaY / scale)
      });
      setDragStart({ x: currentX, y: currentY });
    } else if (isRotating) {
      const centerX = (selectedPanel.x || 0) + (selectedPanel.width * 0.3) / 2;
      const centerY = (selectedPanel.y || 0) + (selectedPanel.length * 0.3) / 2;
      const angle = Math.atan2(currentY - centerY, currentX - centerX) * 180 / Math.PI;
      updatePanel(selectedPanelId, {
        rotation: angle
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setDragStart(null);
    setShowSnapGuides(false);
    setSnapGuides({});
  };

  const findSnapTargets = (movingPanel: Panel, newX: number, newY: number) => {
    const snapTargets: {x?: number, y?: number} = {};
    const scale = 0.3;
    
    const movingWidth = movingPanel.width * scale;
    const movingHeight = movingPanel.length * scale;
    
    // Check against all other panels
    panels.forEach(panel => {
      if (panel.id === movingPanel.id) return;
      
      const panelX = panel.x || 0;
      const panelY = panel.y || 0;
      const panelWidth = panel.width * scale;
      const panelHeight = panel.length * scale;
      
      // Check for horizontal alignment (left, right, center)
      const leftToLeft = Math.abs(newX - panelX);
      const leftToRight = Math.abs(newX - (panelX + panelWidth));
      const rightToLeft = Math.abs((newX + movingWidth) - panelX);
      const rightToRight = Math.abs((newX + movingWidth) - (panelX + panelWidth));
      const centerToCenter = Math.abs((newX + movingWidth/2) - (panelX + panelWidth/2));
      
      // Check for vertical alignment (top, bottom, center)
      const topToTop = Math.abs(newY - panelY);
      const topToBottom = Math.abs(newY - (panelY + panelHeight));
      const bottomToTop = Math.abs((newY + movingHeight) - panelY);
      const bottomToBottom = Math.abs((newY + movingHeight) - (panelY + panelHeight));
      const centerToCenterY = Math.abs((newY + movingHeight/2) - (panelY + panelHeight/2));
      
      // Snap to edges when panels are adjacent or overlapping vertically
      const verticalOverlap = !(newY + movingHeight < panelY || newY > panelY + panelHeight);
      const horizontalOverlap = !(newX + movingWidth < panelX || newX > panelX + panelWidth);
      
      if (verticalOverlap) {
        if (leftToLeft < snapThreshold) snapTargets.x = panelX;
        else if (leftToRight < snapThreshold) snapTargets.x = panelX + panelWidth;
        else if (rightToLeft < snapThreshold) snapTargets.x = panelX - movingWidth;
        else if (rightToRight < snapThreshold) snapTargets.x = panelX + panelWidth - movingWidth;
        else if (centerToCenter < snapThreshold) snapTargets.x = panelX + panelWidth/2 - movingWidth/2;
      }
      
      if (horizontalOverlap) {
        if (topToTop < snapThreshold) snapTargets.y = panelY;
        else if (topToBottom < snapThreshold) snapTargets.y = panelY + panelHeight;
        else if (bottomToTop < snapThreshold) snapTargets.y = panelY - movingHeight;
        else if (bottomToBottom < snapThreshold) snapTargets.y = panelY + panelHeight - movingHeight;
        else if (centerToCenterY < snapThreshold) snapTargets.y = panelY + panelHeight/2 - movingHeight/2;
      }
    });
    
    return snapTargets;
  };

  const renderPanelElement = (panel: Panel, index: number) => {
    const scale = 0.3;
    const isSelected = selectedPanelId === panel.id;
    
    if (panel.shape === 'rectangle') {
      const width = Math.max(panel.width * scale, 40);
      const height = Math.max(panel.length * scale, 25);
      const x = panel.x || (30 + (index * 20) % 300);
      const y = panel.y || (30 + Math.floor(index / 6) * (height + 20));
      const rotation = panel.rotation || 0;

      return (
        <div key={panel.id} style={{ position: 'absolute', left: x, top: y }}>
          {/* Main Panel */}
          <div
            className={`rendered-panel ${isSelected ? 'panel-selected' : ''} ${isDragging && isSelected ? 'panel-dragging' : ''} ${(snapGuides.x !== undefined || snapGuides.y !== undefined) && isSelected ? 'snap-active' : ''}`}
            style={{
              width: `${width}px`,
              height: `${height}px`,
              background: isSelected ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 0.8)',
              border: isSelected ? '3px solid #1d4ed8' : '2px solid #3b82f6',
              borderRadius: '4px',
              cursor: isDragging && isSelected ? 'grabbing' : 'move',
              zIndex: isSelected ? 20 : 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: 'white',
              fontWeight: 'bold',
              textShadow: '1px 1px 1px rgba(0,0,0,0.8)',
              boxShadow: isSelected ? '0 4px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center',
              transition: isDragging ? 'none' : 'all 0.2s ease'
            }}
            onMouseDown={(e) => handlePanelMouseDown(e, panel.id, 'drag')}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPanelId(panel.id);
              showToast('Panel Selected', `${panel.id}: ${panel.width}' × ${panel.length}' (${panel.material})`);
            }}
          >
            {panel.id.replace(/.*-/, 'P')}
          </div>

          {/* Interactive Handles - Only show when selected */}
          {isSelected && (
            <>
              {/* Resize Handle - Bottom Right */}
              <div
                style={{
                  position: 'absolute',
                  right: '-6px',
                  bottom: '-6px',
                  width: '12px',
                  height: '12px',
                  background: '#1d4ed8',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'se-resize',
                  zIndex: 25,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: `${-width/2 + 6}px ${-height/2 + 6}px`
                }}
                onMouseDown={(e) => handlePanelMouseDown(e, panel.id, 'resize')}
              />

              {/* Rotation Handle - Top Center */}
              <div
                style={{
                  position: 'absolute',
                  left: `${width/2 - 6}px`,
                  top: '-20px',
                  width: '12px',
                  height: '12px',
                  background: '#dc2626',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'grab',
                  zIndex: 25,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: `6px ${height/2 + 20}px`
                }}
                onMouseDown={(e) => handlePanelMouseDown(e, panel.id, 'rotate')}
              />

              {/* Connection Line for Rotation Handle */}
              <div
                style={{
                  position: 'absolute',
                  left: `${width/2}px`,
                  top: '-8px',
                  width: '2px',
                  height: '12px',
                  background: '#dc2626',
                  transformOrigin: `1px ${height/2 + 8}px`,
                  transform: `rotate(${rotation}deg)`,
                  zIndex: 24
                }}
              />

              {/* Dimension Labels */}
              <div
                style={{
                  position: 'absolute',
                  left: `${width + 8}px`,
                  top: '2px',
                  background: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  padding: '2px 4px',
                  borderRadius: '2px',
                  fontSize: '9px',
                  whiteSpace: 'nowrap',
                  zIndex: 25
                }}
              >
                {panel.width.toFixed(1)}' × {panel.length.toFixed(1)}'
              </div>
            </>
          )}
        </div>
      );
    } else if (panel.shape === 'polygon' && panel.corners) {
      const minX = Math.min(...panel.corners.map(c => c[0]));
      const maxX = Math.max(...panel.corners.map(c => c[0]));
      const minY = Math.min(...panel.corners.map(c => c[1]));
      const maxY = Math.max(...panel.corners.map(c => c[1]));
      const x = panel.x || minX;
      const y = panel.y || minY;
      
      return (
        <div
          key={panel.id}
          className="rendered-panel"
          style={{
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${Math.max(maxX - minX, 40)}px`,
            height: `${Math.max(maxY - minY, 25)}px`,
            background: isSelected ? 'rgba(168, 85, 247, 0.9)' : 'rgba(168, 85, 247, 0.8)',
            border: isSelected ? '3px solid #7c3aed' : '2px solid #a855f7',
            borderRadius: '4px',
            cursor: 'move',
            zIndex: isSelected ? 20 : 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'white',
            fontWeight: 'bold',
            textShadow: '1px 1px 1px rgba(0,0,0,0.8)',
            boxShadow: isSelected ? '0 4px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseDown={(e) => handlePanelMouseDown(e, panel.id, 'drag')}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPanelId(panel.id);
            showToast('Panel Selected', `${panel.id}: ${panel.width}' × ${panel.length}' (${panel.material})`);
          }}
        >
          {panel.id.replace(/.*-/, 'P')}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="panel-layout-page">
      {/* Header */}
      <header className="panel-layout-header">
        <div className="panel-layout-logo">GeoQC</div>
        <nav className="panel-layout-nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/dashboard/projects">Projects</Link>
          <span className="active">Panel Layout</span>
          <Link href="/dashboard/qc-data">QC Data</Link>
          <Link href="/dashboard/documents">Documents</Link>
        </nav>
      </header>

      <div className="panel-layout-container">
        <div className="panel-layout-interface">
          {/* Left Panel - Controls */}
          <div className="panel-controls">
            
            {/* Site Configuration */}
            <div className="control-section">
              <h2 className="section-title">Site Configuration</h2>
              
              {/* Site Dimensions */}
              <div className="form-group">
                <label htmlFor="site-width">Site Width (ft)</label>
                <input
                  type="number"
                  id="site-width"
                  className="form-input"
                  value={siteConfig.width}
                  onChange={(e) => setSiteConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 1000 }))}
                  min="500"
                  max="2000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="site-length">Site Length (ft)</label>
                <input
                  type="number"
                  id="site-length"
                  className="form-input"
                  value={siteConfig.length}
                  onChange={(e) => setSiteConfig(prev => ({ ...prev, length: parseInt(e.target.value) || 1000 }))}
                  min="500"
                  max="2000"
                />
              </div>
              <div className="form-group">
                <button 
                  onClick={visualizeTerrain}
                  className="btn btn-secondary btn-block"
                >
                  Visualize Terrain
                </button>
              </div>
            </div>

            {/* Panel Management */}
            <div className="control-section">
              <h2 className="section-title">Panel Management</h2>
              
              {/* Required Panel Information */}
              <div className="form-group">
                <label htmlFor="panel-number">Panel Number <span style={{color: 'red'}}>*</span></label>
                <input
                  type="text"
                  id="panel-number"
                  className={`form-input ${!siteConfig.panelNumber.trim() ? 'required-field' : ''}`}
                  value={siteConfig.panelNumber}
                  onChange={(e) => setSiteConfig(prev => ({ ...prev, panelNumber: e.target.value }))}
                  placeholder="e.g., P001, Panel-A"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="roll-number">Roll Number <span style={{color: 'red'}}>*</span></label>
                <input
                  type="text"
                  id="roll-number"
                  className={`form-input ${!siteConfig.rollNumber.trim() ? 'required-field' : ''}`}
                  value={siteConfig.rollNumber}
                  onChange={(e) => setSiteConfig(prev => ({ ...prev, rollNumber: e.target.value }))}
                  placeholder="e.g., R001, Roll-1"
                  required
                />
              </div>
              
              {/* Shape Toggle */}
              <div className="form-group">
                <label>Panel Shape</label>
                <div className="shape-toggle">
                  <div
                    className={`shape-option ${selectedShape === 'rectangle' ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedShape('rectangle');
                      clearPolygonPoints();
                    }}
                  >
                    Rectangle
                  </div>
                  <div
                    className={`shape-option ${selectedShape === 'polygon' ? 'selected' : ''}`}
                    onClick={() => setSelectedShape('polygon')}
                  >
                    Custom Polygon
                  </div>
                </div>
              </div>

              {/* Rectangle Controls */}
              {selectedShape === 'rectangle' && (
                <div id="rectangle-controls" className="shape-controls">
                  <div className="form-group">
                    <label>Add Rectangular Panel</label>
                    <div className="dimensions-grid">
                      <div>
                        <label htmlFor="panel-width">Width (ft)</label>
                        <input
                          type="number"
                          id="panel-width"
                          className="form-input"
                          value={newPanel.width}
                          onChange={(e) => setNewPanel(prev => ({ ...prev, width: parseInt(e.target.value) || 15 }))}
                          min="1"
                          max="100"
                        />
                      </div>
                      <div>
                        <label htmlFor="panel-length">Length (ft)</label>
                        <input
                          type="number"
                          id="panel-length"
                          className="form-input"
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
                <div id="polygon-controls" className="shape-controls">
                  <div className="form-group">
                    <label>Create Custom Polygon</label>
                    <p style={{fontSize: '0.75rem', color: 'var(--color-navy-600)', marginBottom: '0.5rem'}}>
                      Click on the viewer to add polygon points. Right-click to finish.
                    </p>
                    <div id="polygon-points-list" className="polygon-points">
                      {polygonPoints.map((point, index) => (
                        <div key={index} className="polygon-point">
                          <span className="point-coords">Point {index + 1}: ({point.x}, {point.y})</span>
                          <button
                            className="remove-point"
                            onClick={() => removePolygonPoint(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="btn-group" style={{marginTop: '0.5rem'}}>
                      <button
                        onClick={clearPolygonPoints}
                        className="btn btn-secondary"
                        style={{fontSize: '0.75rem'}}
                      >
                        Clear Points
                      </button>
                      <button
                        onClick={finishPolygon}
                        disabled={polygonPoints.length < 3}
                        className="btn btn-primary"
                        style={{fontSize: '0.75rem'}}
                      >
                        Finish Polygon
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Material Selection */}
              <div className="form-group">
                <label htmlFor="panel-material">Material Type</label>
                <select
                  id="panel-material"
                  className="form-select"
                  value={newPanel.material}
                  onChange={(e) => setNewPanel(prev => ({ ...prev, material: e.target.value }))}
                >
                  <option>HDPE 60 mil</option>
                  <option>HDPE 80 mil</option>
                  <option>LLDPE 40 mil</option>
                  <option>PVC 30 mil</option>
                  <option>GCL</option>
                </select>
              </div>

              <div className="form-group">
                <button
                  onClick={addPanel}
                  className="btn btn-primary btn-block"
                >
                  Add Panel
                </button>
              </div>

              {/* Panel List */}
              <div className="panel-list" id="panel-list">
                {panels.map((panel) => (
                  <div key={panel.id} className="panel-list-item">
                    <span>{panel.id}</span>
                    <span>{panel.width}' x {panel.length}' {panel.material}</span>
                  </div>
                ))}
              </div>

              <div className="btn-group">
                <button
                  onClick={clearAllPanels}
                  className="btn btn-secondary"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Python Optimization */}
            <div className="control-section">
              <h2 className="section-title">Python Optimization</h2>
              <div className="optimization-toggle">
                {['material', 'labor', 'balanced'].map((strategy) => (
                  <div
                    key={strategy}
                    className={`optimization-option ${selectedStrategy === strategy ? 'selected' : ''}`}
                    onClick={() => setSelectedStrategy(strategy)}
                  >
                    {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                  </div>
                ))}
              </div>
              <div className="form-group">
                <button
                  onClick={runOptimization}
                  className="btn btn-accent btn-block"
                >
                  Run Python Optimization
                </button>
              </div>
              
              {optimizationResults && (
                <div id="optimization-results" className="results-section">
                  <div className="results-title">Optimization Results</div>
                  <div className="results-grid">
                    <div className="results-label">Strategy:</div>
                    <div>{selectedStrategy}</div>
                    <div className="results-label">Total Panels:</div>
                    <div>{optimizationResults.placements.length}</div>
                    <div className="results-label">Utilization:</div>
                    <div>{optimizationResults.summary?.utilization || 'N/A'}</div>
                    <div className="results-label">Elevated Panels:</div>
                    <div>{optimizationResults.summary?.elevatedPanels || 'N/A'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Export Options */}
            <div className="control-section">
              <h2 className="section-title">Export Options</h2>
              <div className="export-section">
                <button
                  onClick={exportDXF}
                  className="btn btn-secondary"
                >
                  Export DXF
                </button>
                <button
                  onClick={exportCSV}
                  className="btn btn-secondary"
                >
                  Export CSV
                </button>
                <button
                  onClick={visualize3D}
                  className="btn btn-primary btn-block"
                >
                  3D Visualization
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Viewer */}
          <div className="panel-viewer-container">
            <div className="viewer-toolbar">
              <h2 className="toolbar-title">Python-Powered Panel Layout</h2>
              <div>
                <button
                  onClick={() => setShowPanels(!showPanels)}
                  className="btn btn-secondary"
                >
                  Toggle Panel View
                </button>
              </div>
            </div>

            <div
              className={`panel-viewer ${selectedShape === 'polygon' ? 'polygon-mode' : ''}`}
              id="panel-viewer"
              ref={panelViewerRef}
              onClick={(e) => {
                handleCanvasClick(e);
                setSelectedPanelId(null); // Deselect panels when clicking empty space
              }}
              onContextMenu={handleCanvasRightClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '400px',
                background: contourImageData ? 'transparent' : 'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundColor: '#ffffff',
                userSelect: 'none'
              }}
            >
              {/* Terrain image background */}
              {contourImageData && (
                <img 
                  src={`data:image/png;base64,${contourImageData}`}
                  alt="Terrain Contour Map"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              )}
              
              {/* Loading overlay */}
              {isLoading && (
                <div className="loading-overlay">
                  <div className="spinner"></div>
                </div>
              )}
              
              {/* Empty state */}
              {!contourImageData && !isLoading && panels.length === 0 && (
                <div style={{textAlign: 'center', color: 'var(--color-navy-300)', padding: '2rem'}}>
                  <p style={{fontSize: '1.125rem', marginBottom: '0.5rem'}}>Empty Canvas</p>
                  <p style={{fontSize: '0.875rem'}}>Add panels or visualize terrain to get started</p>
                </div>
              )}
              
              {/* Snap guides */}
              {showSnapGuides && (
                <svg 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    pointerEvents: 'none',
                    zIndex: 30
                  }}
                >
                  {snapGuides.x !== undefined && (
                    <line
                      x1={snapGuides.x}
                      y1={0}
                      x2={snapGuides.x}
                      y2="100%"
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      opacity="0.8"
                    />
                  )}
                  {snapGuides.y !== undefined && (
                    <line
                      x1={0}
                      y1={snapGuides.y}
                      x2="100%"
                      y2={snapGuides.y}
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      opacity="0.8"
                    />
                  )}
                </svg>
              )}

              {/* Render panels using React */}
              {showPanels && panels.map((panel, index) => renderPanelElement(panel, index))}
              
              {/* Polygon creation feedback */}
              {isCreatingPolygon && polygonPoints.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  Points: {polygonPoints.length} | Right-click to finish
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="toast show" id="toast">
          <div className="toast-header">
            <div className="toast-title">{toast.title}</div>
            <button
              className="toast-close"
              onClick={() => setToast({ show: false, title: '', message: '' })}
            >
              &times;
            </button>
          </div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}
    </div>
  );
}