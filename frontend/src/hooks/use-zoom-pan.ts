'use client';

import { useState, useRef, useCallback } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface UseZoomPan {
  scale: number;
  position: Point;
  setScale: (newScale: number, pivot?: Point) => void;
  setPosition: (pos: Point) => void;
  reset: () => void;
  fitToContent: (bounds?: { x: number; y: number; width: number; height: number }, padding?: number) => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  handleWheel: (e: WheelEvent, pivot?: Point) => void;
  onMouseMove: (e: { clientX: number; clientY: number } | { offsetX: number; offsetY: number }) => void;
}

const DEFAULT_SCALE = 1;
const DEFAULT_POSITION: Point = { x: 0, y: 0 };
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export function useZoomPan(): UseZoomPan {
  const [scale, setScaleState] = useState<number>(DEFAULT_SCALE);
  const [position, setPositionState] = useState<Point>(DEFAULT_POSITION);

  // Last known pointer (screen or canvas) position
  const lastPointer = useRef<Point>({ x: 0, y: 0 });

  // Update pointer position on mouse move
  const onMouseMove = useCallback(
    (e: { clientX: number; clientY: number } | { offsetX: number; offsetY: number }) => {
      if ('clientX' in e) {
        lastPointer.current = { x: e.clientX, y: e.clientY };
      } else {
        lastPointer.current = { x: e.offsetX, y: e.offsetY };
      }
    },
    []
  );

  // Core setter: zoom about an optional pivot point
  const setScale = useCallback(
    (newScale: number, pivot: Point = lastPointer.current) => {
      // Clamp
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      // Recalculate position so pivot stays under the cursor
      const dx = pivot.x - position.x;
      const dy = pivot.y - position.y;
      const scaleFactor = clamped / scale;
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

  /**
   * Fit the given bounds into the viewport.
   * If you call this from a component, pass it the union bounding box
   * of all your panels plus an optional padding.
   */
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
      const scaleX = (vw - padding * 2) / (bounds.width || 1);
      const scaleY = (vh - padding * 2) / (bounds.height || 1);
      const newScale = Math.min(scaleX, scaleY, MAX_SCALE);
      const clamped = Math.max(MIN_SCALE, newScale);
      // Center bounds
      const newPos: Point = {
        x: -bounds.x * clamped + (vw - bounds.width * clamped) / 2,
        y: -bounds.y * clamped + (vh - bounds.height * clamped) / 2,
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

  // Handler for wheel events; e.g. on Konva Stage: onWheel={e => handleWheel(e.evt, e.target.getStage().getPointerPosition())}
  const handleWheel = useCallback(
    (e: WheelEvent, pivot?: Point) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001; // adjust sensitivity
      setScale(scale * (1 + delta), pivot);
    },
    [scale, setScale]
  );

  return {
    scale,
    position,
    setScale,
    setPosition,
    reset,
    fitToContent,
    zoomIn,
    zoomOut,
    handleWheel,
    onMouseMove,
  };
} 