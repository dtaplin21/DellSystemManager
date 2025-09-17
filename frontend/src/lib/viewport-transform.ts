// VIEWPORT TRANSFORM UTILITIES
// Shared viewport transformation logic for geosynthetic liner system

export interface ViewportState {
  scale: number;        // Pixels per foot (dynamic)
  centerX: number;      // World X coordinate at viewport center (feet)
  centerY: number;      // World Y coordinate at viewport center (feet)
  canvasWidth: number;  // Canvas pixel dimensions
  canvasHeight: number;
}

export class ViewportTransform {
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
  
  // Zoom to fit entire site
  fitToSite(siteWidth: number, siteHeight: number, minScale: number, maxScale: number): Partial<ViewportState> {
    const scaleX = this.viewport.canvasWidth / siteWidth;
    const scaleY = this.viewport.canvasHeight / siteHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add padding
    
    return {
      scale: Math.max(minScale, Math.min(maxScale, scale)),
      centerX: siteWidth / 2,
      centerY: siteHeight / 2
    };
  }
}
