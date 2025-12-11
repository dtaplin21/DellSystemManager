import { useCallback, useEffect, useRef, useMemo } from 'react';
import { Panel } from '@/types/panel';
import { Patch } from '@/types/patch';
import { DestructiveTest } from '@/types/destructiveTest';

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
  originalRotation?: number; // Original rotation when rotation starts (prevents drift)
}

interface CanvasState {
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
}

interface UseUnifiedMouseInteractionOptions {
  canvas: HTMLCanvasElement | null;
  panels: Panel[];
  patches?: Patch[];
  destructiveTests?: DestructiveTest[];
  visibleTypes?: {
    panels: boolean;
    patches: boolean;
    destructs: boolean;
  };
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
  patches = [],
  destructiveTests = [],
  visibleTypes = { panels: true, patches: false, destructs: false },
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
  
  // Debug: Log canvasState changes (only if debug logging enabled)
  useEffect(() => {
    if (enableDebugLogging) {
      console.log('🎯 [CANVAS STATE DEBUG] CanvasState updated:', canvasState);
    }
  }, [canvasState, enableDebugLogging]);
  // SSR Guard: Return empty functions if running on server
  const isSSR = typeof window === 'undefined';
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseStateRef = useRef<MouseState>(initialMouseState);
  const isMouseDownRef = useRef(false);
  const mouseDownTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastCanvasStateRef = useRef({ ...canvasState });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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

  const toPanelLocal = (panel: Panel, worldX: number, worldY: number) => {
    const rotationRadians = ((panel.rotation ?? 0) * Math.PI) / 180;
    const centerX = panel.x + panel.width / 2;
    const centerY = panel.y + panel.height / 2;
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const cosAngle = Math.cos(rotationRadians);
    const sinAngle = Math.sin(rotationRadians);

    const localX = dx * cosAngle + dy * sinAngle + panel.width / 2;
    const localY = -dx * sinAngle + dy * cosAngle + panel.height / 2;

    return { x: localX, y: localY };
  };

  const getRotationHandleWorldPosition = (panel: Panel, state: CanvasState) => {
    const rotationRadians = ((panel.rotation ?? 0) * Math.PI) / 180;
    const centerX = panel.x + panel.width / 2;
    const centerY = panel.y + panel.height / 2;
    const cosAngle = Math.cos(rotationRadians);
    const sinAngle = Math.sin(rotationRadians);

    const handleOffsetWorld = 30 / (state.worldScale || 1);
    const offsetFromCenterY = -panel.height / 2 - handleOffsetWorld;

    const handleWorldX = centerX + (0 * cosAngle - offsetFromCenterY * sinAngle);
    const handleWorldY = centerY + (0 * sinAngle + offsetFromCenterY * cosAngle);

    return { x: handleWorldX, y: handleWorldY };
  };

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
    
    const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
    console.log('🎯 [HIT DETECTION] World coords:', worldPos);
    
    for (let i = panels.length - 1; i >= 0; i--) {
      const panel = panels[i];
      
      if (!panel.isValid) {
        continue;
      }

      const localPos = toPanelLocal(panel, worldPos.x, worldPos.y);

      let isHit = false;
      switch (panel.shape) {
        case 'right-triangle': {
          const withinBounds = localPos.x >= 0 && localPos.x <= panel.width &&
            localPos.y >= 0 && localPos.y <= panel.height;
          if (withinBounds) {
            const hypotenuseY = (-panel.height / panel.width) * localPos.x + panel.height;
            isHit = localPos.y <= hypotenuseY + 0.0001;
          }
          break;
        }
        case 'rectangle':
        default:
          isHit = localPos.x >= 0 && localPos.x <= panel.width &&
                  localPos.y >= 0 && localPos.y <= panel.height;
          break;
      }

      console.log('🎯 [HIT DETECTION] Panel local hit test:', {
        panelId: panel.id,
        localPos,
        shape: panel.shape,
        isHit
      });

      if (isHit) {
        console.log('🎯 [HIT DETECTION] ✅ HIT! Panel:', panel.id, panel.panelNumber);
        return panel;
      }
    }
    
    console.log('🎯 [HIT DETECTION] ❌ No panel hit');
    return null;
  }, [panels, canvasState, getWorldCoordinates]);

  // Patch hit detection - circle collision
  const getPatchAtPosition = useCallback((screenX: number, screenY: number): Patch | null => {
    if (!visibleTypes.patches) return null;
    
    const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
    
    for (let i = patches.length - 1; i >= 0; i--) {
      const patch = patches[i];
      
      if (!patch.isValid) {
        continue;
      }

      // Circle collision detection
      const dx = worldPos.x - patch.x;
      const dy = worldPos.y - patch.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= patch.radius) {
        return patch;
      }
    }
    
    return null;
  }, [patches, visibleTypes.patches, canvasState, getWorldCoordinates]);

  // Destructive test hit detection - rectangle collision
  const getDestructiveTestAtPosition = useCallback((screenX: number, screenY: number): DestructiveTest | null => {
    if (!visibleTypes.destructs) return null;
    
    const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
    
    for (let i = destructiveTests.length - 1; i >= 0; i--) {
      const test = destructiveTests[i];
      
      if (!test.isValid) {
        continue;
      }

      // Rectangle collision detection (accounting for rotation)
      const rotation = ((test.rotation ?? 0) * Math.PI) / 180;
      const cos = Math.cos(-rotation);
      const sin = Math.sin(-rotation);
      
      // Translate point to test's local coordinate system
      const dx = worldPos.x - (test.x + test.width / 2);
      const dy = worldPos.y - (test.y + test.height / 2);
      
      // Rotate point
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      
      // Check if point is within rectangle bounds
      if (localX >= -test.width / 2 && localX <= test.width / 2 &&
          localY >= -test.height / 2 && localY <= test.height / 2) {
        return test;
      }
    }
    
    return null;
  }, [destructiveTests, visibleTypes.destructs, canvasState, getWorldCoordinates]);

  // Check if mouse is over rotation handle - WORLD COORDINATES APPROACH
  const isOverRotationHandle = useCallback((screenX: number, screenY: number, panel: Panel): boolean => {
    if (!panel.isValid) {
      return false;
    }
    
    const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
    const handleWorldPos = getRotationHandleWorldPosition(panel, canvasState);
    const handleSizeWorld = 16 / (canvasState.worldScale || 1);
    
    if (enableDebugLogging) {
      console.log('🎯 [ROTATION HANDLE DEBUG] Rotation handle position (world coords):', {
        panelId: panel.id,
        rotationHandleWorld: handleWorldPos,
        mouseWorldPos: worldPos,
        handleSizeWorld,
        canvasState: {
          worldScale: canvasState.worldScale,
          worldOffsetX: canvasState.worldOffsetX,
          worldOffsetY: canvasState.worldOffsetY
        }
      });
    }
    
    const isHit = Math.abs(worldPos.x - handleWorldPos.x) <= handleSizeWorld / 2 &&
                  Math.abs(worldPos.y - handleWorldPos.y) <= handleSizeWorld / 2;
    
    if (enableDebugLogging) {
      console.log('🎯 [ROTATION HANDLE DEBUG] Hit result (world coords):', isHit);
    }
    
    return isHit;
  }, [canvasState, getWorldCoordinates, enableDebugLogging]);

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
    const currentState = mouseStateRef.current;

    // Use the in-flight drag position if this panel is being dragged
    let drawX = panel.x;
    let drawY = panel.y;
    if (
      currentState.isDragging &&
      currentState.selectedPanelId === panel.id &&
      currentState.dragCurrentX !== undefined &&
      currentState.dragCurrentY !== undefined
    ) {
      drawX = currentState.dragCurrentX;
      drawY = currentState.dragCurrentY;
    }

    const worldWidth = panel.width;
    const worldHeight = panel.height;

    // Panel colors
    ctx.fillStyle = panel.fill || '#87CEEB';
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    
    const rotation = ((panel.rotation ?? 0) * Math.PI) / 180;
    const centerX = drawX + worldWidth / 2;
    const centerY = drawY + worldHeight / 2;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-worldWidth / 2, -worldHeight / 2);
    
    switch (panel.shape) {
      case 'right-triangle': {
        ctx.beginPath();
        const points = [
          { x: 0, y: 0 },
          { x: worldWidth, y: 0 },
          { x: 0, y: worldHeight }
        ];
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'rectangle':
      default:
        ctx.fillRect(0, 0, worldWidth, worldHeight);
        ctx.strokeRect(0, 0, worldWidth, worldHeight);
        break;
    }
    
    ctx.restore();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(panel.panelNumber || panel.id, -worldWidth / 2 + 5, -worldHeight / 2 + 15);
    ctx.restore();
  }, []);

  // Patch drawing function - circles
  const drawPatch = useCallback((ctx: CanvasRenderingContext2D, patch: Patch) => {
    const currentState = mouseStateRef.current;

    // Use the in-flight drag position if this patch is being dragged
    let drawX = patch.x;
    let drawY = patch.y;
    if (
      currentState.isDragging &&
      currentState.selectedPanelId === patch.id &&
      currentState.dragCurrentX !== undefined &&
      currentState.dragCurrentY !== undefined
    ) {
      drawX = currentState.dragCurrentX;
      drawY = currentState.dragCurrentY;
    }

    const radius = patch.radius;
    const rotation = ((patch.rotation ?? 0) * Math.PI) / 180;

    // Patch colors - red to distinguish from panels
    ctx.fillStyle = patch.fill || '#ef4444';
    ctx.strokeStyle = patch.color || '#b91c1c';
    ctx.lineWidth = 2;

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(rotation);

    // Draw circle
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Draw patch number
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(patch.patchNumber || patch.id, 0, 0);
    ctx.restore();
  }, []);

  // Destructive test drawing function - rectangles
  const drawDestructiveTest = useCallback((ctx: CanvasRenderingContext2D, test: DestructiveTest) => {
    const currentState = mouseStateRef.current;

    // Use the in-flight drag position if this test is being dragged
    let drawX = test.x;
    let drawY = test.y;
    if (
      currentState.isDragging &&
      currentState.selectedPanelId === test.id &&
      currentState.dragCurrentX !== undefined &&
      currentState.dragCurrentY !== undefined
    ) {
      drawX = currentState.dragCurrentX;
      drawY = currentState.dragCurrentY;
    }

    const worldWidth = test.width;
    const worldHeight = test.height;

    // Destructive test colors - orange/amber to distinguish
    ctx.fillStyle = test.fill || '#f59e0b';
    ctx.strokeStyle = test.color || '#d97706';
    ctx.lineWidth = 2;

    const rotation = ((test.rotation ?? 0) * Math.PI) / 180;
    const centerX = drawX + worldWidth / 2;
    const centerY = drawY + worldHeight / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-worldWidth / 2, -worldHeight / 2);

    // Draw rectangle
    ctx.fillRect(0, 0, worldWidth, worldHeight);
    ctx.strokeRect(0, 0, worldWidth, worldHeight);

    ctx.restore();

    // Draw sample ID
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(test.sampleId || test.id, 0, 0);
    ctx.restore();
  }, []);

  // Draw selection handles for a panel - WORLD COORDINATES APPROACH
  const drawSelectionHandles = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    const currentState = mouseStateRef.current;
    
    let drawX = panel.x;
    let drawY = panel.y;
    if (currentState.isDragging && currentState.selectedPanelId === panel.id &&
        currentState.dragCurrentX !== undefined && currentState.dragCurrentY !== undefined) {
      drawX = currentState.dragCurrentX;
      drawY = currentState.dragCurrentY;
    }

    const effectiveScale = canvasState.worldScale || 1;
    const handleSizeWorld = 16 / effectiveScale;
    const rotationHandleWorld = getRotationHandleWorldPosition(
      { ...panel, x: drawX, y: drawY },
      canvasState
    );
    
    ctx.fillStyle = '#10b981';
    ctx.fillRect(
      rotationHandleWorld.x - handleSizeWorld / 2,
      rotationHandleWorld.y - handleSizeWorld / 2,
      handleSizeWorld,
      handleSizeWorld
    );
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / effectiveScale;
    ctx.strokeRect(
      rotationHandleWorld.x - handleSizeWorld / 2,
      rotationHandleWorld.y - handleSizeWorld / 2,
      handleSizeWorld,
      handleSizeWorld
    );
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

    // Draw panels directly in unified coordinates (if visible)
    if (visibleTypes.panels) {
      panels.forEach(panel => {
        if (panel.isValid) {
          drawPanel(ctx, panel);
        }
      });
    }

    // Draw patches (circles) if visible
    if (visibleTypes.patches) {
      patches.forEach(patch => {
        if (patch.isValid) {
          drawPatch(ctx, patch);
        }
      });
    }

    // Draw destructive tests (rectangles) if visible
    if (visibleTypes.destructs) {
      destructiveTests.forEach(test => {
        if (test.isValid) {
          drawDestructiveTest(ctx, test);
        }
      });
    }

    // Draw selection handles for selected panel - BEFORE transformations are restored (world coordinates)
    const selectedPanel = panels.find(p => p.id === mouseStateRef.current.selectedPanelId);
    if (enableDebugLogging) {
      console.log('🎯 [ROTATION HANDLE DEBUG] Render function - checking for selected panel:', {
        selectedPanelId: mouseStateRef.current.selectedPanelId,
        selectedPanel: selectedPanel,
        selectedPanelValid: selectedPanel?.isValid,
        totalPanels: panels.length
      });
    }
    
    if (selectedPanel && selectedPanel.isValid) {
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION HANDLE DEBUG] Drawing selection handles for selected panel (world coords):', {
          id: selectedPanel.id,
          shape: selectedPanel.shape,
          position: { x: selectedPanel.x, y: selectedPanel.y },
          size: { width: selectedPanel.width, height: selectedPanel.height },
          canvasSize: { width: canvas.width, height: canvas.height }
        });
      }
      drawSelectionHandles(ctx, selectedPanel);
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION HANDLE DEBUG] Selection handles drawn successfully (world coords)');
      }
    } else {
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION HANDLE DEBUG] No selected panel or panel invalid:', {
          selectedPanelId: mouseStateRef.current.selectedPanelId,
          selectedPanel: selectedPanel
        });
      }
    }

    // Restore transformations
    ctx.restore();

    logRef.current('Canvas rendered', { 
      panelCount: panels.length,
      patchCount: patches.length,
      destructCount: destructiveTests.length,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      worldOffset: { x: canvasState.worldOffsetX, y: canvasState.worldOffsetY },
      worldScale: canvasState.worldScale
    });
  }, [canvasState, panels, patches, destructiveTests, visibleTypes, isSSR, drawSelectionHandles, drawPatch, drawDestructiveTest]); // Include actual dependencies

  // Render function is now self-contained without circular dependencies

  // Trigger render when panels, patches, destructive tests, or visibility changes
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
  }, [panels, patches, destructiveTests, visibleTypes, isSSR, render]); // Include all relevant dependencies

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


  // Canvas resize handler - enhanced with proper container detection and ResizeObserver
  const resizeCanvas = useCallback(() => {
    // SSR Guard: Don't run on server
    if (isSSR) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Try to find the proper container - look for the canvas container div
    let container = canvas.parentElement;
    
    // Check if we're in fullscreen mode by looking for fixed position parent with high z-index
    let isFullscreenMode = false;
    let current = container;
    while (current) {
      const styles = window.getComputedStyle(current);
      if (styles.position === 'fixed' && parseInt(styles.zIndex || '0') >= 50) {
        isFullscreenMode = true;
        break;
      }
      current = current.parentElement;
    }
    
    // In fullscreen, look for the flex-1 container that's a direct child of the fullscreen div
    if (isFullscreenMode) {
      current = canvas.parentElement;
      while (current) {
        if (current.classList.contains('flex-1') || current.classList.contains('flex')) {
          const parentStyles = window.getComputedStyle(current.parentElement || current);
          if (parentStyles.position === 'fixed') {
            container = current;
            break;
          }
        }
        current = current.parentElement;
      }
    } else {
      // Normal mode: look for canvas-container or flex-1
      while (container && !container.classList.contains('canvas-container') && !container.classList.contains('flex-1')) {
        container = container.parentElement;
      }
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

    // Ensure we have valid dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      // In fullscreen mode, use window dimensions as fallback (more reliable)
      if (isFullscreenMode) {
        const windowWidth = window.innerWidth;
        // Calculate header height more accurately by finding the header element
        let headerHeight = 64; // Default fallback
        const headerElement = container.parentElement?.querySelector('.bg-gray-800, [class*="border-b"]');
        if (headerElement) {
          headerHeight = headerElement.getBoundingClientRect().height || 64;
        }
        const windowHeight = Math.max(window.innerHeight - headerHeight, 100); // Minimum 100px
        
        if (windowWidth > 0 && windowHeight > 0) {
          canvas.width = windowWidth;
          canvas.height = windowHeight;
          canvas.style.width = `${windowWidth}px`;
          canvas.style.height = `${windowHeight}px`;
          
          logRef.current('Canvas resized (fullscreen fallback)', { width: windowWidth, height: windowHeight });
          
          // Trigger a render after resize
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          animationFrameRef.current = requestAnimationFrame(() => {
            render();
          });
          return;
        }
      }
      
      // Use ResizeObserver to wait for valid dimensions (only log if debug enabled)
      // Check if we already have a ResizeObserver set up in the main useEffect
      // If so, it will handle the resize when dimensions become valid
      // Otherwise, create a temporary one
      if (typeof ResizeObserver !== 'undefined') {
        // Check if container already has an observer attached (from main useEffect)
        // If the main ResizeObserver is already watching, just return and let it handle it
        if (resizeObserverRef.current) {
          // Main observer is already set up, it will trigger resizeCanvas when dimensions become valid
          if (enableDebugLogging) {
            console.log('🔍 [resizeCanvas] Invalid dimensions detected, main ResizeObserver will handle resize when valid', {
              container: container.className,
              currentRect: rect
            });
          }
          return;
        }
        
        // Fallback: Create a temporary observer if main one isn't set up yet
        // This should rarely happen, but handle it just in case
        const tempObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const newRect = entry.contentRect;
            if (newRect.width > 0 && newRect.height > 0) {
              tempObserver.disconnect();
              
              // Now resize with valid dimensions
              canvas.width = newRect.width;
              canvas.height = newRect.height;
              canvas.style.width = `${newRect.width}px`;
              canvas.style.height = `${newRect.height}px`;
              
              logRef.current('Canvas resized (after temp ResizeObserver)', { width: newRect.width, height: newRect.height });
              
              // Trigger a render after resize
              if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
              }
              animationFrameRef.current = requestAnimationFrame(() => {
                render();
              });
              return;
            }
          }
        });
        
        tempObserver.observe(container);
        
        // Cleanup observer after 5 seconds to prevent memory leaks
        setTimeout(() => {
          tempObserver.disconnect();
        }, 5000);
        
        // Only log if debug logging is enabled
        if (enableDebugLogging) {
          console.log('🔍 [resizeCanvas] Created temporary ResizeObserver for invalid dimensions', {
            container: container.className,
            currentRect: rect
          });
        }
        return;
      } else {
        // Fallback: retry after a short delay if ResizeObserver is not available
        // Only warn if debug logging is enabled
        if (enableDebugLogging) {
          console.warn('🔍 [resizeCanvas] Invalid container dimensions, ResizeObserver not available, will retry:', rect);
        }
        setTimeout(() => {
          resizeCanvas();
        }, 100);
        return;
      }
    }

    // Direct sizing (no DPR complications) - like the working test grid
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    if (enableDebugLogging) {
      console.log('🔍 [resizeCanvas] Canvas dimensions after resize:', {
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height,
        actualWidth: canvas.width,
        actualHeight: canvas.height,
        displayWidth: canvas.offsetWidth,
        displayHeight: canvas.offsetHeight,
        containerWidth: rect.width,
        containerHeight: rect.height,
        isFullscreenMode
      });
    }

    // Trigger a render after resize - use ref to avoid circular dependency
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      render();
    });

    logRef.current('Canvas resized', { width: rect.width, height: rect.height });
  }, [render, isSSR, enableDebugLogging]); // Include dependencies

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
    if (enableDebugLogging) {
      console.log('🎯 [ROTATION DEBUG] Checking rotation handles for all panels...');
    }
    let rotationHandleClicked = false;
    
    for (const panel of panels) {
      if (panel.isValid && isOverRotationHandle(screenX, screenY, panel)) {
        if (enableDebugLogging) {
          console.log('🎯 [ROTATION DEBUG] ✅ ROTATION HANDLE CLICKED!', {
            panelId: panel.id,
            currentRotation: panel.rotation || 0,
            mousePos: { x: screenX, y: screenY }
          });
        }

        // Convert screen coordinates to world coordinates for rotation calculation
        const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
        
        // Calculate initial angle from panel center to mouse position
        const panelCenterX = panel.x + panel.width / 2;
        const panelCenterY = panel.y + panel.height / 2;
        
        // Calculate the angle from panel center to current mouse position
        const initialAngle = Math.atan2(worldPos.y - panelCenterY, worldPos.x - panelCenterX);
        
        if (enableDebugLogging) {
          console.log('🎯 [ROTATION DEBUG] Setup rotation:', {
            panelCenter: { x: panelCenterX, y: panelCenterY },
            mouseWorldPos: worldPos,
            initialAngle: initialAngle * (180 / Math.PI),
            panelCurrentRotation: panel.rotation || 0
          });
        }
        
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
          originalRotation: panel.rotation || 0, // Store original rotation to prevent drift
        };
        
        // Also select the panel for visual feedback
        onPanelSelect(panel.id);
        
        if (enableDebugLogging) {
          console.log('🎯 [ROTATION DEBUG] Started rotating panel:', {
            panelId: panel.id,
            initialAngle: initialAngle * (180 / Math.PI),
            currentRotation: panel.rotation || 0,
            mouseState: mouseStateRef.current
          });
        }
        
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

    // Check for patch clicks (only if patches tab is active and no panel was clicked)
    const clickedPatch = !clickedPanel && visibleTypes.patches ? getPatchAtPosition(screenX, screenY) : null;
    console.log('🎯 [DRAG DEBUG] Patch hit detection result:', clickedPatch);

    // Check for destructive test clicks (only if destructs tab is active and no panel/patch was clicked)
    const clickedDestruct = !clickedPanel && !clickedPatch && visibleTypes.destructs ? getDestructiveTestAtPosition(screenX, screenY) : null;
    console.log('🎯 [DRAG DEBUG] Destructive test hit detection result:', clickedDestruct);

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
    } else if (clickedPatch) {
      console.log('🎯 [DRAG DEBUG] ✅ PATCH CLICKED!', {
        id: clickedPatch.id,
        position: { x: clickedPatch.x, y: clickedPatch.y },
        radius: clickedPatch.radius,
        isValid: clickedPatch.isValid
      });

      // Convert screen coordinates to world coordinates
      const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
      
      // Start dragging patch
      mouseStateRef.current = {
        isDragging: true,
        isPanning: false,
        isRotating: false,
        selectedPanelId: clickedPatch.id,
        dragStartX: worldPos.x - clickedPatch.x,
        dragStartY: worldPos.y - clickedPatch.y,
        lastMouseX: screenX,
        lastMouseY: screenY,
      };
      
      onPanelSelect(clickedPatch.id);
      onDragStart?.(clickedPatch.id, worldPos);
      logRef.current('Started dragging patch', { 
        patchId: clickedPatch.id, 
        screenPos: { x: screenX, y: screenY },
        worldPos: { x: worldPos.x, y: worldPos.y },
        patchPos: { x: clickedPatch.x, y: clickedPatch.y }
      });
    } else if (clickedDestruct) {
      console.log('🎯 [DRAG DEBUG] ✅ DESTRUCTIVE TEST CLICKED!', {
        id: clickedDestruct.id,
        position: { x: clickedDestruct.x, y: clickedDestruct.y },
        size: { width: clickedDestruct.width, height: clickedDestruct.height },
        isValid: clickedDestruct.isValid
      });

      // Convert screen coordinates to world coordinates
      const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
      
      // Start dragging destructive test
      mouseStateRef.current = {
        isDragging: true,
        isPanning: false,
        isRotating: false,
        selectedPanelId: clickedDestruct.id,
        dragStartX: worldPos.x - clickedDestruct.x,
        dragStartY: worldPos.y - clickedDestruct.y,
        lastMouseX: screenX,
        lastMouseY: screenY,
      };
      
      onPanelSelect(clickedDestruct.id);
      onDragStart?.(clickedDestruct.id, worldPos);
      logRef.current('Started dragging destructive test', { 
        testId: clickedDestruct.id, 
        screenPos: { x: screenX, y: screenY },
        worldPos: { x: worldPos.x, y: worldPos.y },
        testPos: { x: clickedDestruct.x, y: clickedDestruct.y }
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
  }, [canvas, getPanelAtPosition, getPatchAtPosition, getDestructiveTestAtPosition, visibleTypes, onPanelSelect, onDragStart, getWorldCoordinates, panels, isOverRotationHandle]);

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
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION DEBUG] 🔄 ROTATING PANEL');
      }
      
      // Convert screen coordinates to world coordinates for rotation calculation
      const worldPos = getWorldCoordinates(screenX, screenY, canvasState);
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION DEBUG] World coordinates:', worldPos);
      }
      
      // Find the panel being rotated
      const panel = panels.find(p => p.id === currentState.selectedPanelId);
      if (!panel) {
        if (enableDebugLogging) {
          console.log('🎯 [ROTATION DEBUG] ❌ Panel not found for rotation');
        }
        return;
      }
      
      // Calculate panel center in world coordinates
      const panelCenterX = panel.x + panel.width / 2;
      const panelCenterY = panel.y + panel.height / 2;
      
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION DEBUG] Panel center:', { panelCenterX, panelCenterY });
        console.log('🎯 [ROTATION DEBUG] Current panel rotation:', panel.rotation);
      }
      
      // Calculate current angle from panel center to mouse position
      const currentAngle = Math.atan2(worldPos.y - panelCenterY, worldPos.x - panelCenterX);
      
      // Get the initial angle when rotation started
      const initialAngle = currentState.rotationStartAngle;
      if (initialAngle === undefined) {
        if (enableDebugLogging) {
          console.log('🎯 [ROTATION DEBUG] ❌ No initial angle stored');
        }
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
      const originalRotation = currentState.originalRotation || 0; // Use stored original rotation
      let newRotation = originalRotation + rotationDeltaDegrees;
      
      // Normalize to 0-360 range (no snapping during mouse move for smooth rotation)
      while (newRotation < 0) newRotation += 360;
      while (newRotation >= 360) newRotation -= 360;
      
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION DEBUG] Rotation calculation:', {
          panelId: panel.id,
          currentAngle: currentAngle * (180 / Math.PI),
          initialAngle: initialAngle * (180 / Math.PI),
          angleDelta: rotationDeltaDegrees,
          originalRotation,
          newRotation
        });
      }
      
      // Throttle rotation updates to prevent excessive API calls
      const now = performance.now();
      if (now - lastRotationUpdateRef.current > ROTATION_THROTTLE_MS) {
        lastRotationUpdateRef.current = now;
        
        // Only update if rotation changed significantly
        if (Math.abs(newRotation - (panel.rotation || 0)) > 0.1) {
          // Send complete position data (CRITICAL FIX)
          onPanelUpdate(panel.id, { 
            x: panel.x,
            y: panel.y,
            rotation: newRotation 
          });
        }
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
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION DEBUG] ✅ FINISHING PANEL ROTATION');
      }
      
      // Find the panel being rotated
      const panel = panels.find(p => p.id === currentState.selectedPanelId);
      if (panel) {
        // Apply 15-degree snapping to final rotation
        let finalRotation = panel.rotation || 0;
        finalRotation = Math.round(finalRotation / 15) * 15;
        
        // Normalize to 0-360 range
        while (finalRotation < 0) finalRotation += 360;
        while (finalRotation >= 360) finalRotation -= 360;
        
        if (enableDebugLogging) {
          console.log('🎯 [ROTATION DEBUG] Final rotation with snapping:', {
            panelId: panel.id,
            originalRotation: panel.rotation || 0,
            snappedRotation: finalRotation
          });
        }
        
        // Commit the snapped rotation with complete position data
        await onPanelUpdate(panel.id, {
          x: panel.x,
          y: panel.y,
          rotation: finalRotation
        });
        
        logRef.current('Finished rotating panel', { 
          panelId: currentState.selectedPanelId,
          finalRotation: finalRotation,
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
  
  // Throttle rotation updates to prevent excessive API calls
  const lastRotationUpdateRef = useRef<number>(0);
  const ROTATION_THROTTLE_MS = 50; // Update every 50ms max

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
    
    if (enableDebugLogging) {
      console.log('🎯 [ROTATION HANDLE DEBUG] Canvas click at:', { screenX, screenY });
    }
    
    // Check for panel hits (rotation handles are handled in mousedown)
    const clickedPanel = getPanelAtPosition(screenX, screenY);
    if (clickedPanel && onPanelClick) {
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION HANDLE DEBUG] Panel clicked, calling onPanelClick:', {
          id: clickedPanel.id,
          shape: clickedPanel.shape
        });
      }
      
      // Set the selected panel ID for selection handles
      mouseStateRef.current.selectedPanelId = clickedPanel.id;
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION HANDLE DEBUG] Set selectedPanelId:', clickedPanel.id);
      }
      
      // Trigger a re-render to show selection handles
      render();
      
      onPanelClick(clickedPanel);
    } else {
      if (enableDebugLogging) {
        console.log('🎯 [ROTATION HANDLE DEBUG] No panel clicked or onPanelClick not available');
      }
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
    // Clean up any existing observer first
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Only log if debug logging is enabled
        if (enableDebugLogging) {
          console.log('🔍 [ResizeObserver] Container size changed:', {
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
        // Only resize if dimensions are valid
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          resizeCanvas();
        }
      }
    });
    
    resizeObserverRef.current = resizeObserver;

    // Observe the canvas container - find the proper container first
    let container = canvas.parentElement;
    // Look for canvas-container or flex-1 parent
    while (container && !container.classList.contains('canvas-container') && !container.classList.contains('flex-1')) {
      container = container.parentElement;
    }
    if (!container) {
      container = canvas.parentElement;
    }
    
    if (container) {
      resizeObserver.observe(container);
    }

    // Window resize handler as fallback
    const handleWindowResize = () => {
      if (enableDebugLogging) {
        console.log('🔍 [WindowResize] Window resized');
      }
      resizeCanvas();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [canvas, isSSR, enableDebugLogging]); // Include enableDebugLogging

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
