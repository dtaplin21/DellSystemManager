import { useCallback } from 'react'
import type { Panel } from '@/types/panel'

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
    getPanelValidationErrors
  } = options

  // Draw grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e0e0e0'
    // Use zoom scale for line width since layout scale is applied globally
    ctx.lineWidth = 1 / canvasState.scale
    
    // Get actual canvas dimensions (important for fullscreen mode)
    const currentCanvas = getCurrentCanvas();
    const actualCanvasWidth = currentCanvas?.width || canvasWidth;
    const actualCanvasHeight = currentCanvas?.height || canvasHeight;
    
    // Calculate grid spacing based on world scale
    // We want grid lines that represent meaningful real-world distances
    const worldScale = canvasState.worldScale;
    
    // Major grid lines every 500ft (for 500ft panels)
    const majorGridSpacing = 500 * worldScale;
    // Minor grid lines every 100ft (for better readability)
    const minorGridSpacing = 100 * worldScale;
    
    // Draw minor grid lines (lighter)
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 0.5 / canvasState.scale
    
    // Vertical lines (west to east) - cover entire canvas width
    for (let x = 0; x <= actualCanvasWidth; x += minorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, actualCanvasHeight)
      ctx.stroke()
    }
    
    // Horizontal lines (north to south) - cover entire canvas height
    for (let y = 0; y <= actualCanvasHeight; y += minorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(actualCanvasWidth, y)
      ctx.stroke()
    }
    
    // Draw major grid lines (darker)
    ctx.strokeStyle = '#d0d0d0'
    ctx.lineWidth = 1.5 / canvasState.scale
    
    // Vertical major lines every 500ft - cover entire canvas width
    for (let x = 0; x <= actualCanvasWidth; x += majorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, actualCanvasHeight)
      ctx.stroke()
    }
    
    // Horizontal major lines every 500ft - cover entire canvas height
    for (let y = 0; y <= actualCanvasHeight; y += majorGridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(actualCanvasWidth, y)
      ctx.stroke()
    }
    
    // Draw grid labels for major lines
    ctx.fillStyle = '#666666'
    ctx.font = `${Math.max(10, 12 / canvasState.scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Label vertical lines (west to east distances)
    for (let x = 0; x <= actualCanvasWidth; x += majorGridSpacing) {
      const worldX = x / worldScale;
      const label = `${worldX.toFixed(0)}ft`;
      ctx.fillText(label, x, 15 / canvasState.scale);
    }
    
    // Label horizontal lines (north to south distances)
    for (let y = 0; y <= actualCanvasHeight; y += majorGridSpacing) {
      const worldY = y / worldScale;
      const label = `${worldY.toFixed(0)}ft`;
      ctx.save();
      ctx.translate(15 / canvasState.scale, y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }, [canvasState, canvasWidth, canvasHeight, getCurrentCanvas])

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
    
    // Draw grid
    if (canvasState.showGrid) {
      drawGrid(ctx)
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
    drawGrid,
    drawPanel,
    drawSelectionHandles
  }
}
