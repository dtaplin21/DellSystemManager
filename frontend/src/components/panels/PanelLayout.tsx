'use client'

import { useState, useRef, useEffect, useCallback, useReducer } from 'react'
import type { Panel } from '../../types/panel'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { 
  Brain, 
  Target, 
  Zap, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Grid,
  Sparkles
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'

interface PanelLayoutProps {
  mode: 'manual' | 'auto'
  projectInfo: {
    projectName: string
    location: string
    description: string
    manager: string
    material: string
  }
  externalPanels?: Panel[]
  onPanelUpdate?: (panels: Panel[]) => void
}

interface AIAssistantState {
  isActive: boolean
  suggestions: AISuggestion[]
  currentTask: string | null
  progress: number
  isProcessing: boolean
}

interface AISuggestion {
  id: string
  type: 'optimization' | 'layout' | 'material' | 'efficiency' | 'warning'
  title: string
  description: string
  action: string
  priority: 'low' | 'medium' | 'high'
  impact: 'cost' | 'time' | 'quality' | 'safety'
}

interface CanvasState {
  scale: number
  offsetX: number
  offsetY: number
  showGrid: boolean
  showGuides: boolean
  snapToGrid: boolean
  gridSize: number
}

// AI Helper Functions
const optimizePanelLayout = (panels: Panel[]): Panel[] => {
  const sortedPanels = [...panels].sort((a, b) => a.x - b.x || a.y - b.y)
  const gridSize = Math.ceil(Math.sqrt(panels.length))
  const spacing = 50
  
  return sortedPanels.map((panel, index) => {
    const row = Math.floor(index / gridSize)
    const col = index % gridSize
    return {
      ...panel,
      x: col * (panel.width + spacing),
      y: row * (panel.height + spacing)
    }
  })
}

const improvePanelSpacing = (panels: Panel[]): Panel[] => {
  const minSpacing = 20
  const improvedPanels = [...panels]
  
  for (let i = 0; i < improvedPanels.length; i++) {
    for (let j = i + 1; j < improvedPanels.length; j++) {
      const panel1 = improvedPanels[i]
      const panel2 = improvedPanels[j]
      
      const distance = Math.sqrt(
        Math.pow(panel1.x - panel2.x, 2) + Math.pow(panel1.y - panel2.y, 2)
      )
      
      if (distance < minSpacing) {
        const angle = Math.atan2(panel2.y - panel1.y, panel2.x - panel1.x)
        const moveDistance = minSpacing - distance
        
        panel2.x += Math.cos(angle) * moveDistance
        panel2.y += Math.sin(angle) * moveDistance
      }
    }
  }
  
  return improvedPanels
}

const standardizeMaterials = (panels: Panel[]): Panel[] => {
  const materialCounts = panels.reduce((counts, panel) => {
    const material = panel.meta?.welder?.method || 'standard'
    counts[material] = (counts[material] || 0) + 1
    return counts
  }, {} as Record<string, number>)
  
  const mostCommonMaterial = Object.entries(materialCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'standard'
  
  return panels.map(panel => ({
    ...panel,
    meta: {
      ...panel.meta,
      welder: {
        ...panel.meta?.welder,
        method: mostCommonMaterial
      }
    }
  }))
}

// Panel State Management
interface PanelState {
  panels: Panel[]
  selectedPanelId: string | null
}

type PanelAction = 
  | { type: 'SET_PANELS'; payload: Panel[] }
  | { type: 'ADD_PANEL'; payload: Panel }
  | { type: 'UPDATE_PANEL'; payload: { id: string; updates: Partial<Panel> } }
  | { type: 'DELETE_PANEL'; payload: string }
  | { type: 'SELECT_PANEL'; payload: string | null }
  | { type: 'RESET_PANELS' }
  | { type: 'OPTIMIZE_LAYOUT'; payload: Panel[] }
  | { type: 'IMPROVE_SPACING'; payload: Panel[] }
  | { type: 'STANDARDIZE_MATERIALS'; payload: Panel[] }

const panelReducer = (state: PanelState, action: PanelAction): PanelState => {
  switch (action.type) {
    case 'SET_PANELS':
      return { ...state, panels: action.payload }
    case 'ADD_PANEL':
      return { ...state, panels: [...state.panels, action.payload] }
    case 'UPDATE_PANEL':
      return {
        ...state,
        panels: state.panels.map(panel =>
          panel.id === action.payload.id
            ? { ...panel, ...action.payload.updates }
            : panel
        )
      }
    case 'DELETE_PANEL':
      return {
        ...state,
        panels: state.panels.filter(panel => panel.id !== action.payload),
        selectedPanelId: state.selectedPanelId === action.payload ? null : state.selectedPanelId
      }
    case 'SELECT_PANEL':
      return { ...state, selectedPanelId: action.payload }
    case 'RESET_PANELS':
      return { ...state, panels: [], selectedPanelId: null }
    case 'OPTIMIZE_LAYOUT':
      return { ...state, panels: action.payload }
    case 'IMPROVE_SPACING':
      return { ...state, panels: action.payload }
    case 'STANDARDIZE_MATERIALS':
      return { ...state, panels: action.payload }
    default:
      return state
  }
}

export default function PanelLayout({ mode, projectInfo, externalPanels, onPanelUpdate }: PanelLayoutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [panels, dispatch] = useReducer(panelReducer, { panels: [], selectedPanelId: null })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState(0)
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    showGrid: true,
    showGuides: true,
    snapToGrid: true,
    gridSize: 20
  })
  const [aiState, setAiState] = useState<AIAssistantState>({
    isActive: true,
    suggestions: [],
    currentTask: null,
    progress: 0,
    isProcessing: false
  })
  
  // Refs for preventing infinite loops
  const lastPanelIds = useRef<string>('')
  const lastProjectInfo = useRef<string>('')
  const lastExternalPanels = useRef<string>('')
  
  // Canvas dimensions
  const [canvasWidth, setCanvasWidth] = useState(1200)
  const [canvasHeight, setCanvasHeight] = useState(800)
  
  const { toast } = useToast()
  
  // Initialize panels from external source
  useEffect(() => {
    if (externalPanels && externalPanels.length > 0) {
      // Only update if panels actually changed (deep comparison)
      const newPanelIds = externalPanels.map(p => p.id).sort().join(',')
      
      if (newPanelIds !== lastExternalPanels.current) {
        lastExternalPanels.current = newPanelIds
        dispatch({ type: 'SET_PANELS', payload: externalPanels })
      }
    }
  }, [externalPanels]) // Remove panels.panels from dependencies
  
  // Notify parent of panel updates
  useEffect(() => {
    if (onPanelUpdate) {
      onPanelUpdate(panels.panels)
    }
  }, [panels.panels]) // Remove onPanelUpdate from dependencies
  
  // AI Functions
  const generateSuggestions = useCallback(async (panels: Panel[], projectInfo: any) => {
    setAiState(prev => ({ ...prev, isProcessing: true, progress: 0 }))
    
    const suggestions: AISuggestion[] = []
    
    if (panels.length > 0) {
      const totalArea = panels.reduce((sum, panel) => sum + (panel.width * panel.height), 0)
      const avgPanelSize = totalArea / panels.length
      
      if (avgPanelSize > 1000) {
        suggestions.push({
          id: 'large-panels',
          type: 'warning',
          title: 'Large Panel Detection',
          description: `Average panel size is ${Math.round(avgPanelSize)} sq ft. Consider breaking into smaller panels for easier handling.`,
          action: 'Split large panels',
          priority: 'medium',
          impact: 'safety'
        })
      }
      
      const materialGroups = panels.reduce((groups, panel) => {
        const material = panel.meta?.welder?.method || 'standard'
        groups[material] = (groups[material] || 0) + 1
        return groups
      }, {} as Record<string, number>)
      
      if (Object.keys(materialGroups).length > 2) {
        suggestions.push({
          id: 'material-consistency',
          type: 'efficiency',
          title: 'Material Consistency',
          description: 'Multiple material types detected. Standardizing materials could reduce costs by 15-20%.',
          action: 'Standardize materials',
          priority: 'high',
          impact: 'cost'
        })
      }
    }
    
    if (panels.length > 5) {
      suggestions.push({
        id: 'layout-optimization',
        type: 'optimization',
        title: 'Layout Optimization Available',
        description: 'AI can optimize panel placement to reduce material waste and improve installation efficiency.',
        action: 'Run AI optimization',
        priority: 'high',
        impact: 'cost'
      })
    }
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 20) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setAiState(prev => ({ ...prev, progress: i }))
    }
    
    setAiState(prev => ({ 
      ...prev, 
      suggestions, 
      isProcessing: false, 
      progress: 100,
      currentTask: null 
    }))
    
    return suggestions
  }, [])
  
  // Generate AI suggestions when panels change - with stable dependencies
  useEffect(() => {
    if (panels.panels.length > 0 && aiState.isActive) {
      // Only run if panels actually changed (deep comparison)
      const panelIds = panels.panels.map(p => p.id).sort().join(',')
      
      if (panelIds !== lastPanelIds.current) {
        lastPanelIds.current = panelIds
        generateSuggestions(panels.panels, projectInfo)
      }
    }
  }, [panels.panels, aiState.isActive, generateSuggestions, projectInfo])
  
  const executeSuggestion = useCallback(async (suggestion: AISuggestion, panels: Panel[]) => {
    setAiState(prev => ({ ...prev, currentTask: suggestion.action, progress: 0 }))
    
    // Simulate AI execution
    for (let i = 0; i <= 100; i += 25) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setAiState(prev => ({ ...prev, progress: i }))
    }
    
    setAiState(prev => ({ ...prev, currentTask: null, progress: 100 }))
    
    switch (suggestion.type) {
      case 'optimization':
        return optimizePanelLayout(panels)
      case 'layout':
        return improvePanelSpacing(panels)
      case 'material':
        return standardizeMaterials(panels)
      default:
        return panels
    }
  }, [])
  
  const toggleAssistant = useCallback(() => {
    setAiState(prev => ({ ...prev, isActive: !prev.isActive }))
  }, [])
  
  // Canvas Functions
  const zoomIn = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 5) }))
  }, [])
  
  const zoomOut = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) }))
  }, [])
  
  const resetView = useCallback(() => {
    setCanvasState(prev => ({ ...prev, scale: 1, offsetX: 0, offsetY: 0 }))
  }, [])
  
  const toggleGrid = useCallback(() => {
    setCanvasState(prev => ({ ...prev, showGrid: !prev.showGrid }))
  }, [])
  
  const toggleGuides = useCallback(() => {
    setCanvasState(prev => ({ ...prev, showGuides: !prev.showGuides }))
  }, [])
  
  const toggleSnap = useCallback(() => {
    setCanvasState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }))
  }, [])
  
  // Canvas rendering function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    
    // Save context for transformations
    ctx.save()
    
    // Apply zoom and pan
    ctx.translate(canvasState.offsetX, canvasState.offsetY)
    ctx.scale(canvasState.scale, canvasState.scale)
    
    // Draw grid
    if (canvasState.showGrid) {
      drawGrid(ctx)
    }
    
    // Draw panels
    panels.panels.forEach(panel => {
      drawPanel(ctx, panel, panel.id === panels.selectedPanelId)
    })
    
    // Draw selection handles
    if (panels.selectedPanelId) {
      const selectedPanel = panels.panels.find(p => p.id === panels.selectedPanelId)
      if (selectedPanel) {
        drawSelectionHandles(ctx, selectedPanel)
      }
    }
    
    // Draw AI guides
    if (canvasState.showGuides && aiState.suggestions.length > 0) {
      drawAIGuides(ctx)
    }
    
    // Restore context
    ctx.restore()
  }, [panels, canvasState, aiState.suggestions, canvasWidth, canvasHeight])
  
  // Draw grid
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1 / canvasState.scale
    
    for (let x = 0; x <= canvasWidth; x += canvasState.gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasHeight)
      ctx.stroke()
    }
    
    for (let y = 0; y <= canvasHeight; y += canvasState.gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvasWidth, y)
      ctx.stroke()
    }
  }
  
  // Draw panel
  const drawPanel = (ctx: CanvasRenderingContext2D, panel: Panel, isSelected: boolean) => {
    ctx.save()
    
    // Apply panel transformations
    ctx.translate(panel.x, panel.y)
    ctx.rotate((panel.rotation || 0) * Math.PI / 180)
    
    // Draw panel rectangle
    ctx.fillStyle = panel.fill || '#4f46e5'
    ctx.fillRect(0, 0, panel.width, panel.height)
    
    // Draw panel border
    ctx.strokeStyle = isSelected ? '#f59e0b' : panel.color || '#1e1b4b'
    ctx.lineWidth = isSelected ? 3 / canvasState.scale : 2 / canvasState.scale
    ctx.strokeRect(0, 0, panel.width, panel.height)
    
    // Draw panel text
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(12, 16 / canvasState.scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const centerX = panel.width / 2
    const centerY = panel.height / 2
    
    if (panel.panelNumber) {
      ctx.fillText(panel.panelNumber.toString(), centerX, centerY - 10 / canvasState.scale)
    }
    
    if (panel.rollNumber) {
      ctx.fillText(panel.rollNumber.toString(), centerX, centerY + 10 / canvasState.scale)
    }
    
    ctx.restore()
  }
  
  // Draw selection handles
  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, panel: Panel) => {
    const handleSize = 8 / canvasState.scale
    const handles = [
      { x: 0, y: 0, cursor: 'nw-resize' },
      { x: panel.width / 2, y: 0, cursor: 'n-resize' },
      { x: panel.width, y: 0, cursor: 'ne-resize' },
      { x: panel.width, y: panel.height / 2, cursor: 'e-resize' },
      { x: panel.width, y: panel.height, cursor: 'se-resize' },
      { x: panel.width / 2, y: panel.height, cursor: 's-resize' },
      { x: 0, y: panel.height, cursor: 'sw-resize' },
      { x: 0, y: panel.height / 2, cursor: 'w-resize' }
    ]
    
    ctx.save()
    ctx.translate(panel.x, panel.y)
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
    ctx.beginPath()
    ctx.arc(panel.width / 2, rotationHandleY, handleSize, 0, 2 * Math.PI)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1 / canvasState.scale
    ctx.stroke()
    
    ctx.restore()
  }
  
  // Draw AI guides
  const drawAIGuides = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2 / canvasState.scale
    ctx.setLineDash([5, 5])
    
    aiState.suggestions.forEach(suggestion => {
      if (suggestion.type === 'optimization') {
        ctx.strokeRect(50, 50, canvasWidth - 100, canvasHeight - 100)
      }
    })
    
    ctx.restore()
  }
  
  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvasState.offsetX) / canvasState.scale
    const y = (e.clientY - rect.top - canvasState.offsetY) / canvasState.scale
    
    const clickedPanel = panels.panels.find(panel => {
      const panelCenterX = panel.x + panel.width / 2
      const panelCenterY = panel.y + panel.height / 2
      const distance = Math.sqrt((x - panelCenterX) ** 2 + (y - panelCenterY) ** 2)
      return distance <= Math.max(panel.width, panel.height) / 2
    })
    
    if (clickedPanel) {
      dispatch({ type: 'SELECT_PANEL', payload: clickedPanel.id })
      setSelectedPanel(clickedPanel)
      
      const handle = getResizeHandle(x, y, clickedPanel)
      if (handle) {
        setIsResizing(true)
        setResizeHandle(handle)
        setDragStart({ x, y })
        return
      }
      
      if (isRotationHandle(x, y, clickedPanel)) {
        setIsRotating(true)
        setRotationStart(Math.atan2(y - (clickedPanel.y + clickedPanel.height / 2), x - (clickedPanel.x + clickedPanel.width / 2)))
        return
      }
      
      setIsDragging(true)
      setDragStart({ x: x - clickedPanel.x, y: y - clickedPanel.y })
    } else {
      dispatch({ type: 'SELECT_PANEL', payload: null })
      setSelectedPanel(null)
    }
  }, [panels, canvasState])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvasState.offsetX) / canvasState.scale
    const y = (e.clientY - rect.top - canvasState.offsetY) / canvasState.scale
    
    if (isDragging && selectedPanel) {
      let newX = x - dragStart.x
      let newY = y - dragStart.y
      
      if (canvasState.snapToGrid) {
        newX = Math.round(newX / canvasState.gridSize) * canvasState.gridSize
        newY = Math.round(newY / canvasState.gridSize) * canvasState.gridSize
      }
      
      dispatch({
        type: 'UPDATE_PANEL',
        payload: {
          id: selectedPanel.id,
          updates: { x: newX, y: newY }
        }
      })
    } else if (isResizing && selectedPanel && resizeHandle) {
      const updates = getResizeUpdates(x, y, selectedPanel, resizeHandle, dragStart)
      if (updates) {
        dispatch({
          type: 'UPDATE_PANEL',
          payload: {
            id: selectedPanel.id,
            updates
          }
        })
      }
    } else if (isRotating && selectedPanel) {
      const angle = Math.atan2(y - (selectedPanel.y + selectedPanel.height / 2), x - (selectedPanel.x + selectedPanel.width / 2))
      const rotation = ((angle - rotationStart) * 180) / Math.PI
      
      dispatch({
        type: 'UPDATE_PANEL',
        payload: {
          id: selectedPanel.id,
          updates: { rotation: ((selectedPanel.rotation ?? 0) + rotation) % 360 }
        }
      })
    }
  }, [isDragging, isResizing, isRotating, selectedPanel, resizeHandle, dragStart, rotationStart, canvasState])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeHandle(null)
  }, [])
  
  // Helper functions
  const getResizeHandle = (x: number, y: number, panel: Panel): string | null => {
    const handleSize = 8 / canvasState.scale
    const handles = {
      'nw': { x: panel.x, y: panel.y },
      'n': { x: panel.x + panel.width / 2, y: panel.y },
      'ne': { x: panel.x + panel.width, y: panel.y },
      'e': { x: panel.x + panel.width, y: panel.y + panel.height / 2 },
      'se': { x: panel.x + panel.width, y: panel.y + panel.height },
      's': { x: panel.x + panel.width / 2, y: panel.y + panel.height },
      'sw': { x: panel.x, y: panel.y + panel.height },
      'w': { x: panel.x, y: panel.y + panel.height / 2 }
    }
    
    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
        return handle
      }
    }
    
    return null
  }
  
  const isRotationHandle = (x: number, y: number, panel: Panel): boolean => {
    const handleSize = 8 / canvasState.scale
    const rotationY = panel.y - 30 / canvasState.scale
    const rotationX = panel.x + panel.width / 2
    
    return Math.abs(x - rotationX) <= handleSize && Math.abs(y - rotationY) <= handleSize
  }
  
  const getResizeUpdates = (x: number, y: number, panel: Panel, handle: string, start: { x: number; y: number }): Partial<Panel> | null => {
    const deltaX = x - start.x
    const deltaY = y - start.y
    
    switch (handle) {
      case 'nw':
        return { x: panel.x + deltaX, y: panel.y + deltaY, width: panel.width - deltaX, height: panel.height - deltaY }
      case 'n':
        return { y: panel.y + deltaY, height: panel.height - deltaY }
      case 'ne':
        return { y: panel.y + deltaY, width: panel.width + deltaX, height: panel.height - deltaY }
      case 'e':
        return { width: panel.width + deltaX }
      case 'se':
        return { width: panel.width + deltaX, height: panel.height + deltaY }
      case 's':
        return { height: panel.height + deltaY }
      case 'sw':
        return { x: panel.x + deltaX, width: panel.width - deltaX, height: panel.height + deltaY }
      case 'w':
        return { x: panel.x + deltaX, width: panel.width - deltaX }
      default:
        return null
    }
  }
  
  // Wheel event for zooming
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, canvasState.scale * zoomFactor))
    
    const newOffsetX = mouseX - (mouseX - canvasState.offsetX) * (newScale / canvasState.scale)
    const newOffsetY = mouseY - (mouseY - canvasState.offsetY) * (newScale / canvasState.scale)
    
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    }))
  }, [canvasState])
  
  // AI suggestion execution
  const handleExecuteSuggestion = useCallback(async (suggestion: AISuggestion) => {
    try {
      const optimizedPanels = await executeSuggestion(suggestion, panels.panels)
      dispatch({ type: 'OPTIMIZE_LAYOUT', payload: optimizedPanels })
      
      toast({
        title: 'AI Optimization Complete',
        description: `Successfully applied: ${suggestion.title}`,
      })
    } catch (error) {
      toast({
        title: 'AI Optimization Failed',
        description: 'Failed to apply AI suggestion. Please try again.',
        variant: 'destructive'
      })
    }
  }, [executeSuggestion, panels.panels, toast])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && panels.selectedPanelId) {
        dispatch({ type: 'DELETE_PANEL', payload: panels.selectedPanelId })
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [panels.selectedPanelId])
  
  // Render canvas when dependencies change
  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement
        if (container) {
          const rect = container.getBoundingClientRect()
          setCanvasWidth(rect.width)
          setCanvasHeight(rect.height)
        }
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return (
    <div className="panel-layout-container">
      {/* AI Assistant Panel */}
      {aiState.isActive && (
        <Card className="mb-4 border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-blue-500" />
              AI Assistant
              {aiState.isProcessing && (
                <Badge variant="secondary" className="ml-2">
                  Processing...
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiState.isProcessing ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{aiState.currentTask}</p>
                <Progress value={aiState.progress} className="w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {aiState.suggestions.map(suggestion => (
                  <div key={suggestion.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant={suggestion.priority === 'high' ? 'destructive' : suggestion.priority === 'medium' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {suggestion.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.impact}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-sm">{suggestion.title}</h4>
                      <p className="text-xs text-gray-600">{suggestion.description}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleExecuteSuggestion(suggestion)}
                      className="ml-3"
                    >
                      {suggestion.action}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Canvas Wrapper */}
      <div className="canvas-wrapper relative">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="panel-canvas border border-gray-200 rounded-lg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          style={{
            cursor: isDragging ? 'grabbing' : 
                   isResizing ? 'nw-resize' : 
                   isRotating ? 'crosshair' : 'default'
          }}
        />
        
        {/* AI Assistant Toggle */}
        <Button
          size="sm"
          variant="outline"
          onClick={toggleAssistant}
          className="absolute top-4 right-4 z-10"
        >
          <Brain className="h-4 w-4 mr-2" />
          {aiState.isActive ? 'Hide AI' : 'Show AI'}
        </Button>
      </div>
      
      {/* Enhanced Control Toolbar */}
      <div className="control-toolbar mt-4 p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex flex-wrap items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center">
              {Math.round(canvasState.scale * 100)}%
            </span>
            <Button size="sm" variant="outline" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={resetView}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          {/* View Controls */}
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant={canvasState.showGrid ? "default" : "outline"} 
              onClick={toggleGrid}
            >
              <Grid className="h-4 w-4 mr-2" />
              Grid
            </Button>
            <Button 
              size="sm" 
              variant={canvasState.showGuides ? "default" : "outline"} 
              onClick={toggleGuides}
            >
              <Target className="h-4 w-4 mr-2" />
              Guides
            </Button>
            <Button 
              size="sm" 
              variant={canvasState.snapToGrid ? "default" : "outline"} 
              onClick={toggleSnap}
            >
              <Zap className="h-4 w-4 mr-2" />
              Snap
            </Button>
          </div>
          
          {/* AI Controls */}
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => generateSuggestions(panels.panels, projectInfo)}
              disabled={panels.panels.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analyze
            </Button>
          </div>
          
          {/* Project Info */}
          <div className="ml-auto text-right">
            <p className="text-sm font-medium">{projectInfo.projectName}</p>
            <p className="text-xs text-gray-500">{panels.panels.length} panels</p>
          </div>
        </div>
      </div>
    </div>
  )
}