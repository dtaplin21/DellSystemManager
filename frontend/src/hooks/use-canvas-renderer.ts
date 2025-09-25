import { useCallback } from 'react'
import type { Panel } from '@/types/panel'
import { worldToScreen, screenToWorld, snapToGrid } from '../lib/geometry'

export interface CanvasState {
  scale: number
  offsetX: number
  offsetY: number
  showGrid: boolean
  showGuides: boolean
  snapToGrid: boolean
  gridSize: number
  worldWidth: number
  worldHeight: number
  worldScale: number
}

export interface UseCanvasRendererReturn {
  renderCanvas: () => void
  drawGrid: (ctx: CanvasRenderingContext2D) => void
  drawPanel: (ctx: CanvasRenderingContext2D, panel: Panel, isSelected: boolean) => void
  drawSelectionHandles: (ctx: CanvasRenderingContext2D, panel: Panel) => void
  worldToScreen: (wx: number, wy: number) => { x: number; y: number }
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
}

export interface UseCanvasRendererOptions {
  panels: Panel[]
  canvasState: CanvasState
  canvasWidth: number
  canvasHeight: number
  selectedPanelId: string | null
  getCurrentCanvas: () => HTMLCanvasElement | null
  isValidPanel: (panel: any) => panel is Panel
  getPanelValidationErrors: (panel: any) => string[]
  drawGrid: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
  getWorldDimensions?: () => { worldWidth: number; worldHeight: number; worldScale: number }
  getCanvasState?: () => CanvasState
}

export const useCanvasRenderer = (options: UseCanvasRendererOptions): UseCanvasRendererReturn => {
  const {
    panels,
    canvasState,
    canvasWidth,
    canvasHeight,
    selectedPanelId,
    getCurrentCanvas,
    isValidPanel,
    getPanelValidationErrors,
    drawGrid,
    getWorldDimensions,
    getCanvasState
  } = options

  // Coordinate transformation helpers
  const worldToScreenCoord = useCallback((wx: number, wy: number) => {
    // Use dynamic state if available, otherwise fall back to canvasState
    const currentCanvasState = getCanvasState ? getCanvasState() : canvasState;
    const worldScale = getWorldDimensions ? getWorldDimensions().worldScale : currentCanvasState.worldScale;
    return worldToScreen(wx, wy, worldScale, currentCanvasState.scale, currentCanvasState.offsetX, currentCanvasState.offsetY)
  }, [getWorldDimensions, getCanvasState, canvasState])

  const screenToWorldCoord = useCallback((sx: number, sy: number) => {
    // Use dynamic state if available, otherwise fall back to canvasState
    const currentCanvasState = getCanvasState ? getCanvasState() : canvasState;
    const worldScale = getWorldDimensions ? getWorldDimensions().worldScale : currentCanvasState.worldScale;
    return screenToWorld(sx, sy, worldScale, currentCanvasState.scale, currentCanvasState.offsetX, currentCanvasState.offsetY)
  }, [getWorldDimensions, getCanvasState, canvasState])

  // Draw panel
  const drawPanel = useCallback((ctx: CanvasRenderingContext2D, panel: Panel, isSelected: boolean) => {
    // Panel dimension validation using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[useCanvasRenderer] Cannot draw invalid panel:', { panel, errors });
      return;
    }
    
    // Get the current canvas for proper coordinate calculations
    const canvas = getCurrentCanvas();
    if (!canvas) return;
    
    // Convert world coordinates (feet) to screen coordinates (pixels)
    // Use the geometry utility functions for proper transformation
    // Use dynamic state if available, otherwise fall back to canvasState
    const currentCanvasState = getCanvasState ? getCanvasState() : canvasState;
    const worldScale = getWorldDimensions ? getWorldDimensions().worldScale : currentCanvasState.worldScale;
    const screenPos = worldToScreen(panel.x, panel.y, worldScale, currentCanvasState.scale, currentCanvasState.offsetX, currentCanvasState.offsetY);
    const screenWidth = panel.width * worldScale * currentCanvasState.scale;
    const screenHeight = panel.height * worldScale * currentCanvasState.scale;
    
    // Debug: Log exact values used for rendering to check for precision issues
    if (Math.abs(worldScale - (getCanvasState ? getCanvasState().worldScale : canvasState.worldScale)) > 0.001) {
      console.log('[DEBUG] Panel rendering values:', {
        id: panel.id,
        shape: panel.shape,
        worldCoords: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
        worldScale,
        canvasScale: currentCanvasState.scale,
        totalScale: worldScale * currentCanvasState.scale,
        screenCoords: { x: screenPos.x, y: screenPos.y, width: screenWidth, height: screenHeight },
        precision: {
          x: panel.x.toString().split('.')[1]?.length || 0,
          y: panel.y.toString().split('.')[1]?.length || 0,
          width: panel.width.toString().split('.')[1]?.length || 0,
          height: panel.height.toString().split('.')[1]?.length || 0
        }
      });
    }
    
    // Check if panel is completely outside canvas bounds (with some margin)
    const margin = 100; // pixels
    if (screenPos.x + screenWidth < -margin || screenPos.x > canvas.clientWidth + margin || 
        screenPos.y + screenHeight < -margin || screenPos.y > canvas.clientHeight + margin) {
      return;
    }
    
    ctx.save()
    
    // Apply panel transformations in screen coordinates
    // No need to translate to world coordinates since we already converted to screen coordinates
    if (panel.rotation && panel.rotation !== 0) {
      const centerX = screenPos.x + screenWidth / 2;
      const centerY = screenPos.y + screenHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((panel.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }
    
    // Draw panel based on shape
    if (panel.shape === 'patch') {
      ctx.fillStyle = '#ef4444' // Red for patches
      ctx.strokeStyle = isSelected ? '#dc2626' : '#b91c1c' // Darker red for stroke
    } else {
      ctx.fillStyle = panel.fill || '#4f46e6'
      ctx.strokeStyle = isSelected ? '#f59e0b' : panel.color || '#1e1b4b'
    }
    ctx.lineWidth = isSelected ? 3 : 2
    
    // Draw different shapes based on panel.shape
    switch (panel.shape) {
      case 'right-triangle':
        ctx.beginPath()
        
        // Calculate center point for rotation
        const triangleCenterX = screenPos.x + screenWidth / 2
        const triangleCenterY = screenPos.y + screenHeight / 2
        
        // Define triangle points relative to center
        const points = [
          { x: -screenWidth / 2, y: -screenHeight / 2 }, // Top left
          { x: screenWidth / 2, y: -screenHeight / 2 },  // Top right  
          { x: -screenWidth / 2, y: screenHeight / 2 }   // Bottom left (right angle)
        ]
        
        // Apply rotation
        const rotation = (panel.rotation || 0) * Math.PI / 180
        const cos = Math.cos(rotation)
        const sin = Math.sin(rotation)
        
        // Rotate and translate points
        const rotatedPoints = points.map(point => ({
          x: triangleCenterX + (point.x * cos - point.y * sin),
          y: triangleCenterY + (point.x * sin + point.y * cos)
        }))
        
        // Draw rotated triangle
        ctx.moveTo(rotatedPoints[0].x, rotatedPoints[0].y)
        ctx.lineTo(rotatedPoints[1].x, rotatedPoints[1].y)
        ctx.lineTo(rotatedPoints[2].x, rotatedPoints[2].y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
        
      case 'patch':
        // Draw circle - use width as diameter for consistent sizing
        const radius = screenWidth / 2
        const circleCenterX = screenPos.x + radius
        const circleCenterY = screenPos.y + radius
        ctx.beginPath()
        ctx.arc(circleCenterX, circleCenterY, radius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
        break
        
      case 'rectangle':
      default:
        // Draw rectangle (default)
        ctx.fillRect(screenPos.x, screenPos.y, screenWidth, screenHeight)
        ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight)
        break
    }
    
    // Draw panel text
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(12, 16)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const centerX = screenPos.x + screenWidth / 2
    const centerY = screenPos.y + screenHeight / 2
    
    if (panel.panelNumber) {
      ctx.fillText(panel.panelNumber.toString(), centerX, centerY - 10)
    }
    
    if (panel.rollNumber) {
      ctx.fillText(panel.rollNumber.toString(), centerX, centerY + 10)
    }
    
    // Draw panel dimensions label
    const dimensionsText = `${panel.width.toFixed(0)}' × ${panel.height.toFixed(0)}'`;
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(10, 14)}px Arial`
    ctx.fillText(dimensionsText, centerX, centerY + 25)
    
    ctx.restore()
  }, [isValidPanel, getPanelValidationErrors, worldToScreen, getCurrentCanvas])

  // Draw selection handles
  const drawSelectionHandles = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    // Validate panel before drawing handles using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[useCanvasRenderer] Cannot draw selection handles for invalid panel:', { panel, errors });
      return;
    }
    
    // Convert world coordinates to screen coordinates
    // Use dynamic state if available, otherwise fall back to canvasState
    const currentCanvasState = getCanvasState ? getCanvasState() : canvasState;
    const worldScale = getWorldDimensions ? getWorldDimensions().worldScale : currentCanvasState.worldScale;
    const screenPos = worldToScreen(panel.x, panel.y, worldScale, currentCanvasState.scale, currentCanvasState.offsetX, currentCanvasState.offsetY);
    const screenWidth = panel.width * worldScale * currentCanvasState.scale;
    const screenHeight = panel.height * worldScale * currentCanvasState.scale;
    
    const handleSize = 8
    
    // Generate handles based on panel shape
    let handles: Array<{ x: number; y: number; cursor: string }> = [];
    
    switch (panel.shape) {
      case 'right-triangle':
        // Right triangle handles: corners and midpoints
        handles = [
          { x: screenPos.x, y: screenPos.y, cursor: 'nw-resize' }, // Top left
          { x: screenPos.x + screenWidth, y: screenPos.y, cursor: 'ne-resize' }, // Top right
          { x: screenPos.x, y: screenPos.y + screenHeight, cursor: 'sw-resize' }, // Bottom left (right angle)
          { x: screenPos.x + screenWidth / 2, y: screenPos.y, cursor: 'n-resize' }, // Top mid
          { x: screenPos.x, y: screenPos.y + screenHeight / 2, cursor: 'w-resize' } // Left mid
        ];
        break;
        
      case 'patch':
        // Circle handles: 8 points around the circle
        const radius = screenWidth / 2
        const centerX = screenPos.x + radius
        const centerY = screenPos.y + radius
        handles = [
          { x: centerX, y: centerY - radius, cursor: 'n-resize' }, // Top
          { x: centerX + radius * 0.707, y: centerY - radius * 0.707, cursor: 'ne-resize' }, // Top right
          { x: centerX + radius, y: centerY, cursor: 'e-resize' }, // Right
          { x: centerX + radius * 0.707, y: centerY + radius * 0.707, cursor: 'se-resize' }, // Bottom right
          { x: centerX, y: centerY + radius, cursor: 's-resize' }, // Bottom
          { x: centerX - radius * 0.707, y: centerY + radius * 0.707, cursor: 'sw-resize' }, // Bottom left
          { x: centerX - radius, y: centerY, cursor: 'w-resize' }, // Left
          { x: centerX - radius * 0.707, y: centerY - radius * 0.707, cursor: 'nw-resize' } // Top left
        ];
        break;
        
      case 'rectangle':
      default:
        // Rectangle handles: all corners and midpoints
        handles = [
          { x: screenPos.x, y: screenPos.y, cursor: 'nw-resize' },
          { x: screenPos.x + screenWidth / 2, y: screenPos.y, cursor: 'n-resize' },
          { x: screenPos.x + screenWidth, y: screenPos.y, cursor: 'ne-resize' },
          { x: screenPos.x + screenWidth, y: screenPos.y + screenHeight / 2, cursor: 'e-resize' },
          { x: screenPos.x + screenWidth, y: screenPos.y + screenHeight, cursor: 'se-resize' },
          { x: screenPos.x + screenWidth / 2, y: screenPos.y + screenHeight, cursor: 's-resize' },
          { x: screenPos.x, y: screenPos.y + screenHeight, cursor: 'sw-resize' },
          { x: screenPos.x, y: screenPos.y + screenHeight / 2, cursor: 'w-resize' }
        ];
        break;
    }
    
    ctx.save()
    
    // Apply rotation if needed
    if (panel.rotation && panel.rotation !== 0) {
      const centerX = screenPos.x + screenWidth / 2;
      const centerY = screenPos.y + screenHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((panel.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }
    
    handles.forEach(handle => {
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
    })
    
    // Draw rotation handle - position based on shape
    let rotationHandleX: number;
    let rotationHandleY: number;
    
    switch (panel.shape) {
      case 'right-triangle':
        // For right triangle, place rotation handle above the top edge center
        rotationHandleX = screenPos.x + screenWidth / 2;
        rotationHandleY = screenPos.y - 30;
        break;
        
      case 'patch':
        // For circle, place rotation handle above the circle center
        const circleRadius = screenWidth / 2;
        rotationHandleX = screenPos.x + circleRadius;
        rotationHandleY = screenPos.y + circleRadius - 30;
        break;
        
      case 'rectangle':
      default:
        // For rectangle, place rotation handle above the top edge center
        rotationHandleX = screenPos.x + screenWidth / 2;
        rotationHandleY = screenPos.y - 30;
        break;
    }
    
    ctx.fillStyle = '#10b981'
    ctx.fillRect(rotationHandleX - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(rotationHandleX - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    
    ctx.restore()
  }, [isValidPanel, getPanelValidationErrors, worldToScreen, getWorldDimensions, canvasState.worldScale, canvasState.scale, canvasState.offsetX, canvasState.offsetY])

  // Canvas rendering function
  const renderCanvas = useCallback(() => {
    const canvas = getCurrentCanvas()
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Get actual canvas dimensions (important for fullscreen mode)
    const actualCanvasWidth = canvas.width;
    const actualCanvasHeight = canvas.height;
    
    // Clear canvas using actual dimensions
    ctx.clearRect(0, 0, actualCanvasWidth, actualCanvasHeight)
    
    // Draw grid using the new interactive grid system
    const currentCanvasState = getCanvasState ? getCanvasState() : canvasState;
    if (currentCanvasState.showGrid) {
      drawGrid(ctx, canvas)
    }
    
    // Draw panels
    // Filter and validate panels before rendering
    const validPanels = panels.filter(panel => {
      if (!isValidPanel(panel)) {
        const errors = getPanelValidationErrors(panel);
        console.warn('[useCanvasRenderer] Skipping invalid panel:', { panel, errors });
        return false;
      }
      return true;
    });
    
    validPanels.forEach(panel => {
      drawPanel(ctx, panel, panel.id === selectedPanelId)
    })
    
    // Draw selection handles
    if (selectedPanelId) {
      const selectedPanel = panels.find(p => p.id === selectedPanelId)
      if (selectedPanel) {
        // Validate the selected panel before drawing handles
        if (isValidPanel(selectedPanel)) {
          drawSelectionHandles(ctx, selectedPanel)
        } else {
          const errors = getPanelValidationErrors(selectedPanel);
          console.warn('[useCanvasRenderer] Selected panel has validation errors, skipping handles:', { panel: selectedPanel, errors });
        }
      }
    }
  }, [panels, selectedPanelId, drawGrid, drawPanel, drawSelectionHandles, isValidPanel, getPanelValidationErrors, getCanvasState, canvasState.showGrid])

  return {
    renderCanvas,
    drawGrid: () => {}, // This is now handled by the interactive grid hook
    drawPanel,
    drawSelectionHandles,
    worldToScreen: worldToScreenCoord,
    screenToWorld: screenToWorldCoord
  }
}
