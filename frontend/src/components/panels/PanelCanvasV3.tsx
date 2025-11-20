'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Panel } from '@/types/panel';
import { useIntegratedMouseInteraction } from '@/hooks/useIntegratedMouseInteraction';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useCanvasState, usePanelState } from '@/contexts/PanelContextV2';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

interface PanelCanvasV3Props {
  panels: Panel[];
  onPanelUpdate: (panelId: string, updates: Partial<Panel>) => void;
  enableDebugLogging?: boolean;
}

/**
 * Phase 3 Panel Canvas Component
 * Integrates world coordinates, Phase 2 state management, and optimized rendering
 */
export function PanelCanvasV3({ 
  panels, 
  onPanelUpdate, 
  enableDebugLogging = false 
}: PanelCanvasV3Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  
  // Canvas state from context
  const { canvas, selectPanel, setTransform } = useCanvasState();
  const { panels: contextPanels } = usePanelState();
  
  // Use actual panels from context if available, otherwise use props
  const actualPanels = contextPanels.panels.length > 0 ? contextPanels.panels : panels;
  
  // Zoom/Pan hook
  const {
    x,
    y,
    scale,
    toWorld,
    toScreen,
    visibleWorldRect,
    onWheel,
    onDragStart,
    onDragMove,
    onDragEnd,
    fitToExtent,
    setViewportSize: setZoomPanViewportSize
  } = useZoomPan({
    worldWidth: WORLD_CONSTANTS.WIDTH_FT,
    worldHeight: WORLD_CONSTANTS.HEIGHT_FT,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    initialFit: 'extent',
    enablePerformanceMonitoring: true,
    onTransformChange: (newTransform) => {
      setTransform(newTransform);
    }
  });

  // Create transform object with useMemo to prevent re-renders
  const transform = useMemo(() => ({ x, y, scale }), [x, y, scale]);

  // Integrated mouse interaction
  const {
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
  } = useIntegratedMouseInteraction({
    canvas: canvasRef.current,
    panels: actualPanels,
    viewTransform: {
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      toWorld,
      toScreen,
      visibleWorldRect
    },
    selectedPanelId: canvas.selectedPanelId,
    renderingQuality: canvas.isLowPerformance ? 'low' : 'high',
    onPanelUpdate,
    onPanelSelect: selectPanel,
    onTransformChange: setTransform,
    enableDebugLogging
  });

  // Handle viewport resize
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const newSize = { width: rect.width, height: rect.height };
    
    if (newSize.width !== viewportSize.width || newSize.height !== viewportSize.height) {
      setViewportSize(newSize);
      setZoomPanViewportSize(newSize.width, newSize.height);
      resizeCanvas(newSize.width, newSize.height);
    }
  }, [viewportSize, setZoomPanViewportSize, resizeCanvas]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewportSize({ width, height });
        setZoomPanViewportSize(width, height);
        resizeCanvas(width, height);
      }
    });
    
    observer.observe(containerRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [setZoomPanViewportSize, resizeCanvas]);

  // Window resize listener
  useEffect(() => {
    const handleWindowResize = () => {
      handleResize();
    };
    
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleResize]);

  // Initial resize
  useEffect(() => {
    handleResize();
  }, [handleResize]);

  // Render when data changes
  useEffect(() => {
    render();
  }, [render, actualPanels, canvas.selectedPanelId, transform]);

  // Debug logging
  useEffect(() => {
    if (enableDebugLogging) {
      console.log('PanelCanvasV3 render:', {
        panelCount: actualPanels.length,
        selectedPanel: canvas.selectedPanelId,
        transform,
        viewportSize,
        performanceMetrics
      });
    }
  }, [actualPanels.length, canvas.selectedPanelId, transform, viewportSize, performanceMetrics, enableDebugLogging]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gray-100"
    >
      <canvas
        ref={canvasRef}
        data-testid="canvas-main"
        width={viewportSize.width}
        height={viewportSize.height}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
      />
      
      {/* Debug overlay */}
      {enableDebugLogging && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div><strong>Phase 3 Canvas Debug</strong></div>
          <div>Panels: {actualPanels.length}</div>
          <div>Selected: {canvas.selectedPanelId || 'None'}</div>
          <div>Scale: {transform.scale.toFixed(3)}</div>
          <div>Offset: ({transform.x.toFixed(1)}, {transform.y.toFixed(1)})</div>
          <div>Viewport: {viewportSize.width}x{viewportSize.height}</div>
          <div>Render Time: {performanceMetrics.renderTime.toFixed(2)}ms</div>
          <div>FPS: {performanceMetrics.frameCount > 0 ? (1000 / performanceMetrics.renderTime).toFixed(1) : 'N/A'}</div>
          <div>Low Perf: {performanceMetrics.isLowPerf ? 'Yes' : 'No'}</div>
        </div>
      )}
      
      {/* Instructions overlay */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
        <div><strong>Phase 3 Controls:</strong></div>
        <div>• Mouse wheel: Zoom in/out</div>
        <div>• Mouse drag: Pan around</div>
        <div>• Click panels: Select them</div>
        <div>• Drag panels: Move them (world units)</div>
        <div>• Touch: Mobile support</div>
      </div>
    </div>
  );
}

export default PanelCanvasV3;
