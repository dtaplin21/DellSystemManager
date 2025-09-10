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
  onCanvasZoom?: (newScale: number) => void;
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
  onCanvasZoom,
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

  // Coordinate transformation functions - proper unified coordinate system
  const getWorldCoordinates = useCallback((screenX: number, screenY: number) => {
    // Convert screen coordinates to world coordinates
    // Account for world offset and scale
    const worldX = (screenX - canvasState.worldOffsetX) / canvasState.worldScale;
    const worldY = (screenY - canvasState.worldOffsetY) / canvasState.worldScale;
    return { x: worldX, y: worldY };
  }, [canvasState.worldOffsetX, canvasState.worldOffsetY, canvasState.worldScale]);

  const getScreenCoordinates = useCallback((worldX: number, worldY: number) => {
    // Convert world coordinates to screen coordinates
    // Account for world offset and scale
    const screenX = worldX * canvasState.worldScale + canvasState.worldOffsetX;
    const screenY = worldY * canvasState.worldScale + canvasState.worldOffsetY;
    return { x: screenX, y: screenY };
  }, [canvasState.worldOffsetX, canvasState.worldOffsetY, canvasState.worldScale]);

  // Panel hit detection - use unified coordinates directly (no conversion needed)
  const getPanelAtPosition = useCallback((screenX: number, screenY: number): Panel | null => {
    // Check panels in reverse order (top to bottom)
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i];
      if (!panel.isValid) continue;

      // Panels are stored in unified coordinates (pixels), so compare directly
      const left = panel.x;
      const right = panel.x + panel.width;
      const top = panel.y;
      const bottom = panel.y + panel.height;

      if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
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

    // Apply world transformations for panning and zooming
    ctx.save();
    ctx.translate(canvasState.worldOffsetX, canvasState.worldOffsetY);
    ctx.scale(canvasState.worldScale, canvasState.worldScale);

    // Draw grid first (in unified coordinates)
    drawGrid(ctx, canvas, canvasState);

    // Draw panels directly in unified coordinates (no transformations needed)
    panels.forEach(panel => {
      if (panel.isValid) {
        drawPanel(ctx, panel);
      }
    });

    // Restore transformations
    ctx.restore();

    logRef.current('Canvas rendered', { 
      panelCount: panels.length, 
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      worldOffset: { x: canvasState.worldOffsetX, y: canvasState.worldOffsetY },
      worldScale: canvasState.worldScale
    });
  }, []); // Remove dependencies to prevent circular dependency

  // Trigger render when panels or canvasState change
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      render();
    });
  }, [panels, canvasState, render]);

  // Grid drawing function - uses unified coordinate system
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: CanvasState) => {
    const gridSize = 0.5; // 0.5px = 1 foot (unified coordinate system: 0.5 pixels per foot)
    const gridColor = '#e5e7eb';
    const majorGridColor = '#d1d5db';
    const majorGridInterval = 10; // Every 10 grid lines = 10 feet

    // Calculate the visible area in world coordinates
    // Since we're already in transformed space, we need to calculate the visible bounds
    const visibleWidth = canvas.width / state.worldScale;
    const visibleHeight = canvas.height / state.worldScale;
    const startX = -state.worldOffsetX / state.worldScale;
    const startY = -state.worldOffsetY / state.worldScale;

    console.log('🔍 [drawGrid] Canvas dimensions:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      displayWidth: canvas.offsetWidth,
      displayHeight: canvas.offsetHeight,
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height,
      visibleWidth,
      visibleHeight,
      startX,
      startY,
      worldOffset: { x: state.worldOffsetX, y: state.worldOffsetY },
      worldScale: state.worldScale
    });

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1 / state.worldScale; // Scale line width inversely with zoom

    // Draw vertical lines - calculate range based on visible area
    const gridStartX = Math.floor(startX / gridSize) * gridSize;
    const gridEndX = Math.ceil((startX + visibleWidth) / gridSize) * gridSize;
    
    for (let x = gridStartX; x <= gridEndX; x += gridSize) {
      ctx.strokeStyle = x % (gridSize * majorGridInterval) === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + visibleHeight);
      ctx.stroke();
    }

    // Draw horizontal lines - calculate range based on visible area
    const gridStartY = Math.floor(startY / gridSize) * gridSize;
    const gridEndY = Math.ceil((startY + visibleHeight) / gridSize) * gridSize;
    
    for (let y = gridStartY; y <= gridEndY; y += gridSize) {
      ctx.strokeStyle = y % (gridSize * majorGridInterval) === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + visibleWidth, y);
      ctx.stroke();
    }

    // Debug logging
    logRef.current('Grid drawn', {
      gridSize,
      majorGridInterval,
      canvasSize: { width: canvas.width, height: canvas.height },
      visibleArea: { width: visibleWidth, height: visibleHeight, startX, startY },
      worldOffset: { x: state.worldOffsetX, y: state.worldOffsetY },
      worldScale: state.worldScale
    });
  }, []);

  // Panel drawing function - panels are stored in screen coordinates, draw directly
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
    ctx.lineWidth = 1 / canvasState.worldScale; // Scale line width with zoom
    ctx.strokeRect(0, 0, width, height);

    // Panel label
    ctx.fillStyle = 'white';
    ctx.font = `${Math.max(8, Math.min(width, height) * 0.3)}px Arial`; // Better font sizing
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(panel.id, width / 2, height / 2);

    ctx.restore();
  }, [canvasState.worldScale]);

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

    // Trigger a render after resize - use ref to avoid circular dependency
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      render();
    });

    logRef.current('Canvas resized', { width: rect.width, height: rect.height });
  }, []); // Remove render dependency to break circular dependency

  // Mouse down handler - use screen coordinates directly
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!canvas) return;

    event.preventDefault();
    isMouseDownRef.current = true;
    mouseDownTimeRef.current = Date.now();

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // Use screen coordinates directly (panels are stored in screen coordinates)
    const clickedPanel = getPanelAtPosition(screenX, screenY);

    if (clickedPanel) {
      // Start dragging panel - store offset from panel's top-left corner
      mouseStateRef.current = {
        isDragging: true,
        isPanning: false,
        selectedPanelId: clickedPanel.id,
        dragStartX: screenX - clickedPanel.x, // Offset from panel's left edge (screen coords)
        dragStartY: screenY - clickedPanel.y, // Offset from panel's top edge (screen coords)
        lastMouseX: screenX,
        lastMouseY: screenY,
      };
      
      onPanelSelect(clickedPanel.id);
      onDragStart?.(clickedPanel.id, { x: screenX, y: screenY });
      logRef.current('Started dragging panel', { panelId: clickedPanel.id, screenPos: { x: screenX, y: screenY } });
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

  // Mouse move handler - use unified coordinates directly
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!canvas || !isMouseDownRef.current) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    const currentState = mouseStateRef.current;

    if (currentState.isDragging && currentState.selectedPanelId) {
      // Update panel position - maintain the offset from where the user clicked
      // Use screen coordinates directly (panels are stored in unified pixels)
      onPanelUpdate(currentState.selectedPanelId, {
        x: screenX - currentState.dragStartX,
        y: screenY - currentState.dragStartY,
      });

      logRef.current('Dragging panel', { 
        panelId: currentState.selectedPanelId, 
        screenPos: { x: screenX, y: screenY },
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

  // Mouse wheel handler for zooming - proper zoom implementation
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!canvas) return;

    event.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to world coordinates
    const worldPos = getWorldCoordinates(mouseX, mouseY);
    
    // Calculate zoom factor (negative deltaY = zoom in, positive = zoom out)
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, canvasState.worldScale * zoomFactor));
    
    // Calculate new offset to zoom towards mouse position
    const scaleChange = newScale / canvasState.worldScale;
    const newOffsetX = mouseX - worldPos.x * newScale;
    const newOffsetY = mouseY - worldPos.y * newScale;
    
    // Update canvas state through callbacks
    if (onCanvasPan) {
      // Calculate delta offset
      const deltaX = newOffsetX - canvasState.worldOffsetX;
      const deltaY = newOffsetY - canvasState.worldOffsetY;
      onCanvasPan(deltaX, deltaY);
    }
    
    // Update scale
    if (onCanvasZoom) {
      onCanvasZoom(newScale);
    }
    
    logRef.current('Zoom attempted', { 
      mousePos: { x: mouseX, y: mouseY },
      worldPos: { x: worldPos.x, y: worldPos.y },
      deltaY: event.deltaY,
      oldScale: canvasState.worldScale,
      newScale: newScale,
      zoomFactor: zoomFactor
    });
  }, [canvas, getWorldCoordinates, canvasState, onCanvasPan, onCanvasZoom]);

  // Context menu handler
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
  }, []);

  // Click handlers for panel interactions - use unified coordinates directly
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // Use screen coordinates directly (panels are stored in unified pixels)
    const clickedPanel = getPanelAtPosition(screenX, screenY);
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
    
    // Use screen coordinates directly (panels are stored in unified pixels)
    const clickedPanel = getPanelAtPosition(screenX, screenY);
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
