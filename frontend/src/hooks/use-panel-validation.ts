import type { Panel } from '@/types/panel'

export interface UsePanelValidationReturn {
  isValidPanel: (panel: any) => panel is Panel
  getPanelValidationErrors: (panel: any) => string[]
  calculatePanelBounds: (panels: Panel[]) => { minX: number; minY: number; maxX: number; maxY: number } | null
}

export const usePanelValidation = (): UsePanelValidationReturn => {
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

  // Utility function to calculate panel bounds
  const calculatePanelBounds = (panels: Panel[]) => {
    if (!panels || panels.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    panels.forEach(panel => {
      if (isValidPanel(panel)) {
        minX = Math.min(minX, panel.x);
        minY = Math.min(minY, panel.y);
        maxX = Math.max(maxX, panel.x + panel.width);
        maxY = Math.max(maxY, panel.y + panel.height);
      }
    });
    
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      return null;
    }
    
    return { minX, minY, maxX, maxY };
  }

  return {
    isValidPanel,
    getPanelValidationErrors,
    calculatePanelBounds
  }
}
