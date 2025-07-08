// Optimized grid and spatial utilities for panel layout

export interface GridCell {
  x: number;
  y: number;
  key: string;
}

export interface SpatialBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelBounds {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Grid constants
export const GRID_CELL_SIZE = 100;
export const SPATIAL_INDEX_CELL_SIZE = 200;
export const SNAP_THRESHOLD = 4;

/**
 * Optimized spatial index for efficient panel proximity queries
 */
export class SpatialIndex {
  private cells: Map<string, Set<string>> = new Map();
  private cellSize: number;

  constructor(cellSize: number = SPATIAL_INDEX_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getCellsForBounds(x: number, y: number, width: number, height: number): string[] {
    const startX = Math.floor(x / this.cellSize);
    const endX = Math.floor((x + width) / this.cellSize);
    const startY = Math.floor(y / this.cellSize);
    const endY = Math.floor((y + height) / this.cellSize);
    
    const cells: string[] = [];
    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        cells.push(`${cx},${cy}`);
      }
    }
    return cells;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(panelId: string, x: number, y: number, width: number, height: number): void {
    const cellKeys = this.getCellsForBounds(x, y, width, height);
    cellKeys.forEach(key => {
      if (!this.cells.has(key)) {
        this.cells.set(key, new Set());
      }
      this.cells.get(key)!.add(panelId);
    });
  }

  query(x: number, y: number, width: number, height: number): Set<string> {
    const cellKeys = this.getCellsForBounds(x, y, width, height);
    const result = new Set<string>();
    cellKeys.forEach(key => {
      const cell = this.cells.get(key);
      if (cell) {
        cell.forEach(panelId => result.add(panelId));
      }
    });
    return result;
  }

  remove(panelId: string, x: number, y: number, width: number, height: number): void {
    const cellKeys = this.getCellsForBounds(x, y, width, height);
    cellKeys.forEach(key => {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(panelId);
        if (cell.size === 0) {
          this.cells.delete(key);
        }
      }
    });
  }
}

/**
 * Optimized grid line calculation with viewport culling
 */
export function calculateGridLines(
  viewport: SpatialBounds,
  gridSize: number = GRID_CELL_SIZE,
  minScale: number = 0.2
): Array<{key: string, x: number, y: number, width: number, height: number}> {
  if (viewport.width <= 0 || viewport.height <= 0) return [];

  const startX = Math.floor(viewport.x / gridSize) * gridSize;
  const endX = Math.ceil((viewport.x + viewport.width) / gridSize) * gridSize;
  const startY = Math.floor(viewport.y / gridSize) * gridSize;
  const endY = Math.ceil((viewport.y + viewport.height) / gridSize) * gridSize;

  const lines: Array<{key: string, x: number, y: number, width: number, height: number}> = [];

  // Vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    lines.push({
      key: `grid-v-${x}`,
      x: x,
      y: startY,
      width: 1,
      height: endY - startY,
    });
  }

  // Horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    lines.push({
      key: `grid-h-${y}`,
      x: startX,
      y: y,
      width: endX - startX,
      height: 1,
    });
  }

  return lines;
}

/**
 * Snap value to grid
 */
export function snapToGrid(value: number, gridSize: number = GRID_CELL_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Check if two bounds overlap
 */
export function boundsOverlap(
  bounds1: SpatialBounds,
  bounds2: SpatialBounds
): boolean {
  return (
    bounds1.x < bounds2.x + bounds2.width &&
    bounds1.x + bounds1.width > bounds2.x &&
    bounds1.y < bounds2.y + bounds2.height &&
    bounds1.y + bounds1.height > bounds2.y
  );
}

/**
 * Calculate distance between two points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is within bounds
 */
export function pointInBounds(
  x: number,
  y: number,
  bounds: SpatialBounds
): boolean {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

/**
 * Calculate bounding box for multiple panels
 */
export function calculateBoundingBox(panels: Array<{x: number, y: number, width: number, length: number}>): SpatialBounds {
  if (panels.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  panels.forEach(panel => {
    minX = Math.min(minX, panel.x);
    minY = Math.min(minY, panel.y);
    maxX = Math.max(maxX, panel.x + panel.width);
    maxY = Math.max(maxY, panel.y + panel.length);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Optimized panel proximity detection using spatial index
 */
export function findNearbyPanels(
  spatialIndex: SpatialIndex,
  panels: Array<{id: string, x: number, y: number, width: number, length: number}>,
  x: number,
  y: number,
  width: number,
  height: number,
  excludeId?: string
): Array<{id: string, x: number, y: number, width: number, length: number}> {
  const nearbyIds = spatialIndex.query(x - SNAP_THRESHOLD, y - SNAP_THRESHOLD, width + SNAP_THRESHOLD * 2, height + SNAP_THRESHOLD * 2);
  return panels.filter(p => p.id !== excludeId && nearbyIds.has(p.id));
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Check if element is in viewport with margin
 */
export function isInViewport(
  elementBounds: SpatialBounds,
  viewport: SpatialBounds,
  margin: number = 100
): boolean {
  return (
    elementBounds.x + elementBounds.width >= viewport.x - margin &&
    elementBounds.x <= viewport.x + viewport.width + margin &&
    elementBounds.y + elementBounds.height >= viewport.y - margin &&
    elementBounds.y <= viewport.y + viewport.height + margin
  );
}

/**
 * Calculate optimal grid size based on zoom level
 */
export function getOptimalGridSize(scale: number): number {
  if (scale < 0.1) return 500;
  if (scale < 0.5) return 200;
  if (scale < 1) return 100;
  if (scale < 2) return 50;
  return 25;
}

/**
 * Generate unique grid cell keys for efficient rendering
 */
export function generateGridKeys(viewport: SpatialBounds, gridSize: number): string[] {
  const keys: string[] = [];
  const startX = Math.floor(viewport.x / gridSize);
  const endX = Math.ceil((viewport.x + viewport.width) / gridSize);
  const startY = Math.floor(viewport.y / gridSize);
  const endY = Math.ceil((viewport.y + viewport.height) / gridSize);

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      keys.push(`${x},${y}`);
    }
  }

  return keys;
} 