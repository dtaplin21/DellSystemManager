'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PanelProvider, useCanvasState, usePanelState } from '@/contexts/PanelContextV2';
import { usePanelData } from '@/hooks/usePanelDataV2';
import PanelCanvasV3 from './PanelCanvasV3';
import TransformErrorBoundary from './TransformErrorBoundary';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

/**
 * Phase 3 Integration Test
 * Tests the complete Phase 3 rendering system with all components
 */
function Phase3TestContent() {
  const [testMode, setTestMode] = useState<'basic' | 'stress' | 'performance'>('basic');
  const [panelCount, setPanelCount] = useState(5);
  
  // Panel data
  const { 
    dataState, 
    updatePanel, 
    addTestPanel, 
    clearStorage, 
    loadData, 
    saveData,
    batchUpdatePanels 
  } = usePanelData({
    projectId: 'phase3-test',
    featureFlags: { ENABLE_DEBUG_LOGGING: true }
  });

  // Canvas state
  const { canvas, selectPanel, setTransform } = useCanvasState();
  const { panels } = usePanelState();

  // Test functions
  const addMultipleTestPanels = () => {
    for (let i = 0; i < panelCount; i++) {
      const testPanel = {
        id: `test-panel-${Date.now()}-${i}`,
        width: 10 + Math.random() * 20, // 10-30 feet
        height: 10 + Math.random() * 20, // 10-30 feet
        x: Math.random() * (WORLD_CONSTANTS.WIDTH_FT - 30),
        y: Math.random() * (WORLD_CONSTANTS.HEIGHT_FT - 30),
        rotation: 0,
        isValid: true,
        shape: 'rectangle' as const,
        type: 'test',
        model: `Test Model ${i + 1}`,
        manufacturer: 'Test Manufacturer',
        power: 100 + Math.random() * 200,
        efficiency: 0.15 + Math.random() * 0.1,
        panelNumber: `TEST-${i + 1}`,
        rollNumber: `ROLL-${i + 1}`,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        fill: `hsl(${Math.random() * 360}, 70%, 50%)`
      };
      
      addTestPanel();
    }
  };

  const testWorldCoordinateAccuracy = () => {
    console.log('=== Phase 3 World Coordinate Accuracy Test ===');
    
    // Test coordinate conversion
    const testPoints = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 1000, y: 1000 },
      { x: WORLD_CONSTANTS.WIDTH_FT / 2, y: WORLD_CONSTANTS.HEIGHT_FT / 2 }
    ];
    
    testPoints.forEach((worldPoint, index) => {
      console.log(`Test point ${index + 1}:`, worldPoint);
      // Note: We can't test toScreen/toWorld here as they're not exposed
      // This would be tested in the actual canvas interaction
    });
    
    console.log('World coordinate test completed');
  };

  const testPanelOperations = () => {
    console.log('=== Phase 3 Panel Operations Test ===');
    
    if (dataState.panels.length === 0) {
      console.log('No panels to test with');
      return;
    }
    
    const panel = dataState.panels[0];
    const originalPos = { x: panel.x, y: panel.y };
    
    // Test single panel update
    updatePanel(panel.id, { x: panel.x + 10, y: panel.y + 10 });
    console.log('Single panel update:', { panelId: panel.id, newPos: { x: panel.x + 10, y: panel.y + 10 } });
    
    // Test batch update
    const updates: Record<string, any> = {};
    dataState.panels.slice(0, 3).forEach(p => {
      updates[p.id] = { x: p.x + 5, y: p.y + 5 };
    });
    batchUpdatePanels(updates);
    console.log('Batch panel update:', Object.keys(updates));
    
    console.log('Panel operations test completed');
  };

  const testPerformance = () => {
    console.log('=== Phase 3 Performance Test ===');
    
    const startTime = performance.now();
    let frameCount = 0;
    
    const testRender = () => {
      frameCount++;
      if (frameCount < 60) { // Test for 1 second at 60fps
        requestAnimationFrame(testRender);
      } else {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const fps = (frameCount / duration) * 1000;
        
        console.log('Performance test results:', {
          duration: `${duration.toFixed(2)}ms`,
          frameCount,
          fps: fps.toFixed(2),
          averageFrameTime: `${(duration / frameCount).toFixed(2)}ms`
        });
      }
    };
    
    testRender();
  };

  const testStress = () => {
    console.log('=== Phase 3 Stress Test ===');
    
    // Add many panels quickly
    const stressPanelCount = 50;
    for (let i = 0; i < stressPanelCount; i++) {
      addTestPanel();
    }
    
    console.log(`Added ${stressPanelCount} panels for stress test`);
  };

  const resetTest = () => {
    clearStorage();
    setPanelCount(5);
    setTestMode('basic');
    console.log('Test reset');
  };

  // Load test data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Test Controls */}
      <div className="bg-gray-100 p-4 border-b">
        <h2 className="text-lg font-semibold mb-4">Phase 3 Integration Test</h2>
        
        {/* Test Mode Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Test Mode:</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="basic"
                checked={testMode === 'basic'}
                onChange={(e) => setTestMode(e.target.value as any)}
                className="mr-2"
              />
              Basic
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="stress"
                checked={testMode === 'stress'}
                onChange={(e) => setTestMode(e.target.value as any)}
                className="mr-2"
              />
              Stress
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="performance"
                checked={testMode === 'performance'}
                onChange={(e) => setTestMode(e.target.value as any)}
                className="mr-2"
              />
              Performance
            </label>
          </div>
        </div>
        
        {/* Panel Count Control */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Panel Count:</label>
          <input
            type="range"
            min="1"
            max="100"
            value={panelCount}
            onChange={(e) => setPanelCount(parseInt(e.target.value))}
            className="w-32"
          />
          <span className="ml-2 text-sm">{panelCount}</span>
        </div>
        
        {/* Test Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={addMultipleTestPanels}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add {panelCount} Test Panels
          </button>
          
          <button
            onClick={testWorldCoordinateAccuracy}
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
            onClick={testPerformance}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Test Performance
          </button>
          
          <button
            onClick={testStress}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Stress Test
          </button>
          
          <button
            onClick={resetTest}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Reset Test
          </button>
        </div>
        
        {/* Status Info */}
        <div className="mt-4 text-sm text-gray-600">
          <strong>Status:</strong> {dataState.state} | 
          <strong> Panels:</strong> {dataState.panels.length} | 
          <strong> Selected:</strong> {canvas.selectedPanelId || 'None'} | 
          <strong> Mode:</strong> {testMode}
        </div>
      </div>
      
      {/* Canvas Area */}
      <div className="flex-1 relative">
        <PanelCanvasV3
          panels={dataState.panels}
          onPanelUpdate={updatePanel}
          enableDebugLogging={true}
        />
        
        {/* Test Instructions */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded text-sm">
          <div><strong>Phase 3 Test Instructions:</strong></div>
          <div>• Use test buttons to add panels and run tests</div>
          <div>• Mouse wheel: Zoom in/out</div>
          <div>• Mouse drag: Pan around</div>
          <div>• Click panels: Select them</div>
          <div>• Drag panels: Move them (world units)</div>
          <div>• Check console for test results</div>
        </div>
      </div>
    </div>
  );
}

export function Phase3Test() {
  return (
    <TransformErrorBoundary>
      <PanelProvider>
        <Phase3TestContent />
      </PanelProvider>
    </TransformErrorBoundary>
  );
}

export default Phase3Test;
