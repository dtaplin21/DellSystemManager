'use client';

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { Panel } from '@/types/panel';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
  toWorld: (screenPoint: { x: number; y: number }) => { x: number; y: number };
  toScreen: (worldPoint: { x: number; y: number }) => { x: number; y: number };
  visibleWorldRect: { x: number; y: number; width: number; height: number };
}

interface UseOptimizedRenderingOptions {
  canvas: HTMLCanvasElement | null;
  panels: Panel[];
  viewTransform: ViewTransform;
  selectedPanelId: string | null;
  renderingQuality: 'high' | 'medium' | 'low';
  enableDebugLogging?: boolean;
}

interface UseOptimizedRenderingReturn {
  render: () => void;
  resizeCanvas: (width: number, height: number) => void;
  getPanelAtPosition: (screenX: number, screenY: number) => Panel | null;
  performanceMetrics: {
    renderTime: number;
    frameCount: number;
    isLowPerf: boolean;
  };
}

/**
 * Optimized rendering hook for world coordinate system
 * Handles grid culling, panel rendering, and performance optimization
 */
export function useOptimizedRendering({
  canvas,
  panels,
  viewTransform,
  selectedPanelId,
  renderingQuality,
  enableDebugLogging = false
}: UseOptimizedRenderingOptions): UseOptimizedRenderingReturn {
  
  // Performance monitoring
  const { metrics, startRenderTiming, endRenderTiming } = usePerformanceMonitoring({
    enabled: enableDebugLogging,
    samplingRate: 0.1,
  });

  // Refs for stable values
  const renderTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  // Memoized grid calculation with viewport culling
  const gridLines = useMemo(() => {
    const start = performance.now();
    
    const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = viewTransform.visibleWorldRect;
    const buffer = WORLD_CONSTANTS.GRID_CELL_SIZE_FT * 10; // 10 grid cells buffer
    
    // Calculate visible grid range
    const startX = Math.max(0, Math.floor((viewX - buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    const endX = Math.min(WORLD_CONSTANTS.WIDTH_FT, Math.ceil((viewX + viewWidth + buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    const startY = Math.max(0, Math.floor((viewY - buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    const endY = Math.min(WORLD_CONSTANTS.HEIGHT_FT, Math.ceil((viewY + viewHeight + buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    
    const lines: Array<{
      type: 'vertical' | 'horizontal';
      x?: number;
      y?: number;
      startX?: number;
      startY?: number;
      endX?: number;
      endY?: number;
      isMajor?: boolean;
    }> = [];
    
    // Vertical lines
    for (let gx = startX; gx <= endX; gx += WORLD_CONSTANTS.GRID_CELL_SIZE_FT) {
      const isMajor = gx % (WORLD_CONSTANTS.GRID_CELL_SIZE_FT * 10) === 0; // Major grid every 10 cells
      lines.push({
        type: 'vertical',
        x: gx,
        startY,
        endY,
        isMajor
      });
    }
    
    // Horizontal lines
    for (let gy = startY; gy <= endY; gy += WORLD_CONSTANTS.GRID_CELL_SIZE_FT) {
      const isMajor = gy % (WORLD_CONSTANTS.GRID_CELL_SIZE_FT * 10) === 0; // Major grid every 10 cells
      lines.push({
        type: 'horizontal',
        y: gy,
        startX,
        endX,
        isMajor
      });
    }
    
    const duration = performance.now() - start;
    if (enableDebugLogging && duration > 16) {
      console.warn(`Slow grid calculation: ${duration.toFixed(2)}ms`);
    }
    
    return lines;
  }, [viewTransform.visibleWorldRect, enableDebugLogging]);

  // Memoized visible panels (viewport culling)
  const visiblePanels = useMemo(() => {
    const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = viewTransform.visibleWorldRect;
    const buffer = 50; // 50 feet buffer for smooth scrolling
    
    return panels.filter(panel => {
      if (!panel.isValid) return false;
      
      // Check if panel intersects with visible area
      return !(panel.x + panel.width < viewX - buffer ||
               panel.x > viewX + viewWidth + buffer ||
               panel.y + panel.height < viewY - buffer ||
               panel.y > viewY + viewHeight + buffer);
    });
  }, [panels, viewTransform.visibleWorldRect]);

  // Draw grid function
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const { scale } = viewTransform;
    
    // Set grid line properties based on rendering quality
    const lineWidth = renderingQuality === 'high' ? 1 / scale : 
                     renderingQuality === 'medium' ? 0.5 / scale : 
                     0.25 / scale;
    
    ctx.lineWidth = Math.max(0.1, lineWidth);
    
    gridLines.forEach(line => {
      if (line.type === 'vertical' && line.x !== undefined && line.startY !== undefined && line.endY !== undefined) {
        // Major grid lines
        if (line.isMajor) {
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = Math.max(0.2, lineWidth * 1.5);
        } else {
          ctx.strokeStyle = '#e5e7eb';
          ctx.lineWidth = Math.max(0.1, lineWidth);
        }
        
        ctx.beginPath();
        ctx.moveTo(line.x, line.startY);
        ctx.lineTo(line.x, line.endY);
        ctx.stroke();
      } else if (line.type === 'horizontal' && line.y !== undefined && line.startX !== undefined && line.endX !== undefined) {
        // Major grid lines
        if (line.isMajor) {
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = Math.max(0.2, lineWidth * 1.5);
        } else {
          ctx.strokeStyle = '#e5e7eb';
          ctx.lineWidth = Math.max(0.1, lineWidth);
        }
        
        ctx.beginPath();
        ctx.moveTo(line.startX, line.y);
        ctx.lineTo(line.endX, line.y);
        ctx.stroke();
      }
    });
  }, [viewTransform, gridLines, renderingQuality]);

  // Draw panel function
  const drawPanel = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    const { scale } = viewTransform;
    const isSelected = selectedPanelId === panel.id;
    
    // Panel colors
    if (panel.shape === 'patch') {
      ctx.fillStyle = '#ef4444'; // Red for patches
      ctx.strokeStyle = isSelected ? '#dc2626' : '#b91c1c'; // Darker red for stroke
    } else {
      ctx.fillStyle = isSelected ? '#ef4444' : panel.color || '#3b82f6';
      ctx.strokeStyle = isSelected ? '#dc2626' : '#1e40af';
    }
    ctx.lineWidth = Math.max(0.5, 2 / scale);
    
    // Draw different shapes based on panel.shape
    switch (panel.shape) {
      case 'right-triangle':
        // Draw right triangle with 90-degree angle at bottom-left corner
        ctx.beginPath();
        ctx.moveTo(panel.x, panel.y); // Top left
        ctx.lineTo(panel.x + panel.width, panel.y); // Top right
        ctx.lineTo(panel.x, panel.y + panel.height); // Bottom left (right angle)
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'patch':
        // Draw circle - use width as diameter for consistent sizing
        const radius = panel.width / 2;
        const centerX = panel.x + radius;
        const centerY = panel.y + radius;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'rectangle':
      default:
        // Draw rectangle (default)
        ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
        ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
        break;
    }
    
    // Panel label (only if panel is large enough)
    const minSizeForLabel = 20 / scale; // 20 feet minimum for label
    if (panel.width >= minSizeForLabel && panel.height >= minSizeForLabel) {
      ctx.fillStyle = 'white';
      ctx.font = `${Math.max(8, Math.min(panel.width, panel.height) * 0.3)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const label = panel.panelNumber || panel.id;
      ctx.fillText(
        label, 
        panel.x + panel.width / 2, 
        panel.y + panel.height / 2
      );
    }
    
    // Selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = Math.max(1, 4 / scale);
      ctx.setLineDash([5 / scale, 5 / scale]);
      
      // Draw selection outline based on shape
      switch (panel.shape) {
        case 'right-triangle':
          ctx.beginPath();
          ctx.moveTo(panel.x - 2, panel.y - 2);
          ctx.lineTo(panel.x + panel.width + 2, panel.y - 2);
          ctx.lineTo(panel.x - 2, panel.y + panel.height + 2);
          ctx.closePath();
          ctx.stroke();
          break;
          
        case 'patch':
          const circleRadius = panel.width / 2;
          const circleCenterX = panel.x + circleRadius;
          const circleCenterY = panel.y + circleRadius;
          ctx.beginPath();
          ctx.arc(circleCenterX, circleCenterY, circleRadius + 2, 0, 2 * Math.PI);
          ctx.stroke();
          break;
          
        case 'rectangle':
        default:
          ctx.strokeRect(panel.x - 2, panel.y - 2, panel.width + 4, panel.height + 4);
          break;
      }
      
      ctx.setLineDash([]);
    }
  }, [viewTransform, selectedPanelId]);

  // Main render function
  const render = useCallback(() => {
    const start = performance.now();
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply transform
    ctx.save();
    ctx.translate(viewTransform.x, viewTransform.y);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    
    // Draw grid (world coordinates)
    drawGrid(ctx);
    
    // Draw panels (world coordinates)
    visiblePanels.forEach(panel => {
      drawPanel(ctx, panel);
    });
    
    ctx.restore();
    
    // Performance tracking
    const duration = performance.now() - start;
    renderTimeRef.current = duration;
    frameCountRef.current++;
    lastRenderTimeRef.current = duration;
    
    // Performance monitoring is handled by the hook internally
    
    if (enableDebugLogging && frameCountRef.current % 60 === 0) {
      console.log(`Render performance: ${duration.toFixed(2)}ms, FPS: ${(1000 / duration).toFixed(1)}`);
    }
  }, [canvas, viewTransform, drawGrid, visiblePanels, drawPanel, enableDebugLogging]);

  // Resize canvas function
  const resizeCanvas = useCallback((width: number, height: number) => {
    if (!canvas) return;
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    
    // Set CSS size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    if (enableDebugLogging) {
      console.log(`Canvas resized to: ${width}x${height}`);
    }
  }, [canvas, enableDebugLogging]);

  // Panel hit detection
  const getPanelAtPosition = useCallback((screenX: number, screenY: number): Panel | null => {
    const worldPos = viewTransform.toWorld({ x: screenX, y: screenY });
    
    // Check visible panels only (performance optimization)
    for (let i = visiblePanels.length - 1; i >= 0; i--) {
      const panel = visiblePanels[i];
      if (worldPos.x >= panel.x && 
          worldPos.x <= panel.x + panel.width &&
          worldPos.y >= panel.y && 
          worldPos.y <= panel.y + panel.height) {
        return panel;
      }
    }
    
    return null;
  }, [viewTransform, visiblePanels]);

  // Performance metrics
  const performanceMetrics = useMemo(() => ({
    renderTime: renderTimeRef.current,
    frameCount: frameCountRef.current,
    isLowPerf: renderTimeRef.current > 16 // Custom logic based on render time
  }), [renderTimeRef.current]);

  return {
    render,
    resizeCanvas,
    getPanelAtPosition,
    performanceMetrics
  };
}

export default useOptimizedRendering;
