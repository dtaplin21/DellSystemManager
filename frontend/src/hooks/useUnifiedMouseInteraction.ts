import { useCallback, useEffect, useRef, useMemo } from 'react';
import { Panel } from '@/types/panel';

interface MouseState {
  isDragging: boolean;
  isPanning: boolean;
  selectedPanelId: string | null;
  dragStartX: number;
  dragStartY: number;
  dragCurrentX?: number; // Current drag position for visual feedback
  dragCurrentY?: number; // Current drag position for visual feedback
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

  // Panel hit detection - convert screen coordinates to world coordinates for comparison
  const getPanelAtPosition = useCallback((screenX: number, screenY: number): Panel | null => {
    // Convert screen coordinates to world coordinates
    const worldPos = getWorldCoordinates(screenX, screenY);
    
    // Check panels in reverse order (top to bottom)
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i];
      if (!panel.isValid) continue;

      // Panels are stored in world coordinates (feet), so compare with world coordinates
      const left = panel.x;
      const right = panel.x + panel.width;
      const top = panel.y;
      const bottom = panel.y + panel.height;

      if (worldPos.x >= left && worldPos.x <= right && worldPos.y >= top && worldPos.y <= bottom) {
        return panel;
      }
    }
    return null;
  }, [panels, getWorldCoordinates]);

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
      animationFrameRef.current = requestAnimationFrame(() => renderRef.current());
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
  }, [canvasState, panels, drawGrid, drawPanel]); // Include dependencies

  // Store render function in ref to avoid circular dependencies
  const renderRef = useRef(render);
  renderRef.current = render;

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

  // Panel drawing function - convert world coordinates to screen coordinates for rendering
  const drawPanel = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    const { x, y, width, height, rotation = 0 } = panel;
    
    // Check if this panel is currently being dragged and use temporary position
    const currentState = mouseStateRef.current;
    let drawX = x;
    let drawY = y;
    
    if (currentState.isDragging && currentState.selectedPanelId === panel.id && 
        currentState.dragCurrentX !== undefined && currentState.dragCurrentY !== undefined) {
      drawX = currentState.dragCurrentX;
      drawY = currentState.dragCurrentY;
    }

    // Convert world coordinates to screen coordinates
    const screenPos = getScreenCoordinates(drawX, drawY);
    const screenWidth = width * canvasState.worldScale;
    const screenHeight = height * canvasState.worldScale;

    ctx.save();
    ctx.translate(screenPos.x + screenWidth / 2, screenPos.y + screenHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-screenWidth / 2, -screenHeight / 2);

    // Panel background
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // Panel border
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 1; // Fixed line width for screen coordinates
    ctx.strokeRect(0, 0, screenWidth, screenHeight);

    // Panel label
    ctx.fillStyle = 'white';
    ctx.font = `${Math.max(8, Math.min(screenWidth, screenHeight) * 0.3)}px Arial`; // Better font sizing
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(panel.id, screenWidth / 2, screenHeight / 2);

    ctx.restore();
  }, [canvasState.worldScale, getScreenCoordinates]);

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
  }, [render]); // Include render dependency

  // Mouse down handler - convert coordinates properly for world coordinate system
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!canvas) return;

    event.preventDefault();
    isMouseDownRef.current = true;
    mouseDownTimeRef.current = Date.now();

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates for panel detection
    const clickedPanel = getPanelAtPosition(screenX, screenY);

    if (clickedPanel) {
      // Convert screen coordinates to world coordinates for drag calculation
      const worldPos = getWorldCoordinates(screenX, screenY);
      
      // Start dragging panel - store offset from panel's top-left corner in world coordinates
      mouseStateRef.current = {
        isDragging: true,
        isPanning: false,
        selectedPanelId: clickedPanel.id,
        dragStartX: worldPos.x - clickedPanel.x, // Offset from panel's left edge (world coords)
        dragStartY: worldPos.y - clickedPanel.y, // Offset from panel's top edge (world coords)
        lastMouseX: screenX,
        lastMouseY: screenY,
      };
      
      onPanelSelect(clickedPanel.id);
      onDragStart?.(clickedPanel.id, worldPos);
      logRef.current('Started dragging panel', { 
        panelId: clickedPanel.id, 
        screenPos: { x: screenX, y: screenY },
        worldPos: { x: worldPos.x, y: worldPos.y },
        panelPos: { x: clickedPanel.x, y: clickedPanel.y }
      });
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
  }, [canvas, getPanelAtPosition, onPanelSelect, onDragStart, getWorldCoordinates]);

  // Mouse move handler - convert coordinates properly for world coordinate system
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!canvas || !isMouseDownRef.current) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    const currentState = mouseStateRef.current;

    if (currentState.isDragging && currentState.selectedPanelId) {
      // Convert screen coordinates to world coordinates for panel position
      const worldPos = getWorldCoordinates(screenX, screenY);
      
      // Calculate new position but don't update state yet - just update the visual position
      const newX = worldPos.x - currentState.dragStartX;
      const newY = worldPos.y - currentState.dragStartY;
      
      // Store the new position for visual feedback without triggering state updates
      // This prevents continuous re-renders during dragging
      currentState.dragCurrentX = newX;
      currentState.dragCurrentY = newY;
      
      // Only update the actual panel state on mouse up to prevent render loops
      // For now, just trigger a render to show the visual feedback
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        renderRef.current();
      });

      logRef.current('Dragging panel (visual only)', { 
        panelId: currentState.selectedPanelId, 
        screenPos: { x: screenX, y: screenY },
        worldPos: { x: worldPos.x, y: worldPos.y },
        newPos: { x: newX, y: newY },
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
  }, [canvas, onCanvasPan, getWorldCoordinates]);

  // Mouse up handler
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!canvas) return;

    event.preventDefault();
    isMouseDownRef.current = false;

    const currentState = mouseStateRef.current;
    const clickDuration = Date.now() - mouseDownTimeRef.current;

    if (currentState.isDragging && currentState.selectedPanelId) {
      // Now commit the final panel position change
      if (currentState.dragCurrentX !== undefined && currentState.dragCurrentY !== undefined) {
        onPanelUpdate(currentState.selectedPanelId, {
          x: currentState.dragCurrentX,
          y: currentState.dragCurrentY,
        });
        
        logRef.current('Committed panel position', { 
          panelId: currentState.selectedPanelId,
          finalPos: { x: currentState.dragCurrentX, y: currentState.dragCurrentY }
        });
      }
      
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
  }, [canvas, onDragEnd, onPanelUpdate]);

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
