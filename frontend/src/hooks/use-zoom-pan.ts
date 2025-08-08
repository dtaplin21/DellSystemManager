'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

export interface UseZoomPanOptions {
  worldWidth: number;      // world units (ft)
  worldHeight: number;     // world units (ft)
  viewportWidth: number;   // px
  viewportHeight: number;  // px
  minScale?: number;       // computed by fitToExtent() if not provided
  maxScale?: number;       // default 8
  initialFit?: 'extent' | 'none';
  marginPct?: number;      // extra border on fit (e.g., 0.05 = 5%)
}

export interface ZoomPanApi {
  scale: number;
  x: number;
  y: number;
  onWheel: (evt: any) => void;
  onDoubleClick: (evt: any) => void;
  onDragStart: (evt: any) => void;
  onDragMove: (evt: any) => void;
  onDragEnd: (evt: any) => void;
  zoomIn: (cursor?: { x: number; y: number }) => void;
  zoomOut: (cursor?: { x: number; y: number }) => void;
  setScaleToCursor: (factor: number, cursor: { x: number; y: number }) => void;
  fitToExtent: () => void;
  setViewportSize: (w: number, h: number) => void;
  toWorld: (screen: { x: number; y: number }) => { x: number; y: number };
  toScreen: (world: { x: number; y: number }) => { x: number; y: number };
  handleKeyDown: (e: KeyboardEvent) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function useZoomPan(opts?: UseZoomPanOptions): any {
  const defaultVw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const defaultVh = typeof window !== 'undefined' ? window.innerHeight : 800
  const {
    worldWidth = defaultVw,
    worldHeight = defaultVh,
    viewportWidth = defaultVw,
    viewportHeight = defaultVh,
    maxScale = 8,
    initialFit = 'extent',
    marginPct = 0.06,
  } = (opts || {} as UseZoomPanOptions);

  const [vw, setVw] = useState(viewportWidth);
  const [vh, setVh] = useState(viewportHeight);

  const [scale, setScale] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  const isDraggingRef = useRef(false);
  const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stageOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const minScale = useMemo(() => {
    const marginW = worldWidth * marginPct;
    const marginH = worldHeight * marginPct;
    const fitW = vw / (worldWidth + 2 * marginW);
    const fitH = vh / (worldHeight + 2 * marginH);
    return Math.min(fitW, fitH);
  }, [vw, vh, worldWidth, worldHeight, marginPct]);

  const constrain = useCallback((nx: number, ny: number, s: number) => {
    const overscroll = 10; // px
    const worldScreenW = worldWidth * s;
    const worldScreenH = worldHeight * s;
    const minX = vw - worldScreenW - overscroll;
    const maxX = overscroll;
    const minY = vh - worldScreenH - overscroll;
    const maxY = overscroll;
    return {
      x: clamp(nx, Math.min(minX, maxX), Math.max(minX, maxX)),
      y: clamp(ny, Math.min(minY, maxY), Math.max(minY, maxY)),
    };
  }, [vw, vh, worldWidth, worldHeight]);

  const fitToExtent = useCallback(() => {
    const s = minScale;
    const worldPxW = worldWidth * s;
    const worldPxH = worldHeight * s;
    const nx = (vw - worldPxW) / 2;
    const ny = (vh - worldPxH) / 2;
    const c = constrain(nx, ny, s);
    setScale(s);
    setX(c.x);
    setY(c.y);
  }, [minScale, vw, vh, worldWidth, worldHeight, constrain]);

  const toWorld = useCallback(({ x: sx, y: sy }: { x: number; y: number }) => ({ x: (sx - x) / scale, y: (sy - y) / scale }), [x, y, scale]);
  const toScreen = useCallback(({ x: wx, y: wy }: { x: number; y: number }) => ({ x: wx * scale + x, y: wy * scale + y }), [x, y, scale]);

  const setScaleToCursor = useCallback((factor: number, cursor: { x: number; y: number }) => {
    const ns = clamp(scale * factor, minScale, maxScale);
    if (ns === scale) return;
    const wx = (cursor.x - x) / scale;
    const wy = (cursor.y - y) / scale;
    const nx = cursor.x - wx * ns;
    const ny = cursor.y - wy * ns;
    const c = constrain(nx, ny, ns);
    setScale(ns);
    setX(c.x);
    setY(c.y);
  }, [scale, x, y, minScale, maxScale, constrain]);

  const onWheel = useCallback((evt: any) => {
    evt.evt?.preventDefault?.();
    const deltaY = evt.evt?.deltaY ?? 0;
    const zoomFactor = Math.pow(1.0015, -deltaY);
    const pointer = evt.target?.getStage?.()?.getPointerPosition?.() ?? { x: vw / 2, y: vh / 2 };
    setScaleToCursor(zoomFactor, pointer);
  }, [setScaleToCursor, vw, vh]);

  const onDoubleClick = useCallback((evt: any) => {
    const pointer = evt.target?.getStage?.()?.getPointerPosition?.() ?? { x: vw / 2, y: vh / 2 };
    setScaleToCursor(1.2, pointer);
  }, [setScaleToCursor, vw, vh]);

  const onDragStart = useCallback((evt: any) => {
    isDraggingRef.current = true;
    const pointer = evt.target?.getStage?.()?.getPointerPosition?.() ?? { x: 0, y: 0 };
    dragOriginRef.current = { x: pointer.x, y: pointer.y };
    stageOriginRef.current = { x, y };
  }, [x, y]);

  const onDragMove = useCallback((evt: any) => {
    if (!isDraggingRef.current) return;
    const pointer = evt.target?.getStage?.()?.getPointerPosition?.() ?? { x: 0, y: 0 };
    const dx = pointer.x - dragOriginRef.current.x;
    const dy = pointer.y - dragOriginRef.current.y;
    const nx = stageOriginRef.current.x + dx;
    const ny = stageOriginRef.current.y + dy;
    const c = constrain(nx, ny, scale);
    setX(c.x);
    setY(c.y);
  }, [constrain, scale]);

  const onDragEnd = useCallback(() => { isDraggingRef.current = false; }, []);

  const zoomIn = useCallback((cursor?: { x: number; y: number }) => setScaleToCursor(1.2, cursor ?? { x: vw / 2, y: vh / 2 }), [setScaleToCursor, vw, vh]);
  const zoomOut = useCallback((cursor?: { x: number; y: number }) => setScaleToCursor(1 / 1.2, cursor ?? { x: vw / 2, y: vh / 2 }), [setScaleToCursor, vw, vh]);
  const setViewportSize = useCallback((w: number, h: number) => { setVw(w); setVh(h); }, []);

  const didInitRef = useRef(false);
  if (!didInitRef.current && initialFit === 'extent') {
    didInitRef.current = true;
    setTimeout(fitToExtent, 0);
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      if (e.key === '-') { e.preventDefault(); zoomOut(); }
    }
    if (e.key === '0') { e.preventDefault(); fitToExtent(); }
  }, [zoomIn, zoomOut, fitToExtent]);

  // Legacy API compatibility layer
  const position = { x, y }
  const setScaleLegacy = (newScale: number, pivot?: { x: number; y: number }) => {
    const factor = newScale / scale
    setScaleToCursor(factor, pivot ?? { x: vw / 2, y: vh / 2 })
  }
  const setPositionLegacy = ({ x: lx, y: ly }: { x: number; y: number }) => {
    const c = constrain(lx, ly, scale); setX(c.x); setY(c.y)
  }
  const handleWheelLegacy = (e: WheelEvent) => {
    e.preventDefault(); const deltaY = e.deltaY; const zoomFactor = Math.pow(1.0015, -deltaY); setScaleToCursor(zoomFactor, { x: vw / 2, y: vh / 2 })
  }
  const fitToContentLegacy = (bounds?: { x: number; y: number; width: number; height: number }, padding: number = 20) => {
    if (!bounds || bounds.width === 0 || bounds.height === 0) { fitToExtent(); return }
    const safeW = Math.max(bounds.width, 1)
    const safeH = Math.max(bounds.height, 1)
    const sX = (vw - padding * 2) / safeW
    const sY = (vh - padding * 2) / safeH
    const ns = clamp(Math.min(sX, sY), minScale, maxScale)
    const nx = -bounds.x * ns + (vw - safeW * ns) / 2
    const ny = -bounds.y * ns + (vh - safeH * ns) / 2
    const c = constrain(nx, ny, ns)
    setScale(ns); setX(c.x); setY(c.y)
  }

  return {
    // New API
    scale, x, y, onWheel, onDoubleClick, onDragStart, onDragMove, onDragEnd, zoomIn, zoomOut, setScaleToCursor, fitToExtent, setViewportSize, toWorld, toScreen, handleKeyDown,
    // Legacy fields
    position,
    setScale: setScaleLegacy,
    setPosition: setPositionLegacy,
    handleWheel: handleWheelLegacy,
    onMouseMove: () => {},
    reset: () => fitToExtent(),
    fitToContent: fitToContentLegacy,
    viewport: { x, y, width: vw / scale, height: vh / scale, scale },
    isInViewport: () => true,
  };
}