'use client';

import React, { useRef, useCallback, useEffect } from 'react';

interface LinerRoll {
  id: string;
  x: number;           // World coordinates in FEET
  y: number;           // World coordinates in FEET  
  width: number;       // Roll width in FEET (typically 15-25 feet)
  length: number;      // Roll length in FEET (varies widely)
  rotation?: number;   // Rotation in degrees
  rollNumber?: string; // Roll identification number
  panelNumber?: string; // Panel/section number (keeping your existing terminology)
  material?: string;   // Liner material type
  thickness?: number;  // Material thickness in mils
}

interface ViewportState {
  // Viewport transforms - handles all scaling
  scale: number;        // Pixels per foot (dynamic)
  centerX: number;      // World X coordinate at viewport center (feet)
  centerY: number;      // World Y coordinate at viewport center (feet)
  canvasWidth: number;  // Canvas pixel dimensions
  canvasHeight: number;
}

// SITE CONFIGURATION FOR GEOSYNTHETIC LINERS
const SITE_CONFIG = {
  // Typical liner roll dimensions (feet)
  TYPICAL_ROLL_WIDTH: 20,    // 20 feet wide rolls are common
  TYPICAL_ROLL_LENGTH: 100,  // Variable length, 100ft example
  
  // Site dimensions for 200 rolls east-west, 50 north-south
  SITE_WIDTH: 4000,   // 200 rolls × 20ft width
  SITE_HEIGHT: 5000,  // 50 rolls × 100ft length
  
  // Viewport limits
  MIN_SCALE: 0.02,    // Very zoomed out to see entire large site
  MAX_SCALE: 10,      // Zoomed in for detail work
  
  // Grid settings (feet)
  GRID_SIZE: 10,      // 10-foot grid lines
  MAJOR_GRID: 50,     // 50-foot major grid lines
  
  // Roll spacing
  MIN_OVERLAP: 1,     // Minimum 1-foot overlap between rolls
  SEAM_WIDTH: 2       // 2-foot seam allowance
};

// VIEWPORT UTILITIES
class ViewportTransform {
  constructor(private viewport: ViewportState) {}
  
  // Convert world coordinates (feet) to screen coordinates (pixels)
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const screenX = (worldX - this.viewport.centerX) * this.viewport.scale + this.viewport.canvasWidth / 2;
    const screenY = (worldY - this.viewport.centerY) * this.viewport.scale + this.viewport.canvasHeight / 2;
    return { x: screenX, y: screenY };
  }
  
  // Convert screen coordinates (pixels) to world coordinates (feet)
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const worldX = (screenX - this.viewport.canvasWidth / 2) / this.viewport.scale + this.viewport.centerX;
    const worldY = (screenY - this.viewport.canvasHeight / 2) / this.viewport.scale + this.viewport.centerY;
    return { x: worldX, y: worldY };
  }
  
  // Get visible world bounds
  getVisibleBounds(): { left: number; top: number; right: number; bottom: number } {
    const halfWidth = this.viewport.canvasWidth / (2 * this.viewport.scale);
    const halfHeight = this.viewport.canvasHeight / (2 * this.viewport.scale);
    
    return {
      left: this.viewport.centerX - halfWidth,
      right: this.viewport.centerX + halfWidth,
      top: this.viewport.centerY - halfHeight,
      bottom: this.viewport.centerY + halfHeight
    };
  }
}

interface LinerCanvasProps {
  rolls: LinerRoll[];
  viewport: ViewportState;
  selectedRollId: string | null;
  onRollUpdate: (id: string, updates: Partial<LinerRoll>) => void;
  onViewportUpdate: (updates: Partial<ViewportState>) => void;
  onRollSelect: (id: string | null) => void;
}

export function LinerCanvas({
  rolls,
  viewport,
  selectedRollId,
  onRollUpdate,
  onViewportUpdate,
  onRollSelect
}: LinerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, worldX: 0, worldY: 0 });
  const dragRollId = useRef<string | null>(null);
  const transform = useRef(new ViewportTransform(viewport));
  
  // Update transform when viewport changes
  useEffect(() => {
    transform.current = new ViewportTransform(viewport);
  }, [viewport]);
  
  // Optimized roll hit detection
  const getRollAt = useCallback((worldX: number, worldY: number): LinerRoll | null => {
    // Test rolls in reverse order (top to bottom in rendering)
    for (let i = rolls.length - 1; i >= 0; i--) {
      const roll = rolls[i];
      if (worldX >= roll.x && 
          worldX <= roll.x + roll.width &&
          worldY >= roll.y && 
          worldY <= roll.y + roll.length) {
        return roll;
      }
    }
    return null;
  }, [rolls]);
  
  // Optimized rendering with viewport culling
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get visible bounds for culling
    const bounds = transform.current.getVisibleBounds();
    
    // Set up world coordinate system
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(viewport.scale, viewport.scale);
    ctx.translate(-viewport.centerX, -viewport.centerY);
    
    // Draw grid (only visible portion)
    drawGrid(ctx, bounds, viewport.scale);
    
    // Draw rolls (only visible ones)
    const visibleRolls = rolls.filter(roll => 
      roll.x + roll.width >= bounds.left &&
      roll.x <= bounds.right &&
      roll.y + roll.length >= bounds.top &&
      roll.y <= bounds.bottom
    );
    
    visibleRolls.forEach(roll => {
      drawRoll(ctx, roll, roll.id === selectedRollId, viewport.scale);
    });
    
    ctx.restore();
    
    // Draw UI overlay (in screen coordinates)
    drawUIOverlay(ctx, canvas, viewport, rolls.length, visibleRolls.length);
  }, [rolls, viewport, selectedRollId]);
  
  // Grid drawing function
  function drawGrid(ctx: CanvasRenderingContext2D, bounds: any, scale: number) {
    const lineWidth = Math.max(0.5, 1 / scale);
    
    // Major grid lines (every 50 feet)
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = lineWidth * 2;
    
    const majorStart = Math.floor(bounds.left / SITE_CONFIG.MAJOR_GRID) * SITE_CONFIG.MAJOR_GRID;
    const majorEnd = Math.ceil(bounds.right / SITE_CONFIG.MAJOR_GRID) * SITE_CONFIG.MAJOR_GRID;
    
    for (let x = majorStart; x <= majorEnd; x += SITE_CONFIG.MAJOR_GRID) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.top);
      ctx.lineTo(x, bounds.bottom);
      ctx.stroke();
    }
    
    const majorYStart = Math.floor(bounds.top / SITE_CONFIG.MAJOR_GRID) * SITE_CONFIG.MAJOR_GRID;
    const majorYEnd = Math.ceil(bounds.bottom / SITE_CONFIG.MAJOR_GRID) * SITE_CONFIG.MAJOR_GRID;
    
    for (let y = majorYStart; y <= majorYEnd; y += SITE_CONFIG.MAJOR_GRID) {
      ctx.beginPath();
      ctx.moveTo(bounds.left, y);
      ctx.lineTo(bounds.right, y);
      ctx.stroke();
    }
    
    // Minor grid lines (only when zoomed in enough)
    if (scale > 0.1) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = lineWidth;
      
      const minorStart = Math.floor(bounds.left / SITE_CONFIG.GRID_SIZE) * SITE_CONFIG.GRID_SIZE;
      const minorEnd = Math.ceil(bounds.right / SITE_CONFIG.GRID_SIZE) * SITE_CONFIG.GRID_SIZE;
      
      for (let x = minorStart; x <= minorEnd; x += SITE_CONFIG.GRID_SIZE) {
        if (x % SITE_CONFIG.MAJOR_GRID !== 0) {
          ctx.beginPath();
          ctx.moveTo(x, bounds.top);
          ctx.lineTo(x, bounds.bottom);
          ctx.stroke();
        }
      }
      
      const minorYStart = Math.floor(bounds.top / SITE_CONFIG.GRID_SIZE) * SITE_CONFIG.GRID_SIZE;
      const minorYEnd = Math.ceil(bounds.bottom / SITE_CONFIG.GRID_SIZE) * SITE_CONFIG.GRID_SIZE;
      
      for (let y = minorYStart; y <= minorYEnd; y += SITE_CONFIG.GRID_SIZE) {
        if (y % SITE_CONFIG.MAJOR_GRID !== 0) {
          ctx.beginPath();
          ctx.moveTo(bounds.left, y);
          ctx.lineTo(bounds.right, y);
          ctx.stroke();
        }
      }
    }
  }
  
  // Roll drawing function
  function drawRoll(ctx: CanvasRenderingContext2D, roll: LinerRoll, isSelected: boolean, scale: number) {
    const lineWidth = Math.max(0.5, 2 / scale);
    
    // Roll fill - different colors for different materials
    const materialColors = {
      'HDPE': isSelected ? '#2563eb' : '#3b82f6',
      'LLDPE': isSelected ? '#059669' : '#10b981',
      'PVC': isSelected ? '#dc2626' : '#ef4444',
      'EPDM': isSelected ? '#7c2d12' : '#a3472a'
    };
    
    ctx.fillStyle = materialColors[roll.material as keyof typeof materialColors] || '#6b7280';
    ctx.fillRect(roll.x, roll.y, roll.width, roll.length);
    
    // Roll border
    ctx.strokeStyle = isSelected ? '#1e40af' : '#374151';
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(roll.x, roll.y, roll.width, roll.length);
    
    // Seam indicator (darker edge)
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = lineWidth * 2;
    ctx.beginPath();
    ctx.moveTo(roll.x + roll.width, roll.y);
    ctx.lineTo(roll.x + roll.width, roll.y + roll.length);
    ctx.stroke();
    
    // Roll label (only when zoomed in enough)
    if (scale > 0.5) {
      const fontSize = Math.max(8, 16 / scale);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = 'center';
      
      // Roll number
      ctx.fillText(
        roll.rollNumber || roll.id,
        roll.x + roll.width / 2,
        roll.y + roll.length / 2 - fontSize / 4
      );
      
      // Material and thickness (when very zoomed in)
      if (scale > 2) {
        ctx.font = `${fontSize * 0.7}px Arial`;
        ctx.fillText(
          `${roll.material} ${roll.thickness}mil`,
          roll.x + roll.width / 2,
          roll.y + roll.length / 2 + fontSize / 2
        );
      }
    }
  }
  
  // UI overlay drawing
  function drawUIOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, viewport: ViewportState, totalRolls: number, visibleRolls: number) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 220, 100);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Scale: ${viewport.scale.toFixed(3)}px/ft`, 20, 30);
    ctx.fillText(`Center: ${viewport.centerX.toFixed(0)}, ${viewport.centerY.toFixed(0)} ft`, 20, 45);
    ctx.fillText(`Rolls: ${visibleRolls}/${totalRolls}`, 20, 60);
    ctx.fillText(`Site: ${SITE_CONFIG.SITE_WIDTH} × ${SITE_CONFIG.SITE_HEIGHT} ft`, 20, 75);
    ctx.fillText(`Coverage: ${(totalRolls * SITE_CONFIG.TYPICAL_ROLL_WIDTH * SITE_CONFIG.TYPICAL_ROLL_LENGTH / 43560).toFixed(1)} acres`, 20, 90);
  }
  
  // Event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = transform.current.screenToWorld(screenX, screenY);
    
    const clickedRoll = getRollAt(worldPos.x, worldPos.y);
    
    isDragging.current = true;
    dragStartRef.current = { 
      x: screenX, 
      y: screenY,
      worldX: worldPos.x,
      worldY: worldPos.y
    };
    
    if (clickedRoll) {
      dragRollId.current = clickedRoll.id;
      onRollSelect(clickedRoll.id);
    } else {
      dragRollId.current = null;
      onRollSelect(null);
    }
  }, [getRollAt, onRollSelect]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    if (dragRollId.current) {
      // Drag roll
      const worldPos = transform.current.screenToWorld(screenX, screenY);
      const roll = rolls.find(r => r.id === dragRollId.current);
      
      if (roll) {
        const deltaX = worldPos.x - dragStartRef.current.worldX;
        const deltaY = worldPos.y - dragStartRef.current.worldY;
        
        onRollUpdate(dragRollId.current, { 
          x: roll.x + deltaX, 
          y: roll.y + deltaY 
        });
        
        dragStartRef.current.worldX = worldPos.x;
        dragStartRef.current.worldY = worldPos.y;
      }
    } else {
      // Pan viewport
      const deltaScreenX = screenX - dragStartRef.current.x;
      const deltaScreenY = screenY - dragStartRef.current.y;
      
      const deltaWorldX = deltaScreenX / viewport.scale;
      const deltaWorldY = deltaScreenY / viewport.scale;
      
      onViewportUpdate({
        centerX: viewport.centerX - deltaWorldX,
        centerY: viewport.centerY - deltaWorldY
      });
      
      dragStartRef.current.x = screenX;
      dragStartRef.current.y = screenY;
    }
  }, [rolls, viewport, onRollUpdate, onViewportUpdate]);
  
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragRollId.current = null;
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = transform.current.screenToWorld(screenX, screenY);
    
    const zoomFactor = e.deltaY > 0 ? 0.8 : 1.25;
    const newScale = Math.max(
      SITE_CONFIG.MIN_SCALE, 
      Math.min(SITE_CONFIG.MAX_SCALE, viewport.scale * zoomFactor)
    );
    
    // Keep the mouse position fixed in world coordinates
    const newCenterX = worldPos.x + (viewport.centerX - worldPos.x) * (viewport.scale / newScale);
    const newCenterY = worldPos.y + (viewport.centerY - worldPos.y) * (viewport.scale / newScale);
    
    onViewportUpdate({
      scale: newScale,
      centerX: newCenterX,
      centerY: newCenterY
    });
  }, [viewport, onViewportUpdate]);
  
  // Render on changes
  useEffect(() => {
    render();
  }, [render]);
  
  // Canvas resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      onViewportUpdate({
        canvasWidth: rect.width,
        canvasHeight: rect.height
      });
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [onViewportUpdate]);
  
  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{ 
        width: '100%', 
        height: '100%',
        cursor: isDragging.current 
          ? (dragRollId.current ? 'grabbing' : 'move') 
          : 'crosshair',
        touchAction: 'none'
      }}
    />
  );
}
