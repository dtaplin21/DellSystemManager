'use client';

import React, { useState } from 'react';
import { usePanelSystem } from '@/hooks/usePanelSystem';
import { SimpleCanvas } from './SimpleCanvas';

interface SimplePanelLayoutDebugProps {
  projectId: string;
}

export function SimplePanelLayoutDebug({ projectId }: SimplePanelLayoutDebugProps) {
  const {
    state,
    isLoading,
    error,
    updatePanel,
    updateCanvas,
    selectPanel
  } = usePanelSystem(projectId);
  
  const [showDebug, setShowDebug] = useState(false);
  
  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Loading simplified panel system...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-red-600">
        <p className="text-lg font-semibold">Error loading panels</p>
        <p className="text-sm">{error}</p>
      </div>
    </div>
  );
  
  return (
    <div className="h-full w-full relative">
      {/* Debug Panel */}
      {showDebug && (
        <div className="absolute top-4 left-4 bg-white border rounded-lg shadow-lg p-4 z-10 max-w-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm">Debug Info</h3>
            <button 
              onClick={() => setShowDebug(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-2 text-xs">
            <div>
              <strong>Panels:</strong> {state.panels.length}
            </div>
            <div>
              <strong>Selected:</strong> {state.selectedPanelId || 'None'}
            </div>
            <div>
              <strong>Canvas Scale:</strong> {state.canvas.scale.toFixed(2)}
            </div>
            <div>
              <strong>Canvas Offset:</strong> ({state.canvas.offsetX.toFixed(0)}, {state.canvas.offsetY.toFixed(0)})
            </div>
            <div>
              <strong>Dirty:</strong> {state.isDirty ? 'Yes' : 'No'}
            </div>
            
            {state.panels.length > 0 && (
              <div className="mt-2">
                <strong>Panel Details:</strong>
                <div className="max-h-32 overflow-y-auto">
                  {state.panels.map(panel => (
                    <div key={panel.id} className="text-xs p-1 bg-gray-50 rounded mb-1">
                      <div>ID: {panel.id}</div>
                      <div>Pos: ({panel.x.toFixed(0)}, {panel.y.toFixed(0)})</div>
                      <div>Size: {panel.width.toFixed(0)} × {panel.height.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Debug Toggle Button */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded text-sm z-10"
      >
        {showDebug ? 'Hide Debug' : 'Show Debug'}
      </button>
      
      {/* Canvas */}
      <SimpleCanvas
        panels={state.panels}
        canvasState={state.canvas}
        selectedPanelId={state.selectedPanelId}
        onPanelUpdate={updatePanel}
        onCanvasUpdate={updateCanvas}
        onPanelSelect={selectPanel}
      />
    </div>
  );
}
