// Comprehensive resize utilities for flexible panel resizing

export interface ResizeHandle {
  id: string;
  position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  cursor: string;
  constraints: ResizeConstraints;
}

export interface ResizeConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number; // width/height ratio
  lockAspectRatio: boolean;
  snapToGrid: boolean;
  gridSize: number;
  snapToOtherPanels: boolean;
  snapThreshold: number;
}

export interface ResizeState {
  isResizing: boolean;
  handleId: string | null;
  panelId: string | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startPanelX: number;
  startPanelY: number;
  currentX: number;
  currentY: number;
  currentWidth: number;
  currentHeight: number;
  constraints: ResizeConstraints;
}

export interface PanelBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeResult {
  x: number;
  y: number;
  width: number;
  height: number;
  snappedToGrid: boolean;
  snappedToPanel: string | null;
  constraintApplied: string | null;
}

// Default resize handles configuration
export const DEFAULT_RESIZE_HANDLES: ResizeHandle[] = [
  {
    id: 'top-left',
    position: 'top-left',
    cursor: 'nw-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  },
  {
    id: 'top-center',
    position: 'top-center',
    cursor: 'n-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  },
  {
    id: 'top-right',
    position: 'top-right',
    cursor: 'ne-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  },
  {
    id: 'middle-left',
    position: 'middle-left',
    cursor: 'w-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  },
  {
    id: 'middle-right',
    position: 'middle-right',
    cursor: 'e-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  },
  {
    id: 'bottom-left',
    position: 'bottom-left',
    cursor: 'sw-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  },
  {
    id: 'bottom-center',
    position: 'bottom-center',
    cursor: 's-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  },
  {
    id: 'bottom-right',
    position: 'bottom-right',
    cursor: 'se-resize',
    constraints: { minWidth: 50, minHeight: 50, lockAspectRatio: false, snapToGrid: true, gridSize: 100, snapToOtherPanels: true, snapThreshold: 4 }
  }
];

/**
 * Calculate resize based on handle position and mouse movement
 */
export function calculateResize(
  handleId: string,
  startX: number,
  startY: number,
  startWidth: number,
  startHeight: number,
  startPanelX: number,
  startPanelY: number,
  mouseX: number,
  mouseY: number,
  constraints: ResizeConstraints
): { x: number; y: number; width: number; height: number } {
  const dx = mouseX - startX;
  const dy = mouseY - startY;
  
  let newX = startPanelX;
  let newY = startPanelY;
  let newWidth = startWidth;
  let newHeight = startHeight;
  
  switch (handleId) {
    case 'top-left':
      newX = startPanelX + dx;
      newY = startPanelY + dy;
      newWidth = startWidth - dx;
      newHeight = startHeight - dy;
      break;
      
    case 'top-center':
      newY = startPanelY + dy;
      newHeight = startHeight - dy;
      break;
      
    case 'top-right':
      newY = startPanelY + dy;
      newWidth = startWidth + dx;
      newHeight = startHeight - dy;
      break;
      
    case 'middle-left':
      newX = startPanelX + dx;
      newWidth = startWidth - dx;
      break;
      
    case 'middle-right':
      newWidth = startWidth + dx;
      break;
      
    case 'bottom-left':
      newX = startPanelX + dx;
      newWidth = startWidth - dx;
      newHeight = startHeight + dy;
      break;
      
    case 'bottom-center':
      newHeight = startHeight + dy;
      break;
      
    case 'bottom-right':
      newWidth = startWidth + dx;
      newHeight = startHeight + dy;
      break;
      
    default:
      return { x: startPanelX, y: startPanelY, width: startWidth, height: startHeight };
  }
  
  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

/**
 * Apply resize constraints
 */
export function applyResizeConstraints(
  x: number,
  y: number,
  width: number,
  height: number,
  constraints: ResizeConstraints
): ResizeResult {
  let newX = x;
  let newY = y;
  let newWidth = width;
  let newHeight = height;
  let constraintApplied: string | null = null;
  
  // Apply minimum size constraints
  if (newWidth < constraints.minWidth) {
    newWidth = constraints.minWidth;
    constraintApplied = 'min-width';
  }
  if (newHeight < constraints.minHeight) {
    newHeight = constraints.minHeight;
    constraintApplied = 'min-height';
  }
  
  // Apply maximum size constraints
  if (constraints.maxWidth && newWidth > constraints.maxWidth) {
    newWidth = constraints.maxWidth;
    constraintApplied = 'max-width';
  }
  if (constraints.maxHeight && newHeight > constraints.maxHeight) {
    newHeight = constraints.maxHeight;
    constraintApplied = 'max-height';
  }
  
  // Apply aspect ratio constraint
  if (constraints.lockAspectRatio && constraints.aspectRatio) {
    const currentRatio = newWidth / newHeight;
    if (Math.abs(currentRatio - constraints.aspectRatio) > 0.01) {
      // Adjust width to maintain aspect ratio
      newWidth = newHeight * constraints.aspectRatio;
      constraintApplied = 'aspect-ratio';
    }
  }
  
  // Apply grid snapping
  let snappedToGrid = false;
  if (constraints.snapToGrid) {
    const snappedX = snapToGrid(newX, constraints.gridSize);
    const snappedY = snapToGrid(newY, constraints.gridSize);
    const snappedWidth = snapToGrid(newWidth, constraints.gridSize);
    const snappedHeight = snapToGrid(newHeight, constraints.gridSize);
    
    if (snappedX !== newX || snappedY !== newY || snappedWidth !== newWidth || snappedHeight !== newHeight) {
      newX = snappedX;
      newY = snappedY;
      newWidth = snappedWidth;
      newHeight = snappedHeight;
      snappedToGrid = true;
    }
  }
  
  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
    snappedToGrid,
    snappedToPanel: null,
    constraintApplied
  };
}

/**
 * Snap to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Find nearby panels for snapping during resize
 */
export function findSnapTargets(
  x: number,
  y: number,
  width: number,
  height: number,
  otherPanels: PanelBounds[],
  threshold: number = 4
): Array<{ panelId: string; edge: string; distance: number; snapValue: number }> {
  const snapTargets: Array<{ panelId: string; edge: string; distance: number; snapValue: number }> = [];
  
  otherPanels.forEach(panel => {
    // Check horizontal edges
    const leftDistance = Math.abs(x - (panel.x + panel.width));
    const rightDistance = Math.abs((x + width) - panel.x);
    
    if (leftDistance <= threshold) {
      snapTargets.push({
        panelId: panel.id,
        edge: 'left-to-right',
        distance: leftDistance,
        snapValue: panel.x + panel.width
      });
    }
    
    if (rightDistance <= threshold) {
      snapTargets.push({
        panelId: panel.id,
        edge: 'right-to-left',
        distance: rightDistance,
        snapValue: panel.x
      });
    }
    
    // Check vertical edges
    const topDistance = Math.abs(y - (panel.y + panel.height));
    const bottomDistance = Math.abs((y + height) - panel.y);
    
    if (topDistance <= threshold) {
      snapTargets.push({
        panelId: panel.id,
        edge: 'top-to-bottom',
        distance: topDistance,
        snapValue: panel.y + panel.height
      });
    }
    
    if (bottomDistance <= threshold) {
      snapTargets.push({
        panelId: panel.id,
        edge: 'bottom-to-top',
        distance: bottomDistance,
        snapValue: panel.y
      });
    }
  });
  
  return snapTargets.sort((a, b) => a.distance - b.distance);
}

/**
 * Apply panel-to-panel snapping during resize
 */
export function applyPanelSnapping(
  x: number,
  y: number,
  width: number,
  height: number,
  otherPanels: PanelBounds[],
  threshold: number = 4
): { x: number; y: number; width: number; height: number; snappedToPanel: string | null } {
  const snapTargets = findSnapTargets(x, y, width, height, otherPanels, threshold);
  
  if (snapTargets.length === 0) {
    return { x, y, width, height, snappedToPanel: null };
  }
  
  const bestSnap = snapTargets[0];
  let newX = x;
  let newY = y;
  let newWidth = width;
  let newHeight = height;
  
  switch (bestSnap.edge) {
    case 'left-to-right':
      newX = bestSnap.snapValue;
      newWidth = (x + width) - bestSnap.snapValue;
      break;
    case 'right-to-left':
      newWidth = bestSnap.snapValue - x;
      break;
    case 'top-to-bottom':
      newY = bestSnap.snapValue;
      newHeight = (y + height) - bestSnap.snapValue;
      break;
    case 'bottom-to-top':
      newHeight = bestSnap.snapValue - y;
      break;
  }
  
  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
    snappedToPanel: bestSnap.panelId
  };
}

/**
 * Comprehensive resize handler
 */
export function handleResize(
  handleId: string,
  mouseX: number,
  mouseY: number,
  resizeState: ResizeState,
  otherPanels: PanelBounds[]
): ResizeResult {
  // Calculate initial resize
  const initialResize = calculateResize(
    handleId,
    resizeState.startX,
    resizeState.startY,
    resizeState.startWidth,
    resizeState.startHeight,
    resizeState.startPanelX,
    resizeState.startPanelY,
    mouseX,
    mouseY,
    resizeState.constraints
  );
  
  // Apply constraints
  let result = applyResizeConstraints(
    initialResize.x,
    initialResize.y,
    initialResize.width,
    initialResize.height,
    resizeState.constraints
  );
  
  // Apply panel-to-panel snapping if enabled
  if (resizeState.constraints.snapToOtherPanels) {
    const snapResult = applyPanelSnapping(
      result.x,
      result.y,
      result.width,
      result.height,
      otherPanels,
      resizeState.constraints.snapThreshold
    );
    
    if (snapResult.snappedToPanel) {
      result.x = snapResult.x;
      result.y = snapResult.y;
      result.width = snapResult.width;
      result.height = snapResult.height;
      result.snappedToPanel = snapResult.snappedToPanel;
    }
  }
  
  return result;
}

/**
 * Create custom resize handles with specific constraints
 */
export function createCustomResizeHandles(
  constraints: Partial<ResizeConstraints> = {}
): ResizeHandle[] {
  const defaultConstraints: ResizeConstraints = {
    minWidth: 50,
    minHeight: 50,
    lockAspectRatio: false,
    snapToGrid: true,
    gridSize: 100,
    snapToOtherPanels: true,
    snapThreshold: 4
  };
  
  const mergedConstraints = { ...defaultConstraints, ...constraints };
  
  return DEFAULT_RESIZE_HANDLES.map(handle => ({
    ...handle,
    constraints: mergedConstraints
  }));
}

/**
 * Get cursor style for resize handle
 */
export function getResizeCursor(handleId: string): string {
  const handle = DEFAULT_RESIZE_HANDLES.find(h => h.id === handleId);
  return handle?.cursor || 'default';
}

/**
 * Validate resize result
 */
export function validateResizeResult(
  result: ResizeResult,
  constraints: ResizeConstraints,
  containerBounds?: { width: number; height: number }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check minimum size
  if (result.width < constraints.minWidth) {
    errors.push(`Width must be at least ${constraints.minWidth}px`);
  }
  if (result.height < constraints.minHeight) {
    errors.push(`Height must be at least ${constraints.minHeight}px`);
  }
  
  // Check maximum size
  if (constraints.maxWidth && result.width > constraints.maxWidth) {
    errors.push(`Width cannot exceed ${constraints.maxWidth}px`);
  }
  if (constraints.maxHeight && result.height > constraints.maxHeight) {
    errors.push(`Height cannot exceed ${constraints.maxHeight}px`);
  }
  
  // Check container bounds
  if (containerBounds) {
    if (result.x < 0) errors.push('Panel cannot extend beyond left edge');
    if (result.y < 0) errors.push('Panel cannot extend beyond top edge');
    if (result.x + result.width > containerBounds.width) {
      errors.push('Panel cannot extend beyond right edge');
    }
    if (result.y + result.height > containerBounds.height) {
      errors.push('Panel cannot extend beyond bottom edge');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
} 