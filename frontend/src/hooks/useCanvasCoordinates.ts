import { useCallback } from 'react';

interface CanvasState {
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
}

interface UseCanvasCoordinatesOptions {
  canvasState: CanvasState;
}

interface UseCanvasCoordinatesReturn {
  getWorldCoordinates: (screenX: number, screenY: number) => { x: number; y: number };
  getScreenCoordinates: (worldX: number, worldY: number) => { x: number; y: number };
}

/**
 * Simple hook for coordinate transformations only
 * Used by components that need coordinate conversion without full canvas functionality
 */
export function useCanvasCoordinates({
  canvasState,
}: UseCanvasCoordinatesOptions): UseCanvasCoordinatesReturn {
  
  const getWorldCoordinates = useCallback((screenX: number, screenY: number) => {
    const x = (screenX - canvasState.worldOffsetX) / canvasState.worldScale;
    const y = (screenY - canvasState.worldOffsetY) / canvasState.worldScale;
    return { x, y };
  }, [canvasState.worldOffsetX, canvasState.worldOffsetY, canvasState.worldScale]);

  const getScreenCoordinates = useCallback((worldX: number, worldY: number) => {
    const x = worldX * canvasState.worldScale + canvasState.worldOffsetX;
    const y = worldY * canvasState.worldScale + canvasState.worldOffsetY;
    return { x, y };
  }, [canvasState.worldOffsetX, canvasState.worldOffsetY, canvasState.worldScale]);

  return {
    getWorldCoordinates,
    getScreenCoordinates,
  };
}
