'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Panel } from '@/types/panel';
import { WORLD_CONSTANTS, snapToGrid } from '@/lib/world-coordinates';
import { useOptimizedRendering } from './useOptimizedRendering';

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
  toWorld: (screenPoint: { x: number; y: number }) => { x: number; y: number };
  toScreen: (worldPoint: { x: number; y: number }) => { x: number; y: number };
  visibleWorldRect: { x: number; y: number; width: number; height: number };
}

interface UseIntegratedMouseInteractionOptions {
  canvas: HTMLCanvasElement | null;
  panels: Panel[];
  viewTransform: ViewTransform;
  selectedPanelId: string | null;
  renderingQuality: 'high' | 'medium' | 'low';
  onPanelUpdate: (panelId: string, updates: Partial<Panel>) => void;
  onPanelSelect: (panelId: string | null) => void;
  onTransformChange: (transform: { x: number; y: number; scale: number }) => void;
  enableDebugLogging?: boolean;
}

interface UseIntegratedMouseInteractionReturn {
  render: () => void;
  resizeCanvas: (width: number, height: number) => void;
  getPanelAtPosition: (screenX: number, screenY: number) => Panel | null;
  performanceMetrics: {
    renderTime: number;
    frameCount: number;
    isLowPerf: boolean;
  };
  // Event handlers
  handleMouseDown: (event: React.MouseEvent) => void;
  handleMouseMove: (event: React.MouseEvent) => void;
  handleMouseUp: (event: React.MouseEvent) => void;
  handleWheel: (event: React.WheelEvent) => void;
  handleTouchStart: (event: React.TouchEvent) => void;
  handleTouchMove: (event: React.TouchEvent) => void;
  handleTouchEnd: (event: React.TouchEvent) => void;
}

/**
 * Integrated mouse interaction hook that combines rendering and interaction
 * Uses world coordinates and Phase 2 state management
 */
export function useIntegratedMouseInteraction({
  canvas,
  panels,
  viewTransform,
  selectedPanelId,
  renderingQuality,
  onPanelUpdate,
  onPanelSelect,
  onTransformChange,
  enableDebugLogging = false
}: UseIntegratedMouseInteractionOptions): UseIntegratedMouseInteractionReturn {
  
  // Rendering hook
  const { render, resizeCanvas, getPanelAtPosition, performanceMetrics } = useOptimizedRendering({
    canvas,
    panels,
    viewTransform,
    selectedPanelId,
    renderingQuality,
    enableDebugLogging
  });

  // Interaction state
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const selectedPanelRef = useRef<Panel | null>(null);

  // Debug logging
  const debugLog = useCallback((message: string, data?: any) => {
    if (enableDebugLogging) {
      console.log(`[useIntegratedMouseInteraction] ${message}`, data);
    }
  }, [enableDebugLogging]);

  // Get screen coordinates from mouse event
  const getScreenCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0]?.clientX || 0 : event.clientX;
    const clientY = 'touches' in event ? event.touches[0]?.clientY || 0 : event.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, [canvas]);

  // Handle mouse down
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    const screenPos = getScreenCoordinates(event);
    const worldPos = viewTransform.toWorld(screenPos);
    
    debugLog('Mouse down', { screenPos, worldPos });
    
    // Find clicked panel
    const clickedPanel = getPanelAtPosition(screenPos.x, screenPos.y);
    
    if (clickedPanel) {
      // Start dragging panel
      isDraggingRef.current = true;
      selectedPanelRef.current = clickedPanel;
      dragStartRef.current = {
        x: worldPos.x - clickedPanel.x,
        y: worldPos.y - clickedPanel.y
      };
      
      onPanelSelect(clickedPanel.id);
      debugLog('Started dragging panel', { panelId: clickedPanel.id, dragStart: dragStartRef.current });
    } else {
      // Start panning
      isPanningRef.current = true;
      lastMousePosRef.current = screenPos;
      onPanelSelect(null);
      debugLog('Started panning');
    }
  }, [getScreenCoordinates, viewTransform, getPanelAtPosition, onPanelSelect, debugLog]);

  // Handle mouse move
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    const screenPos = getScreenCoordinates(event);
    
    if (isDraggingRef.current && selectedPanelRef.current) {
      // Drag panel
      const worldPos = viewTransform.toWorld(screenPos);
      const newX = worldPos.x - dragStartRef.current.x;
      const newY = worldPos.y - dragStartRef.current.y;
      
      // Snap to grid
      const snappedX = snapToGrid(newX, WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
      const snappedY = snapToGrid(newY, WORLD_CONSTANTS.GRID_CELL_SIZE_FT);
      
      // Clamp to world bounds
      const clampedX = Math.max(0, Math.min(WORLD_CONSTANTS.WIDTH_FT - selectedPanelRef.current.width, snappedX));
      const clampedY = Math.max(0, Math.min(WORLD_CONSTANTS.HEIGHT_FT - selectedPanelRef.current.height, snappedY));
      
      onPanelUpdate(selectedPanelRef.current.id, { x: clampedX, y: clampedY });
      debugLog('Dragging panel', { panelId: selectedPanelRef.current.id, newPos: { x: clampedX, y: clampedY } });
    } else if (isPanningRef.current) {
      // Pan view
      const deltaX = screenPos.x - lastMousePosRef.current.x;
      const deltaY = screenPos.y - lastMousePosRef.current.y;
      
      const newX = viewTransform.x + deltaX;
      const newY = viewTransform.y + deltaY;
      
      onTransformChange({ x: newX, y: newY, scale: viewTransform.scale });
      lastMousePosRef.current = screenPos;
      debugLog('Panning view', { deltaX, deltaY, newTransform: { x: newX, y: newY } });
    }
  }, [getScreenCoordinates, viewTransform, onPanelUpdate, onTransformChange, debugLog]);

  // Handle mouse up
  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    if (isDraggingRef.current) {
      debugLog('Finished dragging panel', { panelId: selectedPanelRef.current?.id });
      isDraggingRef.current = false;
      selectedPanelRef.current = null;
    }
    
    if (isPanningRef.current) {
      debugLog('Finished panning');
      isPanningRef.current = false;
    }
  }, [debugLog]);

  // Handle wheel (zoom)
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    
    const screenPos = getScreenCoordinates(event);
    const worldPos = viewTransform.toWorld(screenPos);
    
    // Zoom factor
    const zoomFactor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
    let newScale = viewTransform.scale * zoomFactor;
    newScale = Math.max(WORLD_CONSTANTS.MIN_SCALE, Math.min(WORLD_CONSTANTS.MAX_SCALE, newScale));
    newScale = parseFloat(newScale.toFixed(3));
    
    // Calculate new transform to keep world point under cursor
    const newX = screenPos.x - worldPos.x * newScale;
    const newY = screenPos.y - worldPos.y * newScale;
    
    onTransformChange({ x: newX, y: newY, scale: newScale });
    debugLog('Zoomed', { zoomFactor, newScale, worldPos });
  }, [getScreenCoordinates, viewTransform, onTransformChange, debugLog]);

  // Touch event handlers
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      // Single touch - treat as mouse
      const mouseEvent = {
        ...event,
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY,
        button: 0,
        buttons: 1,
        movementX: 0,
        movementY: 0,
        relatedTarget: null,
        screenX: event.touches[0].screenX,
        screenY: event.touches[0].screenY,
        shiftKey: false,
        detail: 0
      } as unknown as React.MouseEvent;
      
      handleMouseDown(mouseEvent);
    }
  }, [handleMouseDown]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      // Single touch - treat as mouse
      const mouseEvent = {
        ...event,
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY,
        button: 0,
        buttons: 1,
        movementX: 0,
        movementY: 0,
        relatedTarget: null,
        screenX: event.touches[0].screenX,
        screenY: event.touches[0].screenY,
        shiftKey: false,
        detail: 0
      } as unknown as React.MouseEvent;
      
      handleMouseMove(mouseEvent);
    }
  }, [handleMouseMove]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (event.touches.length === 0) {
      // No more touches - treat as mouse up
      const mouseEvent = {
        ...event,
        clientX: 0,
        clientY: 0,
        button: 0,
        buttons: 0,
        movementX: 0,
        movementY: 0,
        relatedTarget: null,
        screenX: 0,
        screenY: 0,
        shiftKey: false,
        detail: 0
      } as unknown as React.MouseEvent;
      
      handleMouseUp(mouseEvent);
    }
  }, [handleMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
      isPanningRef.current = false;
      selectedPanelRef.current = null;
    };
  }, []);

  return {
    render,
    resizeCanvas,
    getPanelAtPosition,
    performanceMetrics,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}

export default useIntegratedMouseInteraction;
