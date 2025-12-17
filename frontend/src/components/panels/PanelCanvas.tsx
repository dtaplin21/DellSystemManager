'use client';

import React from 'react';
import { useCanvasState, usePanelState } from '@/contexts/PanelContext';
import { useUnifiedMouseInteraction } from '@/hooks/useUnifiedMouseInteraction';
import { Panel } from '@/types/panel';
import { Patch } from '@/types/patch';
import { DestructiveTest } from '@/types/destructiveTest';

interface PanelCanvasProps {
  panels: Panel[];
  patches?: Patch[];
  destructiveTests?: DestructiveTest[];
  visibleTypes?: {
    panels: boolean;
    patches: boolean;
    destructs: boolean;
  };
  onPanelClick?: (panel: Panel) => void;
  onPanelDoubleClick?: (panel: Panel) => void;
  onPanelUpdate?: (panelId: string, updates: Partial<Panel>) => Promise<void>;
  onPatchClick?: (patch: Patch) => void;
  onDestructiveTestClick?: (destructiveTest: DestructiveTest) => void;
  onPatchUpdate?: (patchId: string, updates: Partial<Patch>) => Promise<void>;
  onDestructiveTestUpdate?: (testId: string, updates: Partial<DestructiveTest>) => Promise<void>;
  enableDebugLogging?: boolean;
}

export function PanelCanvas({ 
  panels,
  patches = [],
  destructiveTests = [],
  visibleTypes = { panels: true, patches: false, destructs: false },
  onPanelClick, 
  onPanelDoubleClick,
  onPanelUpdate,
  onPatchClick,
  onDestructiveTestClick,
  onPatchUpdate,
  onDestructiveTestUpdate,
  enableDebugLogging = false 
}: PanelCanvasProps) {
  const { canvas: canvasContext, dispatchCanvas } = useCanvasState();
  const { panels: panelState, dispatchPanels } = usePanelState();
  
  // Simple localStorage hook for canvas state
  const updateCanvasState = React.useCallback((state: any) => {
    localStorage.setItem('canvasState', JSON.stringify(state));
  }, []);
  
  const storedCanvasState = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('canvasState');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);
  
  // Use panels from props (usePanelData) as the single source of truth
  const panelsToRender = panels;
  
  // Canvas ref for unified mouse interaction
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Create stable callbacks using useRef to prevent infinite loops
  const onPanelUpdateRef = React.useRef((panelId: string, updates: Partial<Panel>) => {
    if (onPanelUpdate) {
      onPanelUpdate(panelId, updates);
    } else {
      // Fallback to context if no callback provided
      dispatchPanels({ type: 'UPDATE_PANEL', payload: { id: panelId, updates } });
    }
  });
  onPanelUpdateRef.current = (panelId: string, updates: Partial<Panel>) => {
    if (onPanelUpdate) {
      onPanelUpdate(panelId, updates);
    } else {
      // Fallback to context if no callback provided
      dispatchPanels({ type: 'UPDATE_PANEL', payload: { id: panelId, updates } });
    }
  };

  const onCanvasPanRef = React.useRef((deltaX: number, deltaY: number) => {
    dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { 
      x: canvasContext.worldOffsetX + deltaX, 
      y: canvasContext.worldOffsetY + deltaY 
    }});
  });
  onCanvasPanRef.current = (deltaX: number, deltaY: number) => {
    dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { 
      x: canvasContext.worldOffsetX + deltaX, 
      y: canvasContext.worldOffsetY + deltaY 
    }});
  };

  const onCanvasZoomRef = React.useRef((newScale: number) => {
    dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: newScale });
    
    // Persist canvas state
    updateCanvasState({
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
      worldScale: newScale,
    });
  });
  onCanvasZoomRef.current = (newScale: number) => {
    dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: newScale });
    
    // Persist canvas state
    updateCanvasState({
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
      worldScale: newScale,
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

  // Unified mouse interaction hook - combines mouse handling and canvas rendering
  const { 
    mouseState, 
    getWorldCoordinates, 
    getScreenCoordinates, 
    getPanelAtPosition, 
    render, 
    resizeCanvas 
  } = useUnifiedMouseInteraction({
    canvas: canvasRef.current,
    panels: panelsToRender,
    patches,
    destructiveTests,
    visibleTypes,
    canvasState: {
      worldScale: canvasContext.worldScale,
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
    },
    onPanelClick,
    onPanelDoubleClick,
    onPanelUpdate: async (panelId, updates) => onPanelUpdateRef.current?.(panelId, updates),
    onPatchClick,
    onDestructiveTestClick,
    onPatchUpdate: onPatchUpdate ? async (patchId, updates) => onPatchUpdate(patchId, updates) : undefined,
    onDestructiveTestUpdate: onDestructiveTestUpdate ? async (testId, updates) => onDestructiveTestUpdate(testId, updates) : undefined,
    onCanvasPan: (deltaX, deltaY) => onCanvasPanRef.current?.(deltaX, deltaY),
    onCanvasZoom: (newScale) => onCanvasZoomRef.current?.(newScale),
    onPanelSelect: (panelId) => onPanelSelectRef.current?.(panelId),
    onDragStart: (panelId, worldPos) => onDragStartRef.current?.(panelId, worldPos),
    onDragEnd: () => onDragEndRef.current?.(),
    enableDebugLogging,
  });

  // Load stored canvas state on mount only
  const hasLoadedInitialState = React.useRef(false);
  React.useEffect(() => {
    if (storedCanvasState && !hasLoadedInitialState.current) {
      hasLoadedInitialState.current = true;
      dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: storedCanvasState.worldScale });
      dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { 
        x: storedCanvasState.worldOffsetX, 
        y: storedCanvasState.worldOffsetY 
      }});
    }
  }, [storedCanvasState]); // Only depend on storedCanvasState, not dispatchCanvas

  // Auto-fit viewport when panels are first loaded
  const hasAutoFitted = React.useRef(false);
  React.useEffect(() => {
    if (panelsToRender.length > 0 && !hasAutoFitted.current) {
      hasAutoFitted.current = true;
      
      // Calculate bounds of all panels
      const bounds = panelsToRender.reduce((acc, panel) => {
        return {
          minX: Math.min(acc.minX, panel.x),
          maxX: Math.max(acc.maxX, panel.x + panel.width),
          minY: Math.min(acc.minY, panel.y),
          maxY: Math.max(acc.maxY, panel.y + panel.height),
        };
      }, {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      });

      if (bounds.minX !== Infinity) {
        // Center the viewport on the panels
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const panelWidth = bounds.maxX - bounds.minX;
        const panelHeight = bounds.maxY - bounds.minY;
        
        // Set a reasonable scale to fit panels with some padding
        const canvas = canvasRef.current;
        if (canvas) {
          const scaleX = (canvas.width * 0.8) / panelWidth;
          const scaleY = (canvas.height * 0.8) / panelHeight;
          const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in too much
          
          dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: Math.max(0.1, scale) });
          dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { 
            x: canvas.width / 2 - centerX * scale,
            y: canvas.height / 2 - centerY * scale
          }});
        }
      }
    }
  }, [panelsToRender.length]); // Only run when panel count changes

  // Persist canvas state when it changes (but not on initial load) - throttled
  const isInitialMount = React.useRef(true);
  const updateCanvasStateRef = React.useRef(updateCanvasState);
  const persistenceThrottleRef = React.useRef<number>();
  const lastPersistedStateRef = React.useRef({
    worldScale: canvasContext.worldScale,
    worldOffsetX: canvasContext.worldOffsetX,
    worldOffsetY: canvasContext.worldOffsetY,
  });

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only persist if state actually changed
    const currentState = {
      worldScale: canvasContext.worldScale,
      worldOffsetX: canvasContext.worldOffsetX,
      worldOffsetY: canvasContext.worldOffsetY,
    };

    const hasChanged = 
      currentState.worldScale !== lastPersistedStateRef.current.worldScale ||
      currentState.worldOffsetX !== lastPersistedStateRef.current.worldOffsetX ||
      currentState.worldOffsetY !== lastPersistedStateRef.current.worldOffsetY;

    if (hasChanged) {
      lastPersistedStateRef.current = {
        worldScale: canvasContext.worldScale,
        worldOffsetX: canvasContext.worldOffsetX,
        worldOffsetY: canvasContext.worldOffsetY,
      };
      
      // Throttle persistence updates to prevent excessive localStorage writes
      if (persistenceThrottleRef.current) {
        cancelAnimationFrame(persistenceThrottleRef.current);
      }
      
      persistenceThrottleRef.current = requestAnimationFrame(() => {
        updateCanvasStateRef.current(lastPersistedStateRef.current);
      });
    }
  }, [canvasContext.worldScale, canvasContext.worldOffsetX, canvasContext.worldOffsetY]);

  // Render is now handled by the unified mouse interaction hook
  // No need for separate render triggers

  return (
    <div className="relative w-full h-full overflow-hidden canvas-container min-h-0">
      <canvas
        ref={canvasRef}
        data-testid="canvas-main"
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