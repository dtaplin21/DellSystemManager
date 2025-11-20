'use client';

import React, { useRef, useCallback, useEffect } from 'react';

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface SimpleCanvasProps {
  panels: Panel[];
  canvasState: CanvasState;
  selectedPanelId: string | null;
  onPanelUpdate: (id: string, updates: Partial<Panel>) => void;
  onCanvasUpdate: (updates: Partial<CanvasState>) => void;
  onPanelSelect: (id: string | null) => void;
}

export function SimpleCanvas({
  panels,
  canvasState,
  selectedPanelId,
  onPanelUpdate,
  onCanvasUpdate,
  onPanelSelect
}: SimpleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragPanelId = useRef<string | null>(null);
  
  // Simple coordinate conversion
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - canvasState.offsetX) / canvasState.scale,
      y: (screenY - canvasState.offsetY) / canvasState.scale
    };
  }, [canvasState]);
  
  // Simple hit detection
  const getPanelAt = useCallback((worldX: number, worldY: number) => {
    return panels.find(panel => 
      worldX >= panel.x && 
      worldX <= panel.x + panel.width &&
      worldY >= panel.y && 
      worldY <= panel.y + panel.height
    ) || null;
  }, [panels]);
  
  // Simple render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear and setup transform
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvasState.offsetX, canvasState.offsetY);
    ctx.scale(canvasState.scale, canvasState.scale);
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1 / canvasState.scale;
    const gridSize = 10; // Match PIXELS_PER_FOOT
    
    for (let x = 0; x < 1000; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1000);
      ctx.stroke();
    }
    
    for (let y = 0; y < 1000; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1000, y);
      ctx.stroke();
    }
    
    // Draw panels
    panels.forEach(panel => {
      ctx.fillStyle = panel.id === selectedPanelId ? '#3b82f6' : '#6b7280';
      ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
      
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2 / canvasState.scale;
      ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
    });
    
    ctx.restore();
  }, [panels, canvasState, selectedPanelId]);
  
  // Event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    
    const clickedPanel = getPanelAt(worldPos.x, worldPos.y);
    
    if (clickedPanel) {
      // Start dragging panel
      isDragging.current = true;
      dragPanelId.current = clickedPanel.id;
      dragStartRef.current = { 
        x: worldPos.x - clickedPanel.x, 
        y: worldPos.y - clickedPanel.y 
      };
      onPanelSelect(clickedPanel.id);
    } else {
      // Start panning canvas
      isDragging.current = true;
      dragPanelId.current = null;
      dragStartRef.current = { x: screenX, y: screenY };
      onPanelSelect(null);
    }
  }, [screenToWorld, getPanelAt, onPanelSelect]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    if (dragPanelId.current) {
      // Drag panel
      const worldPos = screenToWorld(screenX, screenY);
      const newX = worldPos.x - dragStartRef.current.x;
      const newY = worldPos.y - dragStartRef.current.y;
      
      // Find the panel to get its current rotation
      const panel = panels.find(p => p.id === dragPanelId.current);
      const currentRotation = panel?.rotation || 0;
      
      onPanelUpdate(dragPanelId.current, { x: newX, y: newY, rotation: currentRotation });
    } else {
      // Pan canvas
      const deltaX = screenX - dragStartRef.current.x;
      const deltaY = screenY - dragStartRef.current.y;
      
      onCanvasUpdate({
        offsetX: canvasState.offsetX + deltaX,
        offsetY: canvasState.offsetY + deltaY
      });
      
      dragStartRef.current = { x: screenX, y: screenY };
    }
  }, [screenToWorld, canvasState, onPanelUpdate, onCanvasUpdate]);
  
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragPanelId.current = null;
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, canvasState.scale * zoomFactor));
    
    const newOffsetX = mouseX - worldPos.x * newScale;
    const newOffsetY = mouseY - worldPos.y * newScale;
    
    onCanvasUpdate({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    });
  }, [screenToWorld, canvasState, onCanvasUpdate]);
  
  // Render on changes
  useEffect(() => {
    render();
  }, [render]);
  
  // Resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      render();
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [render]);
  
  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas-main"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{ 
        width: '100%', 
        height: '100%',
        cursor: isDragging.current ? 'grabbing' : 'grab'
      }}
    />
  );
}
