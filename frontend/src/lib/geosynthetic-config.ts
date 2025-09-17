// GEOSYNTHETIC LINER SYSTEM CONFIGURATION
// Single source of truth for all geosynthetic liner constants

export const SITE_CONFIG = {
  // Typical liner roll dimensions (feet)
  TYPICAL_ROLL_WIDTH: 20,    // 20 feet wide rolls are common
  TYPICAL_ROLL_LENGTH: 100,  // Variable length, 100ft example
  
  // Site dimensions for 200 rolls east-west, 50 north-south
  SITE_WIDTH: 4000,   // 200 rolls × 20ft width
  SITE_HEIGHT: 5000,  // 50 rolls × 100ft length
  
  // Viewport limits
  MIN_SCALE: 0.02,    // Very zoomed out to see entire large site
  MAX_SCALE: 10,      // Zoomed in for detail work
  
  // Grid settings (feet)
  GRID_SIZE: 10,      // 10-foot grid lines
  MAJOR_GRID: 50,     // 50-foot major grid lines
  
  // Roll spacing (currently unused but kept for future features)
  MIN_OVERLAP: 1,     // Minimum 1-foot overlap between rolls
  SEAM_WIDTH: 2       // 2-foot seam allowance
} as const;

// Material color mapping for liner rolls
export const MATERIAL_COLORS = {
  'HDPE': { normal: '#3b82f6', selected: '#2563eb' },
  'LLDPE': { normal: '#10b981', selected: '#059669' },
  'PVC': { normal: '#ef4444', selected: '#dc2626' },
  'EPDM': { normal: '#a3472a', selected: '#7c2d12' }
} as const;

// Default roll properties
export const DEFAULT_ROLL = {
  material: 'HDPE' as const,
  thickness: 60,
  rotation: 0
} as const;
