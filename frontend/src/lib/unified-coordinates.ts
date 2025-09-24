/**
 * Unified Coordinate System for Solar Panel Layout Tool
 * 
 * This system eliminates the dual world/screen coordinate complexity by using
 * a single coordinate system where pixels directly represent feet with a 
 * configurable scale ratio.
 */

// Core configuration
export const PIXELS_PER_FOOT = 10; // 10 pixels = 1 foot (significantly larger for better visibility)
export const GRID_SIZE_PIXELS = 10; // 10px = 1 foot (grid every foot)
export const MAJOR_GRID_INTERVAL = 10; // Every 10 grid lines = 10 feet

// Grid configuration
export const GRID_CONFIG = {
  minorSpacing: GRID_SIZE_PIXELS, // 10px = 1 foot
  majorSpacing: GRID_SIZE_PIXELS * MAJOR_GRID_INTERVAL, // 5px = 10 feet
  minorColor: '#e5e7eb',
  majorColor: '#d1d5db',
  lineWidth: 1
} as const;

// Unified canvas state interface
export interface UnifiedCanvasState {
  pixelsPerFoot: number;
  offsetX: number;
  offsetY: number;
  showGrid: boolean;
  snapToGrid: boolean;
}

// Unified panel interface (coordinates in pixels)
export interface UnifiedPanel {
  id: string;
  x: number; // Pixels (directly maps to feet)
  y: number; // Pixels (directly maps to feet)
  width: number; // Pixels (directly maps to feet)
  height: number; // Pixels (directly maps to feet)
  rotation?: number;
  isValid: boolean;
  shape?: 'rectangle' | 'right-triangle' | 'patch';
  // Additional panel properties
  type?: string;
  model?: string;
  manufacturer?: string;
  power?: number;
  efficiency?: number;
  panelNumber?: string;
  rollNumber?: string;
  color?: string;
  fill?: string;
  date?: string;
  location?: string;
  meta?: {
    repairs?: any[];
    airTest?: { result: string };
  };
  points?: any[];
  radius?: number;
}

// Coordinate conversion utilities
export class UnifiedCoordinates {
  constructor(private pixelsPerFoot: number = PIXELS_PER_FOOT) {}

  // Convert pixels to feet
  pixelsToFeet(pixels: number): number {
    return pixels / this.pixelsPerFoot;
  }

  // Convert feet to pixels
  feetToPixels(feet: number): number {
    return feet * this.pixelsPerFoot;
  }

  // Convert panel coordinates from pixels to feet for display
  panelToFeet(panel: UnifiedPanel): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.pixelsToFeet(panel.x),
      y: this.pixelsToFeet(panel.y),
      width: this.pixelsToFeet(panel.width),
      height: this.pixelsToFeet(panel.height)
    };
  }

  // Convert panel coordinates from feet to pixels for storage
  panelToPixels(panel: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.feetToPixels(panel.x),
      y: this.feetToPixels(panel.y),
      width: this.feetToPixels(panel.width),
      height: this.feetToPixels(panel.height)
    };
  }

  // Snap coordinates to grid
  snapToGrid(value: number, gridSize: number = GRID_SIZE_PIXELS): number {
    return Math.round(value / gridSize) * gridSize;
  }

  // Get grid lines for rendering
  getGridLines(canvasWidth: number, canvasHeight: number, offsetX: number, offsetY: number) {
    const lines = {
      vertical: [] as number[],
      horizontal: [] as number[]
    };

    // Vertical lines
    for (let x = 0; x <= canvasWidth; x += GRID_SIZE_PIXELS) {
      lines.vertical.push(x);
    }

    // Horizontal lines
    for (let y = 0; y <= canvasHeight; y += GRID_SIZE_PIXELS) {
      lines.horizontal.push(y);
    }

    return lines;
  }
}

// Default instance
export const unifiedCoords = new UnifiedCoordinates(PIXELS_PER_FOOT);

// Utility functions for backward compatibility
export const pixelsToFeet = (pixels: number): number => unifiedCoords.pixelsToFeet(pixels);
export const feetToPixels = (feet: number): number => unifiedCoords.feetToPixels(feet);
export const snapToGrid = (value: number, gridSize: number = GRID_SIZE_PIXELS): number => 
  unifiedCoords.snapToGrid(value, gridSize);
