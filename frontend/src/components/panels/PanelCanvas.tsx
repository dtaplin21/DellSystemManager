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
  // console.log('🔍 [PanelCanvas] Component rendered with panels:', panels);
  // console.log('🔍 [PanelCanvas] Panels count:', panels.length);
  
  const { canvas: canvasContext, dispatchCanvas } = useCanvasState();
  const { panels: panelState, dispatchPanels } = usePanelState();
  const { canvasState: storedCanvasState, updateCanvasState } = useLocalCanvasState();
  
  // console.log('🔍 [PanelCanvas] Panel state from context:', panelState);
  // console.log('🔍 [PanelCanvas] Panel state panels count:', panelState.panels.length);

  // Use panels from props, not context, to avoid mismatch
  const panelsToRender = panels || panelState.panels;
  
  // Canvas rendering hook
  const { canvasRef, render, getWorldCoordinates, getScreenCoordinates, resizeCanvas } = useCanvas({
    panels: panelsToRender, // Use panels from props first, fallback to context
    canvasState: {
      worldScale: canvasContext.worldScale,
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
    },
    onPanelClick,
    onPanelDoubleClick,
    enableDebugLogging,
  });

  // Create stable callbacks using useRef to prevent infinite loops
  const onPanelUpdateRef = React.useRef((panelId: string, updates: Partial<Panel>) => {
    dispatchPanels({ type: 'UPDATE_PANEL', payload: { id: panelId, updates } });
  });
  onPanelUpdateRef.current = (panelId: string, updates: Partial<Panel>) => {
    dispatchPanels({ type: 'UPDATE_PANEL', payload: { id: panelId, updates } });
  };

  const onCanvasPanRef = React.useRef((deltaX: number, deltaY: number) => {
    const newOffsetX = canvasContext.worldOffsetX + deltaX;
    const newOffsetY = canvasContext.worldOffsetY + deltaY;
    
    dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { x: newOffsetX, y: newOffsetY } });
    
    // Persist canvas state
    updateCanvasState({
      worldOffsetX: newOffsetX,
      worldOffsetY: newOffsetY,
      worldScale: canvasContext.worldScale,
    });
  });
  onCanvasPanRef.current = (deltaX: number, deltaY: number) => {
    const newOffsetX = canvasContext.worldOffsetX + deltaX;
    const newOffsetY = canvasContext.worldOffsetY + deltaY;
    
    dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { x: newOffsetX, y: newOffsetY } });
    
    // Persist canvas state
    updateCanvasState({
      worldOffsetX: newOffsetX,
      worldOffsetY: newOffsetY,
      worldScale: canvasContext.worldScale,
    });
  };

  const onPanelSelectRef = React.useRef((panelId: string | null) => {
    dispatchCanvas({ type: 'SELECT_PANEL', payload: panelId });
  });
  onPanelSelectRef.current = (panelId: string | null) => {
    dispatchCanvas({ type: 'SELECT_PANEL', payload: panelId });
  };

  const onDragStartRef = React.useRef((panelId: string, worldPos: { x: number; y: number }) => {
    dispatchCanvas({ type: 'START_DRAG', payload: { panelId, x: worldPos.x, y: worldPos.y } });
  });
  onDragStartRef.current = (panelId: string, worldPos: { x: number; y: number }) => {
    dispatchCanvas({ type: 'START_DRAG', payload: { panelId, x: worldPos.x, y: worldPos.y } });
  };

  const onDragEndRef = React.useRef(() => {
    dispatchCanvas({ type: 'END_DRAG' });
  });
  onDragEndRef.current = () => {
    dispatchCanvas({ type: 'END_DRAG' });
  };

  // Mouse interaction hook
  const { mouseState, getWorldCoordinates: getMouseWorldCoords, getPanelAtPosition } = useMouseInteraction({
    canvas: canvasRef.current,
    panels: panelsToRender, // Use same panels as canvas
    worldScale: canvasContext.worldScale,
    worldOffsetX: canvasContext.worldOffsetX,
    worldOffsetY: canvasContext.worldOffsetY,
    onPanelUpdate: (panelId, updates) => onPanelUpdateRef.current(panelId, updates),
    onCanvasPan: (deltaX, deltaY) => onCanvasPanRef.current(deltaX, deltaY),
    onPanelSelect: (panelId) => onPanelSelectRef.current(panelId),
    onDragStart: (panelId, worldPos) => onDragStartRef.current(panelId, worldPos),
    onDragEnd: () => onDragEndRef.current(),
    enableDebugLogging,
  });

  // Load stored canvas state on mount only
  React.useEffect(() => {
    if (storedCanvasState) {
      dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: storedCanvasState.worldScale });
      dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { 
        x: storedCanvasState.worldOffsetX, 
        y: storedCanvasState.worldOffsetY 
      }});
    }
  }, []); // Only run on mount

  // Persist canvas state when it changes (but not on initial load)
  const isInitialMount = React.useRef(true);
  const updateCanvasStateRef = React.useRef(updateCanvasState);
  updateCanvasStateRef.current = updateCanvasState;
  
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // Skip on initial mount
    }
    
    updateCanvasStateRef.current({
      worldScale: canvasContext.worldScale,
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
    });
  }, [canvasContext.worldScale, canvasContext.worldOffsetX, canvasContext.worldOffsetY]);

  // Store render function in ref to avoid dependency issues
  const renderRef = React.useRef(render);
  renderRef.current = render;

  // Trigger render when panels change
  React.useEffect(() => {
    renderRef.current();
  }, [panelsToRender]);

  // Trigger render when canvas state changes
  React.useEffect(() => {
    renderRef.current();
  }, [canvasContext.worldScale, canvasContext.worldOffsetX, canvasContext.worldOffsetY]);

  // Trigger render when mouse state changes (for visual feedback during dragging)
  React.useEffect(() => {
    renderRef.current();
  }, [mouseState.isDragging, mouseState.selectedPanelId]);

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
