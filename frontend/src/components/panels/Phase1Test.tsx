'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useZoomPan } from '@/hooks/useZoomPan';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import TransformErrorBoundary from './TransformErrorBoundary';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

/**
 * Test component for Phase 1 foundation
 * Verifies that all core components work together
 */
export function Phase1Test() {
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Performance monitoring
  const { metrics, startRenderTiming, endRenderTiming } = usePerformanceMonitoring({
    enabled: true,
    samplingRate: 0.1,
  });

  // Zoom/Pan hook
  const {
    x,
    y,
    scale,
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

  // Create transform object
  const transform = { x, y, scale };

  // Test coordinate conversion
  const testCoordinateConversion = useCallback(() => {
    const testScreenPos = { x: 400, y: 300 };
    const worldPos = toWorld(testScreenPos);
    const backToScreen = toScreen(worldPos);
    
    console.log('Coordinate conversion test:', {
      original: testScreenPos,
      toWorld: worldPos,
      backToScreen: backToScreen,
      difference: {
        x: Math.abs(testScreenPos.x - backToScreen.x),
        y: Math.abs(testScreenPos.y - backToScreen.y)
      }
    });
  }, [toWorld, toScreen]);

  // Test grid calculation
  const testGridCalculation = useCallback(() => {
    console.log('Grid calculation test:', {
      visibleRect: visibleWorldRect,
      gridLinesCount: gridLines.length,
      verticalLines: gridLines.filter(l => l.type === 'vertical').length,
      horizontalLines: gridLines.filter(l => l.type === 'horizontal').length
    });
  }, [visibleWorldRect, gridLines]);

  // Render test
  const render = useCallback(() => {
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
    
    // Draw test panel
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(100, 100, 50, 50);
    ctx.fillStyle = 'white';
    ctx.font = `${12 / transform.scale}px Arial`;
    ctx.fillText('Test Panel', 105, 125);
    
    ctx.restore();
    
    const duration = performance.now() - start;
    // Performance tracking handled by usePerformanceMonitoring hook
  }, [transform, gridLines]);

  // Render on transform change
  useEffect(() => {
    render();
  }, [render]);

  // Handle canvas events
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    onDragStart(e.nativeEvent);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    onDragMove(e.nativeEvent);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    onDragEnd(e.nativeEvent);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    onWheel(e.nativeEvent);
  };

  return (
    <TransformErrorBoundary>
      <div className="h-screen w-full flex flex-col">
        {/* Controls */}
        <div className="bg-gray-100 p-4 border-b">
          <h2 className="text-lg font-semibold mb-2">Phase 1 Test - Foundation & Safety</h2>
          
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
              onClick={testGridCalculation}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Test Grid
            </button>
          </div>
          
          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Render Time:</strong> {metrics.renderTime.toFixed(2)}ms
            </div>
            <div>
              <strong>Memory:</strong> {metrics.memoryUsage.toFixed(1)}MB
            </div>
            <div>
              <strong>Status:</strong> 
              <span className={`ml-1 ${
                metrics.renderTime > 16 ? 'text-red-600' : 
                metrics.renderTime > 8 ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {metrics.renderTime > 16 ? 'Low Performance' : 
                 metrics.renderTime > 8 ? 'Slow Render' : 
                 'Good'}
              </span>
            </div>
          </div>
          
          {/* Transform Info */}
          <div className="mt-2 text-sm text-gray-600">
            <strong>Transform:</strong> x={transform.x.toFixed(1)}, y={transform.y.toFixed(1)}, scale={transform.scale.toFixed(3)}
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
            <div><strong>Instructions:</strong></div>
            <div>• Mouse wheel: Zoom in/out</div>
            <div>• Mouse drag: Pan around</div>
            <div>• Click buttons to test functionality</div>
          </div>
        </div>
      </div>
    </TransformErrorBoundary>
  );
}

export default Phase1Test;
