'use client';

import { useState, useRef, useCallback, useMemo } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface UseZoomPan {
  scale: number;
  position: Point;
  viewport: Viewport;
  setScale: (newScale: number, pivot?: Point) => void;
  setPosition: (pos: Point) => void;
  reset: () => void;
  fitToContent: (bounds?: { x: number; y: number; width: number; height: number }, padding?: number) => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  handleWheel: (e: WheelEvent, pivot?: Point) => void;
  onMouseMove: (e: { clientX: number; clientY: number } | { offsetX: number; offsetY: number }) => void;
  isInViewport: (bounds: { x: number; y: number; width: number; height: number }) => boolean;
}

const DEFAULT_SCALE = 1;
const DEFAULT_POSITION: Point = { x: 0, y: 0 };
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const MOUSE_THROTTLE_MS = 16; // ~60fps

export function useZoomPan(): UseZoomPan {
  const [scale, setScaleState] = useState<number>(DEFAULT_SCALE);
  const [position, setPositionState] = useState<Point>(DEFAULT_POSITION);

  // Last known pointer (screen or canvas) position
  const lastPointer = useRef<Point>({ x: 0, y: 0 });
  const lastMouseMoveTime = useRef<number>(0);

  // Memoized viewport calculation
  const viewport = useMemo((): Viewport => ({
    x: position.x,
    y: position.y,
    width: window.innerWidth / scale,
    height: window.innerHeight / scale,
    scale
  }), [position.x, position.y, scale]);

  // Throttled mouse move handler
  const onMouseMove = useCallback(
    (e: { clientX: number; clientY: number } | { offsetX: number; offsetY: number }) => {
      const now = Date.now();
      if (now - lastMouseMoveTime.current < MOUSE_THROTTLE_MS) {
        return;
      }
      lastMouseMoveTime.current = now;

      if ('clientX' in e) {
        lastPointer.current = { x: e.clientX, y: e.clientY };
      } else {
        lastPointer.current = { x: e.offsetX, y: e.offsetY };
      }
    },
    []
  );

  // Optimized scale setter with better pivot calculation
  const setScale = useCallback(
    (newScale: number, pivot: Point = lastPointer.current) => {
      // Clamp scale
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      
      // Only update if scale actually changed
      if (Math.abs(clamped - scale) < 0.001) return;

      // Optimized pivot calculation
      const scaleFactor = clamped / scale;
      const dx = pivot.x - position.x;
      const dy = pivot.y - position.y;
      
      const newPos: Point = {
        x: pivot.x - dx * scaleFactor,
        y: pivot.y - dy * scaleFactor,
      };
      
      setScaleState(clamped);
      setPositionState(newPos);
    },
    [position, scale]
  );

  const setPosition = useCallback((pos: Point) => {
    setPositionState(pos);
  }, []);

  const reset = useCallback(() => {
    setScaleState(DEFAULT_SCALE);
    setPositionState(DEFAULT_POSITION);
  }, []);

  // Optimized fit to content with better bounds calculation
  const fitToContent = useCallback(
    (
      bounds: { x: number; y: number; width: number; height: number } = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      padding = 20
    ) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Avoid division by zero
      const safeWidth = Math.max(bounds.width, 1);
      const safeHeight = Math.max(bounds.height, 1);
      
      const scaleX = (vw - padding * 2) / safeWidth;
      const scaleY = (vh - padding * 2) / safeHeight;
      const newScale = Math.min(scaleX, scaleY, MAX_SCALE);
      const clamped = Math.max(MIN_SCALE, newScale);
      
      // Center bounds
      const newPos: Point = {
        x: -bounds.x * clamped + (vw - safeWidth * clamped) / 2,
        y: -bounds.y * clamped + (vh - safeHeight * clamped) / 2,
      };
      
      setScaleState(clamped);
      setPositionState(newPos);
    },
    []
  );

  const zoomIn = useCallback((factor = 0.1) => {
    setScale(scale * (1 + factor));
  }, [scale, setScale]);

  const zoomOut = useCallback((factor = 0.1) => {
    setScale(scale / (1 + factor));
  }, [scale, setScale]);

  // Optimized wheel handler with better delta calculation
  const handleWheel = useCallback(
    (e: WheelEvent, pivot?: Point) => {
      e.preventDefault();
      
      // Improved delta calculation for smoother zooming
      const delta = -e.deltaY * 0.0005; // Reduced sensitivity for smoother zoom
      const newScale = scale * (1 + delta);
      
      setScale(newScale, pivot);
    },
    [scale, setScale]
  );

  // Viewport culling helper for performance optimization
  const isInViewport = useCallback((bounds: { x: number; y: number; width: number; height: number }) => {
    const margin = 100; // Extra margin for smooth scrolling
    return (
      bounds.x + bounds.width >= viewport.x - margin &&
      bounds.x <= viewport.x + viewport.width + margin &&
      bounds.y + bounds.height >= viewport.y - margin &&
      bounds.y <= viewport.y + viewport.height + margin
    );
  }, [viewport]);

  return {
    scale,
    position,
    viewport,
    setScale,
    setPosition,
    reset,
    fitToContent,
    zoomIn,
    zoomOut,
    handleWheel,
    onMouseMove,
    isInViewport,
  };
} 