/**
 * World Coordinate System Constants and Utilities
 * 
 * This module defines the world coordinate system constants and utilities
 * for the panel layout system. All geometry is stored in world units (feet)
 * and converted to screen coordinates only at render time.
 */

// World coordinate system constants
export const WORLD_CONSTANTS = {
  // World dimensions in feet
  WIDTH_FT: 15000,
  HEIGHT_FT: 15000,
  
  // Grid system
  GRID_CELL_SIZE_FT: 1,
  MAJOR_GRID_INTERVAL_FT: 10,
  
  // Snapping
  SNAP_THRESHOLD_FT: 0.5,
  
  // Panel constraints
  MIN_PANEL_WIDTH_FT: 1,
  MIN_PANEL_HEIGHT_FT: 1,
  MAX_PANEL_WIDTH_FT: 1000,
  MAX_PANEL_HEIGHT_FT: 1000,
  
  // Transform limits
  MAX_SCALE: 100,
  MIN_SCALE: 0.01,
  
  // Precision
  EPSILON: 0.001,
  
  // Performance thresholds
  LOW_FPS_THRESHOLD: 30,
  SLOW_RENDER_THRESHOLD_MS: 16,
  MEMORY_WARNING_THRESHOLD_MB: 50,
} as const;

// Precision-safe utilities
export function snapToGrid(value: number, gridSize: number = WORLD_CONSTANTS.GRID_CELL_SIZE_FT): number {
  const snapped = Math.round(value / gridSize) * gridSize;
  return Math.abs(value - snapped) < WORLD_CONSTANTS.EPSILON ? snapped : value;
}

export function snapToGridXY(x: number, y: number, gridSize: number = WORLD_CONSTANTS.GRID_CELL_SIZE_FT): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize)
  };
}

// Panel validation with bounds checking
export function validatePanel(panel: { x: number; y: number; width: number; height: number; id: string }): {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  isValid: boolean;
} {
  const validatedWidth = Math.max(
    WORLD_CONSTANTS.MIN_PANEL_WIDTH_FT,
    Math.min(WORLD_CONSTANTS.MAX_PANEL_WIDTH_FT, panel.width)
  );
  
  const validatedHeight = Math.max(
    WORLD_CONSTANTS.MIN_PANEL_HEIGHT_FT,
    Math.min(WORLD_CONSTANTS.MAX_PANEL_HEIGHT_FT, panel.height)
  );
  
  const validatedX = Math.max(0, Math.min(WORLD_CONSTANTS.WIDTH_FT - validatedWidth, panel.x));
  const validatedY = Math.max(0, Math.min(WORLD_CONSTANTS.HEIGHT_FT - validatedHeight, panel.y));
  
  return {
    ...panel,
    x: validatedX,
    y: validatedY,
    width: validatedWidth,
    height: validatedHeight,
    isValid: true
  };
}

// Safe transform calculations
export function toWorldCoordinates(
  screenX: number, 
  screenY: number, 
  transform: { x: number; y: number; scale: number }
): { x: number; y: number } {
  if (transform.scale <= 0.001) {
    console.warn('Scale too small, returning origin');
    return { x: 0, y: 0 };
  }
  
  const worldX = (screenX - transform.x) / transform.scale;
  const worldY = (screenY - transform.y) / transform.scale;
  
  return {
    x: Math.max(0, Math.min(WORLD_CONSTANTS.WIDTH_FT, worldX)),
    y: Math.max(0, Math.min(WORLD_CONSTANTS.HEIGHT_FT, worldY))
  };
}

export function toScreenCoordinates(
  worldX: number, 
  worldY: number, 
  transform: { x: number; y: number; scale: number }
): { x: number; y: number } {
  return {
    x: worldX * transform.scale + transform.x,
    y: worldY * transform.scale + transform.y
  };
}

// Viewport calculations
export function calculateVisibleWorldRect(
  viewportWidth: number,
  viewportHeight: number,
  transform: { x: number; y: number; scale: number }
): { x: number; y: number; width: number; height: number } {
  return {
    x: -transform.x / transform.scale,
    y: -transform.y / transform.scale,
    width: viewportWidth / transform.scale,
    height: viewportHeight / transform.scale
  };
}

// Grid culling for performance
export function calculateGridLines(
  visibleRect: { x: number; y: number; width: number; height: number },
  gridSize: number = WORLD_CONSTANTS.GRID_CELL_SIZE_FT
): Array<{ type: 'vertical' | 'horizontal'; x?: number; y?: number; startX?: number; startY?: number; endX?: number; endY?: number }> {
  const buffer = gridSize * 10; // 10 grid cells buffer for smoothness
  const startX = Math.max(0, Math.floor((visibleRect.x - buffer) / gridSize) * gridSize);
  const endX = Math.min(WORLD_CONSTANTS.WIDTH_FT, Math.ceil((visibleRect.x + visibleRect.width + buffer) / gridSize) * gridSize);
  const startY = Math.max(0, Math.floor((visibleRect.y - buffer) / gridSize) * gridSize);
  const endY = Math.min(WORLD_CONSTANTS.HEIGHT_FT, Math.ceil((visibleRect.y + visibleRect.height + buffer) / gridSize) * gridSize);
  
  const lines: Array<{ type: 'vertical' | 'horizontal'; x?: number; y?: number; startX?: number; startY?: number; endX?: number; endY?: number }> = [];
  
  // Vertical lines
  for (let gx = startX; gx <= endX; gx += gridSize) {
    lines.push({
      type: 'vertical',
      x: gx,
      startY,
      endY
    });
  }
  
  // Horizontal lines
  for (let gy = startY; gy <= endY; gy += gridSize) {
    lines.push({
      type: 'horizontal',
      y: gy,
      startX,
      endX
    });
  }
  
  return lines;
}

// Performance monitoring utilities
export function checkPerformanceThresholds(
  renderTime: number,
  fps: number,
  memoryUsage?: number
): { isSlowRender: boolean; isLowFps: boolean; isHighMemory: boolean } {
  return {
    isSlowRender: renderTime > WORLD_CONSTANTS.SLOW_RENDER_THRESHOLD_MS,
    isLowFps: fps < WORLD_CONSTANTS.LOW_FPS_THRESHOLD,
    isHighMemory: memoryUsage ? memoryUsage > WORLD_CONSTANTS.MEMORY_WARNING_THRESHOLD_MB : false
  };
}

// Type definitions
export interface WorldTransform {
  x: number;
  y: number;
  scale: number;
}

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridLine {
  type: 'vertical' | 'horizontal';
  x?: number;
  y?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}
