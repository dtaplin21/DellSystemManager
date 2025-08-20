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
    drawGrid
  } = options

  // Coordinate transformation helpers
  const worldToScreenCoord = useCallback((wx: number, wy: number) => {
    return worldToScreen(wx, wy, canvasState.worldScale, canvasState.scale, canvasState.offsetX, canvasState.offsetY)
  }, [canvasState])

  const screenToWorldCoord = useCallback((sx: number, sy: number) => {
    return screenToWorld(sx, sy, canvasState.worldScale, canvasState.scale, canvasState.offsetX, canvasState.offsetY)
  }, [canvasState])

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
    const screenPos = worldToScreen(panel.x, panel.y, canvasState.worldScale, canvasState.scale, canvasState.offsetX, canvasState.offsetY);
    const screenWidth = panel.width * canvasState.worldScale * canvasState.scale;
    const screenHeight = panel.height * canvasState.worldScale * canvasState.scale;
    
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
    
    // Draw panel rectangle in screen coordinates
    ctx.fillStyle = panel.fill || '#4f46e6'
    ctx.fillRect(screenPos.x, screenPos.y, screenWidth, screenHeight)
    
    // Draw panel border
    ctx.strokeStyle = isSelected ? '#f59e0b' : panel.color || '#1e1b4b'
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight)
    
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
  }, [canvasState, canvasWidth, canvasHeight, isValidPanel, getPanelValidationErrors, worldToScreen, getCurrentCanvas])

  // Draw selection handles
  const drawSelectionHandles = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    // Validate panel before drawing handles using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[useCanvasRenderer] Cannot draw selection handles for invalid panel:', { panel, errors });
      return;
    }
    
    // Convert world coordinates to screen coordinates
    const screenPos = worldToScreen(panel.x, panel.y, canvasState.worldScale, canvasState.scale, canvasState.offsetX, canvasState.offsetY);
    const screenWidth = panel.width * canvasState.worldScale * canvasState.scale;
    const screenHeight = panel.height * canvasState.worldScale * canvasState.scale;
    
    const handleSize = 8
    
    const handles = [
      { x: screenPos.x, y: screenPos.y, cursor: 'nw-resize' },
      { x: screenPos.x + screenWidth / 2, y: screenPos.y, cursor: 'n-resize' },
      { x: screenPos.x + screenWidth, y: screenPos.y, cursor: 'ne-resize' },
      { x: screenPos.x + screenWidth, y: screenPos.y + screenHeight / 2, cursor: 'e-resize' },
      { x: screenPos.x + screenWidth, y: screenPos.y + screenHeight, cursor: 'se-resize' },
      { x: screenPos.x + screenWidth / 2, y: screenPos.y + screenHeight, cursor: 's-resize' },
      { x: screenPos.x, y: screenPos.y + screenHeight, cursor: 'sw-resize' },
      { x: screenPos.x, y: screenPos.y + screenHeight / 2, cursor: 'w-resize' }
    ]
    
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
    
    // Draw rotation handle
    const rotationHandleY = screenPos.y - 30
    ctx.fillStyle = '#10b981'
    ctx.fillRect(screenPos.x + screenWidth / 2 - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(screenPos.x + screenWidth / 2 - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    
    ctx.restore()
  }, [canvasState, isValidPanel, getPanelValidationErrors, worldToScreen])

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
    if (canvasState.showGrid) {
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
  }, [panels, canvasState, canvasWidth, canvasHeight, selectedPanelId, drawGrid, drawPanel, drawSelectionHandles, isValidPanel, getPanelValidationErrors])

  return {
    renderCanvas,
    drawGrid: () => {}, // This is now handled by the interactive grid hook
    drawPanel,
    drawSelectionHandles,
    worldToScreen: worldToScreenCoord,
    screenToWorld: screenToWorldCoord
  }
}
