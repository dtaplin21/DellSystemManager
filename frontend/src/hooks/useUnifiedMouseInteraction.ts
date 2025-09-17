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
  onPanelUpdate: (panelId: string, updates: Partial<Panel>) => Promise<void>;
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
  // SSR Guard: Return empty functions if running on server
  const isSSR = typeof window === 'undefined';
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseStateRef = useRef<MouseState>(initialMouseState);
  const isMouseDownRef = useRef(false);
  const mouseDownTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastCanvasStateRef = useRef({ ...canvasState });

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
    
    console.log('🎯 [HIT DETECTION] Screen coords:', { screenX, screenY });
    console.log('🎯 [HIT DETECTION] World coords:', worldPos);
    console.log('🎯 [HIT DETECTION] Available panels:', panels.map(p => ({ 
      id: p.id, 
      x: p.x, 
      y: p.y, 
      width: p.width, 
      height: p.height, 
      isValid: p.isValid,
      panelNumber: p.panelNumber 
    })));
    
    // Check panels in reverse order (top to bottom)
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i];
      
      if (!panel.isValid) {
        console.log('🎯 [HIT DETECTION] Skipping invalid panel:', panel.id);
        continue;
      }

      // Panels are stored in world coordinates (pixels), so compare with world coordinates
      const left = panel.x;
      const right = panel.x + panel.width;
      const top = panel.y;
      const bottom = panel.y + panel.height;

      console.log('🎯 [HIT DETECTION] Checking panel:', {
        id: panel.id,
        panelNumber: panel.panelNumber,
        bounds: { left, right, top, bottom },
        worldPos
      });

      if (worldPos.x >= left && worldPos.x <= right && worldPos.y >= top && worldPos.y <= bottom) {
        console.log('🎯 [HIT DETECTION] ✅ HIT! Panel:', panel.id, panel.panelNumber);
        return panel;
      }
    }
    
    console.log('🎯 [HIT DETECTION] ❌ No panel hit');
    return null;
  }, [panels, getWorldCoordinates]);

  // Grid drawing function - uses unified coordinate system
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: CanvasState) => {
    const gridSize = 10; // 10px = 1 foot (unified coordinate system: 10 pixels per foot)
    const gridColor = '#e5e7eb';
    const majorGridColor = '#d1d5db';
    const majorGridInterval = 10; // Every 10 grid lines = 10 feet

    // Calculate visible grid area
    const visibleLeft = -state.worldOffsetX / state.worldScale;
    const visibleTop = -state.worldOffsetY / state.worldScale;
    const visibleRight = visibleLeft + canvas.width / state.worldScale;
    const visibleBottom = visibleTop + canvas.height / state.worldScale;

    // Draw vertical grid lines
    const startX = Math.floor(visibleLeft / gridSize) * gridSize;
    const endX = Math.ceil(visibleRight / gridSize) * gridSize;
    
    for (let x = startX; x <= endX; x += gridSize) {
      const isMajor = Math.abs(x % (gridSize * majorGridInterval)) < 0.001;
      ctx.strokeStyle = isMajor ? majorGridColor : gridColor;
      ctx.lineWidth = isMajor ? 1.5 : 0.5;
      
      ctx.beginPath();
      ctx.moveTo(x, visibleTop);
      ctx.lineTo(x, visibleBottom);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    const startY = Math.floor(visibleTop / gridSize) * gridSize;
    const endY = Math.ceil(visibleBottom / gridSize) * gridSize;
    
    for (let y = startY; y <= endY; y += gridSize) {
      const isMajor = Math.abs(y % (gridSize * majorGridInterval)) < 0.001;
      ctx.strokeStyle = isMajor ? majorGridColor : gridColor;
      ctx.lineWidth = isMajor ? 1.5 : 0.5;
      
      ctx.beginPath();
      ctx.moveTo(visibleLeft, y);
      ctx.lineTo(visibleRight, y);
      ctx.stroke();
    }
  }, []);

  // Panel drawing function - uses unified coordinate system
  const drawPanel = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    // Get current mouse state for drag feedback
    const currentState = mouseStateRef.current;
    
    // Use drag position if currently dragging this panel
    let drawX = panel.x;
    let drawY = panel.y;
    if (currentState.isDragging && currentState.selectedPanelId === panel.id &&
        currentState.dragCurrentX !== undefined && currentState.dragCurrentY !== undefined) {
      drawX = currentState.dragCurrentX;
      drawY = currentState.dragCurrentY;
    }

    // Draw panel directly in world coordinates (canvas is already transformed)
    // No need to convert to screen coordinates since ctx.translate/scale is applied
    const worldWidth = panel.width;
    const worldHeight = panel.height;

    // Draw panel rectangle
    ctx.fillStyle = panel.fill || '#3b82f6';
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    
    ctx.fillRect(drawX, drawY, worldWidth, worldHeight);
    ctx.strokeRect(drawX, drawY, worldWidth, worldHeight);

    // Draw panel number
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(panel.panelNumber || panel.id, drawX + 5, drawY + 15);
  }, []);

  // Canvas rendering function - simplified for unified coordinates
  const render = useCallback(() => {
    // SSR Guard: Don't render on server
    if (isSSR) return;
    
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const now = performance.now();
    const deltaTime = now - lastRenderTimeRef.current;
    
    // Throttle rendering to 60fps
    if (deltaTime < 16.67) {
      if (typeof requestAnimationFrame !== 'undefined') {
        animationFrameRef.current = requestAnimationFrame(render);
      }
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
  }, [canvasState, panels, isSSR]); // Include actual dependencies

  // Render function is now self-contained without circular dependencies

  // Trigger render when panels change (not on every canvasState change)
  useEffect(() => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    
    if (animationFrameRef.current && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (typeof requestAnimationFrame !== 'undefined') {
      animationFrameRef.current = requestAnimationFrame(() => {
        render();
      });
    }
  }, [panels, isSSR]); // Removed canvasState from dependencies

  // Separate effect for canvas state changes - only re-render if significant change
  useEffect(() => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    
    // Only re-render if there's a significant change in scale or offset
    const scaleChanged = Math.abs(canvasState.worldScale - lastCanvasStateRef.current.worldScale) > 0.001;
    const offsetChanged = Math.abs(canvasState.worldOffsetX - lastCanvasStateRef.current.worldOffsetX) > 1 ||
                         Math.abs(canvasState.worldOffsetY - lastCanvasStateRef.current.worldOffsetY) > 1;
    
    if (scaleChanged || offsetChanged) {
      lastCanvasStateRef.current = { ...canvasState };
      
      if (animationFrameRef.current && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (typeof requestAnimationFrame !== 'undefined') {
        animationFrameRef.current = requestAnimationFrame(() => {
          render();
        });
      }
    }
  }, [canvasState.worldScale, canvasState.worldOffsetX, canvasState.worldOffsetY, isSSR]);


  // Canvas resize handler - enhanced with proper container detection
  const resizeCanvas = useCallback(() => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    
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
    // SSR Guard: Don't run on server
    if (isSSR) return;
    if (!canvas) return;

    console.log('🎯 [DRAG DEBUG] ===== MOUSE DOWN EVENT =====');
    console.log('🎯 [DRAG DEBUG] Event type:', event.type);
    console.log('🎯 [DRAG DEBUG] Event target:', event.target);
    console.log('🎯 [DRAG DEBUG] Canvas element:', canvas);

    event.preventDefault();
    isMouseDownRef.current = true;
    mouseDownTimeRef.current = Date.now();

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    console.log('🎯 [DRAG DEBUG] Screen coordinates:', { screenX, screenY });
    console.log('🎯 [DRAG DEBUG] Canvas rect:', rect);
    console.log('🎯 [DRAG DEBUG] Event details:', { clientX: event.clientX, clientY: event.clientY });
    
    // Convert screen coordinates to world coordinates for panel detection
    console.log('🎯 [DRAG DEBUG] Starting panel hit detection...');
    console.log('🎯 [DRAG DEBUG] Available panels:', panels.map(p => ({ id: p.id, x: p.x, y: p.y, width: p.width, height: p.height, isValid: p.isValid })));
    
    const clickedPanel = getPanelAtPosition(screenX, screenY);
    console.log('🎯 [DRAG DEBUG] Panel hit detection result:', clickedPanel);

    if (clickedPanel) {
      console.log('🎯 [DRAG DEBUG] ✅ PANEL CLICKED!', {
        id: clickedPanel.id,
        position: { x: clickedPanel.x, y: clickedPanel.y },
        size: { width: clickedPanel.width, height: clickedPanel.height },
        isValid: clickedPanel.isValid
      });

      // Convert screen coordinates to world coordinates for drag calculation
      const worldPos = getWorldCoordinates(screenX, screenY);
      console.log('🎯 [DRAG DEBUG] World coordinates:', worldPos);
      
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
      
      console.log('🎯 [DRAG DEBUG] Started dragging panel:', {
        panelId: clickedPanel.id,
        dragStartOffset: { x: worldPos.x - clickedPanel.x, y: worldPos.y - clickedPanel.y },
        worldPos: worldPos,
        panelPos: { x: clickedPanel.x, y: clickedPanel.y },
        mouseState: mouseStateRef.current
      });
      
      onPanelSelect(clickedPanel.id);
      onDragStart?.(clickedPanel.id, worldPos);
      logRef.current('Started dragging panel', { 
        panelId: clickedPanel.id, 
        screenPos: { x: screenX, y: screenY },
        worldPos: { x: worldPos.x, y: worldPos.y },
        panelPos: { x: clickedPanel.x, y: clickedPanel.y }
      });
    } else {
      console.log('🎯 [DRAG DEBUG] ❌ No panel clicked, starting canvas pan');
      
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
      
      console.log('🎯 [DRAG DEBUG] Started canvas panning:', {
        lastMousePos: { x: screenX, y: screenY },
        mouseState: mouseStateRef.current
      });
      
      onPanelSelect(null);
      logRef.current('Started panning canvas', { screenX, screenY });
    }
  }, [canvas, getPanelAtPosition, onPanelSelect, onDragStart, getWorldCoordinates, panels]);

  // Mouse move handler - convert coordinates properly for world coordinate system
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    if (!canvas || !isMouseDownRef.current) return;

    console.log('🎯 [DRAG DEBUG] ===== MOUSE MOVE EVENT =====');
    console.log('🎯 [DRAG DEBUG] Event type:', event.type);
    console.log('🎯 [DRAG DEBUG] isMouseDown:', isMouseDownRef.current);

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    console.log('🎯 [DRAG DEBUG] Screen coordinates:', { screenX, screenY });
    console.log('🎯 [DRAG DEBUG] Canvas rect:', rect);
    
    const currentState = mouseStateRef.current;
    console.log('🎯 [DRAG DEBUG] Current mouse state:', currentState);

    if (currentState.isDragging && currentState.selectedPanelId) {
      console.log('🎯 [DRAG DEBUG] 🔄 DRAGGING PANEL');
      
      // Convert screen coordinates to world coordinates for panel position
      const worldPos = getWorldCoordinates(screenX, screenY);
      console.log('🎯 [DRAG DEBUG] World coordinates:', worldPos);
      
      // Calculate new position but don't update state yet - just update the visual position
      const newX = worldPos.x - currentState.dragStartX;
      const newY = worldPos.y - currentState.dragStartY;
      
      console.log('🎯 [DRAG DEBUG] Calculated new position:', {
        newX, newY,
        worldPos,
        dragStartOffset: { x: currentState.dragStartX, y: currentState.dragStartY }
      });
      
      // Store the new position for visual feedback without triggering state updates
      // This prevents continuous re-renders during dragging
      currentState.dragCurrentX = newX;
      currentState.dragCurrentY = newY;
      
      console.log('🎯 [DRAG DEBUG] Updated drag current position:', {
        dragCurrentX: currentState.dragCurrentX,
        dragCurrentY: currentState.dragCurrentY
      });
      
      // Only update the actual panel state on mouse up to prevent render loops
      // For now, just trigger a render to show the visual feedback
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        console.log('🎯 [DRAG DEBUG] Triggering render for visual feedback');
        render();
      });

      logRef.current('Dragging panel (visual only)', { 
        panelId: currentState.selectedPanelId, 
        screenPos: { x: screenX, y: screenY },
        worldPos: { x: worldPos.x, y: worldPos.y },
        newPos: { x: newX, y: newY },
        dragStart: { x: currentState.dragStartX, y: currentState.dragStartY }
      });
    } else if (currentState.isPanning) {
      console.log('🎯 [DRAG DEBUG] 🔄 PANNING CANVAS');
      
      // Update canvas pan
      const deltaX = screenX - currentState.lastMouseX;
      const deltaY = screenY - currentState.lastMouseY;

      console.log('🎯 [DRAG DEBUG] Pan delta:', { deltaX, deltaY });
      console.log('🎯 [DRAG DEBUG] Last mouse pos:', { x: currentState.lastMouseX, y: currentState.lastMouseY });
      console.log('🎯 [DRAG DEBUG] Current mouse pos:', { x: screenX, y: screenY });

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
  const handleMouseUp = useCallback(async (event: MouseEvent) => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    if (!canvas) return;

    console.log('🎯 [DRAG DEBUG] ===== MOUSE UP EVENT =====');
    console.log('🎯 [DRAG DEBUG] Event type:', event.type);

    event.preventDefault();
    isMouseDownRef.current = false;

    const currentState = mouseStateRef.current;
    const clickDuration = Date.now() - mouseDownTimeRef.current;

    console.log('🎯 [DRAG DEBUG] Current mouse state:', currentState);
    console.log('🎯 [DRAG DEBUG] Click duration:', clickDuration);

    if (currentState.isDragging && currentState.selectedPanelId) {
      console.log('🎯 [DRAG DEBUG] ✅ FINISHING PANEL DRAG');
      
      // Now commit the final panel position change
      if (currentState.dragCurrentX !== undefined && currentState.dragCurrentY !== undefined) {
        console.log('🎯 [DRAG DEBUG] Committing panel position:', {
          panelId: currentState.selectedPanelId,
          finalPos: { x: currentState.dragCurrentX, y: currentState.dragCurrentY }
        });
        
        await onPanelUpdate(currentState.selectedPanelId, {
          x: currentState.dragCurrentX,
          y: currentState.dragCurrentY,
        });
        
        logRef.current('Committed panel position', { 
          panelId: currentState.selectedPanelId,
          finalPos: { x: currentState.dragCurrentX, y: currentState.dragCurrentY }
        });
      } else {
        console.log('🎯 [DRAG DEBUG] ❌ No drag current position to commit');
      }
      
      onDragEnd?.();
      logRef.current('Finished dragging panel', { 
        panelId: currentState.selectedPanelId,
        duration: clickDuration 
      });
    } else if (currentState.isPanning) {
      console.log('🎯 [DRAG DEBUG] ✅ FINISHING CANVAS PAN');
      logRef.current('Finished panning canvas', { duration: clickDuration });
    } else {
      console.log('🎯 [DRAG DEBUG] ❌ No active drag or pan operation');
    }

    // Reset mouse state
    console.log('🎯 [DRAG DEBUG] Resetting mouse state to initial state');
    mouseStateRef.current = initialMouseState;
  }, [canvas, onDragEnd, onPanelUpdate]);

  // Throttle zoom updates to prevent excessive state changes
  const zoomThrottleRef = useRef<number>();
  const lastZoomTimeRef = useRef<number>(0);
  const ZOOM_THROTTLE_MS = 16; // ~60fps

  // Mouse wheel handler for zooming - throttled to prevent excessive updates
  const handleWheel = useCallback((event: WheelEvent) => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    if (!canvas) return;

    event.preventDefault();
    
    const now = performance.now();
    if (now - lastZoomTimeRef.current < ZOOM_THROTTLE_MS) {
      return; // Skip this zoom event
    }
    lastZoomTimeRef.current = now;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to world coordinates
    const worldPos = getWorldCoordinates(mouseX, mouseY);
    
    // Calculate zoom factor (negative deltaY = zoom in, positive = zoom out)
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, canvasState.worldScale * zoomFactor));
    
    // Only update if scale actually changed significantly
    if (Math.abs(newScale - canvasState.worldScale) < 0.001) {
      return;
    }
    
    // Calculate new offset to zoom towards mouse position
    const newOffsetX = mouseX - worldPos.x * newScale;
    const newOffsetY = mouseY - worldPos.y * newScale;
    
    // Clear any pending zoom updates
    if (zoomThrottleRef.current) {
      cancelAnimationFrame(zoomThrottleRef.current);
    }
    
    // Throttle the actual state updates
    zoomThrottleRef.current = requestAnimationFrame(() => {
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
    });
    
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
    // SSR Guard: Don't run on server
    if (isSSR) return;
    event.preventDefault();
  }, [isSSR]);

  // Click handlers for panel interactions - use unified coordinates directly
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
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
    // SSR Guard: Don't run on server
    if (isSSR) return;
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

  // Handler refs to avoid recreating event listeners when handlers change
  const handleMouseDownRef = useRef(handleMouseDown);
  const handleMouseMoveRef = useRef(handleMouseMove);
  const handleMouseUpRef = useRef(handleMouseUp);
  const handleWheelRef = useRef(handleWheel);
  const handleContextMenuRef = useRef(handleContextMenu);
  const handleCanvasClickRef = useRef(handleCanvasClick);
  const handleCanvasDoubleClickRef = useRef(handleCanvasDoubleClick);

  // Update handler refs when handlers change
  useEffect(() => {
    handleMouseDownRef.current = handleMouseDown;
    handleMouseMoveRef.current = handleMouseMove;
    handleMouseUpRef.current = handleMouseUp;
    handleWheelRef.current = handleWheel;
    handleContextMenuRef.current = handleContextMenu;
    handleCanvasClickRef.current = handleCanvasClick;
    handleCanvasDoubleClickRef.current = handleCanvasDoubleClick;
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleContextMenu, handleCanvasClick, handleCanvasDoubleClick]);

  // Setup event listeners - SINGLE UNIFIED SETUP
  useEffect(() => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    if (!canvas) return;

    // Use refs to avoid recreating event listeners when handlers change
    const handlers = {
      mousedown: (e: MouseEvent) => handleMouseDownRef.current(e),
      mousemove: (e: MouseEvent) => handleMouseMoveRef.current(e),
      mouseup: async (e: MouseEvent) => await handleMouseUpRef.current(e),
      wheel: (e: WheelEvent) => handleWheelRef.current(e),
      contextmenu: (e: MouseEvent) => handleContextMenuRef.current(e),
      click: (e: MouseEvent) => handleCanvasClickRef.current(e),
      dblclick: (e: MouseEvent) => handleCanvasDoubleClickRef.current(e),
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
  }, [canvas, isSSR]); // Only depend on canvas and SSR - handlers are stable via refs

  // Setup resize handling - ResizeObserver + window resize
  useEffect(() => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
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
  }, [canvas, isSSR]); // Remove resizeCanvas dependency - it's stable

  // Global mouse up handler (in case mouse leaves canvas)
  useEffect(() => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        mouseStateRef.current = initialMouseState;
        logRef.current('Global mouse up - resetting state');
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSSR]);

  // Resize observer is handled in the main resize effect above

  // Render when dependencies change - handled by the main render trigger above

  // SSR Fallback: Return empty functions if running on server
  if (isSSR) {
    return {
      mouseState: initialMouseState,
      getWorldCoordinates: () => ({ x: 0, y: 0 }),
      getScreenCoordinates: () => ({ x: 0, y: 0 }),
      getPanelAtPosition: () => null,
      render: () => {},
      resizeCanvas: () => {},
    };
  }

  return {
    mouseState: mouseStateRef.current,
    getWorldCoordinates,
    getScreenCoordinates,
    getPanelAtPosition,
    render,
    resizeCanvas,
  };
}
