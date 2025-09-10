'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PanelProvider, useCanvasState, usePanelState, useSelectedPanel } from '@/contexts/PanelContextV2';
import { usePanelData } from '@/hooks/usePanelDataV2';
import { useZoomPan } from '@/hooks/useZoomPan';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import TransformErrorBoundary from './TransformErrorBoundary';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

/**
 * Test component for Phase 2 state management integration
 * Verifies that world coordinates work with the new state management
 */
function Phase2TestContent() {
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Performance monitoring
  const { metrics, recordRenderTime } = usePerformanceMonitoring({
    onPerformanceIssue: (metrics) => {
      console.warn('Performance issue in Phase2Test:', metrics);
    }
  });

  // Panel data (world units)
  const { dataState, updatePanel, addTestPanel, clearStorage, loadData, saveData } = usePanelData({
    projectId: 'test-project',
    featureFlags: { ENABLE_DEBUG_LOGGING: true }
  });

  // Canvas state
  const { canvas, selectPanel, startDrag, endDrag } = useCanvasState();
  
  // Panel state
  const { panels, batchUpdatePanels } = usePanelState();
  
  // Selected panel
  const selectedPanel = useSelectedPanel();

  // Zoom/Pan hook
  const {
    transform,
    toWorld,
    toScreen,
    visibleWorldRect,
    gridLines,
    onWheel,
    onDragStart,
    onDragMove,
    onDragEnd,
    fitToExtent,
    performanceMetrics
  } = useZoomPan({
    worldWidth: WORLD_CONSTANTS.WIDTH_FT,
    worldHeight: WORLD_CONSTANTS.HEIGHT_FT,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    initialFit: 'extent',
    enablePerformanceMonitoring: true,
    onTransformChange: (transform) => {
      console.log('Transform changed:', transform);
    }
  });

  // Test world coordinate conversion
  const testCoordinateConversion = () => {
    const testScreenPos = { x: 400, y: 300 };
    const worldPos = toWorld(testScreenPos);
    const backToScreen = toScreen(worldPos);
    
    console.log('Phase 2 Coordinate conversion test:', {
      original: testScreenPos,
      toWorld: worldPos,
      backToScreen: backToScreen,
      difference: {
        x: Math.abs(testScreenPos.x - backToScreen.x),
        y: Math.abs(testScreenPos.y - backToScreen.y)
      }
    });
  };

  // Test panel operations
  const testPanelOperations = () => {
    console.log('Phase 2 Panel operations test:', {
      dataStatePanels: dataState.panels.length,
      contextPanels: panels.panels.length,
      selectedPanel: selectedPanel?.id,
      canvasState: canvas
    });
  };

  // Test world-based panel updates
  const testWorldPanelUpdate = () => {
    if (dataState.panels.length > 0) {
      const panel = dataState.panels[0];
      const newX = panel.x + 10; // Move 10 feet
      const newY = panel.y + 10; // Move 10 feet
      
      updatePanel(panel.id, { x: newX, y: newY });
      console.log('Updated panel position in world units:', {
        panelId: panel.id,
        oldPos: { x: panel.x, y: panel.y },
        newPos: { x: newX, y: newY }
      });
    }
  };

  // Test batch updates
  const testBatchUpdate = () => {
    const updates: Record<string, Partial<any>> = {};
    
    dataState.panels.slice(0, 3).forEach(panel => {
      updates[panel.id] = {
        x: panel.x + 5, // Move 5 feet
        y: panel.y + 5  // Move 5 feet
      };
    });
    
    batchUpdatePanels(updates);
    console.log('Batch updated panels:', Object.keys(updates));
  };

  // Render function
  const render = () => {
    const start = performance.now();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply transform
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1 / transform.scale;
    
    gridLines.forEach(line => {
      ctx.beginPath();
      if (line.type === 'vertical' && line.x !== undefined && line.startY !== undefined && line.endY !== undefined) {
        ctx.moveTo(line.x, line.startY);
        ctx.lineTo(line.x, line.endY);
      } else if (line.type === 'horizontal' && line.y !== undefined && line.startX !== undefined && line.endX !== undefined) {
        ctx.moveTo(line.startX, line.y);
        ctx.lineTo(line.endX, line.y);
      }
      ctx.stroke();
    });
    
    // Draw panels (world coordinates)
    dataState.panels.forEach(panel => {
      if (!panel.isValid) return;
      
      const isSelected = selectedPanel?.id === panel.id;
      
      // Panel background
      ctx.fillStyle = isSelected ? '#ef4444' : '#3b82f6';
      ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
      
      // Panel border
      ctx.strokeStyle = isSelected ? '#dc2626' : '#1e40af';
      ctx.lineWidth = 2 / transform.scale;
      ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
      
      // Panel label
      ctx.fillStyle = 'white';
      ctx.font = `${Math.max(8, Math.min(panel.width, panel.height) * 0.3)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        panel.panelNumber || panel.id, 
        panel.x + panel.width / 2, 
        panel.y + panel.height / 2
      );
    });
    
    ctx.restore();
    
    const duration = performance.now() - start;
    recordRenderTime(duration);
  };

  // Render on changes
  useEffect(() => {
    render();
  }, [transform, gridLines, dataState.panels, selectedPanel, recordRenderTime]);

  // Handle canvas events
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = toWorld({ x: screenX, y: screenY });
    
    // Find clicked panel
    const clickedPanel = dataState.panels.find(panel => {
      return worldPos.x >= panel.x && 
             worldPos.x <= panel.x + panel.width &&
             worldPos.y >= panel.y && 
             worldPos.y <= panel.y + panel.height;
    });
    
    if (clickedPanel) {
      selectPanel(clickedPanel.id);
      startDrag(clickedPanel.id, worldPos.x, worldPos.y);
      console.log('Selected panel:', clickedPanel.id, 'at world position:', worldPos);
    } else {
      selectPanel(null);
    }
    
    onDragStart(e.nativeEvent);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    onDragMove(e.nativeEvent);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (canvas.isDragging && selectedPanel) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = toWorld({ x: screenX, y: screenY });
        
        updatePanel(selectedPanel.id, { x: worldPos.x, y: worldPos.y });
        console.log('Updated panel position:', { panelId: selectedPanel.id, worldPos });
      }
    }
    
    endDrag();
    onDragEnd(e.nativeEvent);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    onWheel(e.nativeEvent);
  };

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Controls */}
      <div className="bg-gray-100 p-4 border-b">
        <h2 className="text-lg font-semibold mb-2">Phase 2 Test - State Management Integration</h2>
        
        <div className="flex space-x-4 mb-4">
          <button
            onClick={fitToExtent}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Fit to Extent
          </button>
          
          <button
            onClick={testCoordinateConversion}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Test Coordinates
          </button>
          
          <button
            onClick={testPanelOperations}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Test Panel Ops
          </button>
          
          <button
            onClick={testWorldPanelUpdate}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Test World Update
          </button>
          
          <button
            onClick={testBatchUpdate}
            className="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
          >
            Test Batch Update
          </button>
          
          <button
            onClick={addTestPanel}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Add Test Panel
          </button>
          
          <button
            onClick={clearStorage}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Storage
          </button>
        </div>
        
        {/* Performance Metrics */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <strong>FPS:</strong> {metrics.fps.toFixed(1)}
          </div>
          <div>
            <strong>Render Time:</strong> {metrics.renderTime.toFixed(2)}ms
          </div>
          <div>
            <strong>Memory:</strong> {metrics.memoryUsage.toFixed(1)}MB
          </div>
          <div>
            <strong>Status:</strong> 
            <span className={`ml-1 ${
              metrics.isLowPerf ? 'text-red-600' : 
              metrics.isSlowRender ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {metrics.isLowPerf ? 'Low FPS' : 
               metrics.isSlowRender ? 'Slow Render' : 
               'Good'}
            </span>
          </div>
        </div>
        
        {/* State Info */}
        <div className="mt-2 text-sm text-gray-600">
          <strong>Data State:</strong> {dataState.state} | 
          <strong> Panels:</strong> {dataState.panels.length} | 
          <strong> Selected:</strong> {selectedPanel?.id || 'None'} | 
          <strong> Transform:</strong> scale={transform.scale.toFixed(3)}
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={viewportSize.width}
          height={viewportSize.height}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
          style={{ touchAction: 'none' }}
        />
        
        {/* Instructions */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded text-sm">
          <div><strong>Phase 2 Instructions:</strong></div>
          <div>• Mouse wheel: Zoom in/out</div>
          <div>• Mouse drag: Pan around</div>
          <div>• Click panels: Select them</div>
          <div>• Drag panels: Move them (world units)</div>
          <div>• Use buttons to test functionality</div>
        </div>
      </div>
    </div>
  );
}

export function Phase2Test() {
  return (
    <TransformErrorBoundary>
      <PanelProvider>
        <Phase2TestContent />
      </PanelProvider>
    </TransformErrorBoundary>
  );
}

export default Phase2Test;
