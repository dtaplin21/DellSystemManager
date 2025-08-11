'use client'

import { useState, useRef, useEffect, useCallback, useReducer, useMemo } from 'react'
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
  layoutScale?: number // Add layout scale from parent component
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

export default function PanelLayout({ mode, projectInfo, externalPanels, onPanelUpdate, layoutScale = 1.0 }: PanelLayoutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [panels, dispatch] = useReducer(panelReducer, { panels: [], selectedPanelId: null })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState(0)
  
  // Normalize layout scale to ensure panels are always visible
  // If layout scale is extremely small (like 0.0025), normalize it to a reasonable value
  const normalizedLayoutScale = useMemo(() => {
    if (layoutScale < 0.01) {
      // If scale is extremely small, normalize it to make panels visible
      const normalized = 0.01 / layoutScale;
      console.log('[PanelLayout] Layout scale normalized:', { 
        original: layoutScale, 
        normalized, 
        reason: 'Scale too small, normalizing for visibility' 
      });
      return normalized;
    }
    return 1.0; // Use 1.0 for normal scales
  }, [layoutScale]);
  
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
  
  // Debug function to create a test panel
  const createTestPanel = useCallback(() => {
    const testPanel: Panel = {
      id: 'test-panel',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      length: 150,
      rotation: 0,
      fill: '#ff0000',
      color: '#cc0000',
      meta: {
        repairs: [],
        location: { x: 100, y: 100, gridCell: { row: 0, col: 0 } }
      }
    };
    console.log('[PanelLayout] Creating test panel:', testPanel);
    dispatch({ type: 'ADD_PANEL', payload: testPanel });
  }, []);
  
  // Initialize panels from external source
  useEffect(() => {
    console.log('[PanelLayout] externalPanels received:', externalPanels);
    console.log('[PanelLayout] current panels state:', panels.panels);
    console.log('[PanelLayout] canvas state:', canvasState);
    
    if (externalPanels && externalPanels.length > 0) {
      // Only update if panels actually changed (deep comparison)
      const newPanelIds = externalPanels.map(p => p.id).sort().join(',')
      console.log('[PanelLayout] newPanelIds:', newPanelIds);
      console.log('[PanelLayout] lastExternalPanels.current:', lastExternalPanels.current);
      
      if (newPanelIds !== lastExternalPanels.current) {
        console.log('[PanelLayout] Updating panels from external source');
        lastExternalPanels.current = newPanelIds
        
        // Validate external panels before setting them
        const validExternalPanels = externalPanels.filter(panel => {
          if (!isValidPanel(panel)) {
            const errors = getPanelValidationErrors(panel);
            console.warn('[PanelLayout] Skipping invalid external panel:', { panel, errors });
            return false;
          }
          return true;
        });
        
        if (validExternalPanels.length !== externalPanels.length) {
          console.warn('[PanelLayout] Some external panels were invalid:', {
            total: externalPanels.length,
            valid: validExternalPanels.length,
            skipped: externalPanels.length - validExternalPanels.length
          });
        }
        
        if (validExternalPanels.length > 0) {
          dispatch({ type: 'SET_PANELS', payload: validExternalPanels })
        } else {
          console.warn('[PanelLayout] No valid external panels to set');
        }
      } else {
        console.log('[PanelLayout] No panel changes detected');
      }
    } else if (externalPanels && externalPanels.length === 0) {
      // Handle case where external panels is explicitly set to empty array
      console.log('[PanelLayout] External panels explicitly set to empty, clearing internal state');
      lastExternalPanels.current = ''
      dispatch({ type: 'SET_PANELS', payload: [] })
    } else {
      console.log('[PanelLayout] No external panels provided or empty array');
    }
  }, [externalPanels, panels.panels]) // Include panels.panels to detect internal state changes
  
  // Notify parent of panel updates
  useEffect(() => {
    console.log('[PanelLayout] panels state changed:', panels.panels);
    if (onPanelUpdate) {
      onPanelUpdate(panels.panels)
    }
  }, [panels.panels, onPanelUpdate]) // Include onPanelUpdate to avoid stale closures
  
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
  
  // Utility function to validate panel data
  const isValidPanel = (panel: any): panel is Panel => {
    if (!panel || typeof panel !== 'object') {
      return false;
    }
    
    // Check required properties
    if (typeof panel.id !== 'string' || !panel.id) {
      return false;
    }
    
    // Check coordinates
    if (typeof panel.x !== 'number' || !isFinite(panel.x)) {
      return false;
    }
    
    if (typeof panel.y !== 'number' || !isFinite(panel.y)) {
      return false;
    }
    
    // Check dimensions
    if (typeof panel.width !== 'number' || !isFinite(panel.width) || panel.width <= 0) {
      return false;
    }
    
    if (typeof panel.height !== 'number' || !isFinite(panel.height) || panel.height <= 0) {
      return false;
    }
    
    // Check reasonable limits
    const MAX_DIMENSION = 10000;
    const MIN_DIMENSION = 0.1;
    const MAX_COORDINATE = 100000;
    
    if (panel.width > MAX_DIMENSION || panel.height > MAX_DIMENSION) {
      return false;
    }
    
    if (panel.width < MIN_DIMENSION || panel.height < MIN_DIMENSION) {
      return false;
    }
    
    if (Math.abs(panel.x) > MAX_COORDINATE || Math.abs(panel.y) > MAX_COORDINATE) {
      return false;
    }
    
    // Check rotation if present
    if (panel.rotation !== undefined && panel.rotation !== null) {
      if (typeof panel.rotation !== 'number' || !isFinite(panel.rotation)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Utility function to get validation errors for a panel
  const getPanelValidationErrors = (panel: any): string[] => {
    const errors: string[] = [];
    
    if (!panel || typeof panel !== 'object') {
      errors.push('Panel is not a valid object');
      return errors;
    }
    
    if (typeof panel.id !== 'string' || !panel.id) {
      errors.push('Panel missing or invalid ID');
    }
    
    if (typeof panel.x !== 'number' || !isFinite(panel.x)) {
      errors.push('Panel has invalid X coordinate');
    }
    
    if (typeof panel.y !== 'number' || !isFinite(panel.y)) {
      errors.push('Panel has invalid Y coordinate');
    }
    
    if (typeof panel.width !== 'number' || !isFinite(panel.width) || panel.width <= 0) {
      errors.push('Panel has invalid width');
    }
    
    if (typeof panel.height !== 'number' || !isFinite(panel.height) || panel.height <= 0) {
      errors.push('Panel has invalid height');
    }
    
    if (panel.width > 10000 || panel.height > 10000) {
      errors.push('Panel dimensions too large (max 10,000 units)');
    }
    
    if (panel.width < 0.1 || panel.height < 0.1) {
      errors.push('Panel dimensions too small (min 0.1 units)');
    }
    
    if (Math.abs(panel.x) > 100000 || Math.abs(panel.y) > 100000) {
      errors.push('Panel coordinates out of bounds (max ±100,000 units)');
    }
    
    if (panel.rotation !== undefined && panel.rotation !== null) {
      if (typeof panel.rotation !== 'number' || !isFinite(panel.rotation)) {
        errors.push('Panel has invalid rotation');
      }
    }
    
    return errors;
  }
  
  // Auto-fit viewport to show all panels
  const autoFitViewport = useCallback(() => {
    if (panels.panels.length === 0) return;
    
    // Find bounds of all panels in effective coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    panels.panels.forEach(panel => {
      const effectiveX = panel.x * normalizedLayoutScale;
      const effectiveY = panel.y * normalizedLayoutScale;
      const effectiveWidth = panel.width * normalizedLayoutScale;
      const effectiveHeight = panel.height * normalizedLayoutScale;
      
      minX = Math.min(minX, effectiveX);
      minY = Math.min(minY, effectiveY);
      maxX = Math.max(maxX, effectiveX + effectiveWidth);
      maxY = Math.max(maxY, effectiveY + effectiveHeight);
    });
    
    // Add padding
    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    // Calculate required scale to fit in canvas
    const panelWidth = maxX - minX;
    const panelHeight = maxY - minY;
    const scaleX = (canvasWidth - 200) / panelWidth;
    const scaleY = (canvasHeight - 200) / panelHeight;
    const newScale = Math.min(scaleX, scaleY, 2.0); // Cap at 2x zoom
    
    // Set new viewport
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      offsetX: -minX * newScale + 100,
      offsetY: -minY * newScale + 100
    }));
    
    console.log('[PanelLayout] Auto-fit viewport:', {
      panelBounds: { minX, minY, maxX, maxY },
      newScale,
      newOffset: { 
        x: -minX * newScale + 100, 
        y: -minY * newScale + 100 
      }
    });
  }, [panels.panels, canvasWidth, canvasHeight, normalizedLayoutScale])
  
  // Canvas rendering function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    console.log('[PanelLayout] renderCanvas called with:', {
      canvasWidth,
      canvasHeight,
      canvasState,
      panelsCount: panels.panels.length,
      layoutScale,
      normalizedLayoutScale
    });
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    
    // Save context for transformations
    ctx.save()
    
    // Apply viewport transformations in the correct order:
    // 1. Pan (offset)
    // 2. Scale (zoom)
    // Note: We don't apply layoutScale globally anymore to avoid scaling issues
    ctx.translate(canvasState.offsetX, canvasState.offsetY)
    ctx.scale(canvasState.scale, canvasState.scale)
    
    console.log('[PanelLayout] Canvas transformations applied:', {
      offsetX: canvasState.offsetX,
      offsetY: canvasState.offsetY,
      zoomScale: canvasState.scale,
      layoutScale
    });
    
    // Draw grid
    if (canvasState.showGrid) {
      drawGrid(ctx)
    }
    
    // Draw panels
    console.log('[PanelLayout] Rendering canvas with panels:', panels.panels);
    console.log('[PanelLayout] Canvas drawing area:', {
      width: canvasWidth,
      height: canvasHeight,
      offsetX: canvasState.offsetX,
      offsetY: canvasState.offsetY,
      zoomScale: canvasState.scale,
      layoutScale
    });
    
    // Filter and validate panels before rendering
    const validPanels = panels.panels.filter(panel => {
      if (!isValidPanel(panel)) {
        const errors = getPanelValidationErrors(panel);
        console.warn('[PanelLayout] Skipping invalid panel:', { panel, errors });
        return false;
      }
      return true;
    });
    
    console.log('[PanelLayout] Valid panels for rendering:', validPanels.length, 'out of', panels.panels.length);
    
    validPanels.forEach(panel => {
      console.log('[PanelLayout] Drawing panel:', panel);
      
      // Check if panel coordinates are reasonable
      const worldX = panel.x;
      const worldY = panel.y;
      // Calculate screen coordinates considering zoom and offset only
      const screenX = (worldX * normalizedLayoutScale * canvasState.scale) + canvasState.offsetX;
      const screenY = (worldY * normalizedLayoutScale * canvasState.scale) + canvasState.offsetY;
      
      console.log('[PanelLayout] Panel coordinates:', {
        world: { x: worldX, y: worldY },
        screen: { x: screenX, y: screenY },
        canvasBounds: { width: canvasWidth, height: canvasHeight },
        isVisible: screenX >= 0 && screenX <= canvasWidth && screenY >= 0 && screenY <= canvasHeight
      });
      
      drawPanel(ctx, panel, panel.id === panels.selectedPanelId)
    })
    
    // Draw selection handles
    if (panels.selectedPanelId) {
      const selectedPanel = panels.panels.find(p => p.id === panels.selectedPanelId)
      if (selectedPanel) {
        // Validate the selected panel before drawing handles
        if (isValidPanel(selectedPanel)) {
          drawSelectionHandles(ctx, selectedPanel)
        } else {
          const errors = getPanelValidationErrors(selectedPanel);
          console.warn('[PanelLayout] Selected panel has validation errors, skipping handles:', { panel: selectedPanel, errors });
        }
      }
    }
    
    // Draw AI guides
    if (canvasState.showGuides && aiState.suggestions.length > 0) {
      drawAIGuides(ctx)
    }
    
    // Restore context
    ctx.restore()
  }, [panels, canvasState, aiState.suggestions, canvasWidth, canvasHeight, normalizedLayoutScale])
  
  // Draw grid
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e0e0e0'
    // Use zoom scale for line width since layout scale is applied globally
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
    console.log('[PanelLayout] Drawing panel with properties:', {
      id: panel.id,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      rotation: panel.rotation,
      zoomScale: canvasState.scale,
      layoutScale
    });
    
    // Panel dimension validation using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot draw invalid panel:', { panel, errors });
      return;
    }
    
    // Additional validation for rendering-specific checks
    // Check if panel would be visible on canvas (basic culling)
    const effectiveX = panel.x * normalizedLayoutScale;
    const effectiveY = panel.y * normalizedLayoutScale;
    const effectiveWidth = panel.width * normalizedLayoutScale;
    const effectiveHeight = panel.height * normalizedLayoutScale;
    
    // Calculate panel bounds in screen coordinates
    const panelLeft = effectiveX * canvasState.scale + canvasState.offsetX;
    const panelTop = effectiveY * canvasState.scale + canvasState.offsetY;
    const panelRight = (effectiveX + effectiveWidth) * canvasState.scale + canvasState.offsetX;
    const panelBottom = (effectiveY + effectiveHeight) * canvasState.scale + canvasState.offsetY;
    
    // Check if panel is completely outside canvas bounds (with some margin)
    const margin = 100; // pixels
    if (panelRight < -margin || panelLeft > canvasWidth + margin || 
        panelBottom < -margin || panelTop > canvasHeight + margin) {
      console.log('[PanelLayout] Panel outside canvas bounds, skipping render:', { 
        id: panel.id, 
        bounds: { left: panelLeft, top: panelTop, right: panelRight, bottom: panelBottom },
        canvasBounds: { width: canvasWidth, height: canvasHeight }
      });
      return;
    }
    
    console.log('[PanelLayout] Panel validation passed, rendering:', {
      id: panel.id,
      effectiveCoords: { x: effectiveX, y: effectiveY },
      effectiveDimensions: { width: effectiveWidth, height: effectiveHeight },
      screenBounds: { left: panelLeft, top: panelTop, right: panelRight, bottom: panelBottom }
    });
    
    ctx.save()
    
    // Apply panel transformations
    // Since layout scale is not applied globally, we need to scale the panel coordinates
    // to make them visible on the canvas
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
    
    ctx.restore()
  }
  
  // Draw selection handles
  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, panel: Panel) => {
    // Validate panel before drawing handles using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot draw selection handles for invalid panel:', { panel, errors });
      return;
    }
    
    // Use zoom scale for handle sizes
    const handleSize = 8 / canvasState.scale
    
    // Calculate effective coordinates and dimensions
    const effectiveX = panel.x * normalizedLayoutScale;
    const effectiveY = panel.y * normalizedLayoutScale;
    const effectiveWidth = panel.width * normalizedLayoutScale;
    const effectiveHeight = panel.height * normalizedLayoutScale;
    
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
    ctx.beginPath()
    ctx.arc(effectiveWidth / 2, rotationHandleY, handleSize, 0, 2 * Math.PI)
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
    // Use zoom scale for line width since layout scale is applied globally
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
    // Calculate world coordinates considering zoom only (layout scale is applied per panel)
    const x = (e.clientX - rect.left - canvasState.offsetX) / canvasState.scale
    const y = (e.clientY - rect.top - canvasState.offsetY) / canvasState.scale
    
    const clickedPanel = panels.panels.find(panel => {
      // Convert panel coordinates to effective coordinates for hit testing
      const effectiveX = panel.x * normalizedLayoutScale;
      const effectiveY = panel.y * normalizedLayoutScale;
      const effectiveWidth = panel.width * normalizedLayoutScale;
      const effectiveHeight = panel.height * normalizedLayoutScale;
      
      const panelCenterX = effectiveX + effectiveWidth / 2
      const panelCenterY = effectiveY + effectiveHeight / 2
      const distance = Math.sqrt((x - panelCenterX) ** 2 + (y - panelCenterY) ** 2)
      return distance <= Math.max(effectiveWidth, effectiveHeight) / 2
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
        setRotationStart(Math.atan2(y - (clickedPanel.y * normalizedLayoutScale + (clickedPanel.height * normalizedLayoutScale) / 2), x - (clickedPanel.x * normalizedLayoutScale + (clickedPanel.width * normalizedLayoutScale) / 2)))
        return
      }
      
      setIsDragging(true)
      setDragStart({ x: x - (clickedPanel.x * normalizedLayoutScale), y: y - (clickedPanel.y * normalizedLayoutScale) })
    } else {
      dispatch({ type: 'SELECT_PANEL', payload: null })
      setSelectedPanel(null)
    }
  }, [panels, canvasState, normalizedLayoutScale])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    // Calculate world coordinates considering zoom only (layout scale is applied per panel)
    const x = (e.clientX - rect.left - canvasState.offsetX) / canvasState.scale
    const y = (e.clientY - rect.top - canvasState.offsetY) / canvasState.scale
    
    if (isDragging && selectedPanel) {
      let newX = x - dragStart.x
      let newY = y - dragStart.y
      
      // Convert back to original coordinate space
      newX = newX / normalizedLayoutScale
      newY = newY / normalizedLayoutScale
      
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
      const angle = Math.atan2(y - (selectedPanel.y * normalizedLayoutScale + (selectedPanel.height * normalizedLayoutScale) / 2), x - (selectedPanel.x * normalizedLayoutScale + (selectedPanel.width * normalizedLayoutScale) / 2))
      const rotation = ((angle - rotationStart) * 180) / Math.PI
      
      dispatch({
        type: 'UPDATE_PANEL',
        payload: {
          id: selectedPanel.id,
          updates: { rotation: ((selectedPanel.rotation ?? 0) + rotation) % 360 }
        }
      })
    }
  }, [isDragging, isResizing, isRotating, selectedPanel, resizeHandle, dragStart, rotationStart, canvasState, normalizedLayoutScale])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeHandle(null)
  }, [])
  
  // Helper functions
  const getResizeHandle = (x: number, y: number, panel: Panel): string | null => {
    // Validate panel before processing using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot get resize handle for invalid panel:', { panel, errors });
      return null;
    }
    
    // Use zoom scale for handle sizes
    const handleSize = 8 / canvasState.scale
    
    // Calculate effective coordinates and dimensions
    const effectiveX = panel.x * normalizedLayoutScale;
    const effectiveY = panel.y * normalizedLayoutScale;
    const effectiveWidth = panel.width * normalizedLayoutScale;
    const effectiveHeight = panel.height * normalizedLayoutScale;
    
    const handles = {
      'nw': { x: effectiveX, y: effectiveY },
      'n': { x: effectiveX + effectiveWidth / 2, y: effectiveY },
      'ne': { x: effectiveX + effectiveWidth, y: effectiveY },
      'e': { x: effectiveX + effectiveWidth, y: effectiveY + effectiveHeight / 2 },
      'se': { x: effectiveX + effectiveWidth, y: effectiveY + effectiveHeight },
      's': { x: effectiveX + effectiveWidth / 2, y: effectiveY + effectiveHeight },
      'sw': { x: effectiveX, y: effectiveY + effectiveHeight },
      'w': { x: effectiveX, y: effectiveY + effectiveHeight / 2 }
    }
    
    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
        return handle
      }
    }
    
    return null
  }
  
  const isRotationHandle = (x: number, y: number, panel: Panel): boolean => {
    // Validate panel before processing using utility function
    if (!isValidPanel(panel)) {
      const errors = getPanelValidationErrors(panel);
      console.warn('[PanelLayout] Cannot check rotation handle for invalid panel:', { panel, errors });
      return false;
    }
    
    // Use zoom scale for handle sizes
    const handleSize = 8 / canvasState.scale
    
    // Calculate effective coordinates and dimensions
    const effectiveX = panel.x * normalizedLayoutScale;
    const effectiveY = panel.y * normalizedLayoutScale;
    const effectiveWidth = panel.width * normalizedLayoutScale;
    
    const rotationHandleY = effectiveY - 30 / canvasState.scale
    const rotationHandleX = effectiveX + effectiveWidth / 2
    
    return Math.abs(x - rotationHandleX) <= handleSize && Math.abs(y - rotationHandleY) <= handleSize
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
  const handleWheel = useCallback((e: WheelEvent) => {
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

  // Add wheel event listener manually to avoid passive event issues
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const wheelHandler = (e: WheelEvent) => handleWheel(e)
    
    // Add event listener with non-passive option
    canvas.addEventListener('wheel', wheelHandler, { passive: false })
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler)
    }
  }, [handleWheel])
  
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
          console.log('[PanelLayout] Canvas resize - container dimensions:', rect);
          setCanvasWidth(rect.width)
          setCanvasHeight(rect.height)
        }
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Auto-fit viewport when panels are loaded
  useEffect(() => {
    if (panels.panels.length > 0 && canvasWidth > 0 && canvasHeight > 0) {
      // Small delay to ensure canvas is ready
      const timer = setTimeout(() => {
        autoFitViewport();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [panels.panels.length, canvasWidth, canvasHeight, autoFitViewport]);
  
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
        {/* Debug Controls */}
        <div className="mb-4 flex gap-2">
          <Button onClick={createTestPanel} variant="outline" size="sm">
            Create Test Panel
          </Button>
          <Button onClick={() => console.log('Current panels state:', panels)} variant="outline" size="sm">
            Log Panels State
          </Button>
          <Button onClick={() => console.log('Raw external panels:', externalPanels)} variant="outline" size="sm">
            Log External Panels
          </Button>
          <Button onClick={autoFitViewport} variant="outline" size="sm">
            Auto-Fit Viewport
          </Button>
        </div>
        
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="panel-canvas border border-gray-200 rounded-lg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
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