'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  WORLD_CONSTANTS, 
  toWorldCoordinates, 
  toScreenCoordinates, 
  calculateVisibleWorldRect,
  calculateGridLines,
  WorldTransform,
  ViewportRect
} from '@/lib/world-coordinates';
import { usePerformanceMonitoring } from './usePerformanceMonitoring';

interface UseZoomPanOptions {
  worldWidth: number;
  worldHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  initialFit?: 'extent' | 'center' | 'none';
  enablePerformanceMonitoring?: boolean;
  onTransformChange?: (transform: WorldTransform) => void;
}

interface UseZoomPanReturn {
  // Transform state
  transform: WorldTransform;
  
  // Coordinate conversion functions
  toWorld: (screenPos: { x: number; y: number }) => { x: number; y: number };
  toScreen: (worldPos: { x: number; y: number }) => { x: number; y: number };
  
  // Viewport information
  visibleWorldRect: ViewportRect;
  gridLines: Array<{ type: 'vertical' | 'horizontal'; x?: number; y?: number; startX?: number; startY?: number; endX?: number; endY?: number }>;
  
  // Event handlers
  onWheel: (event: WheelEvent) => void;
  onDragStart: (event: MouseEvent) => void;
  onDragMove: (event: MouseEvent) => void;
  onDragEnd: (event: MouseEvent) => void;
  
  // View control functions
  fitToExtent: () => void;
  setViewportSize: (width: number, height: number) => void;
  zoomToPoint: (worldX: number, worldY: number, scale: number) => void;
  panTo: (worldX: number, worldY: number) => void;
  
  // Performance monitoring
  performanceMetrics: ReturnType<typeof usePerformanceMonitoring>['metrics'];
}

/**
 * Hook for managing zoom and pan transformations
 * Provides cursor-centered zoom, bounded panning, and performance monitoring
 */
export function useZoomPan(options: UseZoomPanOptions): UseZoomPanReturn {
  const {
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
    initialFit = 'extent',
    enablePerformanceMonitoring = true,
    onTransformChange
  } = options;

  // Performance monitoring
  const { metrics: performanceMetrics, recordRenderTime } = usePerformanceMonitoring({
    enabled: enablePerformanceMonitoring,
    onPerformanceIssue: (metrics) => {
      console.warn('Performance issue detected in useZoomPan:', metrics);
    }
  });

  // Transform state
  const [transform, setTransform] = useState<WorldTransform>(() => {
    // Calculate initial transform based on fit mode
    if (initialFit === 'extent') {
      const margin = 0.06; // 6% breathing room
      const fitW = viewportWidth / (worldWidth * (1 + margin * 2));
      const fitH = viewportHeight / (worldHeight * (1 + margin * 2));
      const scale = Math.min(fitW, fitH);
      
      const worldPxW = worldWidth * scale;
      const worldPxH = worldHeight * scale;
      const x = (viewportWidth - worldPxW) / 2;
      const y = (viewportHeight - worldPxH) / 2;
      
      return { x, y, scale };
    } else if (initialFit === 'center') {
      return {
        x: viewportWidth / 2 - worldWidth / 2,
        y: viewportHeight / 2 - worldHeight / 2,
        scale: 1
      };
    } else {
      return { x: 0, y: 0, scale: 1 };
    }
  });

  // Refs for drag state
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const dragStartTransformRef = useRef<WorldTransform>({ x: 0, y: 0, scale: 1 });

  // Calculate minimum scale to fit world
  const minScale = useMemo(() => {
    const margin = 0.06; // 6% breathing room
    const fitW = viewportWidth / (worldWidth * (1 + margin * 2));
    const fitH = viewportHeight / (worldHeight * (1 + margin * 2));
    return Math.min(fitW, fitH);
  }, [viewportWidth, viewportHeight, worldWidth, worldHeight]);

  // Calculate maximum scale (10x zoom)
  const maxScale = useMemo(() => {
    return Math.min(WORLD_CONSTANTS.MAX_SCALE, minScale * 10);
  }, [minScale]);

  // Coordinate conversion functions
  const toWorld = useCallback((screenPos: { x: number; y: number }) => {
    return toWorldCoordinates(screenPos.x, screenPos.y, transform);
  }, [transform]);

  const toScreen = useCallback((worldPos: { x: number; y: number }) => {
    return toScreenCoordinates(worldPos.x, worldPos.y, transform);
  }, [transform]);

  // Calculate visible world rectangle
  const visibleWorldRect = useMemo(() => {
    return calculateVisibleWorldRect(viewportWidth, viewportHeight, transform);
  }, [viewportWidth, viewportHeight, transform]);

  // Calculate grid lines for visible area
  const gridLines = useMemo(() => {
    const start = performance.now();
    const lines = calculateGridLines(visibleWorldRect);
    const duration = performance.now() - start;
    
    recordRenderTime(duration);
    
    return lines;
  }, [visibleWorldRect, recordRenderTime]);

  // Safe transform update with bounds checking
  const updateTransform = useCallback((newTransform: Partial<WorldTransform>) => {
    setTransform(prev => {
      const updated = { ...prev, ...newTransform };
      
      // Clamp scale to valid range
      updated.scale = Math.max(minScale, Math.min(maxScale, updated.scale));
      
      // Clamp pan to keep world visible
      const maxX = viewportWidth - worldWidth * updated.scale;
      const maxY = viewportHeight - worldHeight * updated.scale;
      
      updated.x = Math.max(maxX, Math.min(0, updated.x));
      updated.y = Math.max(maxY, Math.min(0, updated.y));
      
      // Notify parent of transform change
      onTransformChange?.(updated);
      
      return updated;
    });
  }, [minScale, maxScale, viewportWidth, viewportHeight, worldWidth, worldHeight, onTransformChange]);

  // Wheel event handler (cursor-centered zoom)
  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to world coordinates
    const worldPos = toWorld({ x: mouseX, y: mouseY });
    
    // Calculate zoom factor
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = transform.scale * zoomFactor;
    
    // Clamp scale
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    // Calculate new offset to keep world point under cursor
    const newX = mouseX - worldPos.x * clampedScale;
    const newY = mouseY - worldPos.y * clampedScale;
    
    updateTransform({ x: newX, y: newY, scale: clampedScale });
  }, [transform.scale, minScale, maxScale, toWorld, updateTransform]);

  // Drag event handlers
  const onDragStart = useCallback((event: MouseEvent) => {
    event.preventDefault();
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    dragStartTransformRef.current = { ...transform };
  }, [transform]);

  const onDragMove = useCallback((event: MouseEvent) => {
    if (!isDraggingRef.current) return;
    
    event.preventDefault();
    
    const deltaX = event.clientX - lastMousePosRef.current.x;
    const deltaY = event.clientY - lastMousePosRef.current.y;
    
    const newX = dragStartTransformRef.current.x + deltaX;
    const newY = dragStartTransformRef.current.y + deltaY;
    
    updateTransform({ x: newX, y: newY });
  }, [updateTransform]);

  const onDragEnd = useCallback((event: MouseEvent) => {
    isDraggingRef.current = false;
  }, []);

  // View control functions
  const fitToExtent = useCallback(() => {
    const margin = 0.06; // 6% breathing room
    const fitW = viewportWidth / (worldWidth * (1 + margin * 2));
    const fitH = viewportHeight / (worldHeight * (1 + margin * 2));
    const scale = Math.min(fitW, fitH);
    
    const worldPxW = worldWidth * scale;
    const worldPxH = worldHeight * scale;
    const x = (viewportWidth - worldPxW) / 2;
    const y = (viewportHeight - worldPxH) / 2;
    
    updateTransform({ x, y, scale });
  }, [viewportWidth, viewportHeight, worldWidth, worldHeight, updateTransform]);

  const setViewportSize = useCallback((width: number, height: number) => {
    // Recalculate min scale with new viewport size
    const margin = 0.06;
    const fitW = width / (worldWidth * (1 + margin * 2));
    const fitH = height / (worldHeight * (1 + margin * 2));
    const newMinScale = Math.min(fitW, fitH);
    
    // Adjust current scale if it's below new minimum
    const newScale = Math.max(newMinScale, transform.scale);
    
    updateTransform({ scale: newScale });
  }, [worldWidth, worldHeight, transform.scale, updateTransform]);

  const zoomToPoint = useCallback((worldX: number, worldY: number, scale: number) => {
    const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
    const screenPos = toScreen({ x: worldX, y: worldY });
    
    const newX = screenPos.x - worldX * clampedScale;
    const newY = screenPos.y - worldY * clampedScale;
    
    updateTransform({ x: newX, y: newY, scale: clampedScale });
  }, [minScale, maxScale, toScreen, updateTransform]);

  const panTo = useCallback((worldX: number, worldY: number) => {
    const screenPos = toScreen({ x: worldX, y: worldY });
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    
    const newX = transform.x + (centerX - screenPos.x);
    const newY = transform.y + (centerY - screenPos.y);
    
    updateTransform({ x: newX, y: newY });
  }, [viewportWidth, viewportHeight, transform.x, transform.y, toScreen, updateTransform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
    };
  }, []);

  return {
    transform,
    toWorld,
    toScreen,
    visibleWorldRect,
    gridLines,
    onWheel,
    onDragStart,
    onDragMove,
    onDragEnd,
    fitToExtent,
    setViewportSize,
    zoomToPoint,
    panTo,
    performanceMetrics
  };
}

export default useZoomPan;
