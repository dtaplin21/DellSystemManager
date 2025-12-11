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
    const panelCenterX = screenPos.x + screenWidth / 2;
    const panelCenterY = screenPos.y + screenHeight / 2;
    
    if (panel.rotation && panel.rotation !== 0) {
      ctx.translate(panelCenterX, panelCenterY);
      ctx.rotate((panel.rotation * Math.PI) / 180);
      ctx.translate(-panelCenterX, -panelCenterY);
    }
    
    // Draw panel based on shape
    ctx.fillStyle = panel.fill || '#4f46e6'
    ctx.strokeStyle = isSelected ? '#f59e0b' : panel.color || '#1e1b4b'
    ctx.lineWidth = isSelected ? 3 : 2
    
    // Draw different shapes based on panel.shape
    switch (panel.shape) {
      case 'right-triangle':
        ctx.beginPath()
        
        // Define triangle points relative to center (rotation already applied via canvas transform)
        const points = [
          { x: -screenWidth / 2, y: -screenHeight / 2 }, // Top left
          { x: screenWidth / 2, y: -screenHeight / 2 },  // Top right  
          { x: -screenWidth / 2, y: screenHeight / 2 }   // Bottom left (right angle)
        ]
        
        // Draw triangle (rotation already applied via canvas transform)
        ctx.moveTo(panelCenterX + points[0].x, panelCenterY + points[0].y)
        ctx.lineTo(panelCenterX + points[1].x, panelCenterY + points[1].y)
        ctx.lineTo(panelCenterX + points[2].x, panelCenterY + points[2].y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
        
      case 'rectangle':
      default:
        // Draw rectangle (default) - centered
        ctx.fillRect(panelCenterX - screenWidth / 2, panelCenterY - screenHeight / 2, screenWidth, screenHeight)
        ctx.strokeRect(panelCenterX - screenWidth / 2, panelCenterY - screenHeight / 2, screenWidth, screenHeight)
        break
    }
    
    // Draw panel text
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(12, 16)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    if (panel.panelNumber) {
      ctx.fillText(panel.panelNumber.toString(), panelCenterX, panelCenterY - 10)
    }
    
    if (panel.rollNumber) {
      ctx.fillText(panel.rollNumber.toString(), panelCenterX, panelCenterY + 10)
    }
    
    // Draw panel dimensions label
    const dimensionsText = `${panel.width.toFixed(0)}' × ${panel.height.toFixed(0)}'`;
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(10, 14)}px Arial`
    ctx.fillText(dimensionsText, panelCenterX, panelCenterY + 25)
    
    ctx.restore()
  }, [isValidPanel, getPanelValidationErrors, worldToScreen, getCurrentCanvas])

  // Draw selection handles
  const drawSelectionHandles = useCallback((ctx: CanvasRenderingContext2D, panel: Panel) => {
    console.log('🎯 [ROTATION HANDLE DEBUG] drawSelectionHandles called for panel:', {
      id: panel.id,
      shape: panel.shape,
      isValid: panel.isValid
    });
    
    // Validate panel before drawing handles using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[useCanvasRenderer] Cannot draw selection handles for invalid panel:', { panel, errors });
      return;
    }
    
    // Convert world coordinates to screen coordinates
    const currentCanvasState = getCanvasState ? getCanvasState() : canvasState;
    const worldScale = getWorldDimensions ? getWorldDimensions().worldScale : currentCanvasState.worldScale;
    const screenPos = worldToScreen(panel.x, panel.y, worldScale, currentCanvasState.scale, currentCanvasState.offsetX, currentCanvasState.offsetY);
    const screenWidth = panel.width * worldScale * currentCanvasState.scale;
    const screenHeight = panel.height * worldScale * currentCanvasState.scale;
    
    const handleSize = 8;
    
    ctx.save();
    
    // Apply rotation if needed
    if (panel.rotation && panel.rotation !== 0) {
      const centerX = screenPos.x + screenWidth / 2;
      const centerY = screenPos.y + screenHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((panel.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }
    
    // Draw rotation handle only - position based on shape
    let rotationHandleX: number;
    let rotationHandleY: number;
    
    switch (panel.shape) {
      case 'right-triangle':
        rotationHandleX = screenPos.x + screenWidth / 2;
        rotationHandleY = screenPos.y - 30;
        break;
        
      case 'rectangle':
      default:
        rotationHandleX = screenPos.x + screenWidth / 2;
        rotationHandleY = screenPos.y - 30;
        break;
    }
    
    console.log('🎯 [ROTATION HANDLE DEBUG] Drawing rotation handle:', {
      panelId: panel.id,
      shape: panel.shape,
      screenPos: { x: screenPos.x, y: screenPos.y },
      screenSize: { width: screenWidth, height: screenHeight },
      rotationHandlePos: { x: rotationHandleX, y: rotationHandleY },
      handleSize
    });
    
    ctx.fillStyle = '#10b981';
    ctx.fillRect(rotationHandleX - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(rotationHandleX - handleSize / 2, rotationHandleY - handleSize / 2, handleSize, handleSize);
    
    console.log('🎯 [ROTATION HANDLE DEBUG] Rotation handle drawn successfully');
    
    ctx.restore();
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
      console.log('🎯 [ROTATION HANDLE DEBUG] selectedPanelId found:', selectedPanelId);
      const selectedPanel = panels.find(p => p.id === selectedPanelId)
      if (selectedPanel) {
        console.log('🎯 [ROTATION HANDLE DEBUG] selectedPanel found:', {
          id: selectedPanel.id,
          shape: selectedPanel.shape,
          isValid: selectedPanel.isValid
        });
        // Validate the selected panel before drawing handles
        if (isValidPanel(selectedPanel)) {
          console.log('🎯 [ROTATION HANDLE DEBUG] Calling drawSelectionHandles for selected panel');
          drawSelectionHandles(ctx, selectedPanel)
        } else {
          const errors = getPanelValidationErrors(selectedPanel);
          console.warn('[useCanvasRenderer] Selected panel has validation errors, skipping handles:', { panel: selectedPanel, errors });
        }
      } else {
        console.log('🎯 [ROTATION HANDLE DEBUG] selectedPanel not found for ID:', selectedPanelId);
      }
    } else {
      console.log('🎯 [ROTATION HANDLE DEBUG] No selectedPanelId');
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
