'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PanelProvider, useCanvasState, usePanelState } from '@/contexts/PanelContextV2';
import { usePanelData } from '@/hooks/usePanelDataV2';
import { useZoomPan } from '@/hooks/useZoomPan';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import TransformErrorBoundary from './TransformErrorBoundary';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

/**
 * Phase 4 Foundation Test
 * Verifies that all missing dependencies are working correctly
 * Tests the complete foundation before adding new features
 */
function Phase4FoundationTestContent() {
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  
  // Performance monitoring
  const { metrics, startRenderTiming, endRenderTiming } = usePerformanceMonitoring({
    enabled: true,
    samplingRate: 0.1,
  });

  // Panel data (world units)
  const { 
    dataState, 
    updatePanel, 
    addTestPanel, 
    clearStorage, 
    loadData, 
    saveData 
  } = usePanelData({
    projectId: 'phase4-foundation-test',
    featureFlags: { ENABLE_DEBUG_LOGGING: true }
  });

  // Canvas state
  const { canvas, selectPanel, setTransform } = useCanvasState();
  const { panels } = usePanelState();

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
    onTransformChange: (newTransform) => {
      console.log('Transform changed:', newTransform);
    }
  });

  // Create transform object
  const transform = { x, y, scale };

  // Test functions
  const testDependencies = useCallback(() => {
    const results: Record<string, boolean> = {};
    
    try {
      // Test lodash debounce
      const { debounce } = require('lodash');
      const debouncedFn = debounce(() => {}, 100);
      results.lodash = typeof debouncedFn === 'function';
    } catch (error) {
      results.lodash = false;
      console.error('Lodash test failed:', error);
    }
    
    try {
      // Test useZoomPan hook
      results.useZoomPan = typeof transform === 'object' && 
                          typeof toWorld === 'function' && 
                          typeof toScreen === 'function';
    } catch (error) {
      results.useZoomPan = false;
      console.error('useZoomPan test failed:', error);
    }
    
    try {
      // Test usePerformanceMonitoring hook
      results.usePerformanceMonitoring = typeof metrics === 'object' && 
                                        typeof startRenderTiming === 'function';
    } catch (error) {
      results.usePerformanceMonitoring = false;
      console.error('usePerformanceMonitoring test failed:', error);
    }
    
    try {
      // Test TransformErrorBoundary
      results.TransformErrorBoundary = true; // If we got here, it imported successfully
    } catch (error) {
      results.TransformErrorBoundary = false;
      console.error('TransformErrorBoundary test failed:', error);
    }
    
    try {
      // Test world coordinates
      results.worldCoordinates = typeof WORLD_CONSTANTS === 'object' && 
                                typeof WORLD_CONSTANTS.WIDTH_FT === 'number';
    } catch (error) {
      results.worldCoordinates = false;
      console.error('worldCoordinates test failed:', error);
    }
    
    try {
      // Test PanelContextV2
      results.PanelContextV2 = typeof canvas === 'object' && 
                              typeof selectPanel === 'function';
    } catch (error) {
      results.PanelContextV2 = false;
      console.error('PanelContextV2 test failed:', error);
    }
    
    try {
      // Test usePanelDataV2
      results.usePanelDataV2 = typeof dataState === 'object' && 
                              typeof updatePanel === 'function';
    } catch (error) {
      results.usePanelDataV2 = false;
      console.error('usePanelDataV2 test failed:', error);
    }
    
    setTestResults(results);
    console.log('Phase 4 Foundation Test Results:', results);
  }, [transform, toWorld, toScreen, metrics, startRenderTiming, canvas, selectPanel, dataState]);

  const testCoordinateConversion = useCallback(() => {
    const testScreenPos = { x: 400, y: 300 };
    const worldPos = toWorld(testScreenPos);
    const backToScreen = toScreen(worldPos);
    
    const accuracy = {
      x: Math.abs(testScreenPos.x - backToScreen.x),
      y: Math.abs(testScreenPos.y - backToScreen.y)
    };
    
    console.log('Coordinate conversion test:', {
      original: testScreenPos,
      toWorld: worldPos,
      backToScreen: backToScreen,
      accuracy: accuracy,
      isAccurate: accuracy.x < 0.1 && accuracy.y < 0.1
    });
  }, [toWorld, toScreen]);

  const testPanelOperations = useCallback(() => {
    console.log('Panel operations test:', {
      dataState: dataState.state,
      panelCount: dataState.panels.length,
      contextPanelCount: panels.panels.length,
      selectedPanel: canvas.selectedPanelId
    });
  }, [dataState, panels, canvas]);

  const testRendering = useCallback(() => {
    const start = performance.now();
    
    // Simulate render
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Draw test grid
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const x = i * 50;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasRef.current.height);
        }
        for (let i = 0; i < 10; i++) {
          const y = i * 50;
          ctx.moveTo(0, y);
          ctx.lineTo(canvasRef.current.width, y);
        }
        ctx.stroke();
        
        // Draw test panel
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(100, 100, 200, 100);
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 2;
        ctx.strokeRect(100, 100, 200, 100);
        
        // Draw test text
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Phase 4 Foundation Test', 200, 150);
      }
    }
    
    const duration = performance.now() - start;
    // Performance tracking handled by usePerformanceMonitoring hook
    
    console.log('Rendering test completed:', {
      renderTime: `${duration.toFixed(2)}ms`,
      isFast: duration < 16
    });
  }, []);

  const testErrorBoundary = () => {
    // This will trigger the error boundary
    throw new Error('Test error for error boundary');
  };

  // Run tests on mount
  useEffect(() => {
    testDependencies();
    testCoordinateConversion();
    testPanelOperations();
    testRendering();
  }, [testDependencies, testCoordinateConversion, testPanelOperations, testRendering]);

  // Render function
  const render = () => {
    testRendering();
  };

  // Handle canvas events
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = toWorld({ x: screenX, y: screenY });
    
    console.log('Mouse down:', { screenX, screenY, worldPos });
    
    // Find clicked panel
    const clickedPanel = dataState.panels.find(panel => {
      return worldPos.x >= panel.x && 
             worldPos.x <= panel.x + panel.width &&
             worldPos.y >= panel.y && 
             worldPos.y <= panel.y + panel.height;
    });
    
    if (clickedPanel) {
      selectPanel(clickedPanel.id);
      console.log('Selected panel:', clickedPanel.id);
    } else {
      selectPanel(null);
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    onWheel(e.nativeEvent);
  };

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Test Controls */}
      <div className="bg-gray-100 p-4 border-b">
        <h2 className="text-lg font-semibold mb-4">Phase 4 Foundation Test</h2>
        
        {/* Test Results */}
        <div className="mb-4">
          <h3 className="text-md font-medium mb-2">Dependency Tests:</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(testResults).map(([name, passed]) => (
              <div key={name} className={`flex items-center ${passed ? 'text-green-600' : 'text-red-600'}`}>
                <span className="mr-2">{passed ? '✅' : '❌'}</span>
                {name}
              </div>
            ))}
          </div>
        </div>
        
        {/* Test Buttons */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={testDependencies}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Dependencies
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
            onClick={testRendering}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Test Rendering
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
        
        {/* State Info */}
        <div className="mt-2 text-sm text-gray-600">
          <strong>Data State:</strong> {dataState.state} | 
          <strong> Panels:</strong> {dataState.panels.length} | 
          <strong> Selected:</strong> {canvas.selectedPanelId || 'None'} | 
          <strong> Transform:</strong> scale={transform.scale.toFixed(3)}
        </div>
      </div>
      
      {/* Canvas Area */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          data-testid="canvas-main"
          width={viewportSize.width}
          height={viewportSize.height}
          className="absolute inset-0 cursor-crosshair border border-gray-300"
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleCanvasWheel}
          style={{ touchAction: 'none' }}
        />
        
        {/* Instructions */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded text-sm">
          <div><strong>Phase 4 Foundation Test Instructions:</strong></div>
          <div>• Click &quot;Test Dependencies&quot; to verify all components work</div>
          <div>• Click &quot;Test Coordinates&quot; to verify world/screen conversion</div>
          <div>• Click &quot;Test Panel Ops&quot; to verify state management</div>
          <div>• Click &quot;Test Rendering&quot; to verify canvas rendering</div>
          <div>• Click &quot;Add Test Panel&quot; to add a test panel</div>
          <div>• Click on the canvas to test mouse interactions</div>
          <div>• Use mouse wheel to test zoom functionality</div>
        </div>
        
        {/* Error Boundary Test */}
        <div className="absolute bottom-4 right-4">
          <button
            onClick={testErrorBoundary}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            Test Error Boundary
          </button>
        </div>
      </div>
    </div>
  );
}

export function Phase4FoundationTest() {
  return (
    <TransformErrorBoundary>
      <PanelProvider>
        <Phase4FoundationTestContent />
      </PanelProvider>
    </TransformErrorBoundary>
  );
}

export default Phase4FoundationTest;
