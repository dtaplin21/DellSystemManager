import { useCallback, useEffect, useRef } from 'react';
import { Panel } from '@/types/panel';

interface MouseState {
  isDragging: boolean;
  isPanning: boolean;
  selectedPanelId: string | null;
  dragStartX: number;
  dragStartY: number;
  lastMouseX: number;
  lastMouseY: number;
}

interface UseMouseInteractionOptions {
  canvas: HTMLCanvasElement | null;
  panels: Panel[];
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
  onPanelUpdate: (panelId: string, updates: Partial<Panel>) => void;
  onCanvasPan: (deltaX: number, deltaY: number) => void;
  onPanelSelect: (panelId: string | null) => void;
  enableDebugLogging?: boolean;
}

interface UseMouseInteractionReturn {
  mouseState: MouseState;
  getWorldCoordinates: (screenX: number, screenY: number) => { x: number; y: number };
  getPanelAtPosition: (worldX: number, worldY: number) => Panel | null;
}

const initialMouseState: MouseState = {
  isDragging: false,
  isPanning: false,
  selectedPanelId: null,
  dragStartX: 0,
  dragStartY: 0,
  lastMouseX: 0,
  lastMouseY: 0,
};

/**
 * Custom hook for handling mouse interactions on the canvas
 * Manages dragging, panning, and panel selection
 */
export function useMouseInteraction({
  canvas,
  panels,
  worldScale,
  worldOffsetX,
  worldOffsetY,
  onPanelUpdate,
  onCanvasPan,
  onPanelSelect,
  enableDebugLogging = false,
}: UseMouseInteractionOptions): UseMouseInteractionReturn {
  const mouseStateRef = useRef<MouseState>(initialMouseState);
  const isMouseDownRef = useRef(false);
  const mouseDownTimeRef = useRef(0);

  const log = useCallback((message: string, data?: any) => {
    if (enableDebugLogging) {
      console.log(`[useMouseInteraction] ${message}`, data);
    }
  }, [enableDebugLogging]);

  // Coordinate transformation
  const getWorldCoordinates = useCallback((screenX: number, screenY: number) => {
    const x = (screenX - worldOffsetX) / worldScale;
    const y = (screenY - worldOffsetY) / worldScale;
    return { x, y };
  }, [worldOffsetX, worldOffsetY, worldScale]);

  // Panel hit detection
  const getPanelAtPosition = useCallback((worldX: number, worldY: number): Panel | null => {
    // Check panels in reverse order (top to bottom)
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i];
      if (!panel.isValid) continue;

      const left = panel.x;
      const right = panel.x + panel.width;
      const top = panel.y;
      const bottom = panel.y + panel.height;

      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return panel;
      }
    }
    return null;
  }, [panels]);

  // Mouse down handler
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!canvas) return;

    event.preventDefault();
    isMouseDownRef.current = true;
    mouseDownTimeRef.current = Date.now();

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPos = getWorldCoordinates(screenX, screenY);

    const clickedPanel = getPanelAtPosition(worldPos.x, worldPos.y);

    if (clickedPanel) {
      // Start dragging panel
      mouseStateRef.current = {
        isDragging: true,
        isPanning: false,
        selectedPanelId: clickedPanel.id,
        dragStartX: worldPos.x,
        dragStartY: worldPos.y,
        lastMouseX: screenX,
        lastMouseY: screenY,
      };
      
      onPanelSelect(clickedPanel.id);
      log('Started dragging panel', { panelId: clickedPanel.id, worldPos });
    } else {
      // Start panning canvas
      mouseStateRef.current = {
        isDragging: false,
        isPanning: true,
        selectedPanelId: null,
        dragStartX: 0,
        dragStartY: 0,
        lastMouseX: screenX,
        lastMouseY: screenY,
      };
      
      onPanelSelect(null);
      log('Started panning canvas', { screenX, screenY });
    }
  }, [canvas, getWorldCoordinates, getPanelAtPosition, onPanelSelect, log]);

  // Mouse move handler
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!canvas || !isMouseDownRef.current) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPos = getWorldCoordinates(screenX, screenY);

    const currentState = mouseStateRef.current;

    if (currentState.isDragging && currentState.selectedPanelId) {
      // Update panel position
      const deltaX = worldPos.x - currentState.dragStartX;
      const deltaY = worldPos.y - currentState.dragStartY;

      onPanelUpdate(currentState.selectedPanelId, {
        x: currentState.dragStartX + deltaX,
        y: currentState.dragStartY + deltaY,
      });

      log('Dragging panel', { 
        panelId: currentState.selectedPanelId, 
        deltaX, 
        deltaY,
        newPos: { x: currentState.dragStartX + deltaX, y: currentState.dragStartY + deltaY }
      });
    } else if (currentState.isPanning) {
      // Update canvas pan
      const deltaX = screenX - currentState.lastMouseX;
      const deltaY = screenY - currentState.lastMouseY;

      onCanvasPan(deltaX, deltaY);

      mouseStateRef.current = {
        ...currentState,
        lastMouseX: screenX,
        lastMouseY: screenY,
      };

      log('Panning canvas', { deltaX, deltaY });
    }
  }, [canvas, getWorldCoordinates, onPanelUpdate, onCanvasPan, log]);

  // Mouse up handler
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!canvas) return;

    event.preventDefault();
    isMouseDownRef.current = false;

    const currentState = mouseStateRef.current;
    const clickDuration = Date.now() - mouseDownTimeRef.current;

    if (currentState.isDragging) {
      log('Finished dragging panel', { 
        panelId: currentState.selectedPanelId,
        duration: clickDuration 
      });
    } else if (currentState.isPanning) {
      log('Finished panning canvas', { duration: clickDuration });
    }

    // Reset mouse state
    mouseStateRef.current = initialMouseState;
  }, [canvas, log]);

  // Mouse wheel handler for zooming
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!canvas) return;

    event.preventDefault();
    
    // Zoom in/out based on wheel direction
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Get world coordinates before zoom
    const worldPos = getWorldCoordinates(mouseX, mouseY);

    // Apply zoom
    const newScale = Math.max(0.1, Math.min(10, worldScale * zoomFactor));
    const scaleChange = newScale / worldScale;

    // Adjust offset to zoom towards mouse position
    const newOffsetX = mouseX - worldPos.x * newScale;
    const newOffsetY = mouseY - worldPos.y * newScale;

    onCanvasPan(newOffsetX - worldOffsetX, newOffsetY - worldOffsetY);

    log('Zoomed canvas', { 
      oldScale: worldScale, 
      newScale, 
      scaleChange,
      mousePos: { x: mouseX, y: mouseY },
      worldPos 
    });
  }, [canvas, worldScale, worldOffsetX, worldOffsetY, getWorldCoordinates, onCanvasPan, log]);

  // Context menu handler
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!canvas) return;

    const handlers = {
      mousedown: handleMouseDown,
      mousemove: handleMouseMove,
      mouseup: handleMouseUp,
      wheel: handleWheel,
      contextmenu: handleContextMenu,
    };

    // Add event listeners
    Object.entries(handlers).forEach(([event, handler]) => {
      canvas.addEventListener(event, handler as EventListener, { passive: false });
    });

    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        canvas.removeEventListener(event, handler as EventListener);
      });
    };
  }, [canvas, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleContextMenu]);

  // Global mouse up handler (in case mouse leaves canvas)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        mouseStateRef.current = initialMouseState;
        log('Global mouse up - resetting state');
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [log]);

  return {
    mouseState: mouseStateRef.current,
    getWorldCoordinates,
    getPanelAtPosition,
  };
}
