import { useState, useCallback, useRef, useEffect } from 'react';
import type { Panel } from '../types/panel';
import {
  ResizeState,
  ResizeConstraints,
  ResizeResult,
  PanelBounds,
  handleResize,
  createCustomResizeHandles,
  getResizeCursor,
  validateResizeResult
} from '../lib/resize-utils';

interface UseFlexibleResizeOptions {
  panels: Panel[];
  onPanelUpdate: (panels: Panel[]) => void;
  constraints?: Partial<ResizeConstraints>;
  containerBounds?: { width: number; height: number };
  enableVisualFeedback?: boolean;
  enableSnapping?: boolean;
}

interface UseFlexibleResizeReturn {
  // State
  isResizing: boolean;
  resizeState: ResizeState | null;
  resizeResult: ResizeResult | null;
  visualFeedback: {
    showSnapLines: boolean;
    snapLines: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }>;
    showConstraintIndicator: boolean;
    constraintMessage: string;
  };
  
  // Handlers
  startResize: (handleId: string, panelId: string, mouseX: number, mouseY: number) => void;
  updateResize: (mouseX: number, mouseY: number) => void;
  endResize: () => void;
  cancelResize: () => void;
  
  // Utilities
  getResizeCursor: (handleId: string) => string;
  getResizeHandles: () => Array<{ id: string; position: string; cursor: string }>;
}

export function useFlexibleResize({
  panels,
  onPanelUpdate,
  constraints = {},
  containerBounds,
  enableVisualFeedback = true,
  enableSnapping = true
}: UseFlexibleResizeOptions): UseFlexibleResizeReturn {
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [resizeResult, setResizeResult] = useState<ResizeResult | null>(null);
  const [visualFeedback, setVisualFeedback] = useState({
    showSnapLines: false,
    snapLines: [] as Array<{ x1: number; y1: number; x2: number; y2: number; color: string }>,
    showConstraintIndicator: false,
    constraintMessage: ''
  });
  
  const resizeHandlesRef = useRef(createCustomResizeHandles(constraints));
  const lastMousePositionRef = useRef({ x: 0, y: 0 });
  
  // Update resize handles when constraints change
  useEffect(() => {
    resizeHandlesRef.current = createCustomResizeHandles(constraints);
  }, [constraints]);
  
  // Convert panels to bounds for snapping
  const getOtherPanelBounds = useCallback((excludePanelId: string): PanelBounds[] => {
    return panels
      .filter(panel => panel.id !== excludePanelId)
      .map(panel => ({
        id: panel.id,
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.length
      }));
  }, [panels]);
  
  // Start resize operation
  const startResize = useCallback((handleId: string, panelId: string, mouseX: number, mouseY: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return;
    
    const handle = resizeHandlesRef.current.find(h => h.id === handleId);
    if (!handle) return;
    
    const newResizeState: ResizeState = {
      isResizing: true,
      handleId,
      panelId,
      startX: mouseX,
      startY: mouseY,
      startWidth: panel.width,
      startHeight: panel.length,
      startPanelX: panel.x,
      startPanelY: panel.y,
      currentX: panel.x,
      currentY: panel.y,
      currentWidth: panel.width,
      currentHeight: panel.length,
      constraints: handle.constraints
    };
    
    setResizeState(newResizeState);
    lastMousePositionRef.current = { x: mouseX, y: mouseY };
    
    // Clear visual feedback
    setVisualFeedback({
      showSnapLines: false,
      snapLines: [],
      showConstraintIndicator: false,
      constraintMessage: ''
    });
  }, [panels]);
  
  // Update resize operation
  const updateResize = useCallback((mouseX: number, mouseY: number) => {
    if (!resizeState || !resizeState.isResizing) return;
    
    lastMousePositionRef.current = { x: mouseX, y: mouseY };
    
    // Get other panels for snapping
    const otherPanels = getOtherPanelBounds(resizeState.panelId || '');
    
    // Calculate new resize result
    const result = handleResize(
      resizeState.handleId!,
      mouseX,
      mouseY,
      resizeState,
      enableSnapping ? otherPanels : []
    );
    
    setResizeResult(result);
    
    // Update resize state
    setResizeState(prev => prev ? {
      ...prev,
      currentX: result.x,
      currentY: result.y,
      currentWidth: result.width,
      currentHeight: result.height
    } : null);
    
    // Update visual feedback
    if (enableVisualFeedback) {
      const snapLines: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
      
      // Add snap lines for panel-to-panel snapping
      if (result.snappedToPanel && enableSnapping) {
        const snappedPanel = otherPanels.find(p => p.id === result.snappedToPanel);
        if (snappedPanel) {
          // Vertical snap line
          if (Math.abs(result.x - (snappedPanel.x + snappedPanel.width)) < 5) {
            snapLines.push({
              x1: snappedPanel.x + snappedPanel.width,
              y1: Math.min(result.y, snappedPanel.y),
              x2: snappedPanel.x + snappedPanel.width,
              y2: Math.max(result.y + result.height, snappedPanel.y + snappedPanel.height),
              color: '#00ff00'
            });
          }
          if (Math.abs((result.x + result.width) - snappedPanel.x) < 5) {
            snapLines.push({
              x1: snappedPanel.x,
              y1: Math.min(result.y, snappedPanel.y),
              x2: snappedPanel.x,
              y2: Math.max(result.y + result.height, snappedPanel.y + snappedPanel.height),
              color: '#00ff00'
            });
          }
          
          // Horizontal snap line
          if (Math.abs(result.y - (snappedPanel.y + snappedPanel.height)) < 5) {
            snapLines.push({
              x1: Math.min(result.x, snappedPanel.x),
              y1: snappedPanel.y + snappedPanel.height,
              x2: Math.max(result.x + result.width, snappedPanel.x + snappedPanel.width),
              y2: snappedPanel.y + snappedPanel.height,
              color: '#00ff00'
            });
          }
          if (Math.abs((result.y + result.height) - snappedPanel.y) < 5) {
            snapLines.push({
              x1: Math.min(result.x, snappedPanel.x),
              y1: snappedPanel.y,
              x2: Math.max(result.x + result.width, snappedPanel.x + snappedPanel.width),
              y2: snappedPanel.y,
              color: '#00ff00'
            });
          }
        }
      }
      
      // Add grid snap lines
      if (result.snappedToGrid && resizeState.constraints.snapToGrid) {
        const gridSize = resizeState.constraints.gridSize;
        
        // Vertical grid lines
        const leftGridX = Math.round(result.x / gridSize) * gridSize;
        const rightGridX = Math.round((result.x + result.width) / gridSize) * gridSize;
        
        if (Math.abs(result.x - leftGridX) < 5) {
          snapLines.push({
            x1: leftGridX,
            y1: result.y - 20,
            x2: leftGridX,
            y2: result.y + result.height + 20,
            color: '#3b82f6'
          });
        }
        if (Math.abs((result.x + result.width) - rightGridX) < 5) {
          snapLines.push({
            x1: rightGridX,
            y1: result.y - 20,
            x2: rightGridX,
            y2: result.y + result.height + 20,
            color: '#3b82f6'
          });
        }
        
        // Horizontal grid lines
        const topGridY = Math.round(result.y / gridSize) * gridSize;
        const bottomGridY = Math.round((result.y + result.height) / gridSize) * gridSize;
        
        if (Math.abs(result.y - topGridY) < 5) {
          snapLines.push({
            x1: result.x - 20,
            y1: topGridY,
            x2: result.x + result.width + 20,
            y2: topGridY,
            color: '#3b82f6'
          });
        }
        if (Math.abs((result.y + result.height) - bottomGridY) < 5) {
          snapLines.push({
            x1: result.x - 20,
            y1: bottomGridY,
            x2: result.x + result.width + 20,
            y2: bottomGridY,
            color: '#3b82f6'
          });
        }
      }
      
      // Constraint indicator
      let constraintMessage = '';
      if (result.constraintApplied) {
        switch (result.constraintApplied) {
          case 'min-width':
            constraintMessage = `Minimum width: ${resizeState.constraints.minWidth}px`;
            break;
          case 'min-height':
            constraintMessage = `Minimum height: ${resizeState.constraints.minHeight}px`;
            break;
          case 'max-width':
            constraintMessage = `Maximum width: ${resizeState.constraints.maxWidth}px`;
            break;
          case 'max-height':
            constraintMessage = `Maximum height: ${resizeState.constraints.maxHeight}px`;
            break;
          case 'aspect-ratio':
            constraintMessage = `Aspect ratio locked: ${resizeState.constraints.aspectRatio?.toFixed(2)}`;
            break;
        }
      }
      
      setVisualFeedback({
        showSnapLines: snapLines.length > 0,
        snapLines,
        showConstraintIndicator: constraintMessage !== '',
        constraintMessage
      });
    }
  }, [resizeState, getOtherPanelBounds, enableSnapping, enableVisualFeedback]);
  
  // End resize operation
  const endResize = useCallback(() => {
    if (!resizeState || !resizeResult) return;
    
    // Validate final result
    const validation = validateResizeResult(resizeResult, resizeState.constraints, containerBounds);
    
    if (validation.isValid) {
      // Update the panel
      const updatedPanels = panels.map(panel => {
        if (panel.id === resizeState.panelId) {
          return {
            ...panel,
            x: resizeResult.x,
            y: resizeResult.y,
            width: resizeResult.width,
            length: resizeResult.height
          };
        }
        return panel;
      });
      
      onPanelUpdate(updatedPanels);
    } else {
      console.warn('Resize validation failed:', validation.errors);
    }
    
    // Reset state
    setResizeState(null);
    setResizeResult(null);
    setVisualFeedback({
      showSnapLines: false,
      snapLines: [],
      showConstraintIndicator: false,
      constraintMessage: ''
    });
  }, [resizeState, resizeResult, panels, onPanelUpdate, containerBounds]);
  
  // Cancel resize operation
  const cancelResize = useCallback(() => {
    setResizeState(null);
    setResizeResult(null);
    setVisualFeedback({
      showSnapLines: false,
      snapLines: [],
      showConstraintIndicator: false,
      constraintMessage: ''
    });
  }, []);
  
  // Get resize cursor
  const getCursor = useCallback((handleId: string) => {
    return getResizeCursor(handleId);
  }, []);
  
  // Get resize handles
  const getResizeHandles = useCallback(() => {
    return resizeHandlesRef.current.map(handle => ({
      id: handle.id,
      position: handle.position,
      cursor: handle.cursor
    }));
  }, []);
  
  return {
    // State
    isResizing: resizeState?.isResizing || false,
    resizeState,
    resizeResult,
    visualFeedback,
    
    // Handlers
    startResize,
    updateResize,
    endResize,
    cancelResize,
    
    // Utilities
    getResizeCursor: getCursor,
    getResizeHandles
  };
} 