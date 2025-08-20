import { useCallback } from 'react'
import { worldToScreen, screenToWorld } from '../lib/geometry'

export interface GridConfig {
  minorSpacing: number // feet
  majorSpacing: number // feet
  snapSize: number // feet
}

export interface CanvasState {
  worldScale: number
  scale: number
  offsetX: number
  offsetY: number
  showGrid: boolean
  snapEnabled: boolean
}

export interface UseInteractiveGridReturn {
  drawGrid: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
  setupCanvas: (canvas: HTMLCanvasElement, container: HTMLDivElement) => void
  getWorldScale: () => number
}

export interface UseInteractiveGridOptions {
  worldSize: number // feet (assumes square world)
  gridConfig: GridConfig
  canvasState: CanvasState
}

const WORLD_SIZE = 4000 // feet - using the new 4000x4000 world

export const useInteractiveGrid = (options: UseInteractiveGridOptions): UseInteractiveGridReturn => {
  const { worldSize, gridConfig, canvasState } = options

  // Setup canvas with HiDPI support
  const setupCanvas = useCallback((canvas: HTMLCanvasElement, container: HTMLDivElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()

    // Set display size
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'

    // Set actual size in memory (scaled for HiDPI)
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    // Scale the drawing context so everything draws at the correct size
    ctx.scale(dpr, dpr)
  }, [])

  // Draw grid with configurable spacing
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (!canvasState.showGrid) return

    const { worldScale, scale, offsetX, offsetY } = canvasState
    const totalScale = worldScale * scale

    // Calculate visible world bounds
    const topLeft = screenToWorld(0, 0, worldScale, scale, offsetX, offsetY)
    const bottomRight = screenToWorld(canvas.clientWidth, canvas.clientHeight, worldScale, scale, offsetX, offsetY)

    // Minor grid lines (configurable spacing)
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.5
    ctx.beginPath()

    for (let x = Math.floor(topLeft.x / gridConfig.minorSpacing) * gridConfig.minorSpacing; x <= bottomRight.x; x += gridConfig.minorSpacing) {
      const screenX = worldToScreen(x, 0, worldScale, scale, offsetX, offsetY).x
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, canvas.clientHeight)
    }

    for (let y = Math.floor(topLeft.y / gridConfig.minorSpacing) * gridConfig.minorSpacing; y <= bottomRight.y; y += gridConfig.minorSpacing) {
      const screenY = worldToScreen(0, y, worldScale, scale, offsetX, offsetY).y
      ctx.moveTo(0, screenY)
      ctx.lineTo(canvas.clientWidth, screenY)
    }

    ctx.stroke()

    // Major grid lines (configurable spacing)
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let x = Math.floor(topLeft.x / gridConfig.majorSpacing) * gridConfig.majorSpacing; x <= bottomRight.x; x += gridConfig.majorSpacing) {
      const screenX = worldToScreen(x, 0, worldScale, scale, offsetX, offsetY).x
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, canvas.clientHeight)
    }

    for (let y = Math.floor(topLeft.y / gridConfig.majorSpacing) * gridConfig.majorSpacing; y <= bottomRight.y; y += gridConfig.majorSpacing) {
      const screenY = worldToScreen(0, y, worldScale, scale, offsetX, offsetY).y
      ctx.moveTo(0, screenY)
      ctx.lineTo(canvas.clientWidth, screenY)
    }

    ctx.stroke()

    // Draw grid labels for major lines
    ctx.fillStyle = '#666666'
    ctx.font = `${Math.max(10, 12 / scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Label vertical lines (west to east distances)
    for (let x = Math.floor(topLeft.x / gridConfig.majorSpacing) * gridConfig.majorSpacing; x <= bottomRight.x; x += gridConfig.majorSpacing) {
      const screenX = worldToScreen(x, 0, worldScale, scale, offsetX, offsetY).x
      const label = `${x.toFixed(0)}ft`
      ctx.fillText(label, screenX, 15 / scale)
    }

    // Label horizontal lines (north to south distances)
    for (let y = Math.floor(topLeft.y / gridConfig.majorSpacing) * gridConfig.majorSpacing; y <= bottomRight.y; y += gridConfig.majorSpacing) {
      const screenY = worldToScreen(0, y, worldScale, scale, offsetX, offsetY).y
      const label = `${y.toFixed(0)}ft`
      ctx.save()
      ctx.translate(15 / scale, screenY)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(label, 0, 0)
      ctx.restore()
    }
  }, [canvasState, gridConfig])

  const getWorldScale = useCallback(() => {
    return canvasState.worldScale
  }, [canvasState.worldScale])

  return {
    drawGrid,
    setupCanvas,
    getWorldScale
  }
}
