import { useCallback, useEffect, useRef, useMemo } from 'react';
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

interface CanvasState {
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
}

interface UseUnifiedMouseInteractionOptions {
  canvas: HTMLCanvasElement | null;
  panels: Panel[];
  canvasState: CanvasState;
  onPanelClick?: (panel: Panel) => void;
  onPanelDoubleClick?: (panel: Panel) => void;
  onPanelUpdate: (panelId: string, updates: Partial<Panel>) => void;
  onCanvasPan: (deltaX: number, deltaY: number) => void;
  onPanelSelect: (panelId: string | null) => void;
  onDragStart?: (panelId: string, worldPos: { x: number; y: number }) => void;
  onDragEnd?: () => void;
  enableDebugLogging?: boolean;
}

interface UseUnifiedMouseInteractionReturn {
  mouseState: MouseState;
  getWorldCoordinates: (screenX: number, screenY: number) => { x: number; y: number };
  getScreenCoordinates: (worldX: number, worldY: number) => { x: number; y: number };
  getPanelAtPosition: (worldX: number, worldY: number) => Panel | null;
  render: () => void;
  resizeCanvas: () => void;
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
 * Unified mouse interaction hook that combines mouse handling and canvas rendering
 * Eliminates conflicts between multiple mouse systems
 */
export function useUnifiedMouseInteraction({
  canvas,
  panels,
  canvasState,
  onPanelClick,
  onPanelDoubleClick,
  onPanelUpdate,
  onCanvasPan,
  onPanelSelect,
  onDragStart,
  onDragEnd,
  enableDebugLogging = false,
}: UseUnifiedMouseInteractionOptions): UseUnifiedMouseInteractionReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseStateRef = useRef<MouseState>(initialMouseState);
  const isMouseDownRef = useRef(false);
  const mouseDownTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);

  // Set canvas ref
  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  const logRef = useRef((message: string, data?: any) => {
    if (enableDebugLogging) {
      console.log(`[useUnifiedMouseInteraction] ${message}`, data);
    }
  });
  
  // Update log function when enableDebugLogging changes
  useEffect(() => {
    logRef.current = (message: string, data?: any) => {
      if (enableDebugLogging) {
        console.log(`[useUnifiedMouseInteraction] ${message}`, data);
      }
    };
  }, [enableDebugLogging]);

  // Coordinate transformation functions - simplified for unified coordinates
  const getWorldCoordinates = useCallback((screenX: number, screenY: number) => {
    // In unified coordinates, screen coordinates are the same as world coordinates
    // No transformation needed - direct pixel mapping
    return { x: screenX, y: screenY };
  }, []);

  const getScreenCoordinates = useCallback((worldX: number, worldY: number) => {
    // In unified coordinates, world coordinates are the same as screen coordinates
    // No transformation needed - direct pixel mapping
    return { x: worldX, y: worldY };
  }, []);

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

  // Canvas rendering function - simplified for unified coordinates
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const deltaTime = now - lastRenderTimeRef.current;
    
    // Throttle rendering to 60fps
    if (deltaTime < 16.67) {
      animationFrameRef.current = requestAnimationFrame(render);
      return;
    }
    
    lastRenderTimeRef.current = now;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid first (in unified coordinates)
    drawGrid(ctx, canvas, canvasState);

    // Draw panels directly in unified coordinates (no transformations needed)
    panels.forEach(panel => {
      if (panel.isValid) {
        drawPanel(ctx, panel);
      }
    });

    logRef.current('Canvas rendered', { 
      panelCount: panels.length, 
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    });
  }, [panels, canvasState]);

  // Grid drawing function - uses unified coordinate system
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: CanvasState) => {
    const gridSize = 0.5; // 0.5px = 1 foot (unified coordinate system: 0.5 pixels per foot)
    const gridColor = '#e5e7eb';
    const majorGridColor = '#d1d5db';
    const majorGridInterval = 10; // Every 10 grid lines = 10 feet

    console.log('🔍 [drawGrid] Canvas dimensions:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      displayWidth: canvas.offsetWidth,
      displayHeight: canvas.offsetHeight,
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height
    });

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.strokeStyle = x % (gridSize * majorGridInterval) === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.strokeStyle = y % (gridSize * majorGridInterval) === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Debug logging
    logRef.current('Grid drawn', {
      gridSize,
      majorGridInterval,
      canvasSize: { width: canvas.width, height: canvas.height },
      worldOffset: { x: state.worldOffsetX, y: state.worldOffsetY },
      worldScale: state.worldScale
    });
  }, []);

  // Panel drawing function - uses unified coordinate system (pixels)
  const drawPanel = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    const { x, y, width, height, rotation = 0 } = panel;

    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);

    // Panel background
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, width, height);

    // Panel border
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 1; // Fixed line width for unified coordinates
    ctx.strokeRect(0, 0, width, height);

    // Panel label
    ctx.fillStyle = 'white';
    ctx.font = `${Math.max(8, Math.min(width, height) * 0.3)}px Arial`; // Better font sizing
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(panel.id, width / 2, height / 2);

    ctx.restore();
  }, []);

  // Canvas resize handler - enhanced with proper container detection
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Try to find the proper container - look for the canvas container div
    let container = canvas.parentElement;
    
    // If the immediate parent is not the right container, look for a container with specific classes
    while (container && !container.classList.contains('canvas-container') && !container.classList.contains('flex-1')) {
      container = container.parentElement;
    }
    
    // Fallback to immediate parent if no specific container found
    if (!container) {
      container = canvas.parentElement;
    }

    if (!container) {
      console.warn('🔍 [resizeCanvas] No container found for canvas');
      return;
    }

    const rect = container.getBoundingClientRect();

    console.log('🔍 [resizeCanvas] Container rect:', rect);
    console.log('🔍 [resizeCanvas] Container classes:', container.className);

    // Ensure we have valid dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn('🔍 [resizeCanvas] Invalid container dimensions:', rect);
      return;
    }

    // Direct sizing (no DPR complications) - like the working test grid
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    console.log('🔍 [resizeCanvas] Canvas dimensions after resize:', {
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height,
      actualWidth: canvas.width,
      actualHeight: canvas.height,
      displayWidth: canvas.offsetWidth,
      displayHeight: canvas.offsetHeight,
      containerWidth: rect.width,
      containerHeight: rect.height
    });

    // Trigger a render after resize
    render();

    logRef.current('Canvas resized', { width: rect.width, height: rect.height });
  }, [render]);

  // Mouse down handler - simplified for unified coordinates
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!canvas) return;

    event.preventDefault();
    isMouseDownRef.current = true;
    mouseDownTimeRef.current = Date.now();

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // In unified coordinates, screen coordinates are world coordinates
    const worldPos = { x: screenX, y: screenY };
    const clickedPanel = getPanelAtPosition(worldPos.x, worldPos.y);

    if (clickedPanel) {
      // Start dragging panel - store offset from panel's top-left corner
      mouseStateRef.current = {
        isDragging: true,
        isPanning: false,
        selectedPanelId: clickedPanel.id,
        dragStartX: worldPos.x - clickedPanel.x, // Offset from panel's left edge
        dragStartY: worldPos.y - clickedPanel.y, // Offset from panel's top edge
        lastMouseX: screenX,
        lastMouseY: screenY,
      };
      
      onPanelSelect(clickedPanel.id);
      onDragStart?.(clickedPanel.id, worldPos);
      logRef.current('Started dragging panel', { panelId: clickedPanel.id, worldPos });
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
      logRef.current('Started panning canvas', { screenX, screenY });
    }
  }, [canvas, getPanelAtPosition, onPanelSelect, onDragStart]);

  // Mouse move handler - simplified for unified coordinates
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!canvas || !isMouseDownRef.current) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // In unified coordinates, screen coordinates are world coordinates
    const worldPos = { x: screenX, y: screenY };
    const currentState = mouseStateRef.current;

    if (currentState.isDragging && currentState.selectedPanelId) {
      // Update panel position - maintain the offset from where the user clicked
      onPanelUpdate(currentState.selectedPanelId, {
        x: worldPos.x - currentState.dragStartX,
        y: worldPos.y - currentState.dragStartY,
      });

      logRef.current('Dragging panel', { 
        panelId: currentState.selectedPanelId, 
        worldPos: { x: worldPos.x, y: worldPos.y },
        dragStart: { x: currentState.dragStartX, y: currentState.dragStartY }
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

      logRef.current('Panning canvas', { deltaX, deltaY });
    }
  }, [canvas, onPanelUpdate, onCanvasPan]);

  // Mouse up handler
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!canvas) return;

    event.preventDefault();
    isMouseDownRef.current = false;

    const currentState = mouseStateRef.current;
    const clickDuration = Date.now() - mouseDownTimeRef.current;

    if (currentState.isDragging) {
      onDragEnd?.();
      logRef.current('Finished dragging panel', { 
        panelId: currentState.selectedPanelId,
        duration: clickDuration 
      });
    } else if (currentState.isPanning) {
      logRef.current('Finished panning canvas', { duration: clickDuration });
    }

    // Reset mouse state
    mouseStateRef.current = initialMouseState;
  }, [canvas, onDragEnd]);

  // Mouse wheel handler for zooming - simplified for unified coordinates
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!canvas) return;

    event.preventDefault();
    
    // For unified coordinates, we can implement simple zoom by scaling the canvas
    // This is a simplified approach - in a full implementation, you might want to
    // implement zoom by changing the PIXELS_PER_FOOT ratio
    
    // For now, we'll just log the zoom event
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    logRef.current('Zoom attempted', { 
      mousePos: { x: mouseX, y: mouseY },
      deltaY: event.deltaY,
      note: 'Zoom functionality simplified for unified coordinates'
    });
  }, [canvas]);

  // Context menu handler
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
  }, []);

  // Click handlers for panel interactions - simplified for unified coordinates
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // In unified coordinates, screen coordinates are world coordinates
    const worldPos = { x: screenX, y: screenY };
    const clickedPanel = getPanelAtPosition(worldPos.x, worldPos.y);
    if (clickedPanel && onPanelClick) {
      onPanelClick(clickedPanel);
    }
  }, [getPanelAtPosition, onPanelClick]);

  const handleCanvasDoubleClick = useCallback((event: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // In unified coordinates, screen coordinates are world coordinates
    const worldPos = { x: screenX, y: screenY };
    const clickedPanel = getPanelAtPosition(worldPos.x, worldPos.y);
    if (clickedPanel && onPanelDoubleClick) {
      onPanelDoubleClick(clickedPanel);
    }
  }, [getPanelAtPosition, onPanelDoubleClick]);

  // Setup event listeners - SINGLE UNIFIED SETUP
  useEffect(() => {
    if (!canvas) return;

    const handlers = {
      mousedown: handleMouseDown,
      mousemove: handleMouseMove,
      mouseup: handleMouseUp,
      wheel: handleWheel,
      contextmenu: handleContextMenu,
      click: handleCanvasClick,
      dblclick: handleCanvasDoubleClick,
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
  }, [canvas, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleContextMenu, handleCanvasClick, handleCanvasDoubleClick]);

  // Setup resize handling - ResizeObserver + window resize
  useEffect(() => {
    if (!canvas) return;

    // Initial resize
    resizeCanvas();

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        console.log('🔍 [ResizeObserver] Container size changed:', {
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
        resizeCanvas();
      }
    });

    // Observe the canvas container
    const container = canvas.parentElement;
    if (container) {
      resizeObserver.observe(container);
    }

    // Window resize handler as fallback
    const handleWindowResize = () => {
      console.log('🔍 [WindowResize] Window resized');
      resizeCanvas();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [canvas, resizeCanvas]);

  // Global mouse up handler (in case mouse leaves canvas)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        mouseStateRef.current = initialMouseState;
        logRef.current('Global mouse up - resetting state');
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Setup resize observer
  useEffect(() => {
    if (!canvas) return;

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });

    resizeObserver.observe(canvas.parentElement || canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeCanvas]);

  // Render when dependencies change - use ref to avoid dependency issues
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => renderRef.current());

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [panels, canvasState]);

  return {
    mouseState: mouseStateRef.current,
    getWorldCoordinates,
    getScreenCoordinates,
    getPanelAtPosition,
    render,
    resizeCanvas,
  };
}
