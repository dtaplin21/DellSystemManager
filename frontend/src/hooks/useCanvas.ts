import { useRef, useCallback, useEffect, useMemo } from 'react';
import { Panel } from '@/types/panel';

interface CanvasState {
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
}

interface UseCanvasOptions {
  panels: Panel[];
  canvasState: CanvasState;
  onPanelClick?: (panel: Panel) => void;
  onPanelDoubleClick?: (panel: Panel) => void;
  enableDebugLogging?: boolean;
}

interface UseCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  render: () => void;
  getWorldCoordinates: (screenX: number, screenY: number) => { x: number; y: number };
  getScreenCoordinates: (worldX: number, worldY: number) => { x: number; y: number };
  resizeCanvas: () => void;
}

/**
 * Custom hook for canvas rendering and coordinate transformations
 * Handles all canvas-specific logic in a focused, reusable way
 */
export function useCanvas({
  panels,
  canvasState,
  onPanelClick,
  onPanelDoubleClick,
  enableDebugLogging = false,
}: UseCanvasOptions): UseCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);

  const logRef = useRef((message: string, data?: any) => {
    if (enableDebugLogging) {
      console.log(`[useCanvas] ${message}`, data);
    }
  });
  
  // Update log function when enableDebugLogging changes
  useEffect(() => {
    logRef.current = (message: string, data?: any) => {
      if (enableDebugLogging) {
        console.log(`[useCanvas] ${message}`, data);
      }
    };
  }, [enableDebugLogging]);

  // Coordinate transformation functions
  const getWorldCoordinates = useCallback((screenX: number, screenY: number) => {
    const x = (screenX - canvasState.worldOffsetX) / canvasState.worldScale;
    const y = (screenY - canvasState.worldOffsetY) / canvasState.worldScale;
    return { x, y };
  }, [canvasState.worldOffsetX, canvasState.worldOffsetY, canvasState.worldScale]);

  const getScreenCoordinates = useCallback((worldX: number, worldY: number) => {
    const x = worldX * canvasState.worldScale + canvasState.worldOffsetX;
    const y = worldY * canvasState.worldScale + canvasState.worldOffsetY;
    return { x, y };
  }, [canvasState.worldOffsetX, canvasState.worldOffsetY, canvasState.worldScale]);

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

  // Memoize canvas state to prevent unnecessary recreations
  const memoizedCanvasState = useMemo(() => ({
    worldScale: canvasState.worldScale,
    worldOffsetX: canvasState.worldOffsetX,
    worldOffsetY: canvasState.worldOffsetY,
  }), [canvasState.worldScale, canvasState.worldOffsetX, canvasState.worldOffsetY]);

  // Canvas rendering function
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

    // Save context state
    ctx.save();

    // Apply world transformation
    ctx.scale(memoizedCanvasState.worldScale, memoizedCanvasState.worldScale);
    ctx.translate(memoizedCanvasState.worldOffsetX / memoizedCanvasState.worldScale, memoizedCanvasState.worldOffsetY / memoizedCanvasState.worldScale);

    // Draw grid
    drawGrid(ctx, canvas, memoizedCanvasState);

    // Draw panels
    panels.forEach(panel => {
      if (panel.isValid) {
        drawPanel(ctx, panel);
      }
    });

    // Restore context state
    ctx.restore();

    logRef.current('Canvas rendered', { panelCount: panels.length, worldScale: memoizedCanvasState.worldScale });
  }, [panels, memoizedCanvasState]); // Remove drawGrid and drawPanel to avoid circular dependency

  // Grid drawing function
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: CanvasState) => {
    const gridSize = 1; // 1 foot grid
    const gridColor = '#e5e7eb';
    const majorGridColor = '#d1d5db';
    const majorGridInterval = 5; // Every 5 feet

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1 / state.worldScale;

    // Calculate visible grid bounds
    const left = Math.floor(-state.worldOffsetX / state.worldScale / gridSize) * gridSize;
    const right = Math.ceil((canvas.width - state.worldOffsetX) / state.worldScale / gridSize) * gridSize;
    const top = Math.floor(-state.worldOffsetY / state.worldScale / gridSize) * gridSize;
    const bottom = Math.ceil((canvas.height - state.worldOffsetY) / state.worldScale / gridSize) * gridSize;

    // Draw vertical lines
    for (let x = left; x <= right; x += gridSize) {
      ctx.strokeStyle = x % majorGridInterval === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = top; y <= bottom; y += gridSize) {
      ctx.strokeStyle = y % majorGridInterval === 0 ? majorGridColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
  }, []);

  // Panel drawing function
  const drawPanel = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    const { x, y, width, height, rotation = 0 } = panel;

    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);

    // Panel colors
    if (panel.shape === 'patch') {
      ctx.fillStyle = '#ef4444'; // Red for patches
      ctx.strokeStyle = '#b91c1c'; // Darker red for stroke
    } else {
      ctx.fillStyle = '#87CEEB';
      ctx.strokeStyle = '#1e40af';
    }
    ctx.lineWidth = 0.1;

    // Draw different shapes based on panel.shape
    switch (panel.shape) {
      case 'right-triangle':
        ctx.beginPath();
        
        // Define triangle points relative to center
        const points = [
          { x: -width / 2, y: -height / 2 }, // Top left
          { x: width / 2, y: -height / 2 },  // Top right
          { x: -width / 2, y: height / 2 }   // Bottom left (right angle)
        ]
        
        // Apply rotation
        const rotation = (panel.rotation || 0) * Math.PI / 180
        const cos = Math.cos(rotation)
        const sin = Math.sin(rotation)
        
        // Rotate points
        const rotatedPoints = points.map(point => ({
          x: (point.x * cos - point.y * sin),
          y: (point.x * sin + point.y * cos)
        }))
        
        // Draw rotated triangle
        ctx.moveTo(rotatedPoints[0].x, rotatedPoints[0].y)
        ctx.lineTo(rotatedPoints[1].x, rotatedPoints[1].y)
        ctx.lineTo(rotatedPoints[2].x, rotatedPoints[2].y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke();
        break;
        
      case 'patch':
        // Draw circle - use width as diameter for consistent sizing
        const radius = width / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'rectangle':
      default:
        // Draw rectangle (default)
        ctx.fillRect(0, 0, width, height);
        ctx.strokeRect(0, 0, width, height);
        break;
    }

    // Panel label
    ctx.fillStyle = 'white';
    ctx.font = `${Math.max(0.5, Math.min(width, height) * 0.3)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(panel.id, width / 2, height / 2);

    ctx.restore();
  }, []);

  // Canvas resize handler
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set display size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Set actual size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Scale context for HiDPI
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    logRef.current('Canvas resized', { width: rect.width, height: rect.height, dpr });
  }, []);

  // Mouse event handlers
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPos = getWorldCoordinates(screenX, screenY);
    
    const clickedPanel = getPanelAtPosition(worldPos.x, worldPos.y);
    if (clickedPanel && onPanelClick) {
      onPanelClick(clickedPanel);
    }
  }, [getWorldCoordinates, getPanelAtPosition, onPanelClick]);

  const handleCanvasDoubleClick = useCallback((event: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPos = getWorldCoordinates(screenX, screenY);
    
    const clickedPanel = getPanelAtPosition(worldPos.x, worldPos.y);
    if (clickedPanel && onPanelDoubleClick) {
      onPanelDoubleClick(clickedPanel);
    }
  }, [getWorldCoordinates, getPanelAtPosition, onPanelDoubleClick]);

  // Setup canvas event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [handleCanvasClick, handleCanvasDoubleClick]);

  // Setup resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
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
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (renderRef.current) {
        renderRef.current();
      }
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [panels, memoizedCanvasState]);

  return {
    canvasRef,
    render,
    getWorldCoordinates,
    getScreenCoordinates,
    resizeCanvas,
  };
}
