'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ZoomPanState {
  scale: number;
  position: { x: number; y: number };
}

interface UseZoomPanOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  initialPosition?: { x: number; y: number };
  containerWidth?: number;
  containerHeight?: number;
  contentWidth?: number;
  contentHeight?: number;
}

interface UseZoomPanReturn {
  scale: number;
  position: { x: number; y: number };
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  zoomToFit: () => void;
  setScale: (scale: number) => void;
  setPosition: (position: { x: number; y: number }) => void;
  handleWheel: (e: React.WheelEvent, containerRect: DOMRect) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  isPanning: boolean;
}

export const useZoomPan = (options: UseZoomPanOptions = {}): UseZoomPanReturn => {
  const {
    minScale = 0.1,
    maxScale = 3.0,
    initialScale = 1.0,
    initialPosition = { x: 0, y: 0 },
    containerWidth = 0,
    containerHeight = 0,
    contentWidth = 0,
    contentHeight = 0,
  } = options;

  const [state, setState] = useState<ZoomPanState>({
    scale: initialScale,
    position: initialPosition,
  });

  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const isMouseDown = useRef(false);

  // Clamp scale to bounds
  const clampScale = useCallback((scale: number) => {
    return Math.max(minScale, Math.min(maxScale, scale));
  }, [minScale, maxScale]);

  // Zoom in
  const zoomIn = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: clampScale(prev.scale * 1.2),
    }));
  }, [clampScale]);

  // Zoom out
  const zoomOut = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: clampScale(prev.scale / 1.2),
    }));
  }, [clampScale]);

  // Reset zoom and position
  const resetZoom = useCallback(() => {
    setState({
      scale: initialScale,
      position: initialPosition,
    });
  }, [initialScale, initialPosition]);

  // Zoom to fit all content
  const zoomToFit = useCallback(() => {
    if (containerWidth === 0 || containerHeight === 0 || contentWidth === 0 || contentHeight === 0) {
      return;
    }

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const fitScale = clampScale(Math.min(scaleX, scaleY) * 0.9); // 90% to add some padding

    setState({
      scale: fitScale,
      position: {
        x: (containerWidth - contentWidth * fitScale) / 2,
        y: (containerHeight - contentHeight * fitScale) / 2,
      },
    });
  }, [containerWidth, containerHeight, contentWidth, contentHeight, clampScale]);

  // Set scale directly
  const setScale = useCallback((scale: number) => {
    setState(prev => ({
      ...prev,
      scale: clampScale(scale),
    }));
  }, [clampScale]);

  // Set position directly
  const setPosition = useCallback((position: { x: number; y: number }) => {
    setState(prev => ({
      ...prev,
      position,
    }));
  }, []);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent, containerRect: DOMRect) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = clampScale(state.scale * delta);
    
    // Calculate zoom center (mouse position relative to container)
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    // Calculate new position to zoom towards mouse cursor
    const scaleRatio = newScale / state.scale;
    const newX = mouseX - (mouseX - state.position.x) * scaleRatio;
    const newY = mouseY - (mouseY - state.position.y) * scaleRatio;
    
    setState({
      scale: newScale,
      position: { x: newX, y: newY },
    });
  }, [state.scale, state.position, clampScale]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button only
      e.preventDefault();
      isMouseDown.current = true;
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isMouseDown.current || !lastMousePos.current) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    
    setState(prev => ({
      ...prev,
      position: {
        x: prev.position.x + deltaX,
        y: prev.position.y + deltaY,
      },
    }));
    
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
    setIsPanning(false);
    lastMousePos.current = null;
  }, []);

  // Add global mouse event listeners for panning
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isMouseDown.current && lastMousePos.current) {
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        
        setState(prev => ({
          ...prev,
          position: {
            x: prev.position.x + deltaX,
            y: prev.position.y + deltaY,
          },
        }));
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleGlobalMouseUp = () => {
      isMouseDown.current = false;
      setIsPanning(false);
      lastMousePos.current = null;
    };

    if (isPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning]);

  return {
    scale: state.scale,
    position: state.position,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomToFit,
    setScale,
    setPosition,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isPanning,
  };
}; 