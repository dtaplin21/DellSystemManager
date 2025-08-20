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
  normalizedLayoutScale: number
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
    normalizedLayoutScale,
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
    
    // Calculate effective coordinates and dimensions using world scale
    // Convert world coordinates (feet) to canvas coordinates (pixels)
    const effectiveX = panel.x * canvasState.worldScale;
    const effectiveY = panel.y * canvasState.worldScale;
    const effectiveWidth = panel.width * canvasState.worldScale;
    const effectiveHeight = panel.height * canvasState.worldScale;
    
    // Calculate panel bounds in screen coordinates
    const panelLeft = effectiveX * canvasState.scale + canvasState.offsetX;
    const panelTop = effectiveY * canvasState.scale + canvasState.offsetY;
    const panelRight = (effectiveX + effectiveWidth) * canvasState.scale + canvasState.offsetX;
    const panelBottom = (effectiveY + effectiveHeight) * canvasState.scale + canvasState.offsetY;
    
    // Check if panel is completely outside canvas bounds (with some margin)
    const margin = 100; // pixels
    if (panelRight < -margin || panelLeft > canvasWidth + margin || 
        panelBottom < -margin || panelTop > canvasHeight + margin) {
      return;
    }
    
    ctx.save()
    
    // Apply panel transformations
    // Convert world coordinates to canvas coordinates
    ctx.translate(effectiveX, effectiveY)
    ctx.rotate((panel.rotation || 0) * Math.PI / 180)
    
    // Draw panel rectangle
    ctx.fillStyle = panel.fill || '#4f46e5'
    ctx.fillRect(0, 0, effectiveWidth, effectiveHeight)
    
    // Draw panel border
    ctx.strokeStyle = isSelected ? '#f59e0b' : panel.color || '#1e1b4b'
    // Use zoom scale for line width
    ctx.lineWidth = isSelected ? 3 / canvasState.scale : 2 / canvasState.scale
    ctx.strokeRect(0, 0, effectiveWidth, effectiveHeight)
    
    // Draw panel text
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(12, 16 / canvasState.scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const centerX = effectiveWidth / 2
    const centerY = effectiveHeight / 2
    
    if (panel.panelNumber) {
      ctx.fillText(panel.panelNumber.toString(), centerX, centerY - 10 / canvasState.scale)
    }
    
    if (panel.rollNumber) {
      ctx.fillText(panel.rollNumber.toString(), centerX, centerY + 10 / canvasState.scale)
    }
    
    // Draw panel dimensions label
    const dimensionsText = `${panel.width.toFixed(0)}' × ${panel.height.toFixed(0)}'`;
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(10, 14 / canvasState.scale)}px Arial`
    ctx.fillText(dimensionsText, centerX, centerY + 25 / canvasState.scale)
    
    ctx.restore()
  }, [canvasState, canvasWidth, canvasHeight, normalizedLayoutScale, isValidPanel, getPanelValidationErrors])

  // Draw selection handles
  const drawSelectionHandles = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    // Validate panel before drawing handles using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[useCanvasRenderer] Cannot draw selection handles for invalid panel:', { panel, errors });
      return;
    }
    
    // Use zoom scale for handle sizes
    const handleSize = 8 / canvasState.scale
    
    // Calculate effective coordinates and dimensions using world scale
    const effectiveX = panel.x * canvasState.worldScale;
    const effectiveY = panel.y * canvasState.worldScale;
    const effectiveWidth = panel.width * canvasState.worldScale;
    const effectiveHeight = panel.height * canvasState.worldScale;
    
    const handles = [
      { x: 0, y: 0, cursor: 'nw-resize' },
      { x: effectiveWidth / 2, y: 0, cursor: 'n-resize' },
      { x: effectiveWidth, y: 0, cursor: 'ne-resize' },
      { x: effectiveWidth, y: effectiveHeight / 2, cursor: 'e-resize' },
      { x: effectiveWidth, y: effectiveHeight, cursor: 'se-resize' },
      { x: effectiveWidth / 2, y: effectiveHeight, cursor: 's-resize' },
      { x: 0, y: effectiveHeight, cursor: 'sw-resize' },
      { x: 0, y: effectiveHeight / 2, cursor: 'w-resize' }
    ]
    
    ctx.save()
    ctx.translate(effectiveX, effectiveY)
    ctx.rotate((panel.rotation || 0) * Math.PI / 180)
    
    handles.forEach(handle => {
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1 / canvasState.scale
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
    })
    
    // Draw rotation handle
    const rotationHandleY = -30 / canvasState.scale
    ctx.fillStyle = '#10b981'
    ctx.fillRect(effectiveWidth / 2 - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    ctx.strokeStyle = '#ffffff'
    ctx.strokeRect(effectiveWidth / 2 - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize)
    
    ctx.restore()
  }, [canvasState, isValidPanel, getPanelValidationErrors])

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
    
    // Save context for transformations
    ctx.save()
    
    // Apply viewport transformations in the correct order:
    // 1. Pan (offset)
    // 2. Scale (zoom)
    // Note: We don't apply layoutScale globally anymore to avoid scaling issues
    ctx.translate(canvasState.offsetX, canvasState.offsetY)
    ctx.scale(canvasState.scale, canvasState.scale)
    
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
    
    // Restore context
    ctx.restore()
  }, [panels, canvasState, canvasWidth, canvasHeight, normalizedLayoutScale, selectedPanelId, drawGrid, drawPanel, drawSelectionHandles, isValidPanel, getPanelValidationErrors])

  return {
    renderCanvas,
    drawGrid: () => {}, // This is now handled by the interactive grid hook
    drawPanel,
    drawSelectionHandles,
    worldToScreen: worldToScreenCoord,
    screenToWorld: screenToWorldCoord
  }
}
