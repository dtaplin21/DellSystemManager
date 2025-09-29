import { useCallback, useEffect, useRef, useMemo } from 'react';
import { Panel } from '@/types/panel';

interface MouseState {
  isDragging: boolean;
  isPanning: boolean;
  isRotating: boolean;
  selectedPanelId: string | null;
  dragStartX: number;
  dragStartY: number;
  dragCurrentX?: number; // Current drag position for visual feedback
  dragCurrentY?: number; // Current drag position for visual feedback
  lastMouseX: number;
  lastMouseY: number;
  rotationStartAngle?: number; // Initial angle when rotation starts
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
  getWorldCoordinates: (screenX: number, screenY: number, currentCanvasState: CanvasState) => { x: number; y: number };
  getScreenCoordinates: (worldX: number, worldY: number, currentCanvasState: CanvasState) => { x: number; y: number };
  getPanelAtPosition: (worldX: number, worldY: number) => Panel | null;
  render: () => void;
  resizeCanvas: () => void;
}

const initialMouseState: MouseState = {
  isDragging: false,
  isPanning: false,
  isRotating: false,
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
  
  // Debug: Log canvasState changes
  useEffect(() => {
    console.log('🎯 [CANVAS STATE DEBUG] CanvasState updated:', canvasState);
  }, [canvasState]);
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
  const getWorldCoordinates = useCallback((screenX: number, screenY: number, currentCanvasState: CanvasState) => {
    // Convert screen coordinates to world coordinates
    // Account for world offset and scale
    const worldX = (screenX - currentCanvasState.worldOffsetX) / currentCanvasState.worldScale;
    const worldY = (screenY - currentCanvasState.worldOffsetY) / currentCanvasState.worldScale;
    
    return { x: worldX, y: worldY };
  }, []);

  const getScreenCoordinates = useCallback((worldX: number, worldY: number, currentCanvasState: CanvasState) => {
    // Convert world coordinates to screen coordinates
    // Account for world offset and scale
    const screenX = worldX * currentCanvasState.worldScale + currentCanvasState.worldOffsetX;
    const screenY = worldY * currentCanvasState.worldScale + currentCanvasState.worldOffsetY;
    return { x: screenX, y: screenY };
  }, []);

  // Panel hit detection - SIMPLIFIED APPROACH: Convert panel coordinates to screen coordinates
  const getPanelAtPosition = useCallback((screenX: number, screenY: number): Panel | null => {
    console.log('🎯 [HIT DETECTION] Screen coords:', { screenX, screenY });
    console.log('🎯 [HIT DETECTION] Canvas state:', {
      worldScale: canvasState.worldScale,
      worldOffsetX: canvasState.worldOffsetX,
      worldOffsetY: canvasState.worldOffsetY
    });
    
    // Check panels in reverse order (top to bottom)
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i];
      
      if (!panel.isValid) {
        continue;
      }

      // SIMPLIFIED: Convert panel world coordinates to screen coordinates for hit detection
      // This matches exactly how panels are drawn with canvas transformations
      const panelScreenX = panel.x * canvasState.worldScale + canvasState.worldOffsetX;
      const panelScreenY = panel.y * canvasState.worldScale + canvasState.worldOffsetY;
      const panelScreenWidth = panel.width * canvasState.worldScale;
      const panelScreenHeight = panel.height * canvasState.worldScale;
      
      // Panel bounds in screen coordinates
      const left = panelScreenX;
      const right = panelScreenX + panelScreenWidth;
      const top = panelScreenY;
      const bottom = panelScreenY + panelScreenHeight;
      
      console.log('🎯 [HIT DETECTION] Panel screen bounds:', {
        panelId: panel.id,
        panelWorldCoords: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
        panelScreenCoords: { x: panelScreenX, y: panelScreenY, width: panelScreenWidth, height: panelScreenHeight },
        bounds: { left, right, top, bottom },
        mousePos: { x: screenX, y: screenY }
      });

      // Check if mouse position is within panel screen bounds
      if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
        console.log('🎯 [HIT DETECTION] ✅ HIT! Panel:', panel.id, panel.panelNumber);
        return panel;
      }
    }
    
    console.log('🎯 [HIT DETECTION] ❌ No panel hit');
    return null;
  }, [panels, canvasState]);

  // Check if mouse is over rotation handle - WORLD COORDINATES APPROACH
  const isOverRotationHandle = useCallback((screenX: number, screenY: number, panel: Panel): boolean => {
    if (!panel.isValid) {
      return false;
    }
    
    // Convert mouse screen coordinates to world coordinates
    const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
    
    // ROTATION HANDLES SHOULD ALWAYS USE ORIGINAL PANEL POSITION
    // They should not move with the panel during dragging
    // Use world coordinates for consistency with drawing
    const originalPanelWorldX = panel.x;
    const originalPanelWorldY = panel.y;
    const originalPanelWorldWidth = panel.width;
    const originalPanelWorldHeight = panel.height;
    
    // Calculate rotation handle position based on panel shape - using world coordinates
    let rotationHandleWorldX: number;
    let rotationHandleWorldY: number;
    
    // Convert handle size from screen pixels to world units
    const handleSizeWorld = 16 / canvasState.worldScale; // 16 pixels in world units
    
    switch (panel.shape) {
      case 'right-triangle':
        // For right triangle, place rotation handle above the top edge center
        rotationHandleWorldX = originalPanelWorldX + originalPanelWorldWidth / 2;
        rotationHandleWorldY = originalPanelWorldY - (30 / canvasState.worldScale); // 30 pixels in world units
        break;
        
      case 'patch':
        // For circle, place rotation handle above the circle center
        const circleRadius = originalPanelWorldWidth / 2;
        rotationHandleWorldX = originalPanelWorldX + circleRadius;
        rotationHandleWorldY = originalPanelWorldY + circleRadius - (30 / canvasState.worldScale); // 30 pixels in world units
        break;
        
      case 'rectangle':
      default:
        // For rectangle, place rotation handle above the top edge center
        rotationHandleWorldX = originalPanelWorldX + originalPanelWorldWidth / 2;
        rotationHandleWorldY = originalPanelWorldY - (30 / canvasState.worldScale); // 30 pixels in world units
        break;
    }
    
    console.log('🎯 [ROTATION HANDLE DEBUG] Rotation handle position (world coords):', {
      panelId: panel.id,
      originalPanelWorldCoords: { x: originalPanelWorldX, y: originalPanelWorldY, width: originalPanelWorldWidth, height: originalPanelWorldHeight },
      rotationHandleWorld: { x: rotationHandleWorldX, y: rotationHandleWorldY },
      mouseWorldPos: worldPos,
      handleSizeWorld,
      canvasState: {
        worldScale: canvasState.worldScale,
        worldOffsetX: canvasState.worldOffsetX,
        worldOffsetY: canvasState.worldOffsetY
      }
    });
    
    // Check if mouse is within rotation handle bounds (in world coordinates)
    const handleBounds = {
      left: rotationHandleWorldX - handleSizeWorld / 2,
      right: rotationHandleWorldX + handleSizeWorld / 2,
      top: rotationHandleWorldY - handleSizeWorld / 2,
      bottom: rotationHandleWorldY + handleSizeWorld / 2
    };
    
    const isHit = worldPos.x >= handleBounds.left && worldPos.x <= handleBounds.right &&
                 worldPos.y >= handleBounds.top && worldPos.y <= handleBounds.bottom;
    
    console.log('🎯 [ROTATION HANDLE DEBUG] Hit result (world coords):', isHit);
    
    return isHit;
  }, [canvasState, getWorldCoordinates]);

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

    // Panel colors
    if (panel.shape === 'patch') {
      ctx.fillStyle = '#ef4444'; // Red for patches
      ctx.strokeStyle = '#b91c1c'; // Darker red for stroke
    } else {
      ctx.fillStyle = panel.fill || '#87CEEB';
      ctx.strokeStyle = '#1e40af';
    }
    ctx.lineWidth = 2;
    
    // Apply rotation for all shapes
    const rotation = panel.rotation * Math.PI / 180;
    const centerX = drawX + worldWidth / 2;
    const centerY = drawY + worldHeight / 2;
    
    // Save the current transformation state
    ctx.save();
    
    // Apply rotation transformation
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-worldWidth / 2, -worldHeight / 2);
    
    // Draw different shapes based on panel.shape
    switch (panel.shape) {
      case 'right-triangle':
        ctx.beginPath();
        
        // Define triangle points relative to origin (after translation)
        const points = [
          { x: 0, y: 0 }, // Top left
          { x: worldWidth, y: 0 },  // Top right
          { x: 0, y: worldHeight }   // Bottom left (right angle)
        ]
        
        // Draw triangle
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(points[1].x, points[1].y)
        ctx.lineTo(points[2].x, points[2].y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break;
        
      case 'patch':
        // Draw circle - use width as diameter for consistent sizing
        const radius = worldWidth / 2;
        const circleCenterX = worldWidth / 2;
        const circleCenterY = worldHeight / 2;
        ctx.beginPath();
        ctx.arc(circleCenterX, circleCenterY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'rectangle':
      default:
        // Draw rectangle (default)
        ctx.fillRect(0, 0, worldWidth, worldHeight);
        ctx.strokeRect(0, 0, worldWidth, worldHeight);
        break;
    }
    
    // Restore the transformation state
    ctx.restore();

    // Draw panel number (after rotation is applied)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(panel.panelNumber || panel.id, -worldWidth / 2 + 5, -worldHeight / 2 + 15);
    ctx.restore();
  }, []);

  // Draw selection handles for a panel - WORLD COORDINATES APPROACH
  const drawSelectionHandles = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
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

    // Convert handle size from screen pixels to world units
    const handleSizeWorld = 16 / canvasState.worldScale; // 16 pixels in world units
    
    // Generate handles based on panel shape - using world coordinates
    let handles: Array<{ x: number; y: number; cursor: string }> = [];
    
    switch (panel.shape) {
      case 'right-triangle':
        // Right triangle handles: corners and midpoints
        handles = [
          { x: drawX, y: drawY, cursor: 'nw-resize' }, // Top left
          { x: drawX + panel.width, y: drawY, cursor: 'ne-resize' }, // Top right
          { x: drawX, y: drawY + panel.height, cursor: 'sw-resize' }, // Bottom left (right angle)
          { x: drawX + panel.width / 2, y: drawY, cursor: 'n-resize' }, // Top mid
          { x: drawX, y: drawY + panel.height / 2, cursor: 'w-resize' } // Left mid
        ];
        break;
        
      case 'patch':
        // Circle handles: 8 points around the circle
        const radius = panel.width / 2;
        const centerX = drawX + radius;
        const centerY = drawY + radius;
        handles = [
          { x: centerX, y: centerY - radius, cursor: 'n-resize' }, // Top
          { x: centerX + radius * 0.707, y: centerY - radius * 0.707, cursor: 'ne-resize' }, // Top right
          { x: centerX + radius, y: centerY, cursor: 'e-resize' }, // Right
          { x: centerX + radius * 0.707, y: centerY + radius * 0.707, cursor: 'se-resize' }, // Bottom right
          { x: centerX, y: centerY + radius, cursor: 's-resize' }, // Bottom
          { x: centerX - radius * 0.707, y: centerY + radius * 0.707, cursor: 'sw-resize' }, // Bottom left
          { x: centerX - radius, y: centerY, cursor: 'w-resize' }, // Left
          { x: centerX - radius * 0.707, y: centerY - radius * 0.707, cursor: 'nw-resize' } // Top left
        ];
        break;
        
      case 'rectangle':
      default:
        // Rectangle handles: all corners and midpoints
        handles = [
          { x: drawX, y: drawY, cursor: 'nw-resize' },
          { x: drawX + panel.width / 2, y: drawY, cursor: 'n-resize' },
          { x: drawX + panel.width, y: drawY, cursor: 'ne-resize' },
          { x: drawX + panel.width, y: drawY + panel.height / 2, cursor: 'e-resize' },
          { x: drawX + panel.width, y: drawY + panel.height, cursor: 'se-resize' },
          { x: drawX + panel.width / 2, y: drawY + panel.height, cursor: 's-resize' },
          { x: drawX, y: drawY + panel.height, cursor: 'sw-resize' },
          { x: drawX, y: drawY + panel.height / 2, cursor: 'w-resize' }
        ];
        break;
    }
    
    // Draw resize handles (in world coordinates)
    handles.forEach(handle => {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(handle.x - handleSizeWorld / 2, handle.y - handleSizeWorld / 2, handleSizeWorld, handleSizeWorld);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / canvasState.worldScale; // Scale line width
      ctx.strokeRect(handle.x - handleSizeWorld / 2, handle.y - handleSizeWorld / 2, handleSizeWorld, handleSizeWorld);
    });
    
    // Draw rotation handle - ALWAYS use original panel position (not drag position)
    // Use world coordinates for consistency
    const originalPanelWorldX = panel.x;
    const originalPanelWorldY = panel.y;
    const originalPanelWorldWidth = panel.width;
    const originalPanelWorldHeight = panel.height;
    
    let rotationHandleWorldX: number;
    let rotationHandleWorldY: number;
    
    switch (panel.shape) {
      case 'right-triangle':
        // For right triangle, place rotation handle above the top edge center
        rotationHandleWorldX = originalPanelWorldX + originalPanelWorldWidth / 2;
        rotationHandleWorldY = originalPanelWorldY - (30 / canvasState.worldScale); // 30 pixels in world units
        break;
        
      case 'patch':
        // For circle, place rotation handle above the circle center
        const circleRadius = originalPanelWorldWidth / 2;
        rotationHandleWorldX = originalPanelWorldX + circleRadius;
        rotationHandleWorldY = originalPanelWorldY + circleRadius - (30 / canvasState.worldScale); // 30 pixels in world units
        break;
        
      case 'rectangle':
      default:
        // For rectangle, place rotation handle above the top edge center
        rotationHandleWorldX = originalPanelWorldX + originalPanelWorldWidth / 2;
        rotationHandleWorldY = originalPanelWorldY - (30 / canvasState.worldScale); // 30 pixels in world units
        break;
    }
    
    console.log('🎯 [ROTATION HANDLE DEBUG] Drawing rotation handle at (world coords):', {
      x: rotationHandleWorldX,
      y: rotationHandleWorldY,
      originalPanelWorldCoords: { x: originalPanelWorldX, y: originalPanelWorldY, width: originalPanelWorldWidth, height: originalPanelWorldHeight },
      dragPanelWorldCoords: { x: drawX, y: drawY, width: panel.width, height: panel.height },
      handleSizeWorld,
      panelShape: panel.shape,
      canvasState: {
        worldScale: canvasState.worldScale,
        worldOffsetX: canvasState.worldOffsetX,
        worldOffsetY: canvasState.worldOffsetY
      }
    });
    
    // Draw rotation handle (green square) in world coordinates
    ctx.fillStyle = '#10b981';
    ctx.fillRect(rotationHandleWorldX - handleSizeWorld / 2, rotationHandleWorldY - handleSizeWorld / 2, handleSizeWorld, handleSizeWorld);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / canvasState.worldScale; // Scale line width
    ctx.strokeRect(rotationHandleWorldX - handleSizeWorld / 2, rotationHandleWorldY - handleSizeWorld / 2, handleSizeWorld, handleSizeWorld);
    
    // DEBUG: Draw handle bounds outline for visual debugging
    ctx.strokeStyle = '#ff0000'; // Red outline
    ctx.lineWidth = 2 / canvasState.worldScale;
    ctx.strokeRect(rotationHandleWorldX - handleSizeWorld / 2, rotationHandleWorldY - handleSizeWorld / 2, handleSizeWorld, handleSizeWorld);
    
    // DEBUG: Draw center point
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(rotationHandleWorldX - 1 / canvasState.worldScale, rotationHandleWorldY - 1 / canvasState.worldScale, 2 / canvasState.worldScale, 2 / canvasState.worldScale);
    
    console.log('🎯 [ROTATION HANDLE DEBUG] Rotation handle drawn successfully (world coords)');
  }, [canvasState]);

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

    // Draw selection handles for selected panel - BEFORE transformations are restored (world coordinates)
    const selectedPanel = panels.find(p => p.id === mouseStateRef.current.selectedPanelId);
    console.log('🎯 [ROTATION HANDLE DEBUG] Render function - checking for selected panel:', {
      selectedPanelId: mouseStateRef.current.selectedPanelId,
      selectedPanel: selectedPanel,
      selectedPanelValid: selectedPanel?.isValid,
      totalPanels: panels.length
    });
    
    if (selectedPanel && selectedPanel.isValid) {
      console.log('🎯 [ROTATION HANDLE DEBUG] Drawing selection handles for selected panel (world coords):', {
        id: selectedPanel.id,
        shape: selectedPanel.shape,
        position: { x: selectedPanel.x, y: selectedPanel.y },
        size: { width: selectedPanel.width, height: selectedPanel.height },
        canvasSize: { width: canvas.width, height: canvas.height }
      });
      drawSelectionHandles(ctx, selectedPanel);
      console.log('🎯 [ROTATION HANDLE DEBUG] Selection handles drawn successfully (world coords)');
    } else {
      console.log('🎯 [ROTATION HANDLE DEBUG] No selected panel or panel invalid:', {
        selectedPanelId: mouseStateRef.current.selectedPanelId,
        selectedPanel: selectedPanel
      });
    }

    // Restore transformations
    ctx.restore();

    logRef.current('Canvas rendered', { 
      panelCount: panels.length, 
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      worldOffset: { x: canvasState.worldOffsetX, y: canvasState.worldOffsetY },
      worldScale: canvasState.worldScale
    });
  }, [canvasState, panels, isSSR, drawSelectionHandles]); // Include actual dependencies

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
    
    // FIRST: Check if clicking on any rotation handle (before panel detection)
    console.log('🎯 [ROTATION DEBUG] Checking rotation handles for all panels...');
    let rotationHandleClicked = false;
    
    for (const panel of panels) {
      if (panel.isValid && isOverRotationHandle(screenX, screenY, panel)) {
        console.log('🎯 [ROTATION DEBUG] ✅ ROTATION HANDLE CLICKED!', {
          panelId: panel.id,
          currentRotation: panel.rotation || 0,
          mousePos: { x: screenX, y: screenY }
        });

        // Convert screen coordinates to world coordinates for rotation calculation
        const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
        
        // Calculate initial angle from panel center to mouse position
        const panelCenterX = panel.x + panel.width / 2;
        const panelCenterY = panel.y + panel.height / 2;
        
        // Calculate the angle from panel center to current mouse position
        const initialAngle = Math.atan2(worldPos.y - panelCenterY, worldPos.x - panelCenterX);
        
        console.log('🎯 [ROTATION DEBUG] Setup rotation:', {
          panelCenter: { x: panelCenterX, y: panelCenterY },
          mouseWorldPos: worldPos,
          initialAngle: initialAngle * (180 / Math.PI),
          panelCurrentRotation: panel.rotation || 0
        });
        
        // Start rotating panel
        mouseStateRef.current = {
          isDragging: false,
          isPanning: false,
          isRotating: true,
          selectedPanelId: panel.id,
          dragStartX: worldPos.x,
          dragStartY: worldPos.y,
          lastMouseX: screenX,
          lastMouseY: screenY,
          rotationStartAngle: initialAngle,
        };
        
        // Also select the panel for visual feedback
        onPanelSelect(panel.id);
        
        console.log('🎯 [ROTATION DEBUG] Started rotating panel:', {
          panelId: panel.id,
          initialAngle: initialAngle * (180 / Math.PI),
          currentRotation: panel.rotation || 0,
          mouseState: mouseStateRef.current
        });
        
        rotationHandleClicked = true;
        return; // Exit early, don't start dragging
      }
    }
    
    if (rotationHandleClicked) {
      return; // Exit if rotation handle was clicked
    }

    // SECOND: Check for panel clicks (only if no rotation handle was clicked)
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
      const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
      console.log('🎯 [DRAG DEBUG] World coordinates:', worldPos);
      
      // Start dragging panel - store offset from panel's top-left corner in world coordinates
      mouseStateRef.current = {
        isDragging: true,
        isPanning: false,
        isRotating: false,
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
        isRotating: false,
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
  }, [canvas, getPanelAtPosition, onPanelSelect, onDragStart, getWorldCoordinates, panels, isOverRotationHandle]);

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
      const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
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
    } else if (currentState.isRotating && currentState.selectedPanelId) {
      console.log('🎯 [ROTATION DEBUG] 🔄 ROTATING PANEL');
      
      // Convert screen coordinates to world coordinates for rotation calculation
      const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
      console.log('🎯 [ROTATION DEBUG] World coordinates:', worldPos);
      
      // Find the panel being rotated
      const panel = panels.find(p => p.id === currentState.selectedPanelId);
      if (!panel) {
        console.log('🎯 [ROTATION DEBUG] ❌ Panel not found for rotation');
        return;
      }
      
      // Calculate panel center in world coordinates
      const panelCenterX = panel.x + panel.width / 2;
      const panelCenterY = panel.y + panel.height / 2;
      
      console.log('🎯 [ROTATION DEBUG] Panel center:', { panelCenterX, panelCenterY });
      console.log('🎯 [ROTATION DEBUG] Current panel rotation:', panel.rotation);
      
      // Calculate current angle from panel center to mouse position
      const currentAngle = Math.atan2(worldPos.y - panelCenterY, worldPos.x - panelCenterX);
      
      // Get the initial angle when rotation started
      const initialAngle = currentState.rotationStartAngle;
      if (initialAngle === undefined) {
        console.log('🎯 [ROTATION DEBUG] ❌ No initial angle stored');
        return;
      }
      
      // Calculate the rotation delta
      let angleDelta = currentAngle - initialAngle;
      
      // Normalize angle delta to -π to π range
      while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
      while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
      
      // Convert to degrees
      const rotationDeltaDegrees = angleDelta * (180 / Math.PI);
      
      // Apply rotation delta to the original rotation (stored when rotation started)
      const originalRotation = panel.rotation || 0;
      let newRotation = originalRotation + rotationDeltaDegrees;
      
      // Snap to 15-degree increments for better UX
      newRotation = Math.round(newRotation / 15) * 15;
      
      // Normalize to 0-360 range
      while (newRotation < 0) newRotation += 360;
      while (newRotation >= 360) newRotation -= 360;
      
      console.log('🎯 [ROTATION DEBUG] Rotation calculation:', {
        panelId: panel.id,
        currentAngle: currentAngle * (180 / Math.PI),
        initialAngle: initialAngle * (180 / Math.PI),
        angleDelta: rotationDeltaDegrees,
        originalRotation,
        newRotation
      });
      
      // Only update if rotation changed significantly
      if (Math.abs(newRotation - (panel.rotation || 0)) > 0.1) {
        onPanelUpdate(panel.id, { rotation: newRotation });
      }
      
      logRef.current('Rotating panel', { 
        panelId: currentState.selectedPanelId, 
        screenPos: { x: screenX, y: screenY },
        worldPos: { x: worldPos.x, y: worldPos.y },
        newRotation
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
  }, [canvas, onCanvasPan, getWorldCoordinates, onPanelUpdate, panels]);

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
        
        // Find the panel to get its current rotation
        const panel = panels.find(p => p.id === currentState.selectedPanelId);
        const currentRotation = panel?.rotation || 0;
        
        await onPanelUpdate(currentState.selectedPanelId, {
          x: currentState.dragCurrentX,
          y: currentState.dragCurrentY,
          rotation: currentRotation
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
    } else if (currentState.isRotating && currentState.selectedPanelId) {
      console.log('🎯 [ROTATION DEBUG] ✅ FINISHING PANEL ROTATION');
      
      // Find the panel being rotated
      const panel = panels.find(p => p.id === currentState.selectedPanelId);
      if (panel) {
        console.log('🎯 [ROTATION DEBUG] Final rotation committed:', {
          panelId: panel.id,
          finalRotation: panel.rotation || 0
        });
        
        // The rotation should already be committed via onPanelUpdate calls during mouse move
        // But we can do a final update here if needed to ensure it's saved
        
        logRef.current('Finished rotating panel', { 
          panelId: currentState.selectedPanelId,
          finalRotation: panel.rotation || 0,
          duration: clickDuration 
        });
      }
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
    const worldPos = getWorldCoordinates(mouseX, mouseY, canvasState);
    
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
    
    console.log('🎯 [ROTATION HANDLE DEBUG] Canvas click at:', { screenX, screenY });
    
    // Check for panel hits (rotation handles are handled in mousedown)
    const clickedPanel = getPanelAtPosition(screenX, screenY);
    if (clickedPanel && onPanelClick) {
      console.log('🎯 [ROTATION HANDLE DEBUG] Panel clicked, calling onPanelClick:', {
        id: clickedPanel.id,
        shape: clickedPanel.shape
      });
      
      // Set the selected panel ID for selection handles
      mouseStateRef.current.selectedPanelId = clickedPanel.id;
      console.log('🎯 [ROTATION HANDLE DEBUG] Set selectedPanelId:', clickedPanel.id);
      
      // Trigger a re-render to show selection handles
      render();
      
      onPanelClick(clickedPanel);
    } else {
      console.log('🎯 [ROTATION HANDLE DEBUG] No panel clicked or onPanelClick not available');
      // Clear selection if no panel clicked
      mouseStateRef.current.selectedPanelId = null;
      // Trigger a re-render to hide selection handles
      render();
    }
  }, [getPanelAtPosition, onPanelClick, render, panels]);

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
