'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { WORLD_CONSTANTS, snapToGrid } from '@/lib/world-coordinates';
import { debounce } from 'lodash';

interface Point {
  x: number;
  y: number;
}

interface Viewport {
  width: number;
  height: number;
}

interface UseZoomPanOptions {
  worldWidth: number;
  worldHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  initialFit?: 'extent' | 'none';
  enablePerformanceMonitoring?: boolean;
  onTransformChange?: (transform: { x: number; y: number; scale: number }) => void;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
  toWorld: (screenPoint: Point) => Point;
  toScreen: (worldPoint: Point) => Point;
  fitToExtent: () => void;
  setViewportSize: (width: number, height: number) => void;
  visibleWorldRect: { x: number; y: number; width: number; height: number };
  gridLines: Array<{
    type: 'vertical' | 'horizontal';
    x?: number;
    y?: number;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    isMajor?: boolean;
  }>;
  onWheel: (event: WheelEvent) => void;
  onDragStart: (event: MouseEvent) => void;
  onDragMove: (event: MouseEvent) => void;
  onDragEnd: (event: MouseEvent) => void;
  performanceMetrics: {
    renderTime: number;
    frameCount: number;
    isLowPerf: boolean;
  };
}

export function useZoomPan({
  worldWidth,
  worldHeight,
  viewportWidth,
  viewportHeight,
  initialFit = 'extent',
  enablePerformanceMonitoring = false,
  onTransformChange
}: UseZoomPanOptions): ViewTransform {
  
  const [scale, setScale] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  
  const viewportSizeRef = useRef({ width: viewportWidth, height: viewportHeight });
  const performanceMetricsRef = useRef({
    renderTime: 0,
    frameCount: 0,
    isLowPerf: false
  });

  // Update viewport size if props change
  useEffect(() => {
    viewportSizeRef.current = { width: viewportWidth, height: viewportHeight };
  }, [viewportWidth, viewportHeight]);

  // Calculate minScale to fit the entire world
  const minScale = useMemo(() => {
    const margin = 0.06; // 6% breathing room
    const fitW = viewportSizeRef.current.width / (worldWidth * (1 + margin * 2));
    const fitH = viewportSizeRef.current.height / (worldHeight * (1 + margin * 2));
    return Math.min(fitW, fitH);
  }, [worldWidth, worldHeight]);

  // Clamp pan offsets to prevent world from being lost
  const clampPan = useCallback((newX: number, newY: number, currentScale: number) => {
    const scaledWorldWidth = worldWidth * currentScale;
    const scaledWorldHeight = worldHeight * currentScale;

    const maxX = Math.max(0, viewportSizeRef.current.width - scaledWorldWidth);
    const maxY = Math.max(0, viewportSizeRef.current.height - scaledWorldHeight);

    const clampedX = Math.max(maxX, Math.min(0, newX));
    const clampedY = Math.max(maxY, Math.min(0, newY));
    return { x: clampedX, y: clampedY };
  }, [worldWidth, worldHeight]);

  // Fit the entire world to the viewport
  const fitToExtent = useCallback(() => {
    const s = minScale;
    const scaledWorldWidth = worldWidth * s;
    const scaledWorldHeight = worldHeight * s;
    const nx = (viewportSizeRef.current.width - scaledWorldWidth) / 2;
    const ny = (viewportSizeRef.current.height - scaledWorldHeight) / 2;

    setScale(s);
    setX(nx);
    setY(ny);
  }, [minScale, worldWidth, worldHeight]);

  // Initial fit
  useEffect(() => {
    if (initialFit === 'extent') {
      fitToExtent();
    }
  }, [initialFit, fitToExtent]);

  // Coordinate conversion helpers
  const toWorld = useCallback((screenPoint: Point): Point => {
    if (scale <= WORLD_CONSTANTS.EPSILON) return { x: 0, y: 0 };
    return {
      x: (screenPoint.x - x) / scale,
      y: (screenPoint.y - y) / scale,
    };
  }, [x, y, scale]);

  const toScreen = useCallback((worldPoint: Point): Point => {
    return {
      x: worldPoint.x * scale + x,
      y: worldPoint.y * scale + y,
    };
  }, [x, y, scale]);

  // Debounced transform change callback
  const debouncedTransformChange = useMemo(
    () => debounce((transform: { x: number; y: number; scale: number }) => {
      onTransformChange?.(transform);
    }, 16),
    [onTransformChange]
  );

  // Update transform and notify
  const updateTransform = useCallback((newX: number, newY: number, newScale: number) => {
    setX(newX);
    setY(newY);
    setScale(newScale);
    
    const transform = { x: newX, y: newY, scale: newScale };
    debouncedTransformChange(transform);
  }, [debouncedTransformChange]);

  // Zoom handler (cursor-centered)
  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();

    const stageRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - stageRect.left;
    const mouseY = event.clientY - stageRect.top;

    const oldWorldPoint = toWorld({ x: mouseX, y: mouseY });

    const zoomFactor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
    let newScale = scale * zoomFactor;
    newScale = Math.max(WORLD_CONSTANTS.MIN_SCALE, Math.min(WORLD_CONSTANTS.MAX_SCALE, newScale));
    newScale = parseFloat(newScale.toFixed(3));

    const newX = mouseX - oldWorldPoint.x * newScale;
    const newY = mouseY - oldWorldPoint.y * newScale;

    const clamped = clampPan(newX, newY, newScale);
    updateTransform(clamped.x, clamped.y, newScale);
  }, [scale, toWorld, clampPan, updateTransform]);

  // Pan handlers
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<Point>({ x: 0, y: 0 });

  const onDragStart = useCallback((event: MouseEvent) => {
    isPanningRef.current = true;
    lastPanPointRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onDragMove = useCallback((event: MouseEvent) => {
    if (!isPanningRef.current) return;

    const deltaX = event.clientX - lastPanPointRef.current.x;
    const deltaY = event.clientY - lastPanPointRef.current.y;

    lastPanPointRef.current = { x: event.clientX, y: event.clientY };

    const newX = x + deltaX;
    const newY = y + deltaY;

    const clamped = clampPan(newX, newY, scale);
    updateTransform(clamped.x, clamped.y, scale);
  }, [x, y, scale, clampPan, updateTransform]);

  const onDragEnd = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Visible world rectangle (for grid culling and logic)
  const visibleWorldRect = useMemo(() => ({
    x: -x / scale,
    y: -y / scale,
    width: viewportSizeRef.current.width / scale,
    height: viewportSizeRef.current.height / scale,
  }), [x, y, scale]);

  // Grid lines calculation with viewport culling
  const gridLines = useMemo(() => {
    const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = visibleWorldRect;
    const buffer = WORLD_CONSTANTS.GRID_CELL_SIZE_FT * 10;
    
    const startX = Math.max(0, Math.floor((viewX - buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    const endX = Math.min(worldWidth, Math.ceil((viewX + viewWidth + buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    const startY = Math.max(0, Math.floor((viewY - buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    const endY = Math.min(worldHeight, Math.ceil((viewY + viewHeight + buffer) / WORLD_CONSTANTS.GRID_CELL_SIZE_FT) * WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
    
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
      const isMajor = gx % (WORLD_CONSTANTS.GRID_CELL_SIZE_FT * 10) === 0;
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
      const isMajor = gy % (WORLD_CONSTANTS.GRID_CELL_SIZE_FT * 10) === 0;
      lines.push({
        type: 'horizontal',
        y: gy,
        startX,
        endX,
        isMajor
      });
    }
    
    return lines;
  }, [visibleWorldRect, worldWidth, worldHeight]);

  const setViewportSize = useCallback((width: number, height: number) => {
    viewportSizeRef.current = { width, height };
  }, []);

  // Performance monitoring
  const performanceMetrics = useMemo(() => {
    if (enablePerformanceMonitoring) {
      return performanceMetricsRef.current;
    }
    return {
      renderTime: 0,
      frameCount: 0,
      isLowPerf: false
    };
  }, [enablePerformanceMonitoring]);

  const transform: ViewTransform = useMemo(() => ({
    x,
    y,
    scale,
    toWorld,
    toScreen,
    fitToExtent,
    setViewportSize,
    visibleWorldRect,
    gridLines,
    onWheel,
    onDragStart,
    onDragMove,
    onDragEnd,
    performanceMetrics
  }), [x, y, scale, toWorld, toScreen, fitToExtent, setViewportSize, visibleWorldRect, gridLines, onWheel, onDragStart, onDragMove, onDragEnd, performanceMetrics]);

  return transform;
}

export default useZoomPan;