'use client';

import React from 'react';
import { useCanvas } from '@/hooks/useCanvas';
import { useMouseInteraction } from '@/hooks/useMouseInteraction';
import { useCanvasState as useLocalCanvasState } from '@/hooks/useLocalStorage';
import { useCanvasState, usePanelState } from '@/contexts/PanelContext';
import { Panel } from '@/types/panel';

interface PanelCanvasProps {
  panels: Panel[];
  onPanelClick?: (panel: Panel) => void;
  onPanelDoubleClick?: (panel: Panel) => void;
  enableDebugLogging?: boolean;
}

/**
 * Focused component for canvas rendering and interaction
 * Handles only canvas-specific concerns
 */
export function PanelCanvas({ 
  panels, 
  onPanelClick, 
  onPanelDoubleClick,
  enableDebugLogging = false 
}: PanelCanvasProps) {
  const { canvas: canvasContext, dispatchCanvas } = useCanvasState();
  const { panels: panelState, dispatchPanels } = usePanelState();
  const { canvasState: storedCanvasState, updateCanvasState } = useLocalCanvasState();

  // Canvas rendering hook
  const { canvasRef, render, getWorldCoordinates, getScreenCoordinates, resizeCanvas } = useCanvas({
    panels,
    canvasState: {
      worldScale: canvasContext.worldScale,
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
    },
    onPanelClick,
    onPanelDoubleClick,
    enableDebugLogging,
  });

  // Mouse interaction hook
  const { mouseState, getWorldCoordinates: getMouseWorldCoords, getPanelAtPosition } = useMouseInteraction({
    canvas: canvasRef.current,
    panels,
    worldScale: canvasContext.worldScale,
    worldOffsetX: canvasContext.worldOffsetX,
    worldOffsetY: canvasContext.worldOffsetY,
    onPanelUpdate: (panelId, updates) => {
      dispatchPanels({ type: 'UPDATE_PANEL', payload: { id: panelId, updates } });
    },
    onCanvasPan: (deltaX, deltaY) => {
      const newOffsetX = canvasContext.worldOffsetX + deltaX;
      const newOffsetY = canvasContext.worldOffsetY + deltaY;
      
      dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { x: newOffsetX, y: newOffsetY } });
      
      // Persist canvas state
      updateCanvasState({
        worldOffsetX: newOffsetX,
        worldOffsetY: newOffsetY,
        worldScale: canvasContext.worldScale,
      });
    },
    onPanelSelect: (panelId) => {
      dispatchCanvas({ type: 'SELECT_PANEL', payload: panelId });
    },
    enableDebugLogging,
  });

  // Load stored canvas state on mount
  React.useEffect(() => {
    if (storedCanvasState) {
      dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: storedCanvasState.worldScale });
      dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { 
        x: storedCanvasState.worldOffsetX, 
        y: storedCanvasState.worldOffsetY 
      }});
    }
  }, [storedCanvasState, dispatchCanvas]);

  // Persist canvas state when it changes
  React.useEffect(() => {
    updateCanvasState({
      worldScale: canvasContext.worldScale,
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
    });
  }, [canvasContext.worldScale, canvasContext.worldOffsetX, canvasContext.worldOffsetY, updateCanvasState]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ 
          touchAction: 'none',
          userSelect: 'none',
        }}
      />
      
      {/* Debug overlay for development */}
      {enableDebugLogging && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>Scale: {canvasContext.worldScale.toFixed(2)}</div>
          <div>Offset: ({canvasContext.worldOffsetX.toFixed(1)}, {canvasContext.worldOffsetY.toFixed(1)})</div>
          <div>Panels: {panels.length}</div>
          <div>Dragging: {mouseState.isDragging ? 'Yes' : 'No'}</div>
          <div>Panning: {mouseState.isPanning ? 'Yes' : 'No'}</div>
          {mouseState.selectedPanelId && (
            <div>Selected: {mouseState.selectedPanelId}</div>
          )}
        </div>
      )}
    </div>
  );
}
