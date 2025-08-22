export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface WorldToScreenResult {
  x: number;
  y: number;
}

export interface ScreenToWorldResult {
  x: number;
  y: number;
}

export function worldToScreen(
  wx: number, 
  wy: number, 
  worldScale: number, 
  scale: number, 
  offsetX: number, 
  offsetY: number
): WorldToScreenResult {
  const totalScale = worldScale * scale;
  return {
    x: Math.round((wx * totalScale + offsetX) * 1000) / 1000,
    y: Math.round((wy * totalScale + offsetY) * 1000) / 1000
  };
}

export function screenToWorld(
  sx: number, 
  sy: number, 
  worldScale: number, 
  scale: number, 
  offsetX: number, 
  offsetY: number
): ScreenToWorldResult {
  const totalScale = worldScale * scale;
  return {
    x: Math.round(((sx - offsetX) / totalScale) * 1000) / 1000,
    y: Math.round(((sy - offsetY) / totalScale) * 1000) / 1000
  };
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}
