/**
 * GeoQC Panel Optimizer
 * Main panel optimization module for the frontend panel layout tool
 */

// Configuration constants
const OPTIMIZATION_CONFIG = {
  gridSnapTolerance: 0.2,
  minPanelSpacing: 1.0,
  maxOverlapTolerance: 0.1,
  defaultOptimizationStrategy: 'balanced'
};

/**
 * Main panel layout optimization function
 * @param {Array} panels Array of panel objects
 * @param {Object} siteConfig Site configuration parameters
 * @param {Object} optimizationSettings Optimization preferences
 * @returns {Object} Optimized panel layout with summary
 */
function optimizePanelLayout(panels, siteConfig, optimizationSettings = {}) {
  const strategy = optimizationSettings.strategy || OPTIMIZATION_CONFIG.defaultOptimizationStrategy;
  
  // Create deep copy of panels to avoid modifying original
  const optimizedPanels = JSON.parse(JSON.stringify(panels));
  
  // Apply optimization based on strategy
  switch (strategy) {
    case 'material-efficient':
      return optimizeMaterialEfficiency(optimizedPanels, siteConfig, optimizationSettings);
    case 'labor-efficient':
      return optimizeLaborEfficiency(optimizedPanels, siteConfig, optimizationSettings);
    case 'balanced':
    default:
      return optimizeBalanced(optimizedPanels, siteConfig, optimizationSettings);
  }
}

/**
 * Material-efficient optimization strategy
 * Minimizes material waste by optimizing panel placement and sizing
 */
function optimizeMaterialEfficiency(panels, siteConfig, settings) {
  // Sort panels by material type to group similar materials
  panels.sort((a, b) => {
    const materialA = a.material || 'HDPE 60 mil';
    const materialB = b.material || 'HDPE 60 mil';
    return materialA.localeCompare(materialB);
  });
  
  // Apply tight packing algorithm
  applyTightPacking(panels, siteConfig);
  
  // Minimize edge waste
  minimizeEdgeWaste(panels, siteConfig);
  
  return {
    panels: panels,
    summary: {
      strategy: 'material-efficient',
      wasteReduction: calculateWasteReduction(panels, siteConfig),
      materialUtilization: calculateMaterialUtilization(panels, siteConfig)
    }
  };
}

/**
 * Labor-efficient optimization strategy
 * Minimizes installation time by optimizing for construction workflow
 */
function optimizeLaborEfficiency(panels, siteConfig, settings) {
  // Organize panels for logical installation sequence
  optimizeInstallationSequence(panels, siteConfig);
  
  // Minimize seam lengths
  minimizeSeamLengths(panels);
  
  // Group panels by installation zone
  groupByInstallationZone(panels, siteConfig);
  
  return {
    panels: panels,
    summary: {
      strategy: 'labor-efficient',
      seamReduction: calculateSeamReduction(panels),
      installationEfficiency: calculateInstallationEfficiency(panels)
    }
  };
}

/**
 * Balanced optimization strategy
 * Compromises between material and labor efficiency
 */
function optimizeBalanced(panels, siteConfig, settings) {
  // Apply moderate packing with installation considerations
  applyModeratePacking(panels, siteConfig);
  
  // Balance seam optimization with material efficiency
  balanceSeamAndMaterial(panels, siteConfig);
  
  // Resolve overlaps and spacing issues
  resolveOverlaps(panels);
  
  return {
    panels: panels,
    summary: {
      strategy: 'balanced',
      overallEfficiency: calculateOverallEfficiency(panels, siteConfig),
      coverage: calculateSiteCoverage(panels, siteConfig)
    }
  };
}

/**
 * Apply tight packing algorithm for material efficiency
 */
function applyTightPacking(panels, siteConfig) {
  const spacing = OPTIMIZATION_CONFIG.minPanelSpacing;
  
  panels.forEach((panel, index) => {
    // Find optimal position with minimal gaps
    const position = findOptimalPosition(panel, panels.slice(0, index), siteConfig, spacing);
    panel.x = position.x;
    panel.y = position.y;
  });
}

/**
 * Find optimal position for a panel
 */
function findOptimalPosition(panel, existingPanels, siteConfig, minSpacing) {
  const siteWidth = parseFloat(siteConfig.width) || 4000;
  const siteHeight = parseFloat(siteConfig.length) || 4000;
  
  // Start from top-left and find first available position
  for (let y = 0; y <= siteHeight - panel.length; y += 5) {
    for (let x = 0; x <= siteWidth - panel.width; x += 5) {
      const testPosition = { x, y };
      
      if (isPositionValid(panel, testPosition, existingPanels, minSpacing)) {
        return testPosition;
      }
    }
  }
  
  // Fallback to original position if no valid position found
  return { x: panel.x || 0, y: panel.y || 0 };
}

/**
 * Check if a position is valid for panel placement
 */
function isPositionValid(panel, position, existingPanels, minSpacing) {
  const testPanel = {
    ...panel,
    x: position.x,
    y: position.y
  };
  
  // Check for overlaps with existing panels
  for (const existingPanel of existingPanels) {
    if (panelsOverlap(testPanel, existingPanel, minSpacing)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if two panels overlap
 */
function panelsOverlap(panel1, panel2, minSpacing = 0) {
  const p1 = {
    left: panel1.x - minSpacing,
    right: panel1.x + panel1.width + minSpacing,
    top: panel1.y - minSpacing,
    bottom: panel1.y + panel1.length + minSpacing
  };
  
  const p2 = {
    left: panel2.x,
    right: panel2.x + panel2.width,
    top: panel2.y,
    bottom: panel2.y + panel2.length
  };
  
  return !(p1.right <= p2.left || p1.left >= p2.right || 
           p1.bottom <= p2.top || p1.top >= p2.bottom);
}

/**
 * Minimize edge waste by optimizing panel positioning
 */
function minimizeEdgeWaste(panels, siteConfig) {
  // Move panels closer to edges when possible
  panels.forEach(panel => {
    // Snap to site boundaries if close enough
    if (panel.x < 10) panel.x = 0;
    if (panel.y < 10) panel.y = 0;
  });
}

/**
 * Optimize installation sequence for labor efficiency
 */
function optimizeInstallationSequence(panels, siteConfig) {
  // Sort panels by logical installation order (left to right, top to bottom)
  panels.sort((a, b) => {
    if (Math.abs(a.y - b.y) < 10) {
      return a.x - b.x; // Same row, sort by x
    }
    return a.y - b.y; // Different rows, sort by y
  });
}

/**
 * Minimize total seam lengths
 */
function minimizeSeamLengths(panels) {
  // Group adjacent panels and align edges where possible
  panels.forEach((panel, index) => {
    const neighbors = findNeighbors(panel, panels);
    alignWithNeighbors(panel, neighbors);
  });
}

/**
 * Find neighboring panels
 */
function findNeighbors(panel, allPanels) {
  const tolerance = 5; // 5 foot tolerance for considering panels as neighbors
  
  return allPanels.filter(otherPanel => {
    if (otherPanel === panel) return false;
    
    const distance = Math.sqrt(
      Math.pow(panel.x - otherPanel.x, 2) + 
      Math.pow(panel.y - otherPanel.y, 2)
    );
    
    return distance < tolerance;
  });
}

/**
 * Align panel with its neighbors
 */
function alignWithNeighbors(panel, neighbors) {
  neighbors.forEach(neighbor => {
    // Align horizontally if panels are side by side
    if (Math.abs(panel.y - neighbor.y) < 1) {
      if (panel.x > neighbor.x && panel.x < neighbor.x + neighbor.width + 5) {
        panel.x = neighbor.x + neighbor.width;
      }
    }
    
    // Align vertically if panels are stacked
    if (Math.abs(panel.x - neighbor.x) < 1) {
      if (panel.y > neighbor.y && panel.y < neighbor.y + neighbor.length + 5) {
        panel.y = neighbor.y + neighbor.length;
      }
    }
  });
}

/**
 * Apply moderate packing for balanced optimization
 */
function applyModeratePacking(panels, siteConfig) {
  const spacing = OPTIMIZATION_CONFIG.minPanelSpacing * 1.5; // Slightly more spacing than tight packing
  applyTightPacking(panels, { ...siteConfig, minSpacing: spacing });
}

/**
 * Balance seam optimization with material efficiency
 */
function balanceSeamAndMaterial(panels, siteConfig) {
  // Apply both optimizations with reduced intensity
  minimizeSeamLengths(panels);
  minimizeEdgeWaste(panels, siteConfig);
}

/**
 * Resolve panel overlaps
 */
function resolveOverlaps(panels) {
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (panelsOverlap(panels[i], panels[j], OPTIMIZATION_CONFIG.maxOverlapTolerance)) {
        // Move the second panel to resolve overlap
        moveToResolveOverlap(panels[j], panels[i]);
      }
    }
  }
}

/**
 * Move a panel to resolve overlap with another panel
 */
function moveToResolveOverlap(movingPanel, fixedPanel) {
  // Simple strategy: move the panel to the right of the fixed panel
  movingPanel.x = fixedPanel.x + fixedPanel.width + OPTIMIZATION_CONFIG.minPanelSpacing;
}

/**
 * Calculate waste reduction percentage
 */
function calculateWasteReduction(panels, siteConfig) {
  // Simplified calculation - in practice this would be more complex
  const totalPanelArea = panels.reduce((sum, panel) => sum + (panel.width * panel.length), 0);
  const siteArea = (parseFloat(siteConfig.width) || 4000) * (parseFloat(siteConfig.length) || 4000);
  const utilization = totalPanelArea / siteArea;
  
  return Math.min(utilization * 100, 95); // Cap at 95% for realism
}

/**
 * Calculate material utilization
 */
function calculateMaterialUtilization(panels, siteConfig) {
  return calculateWasteReduction(panels, siteConfig);
}

/**
 * Calculate seam reduction
 */
function calculateSeamReduction(panels) {
  // Simplified calculation
  const alignedEdges = countAlignedEdges(panels);
  const totalPossibleEdges = panels.length * 4;
  
  return (alignedEdges / totalPossibleEdges) * 100;
}

/**
 * Count aligned edges between panels
 */
function countAlignedEdges(panels) {
  let alignedCount = 0;
  
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (edgesAreAligned(panels[i], panels[j])) {
        alignedCount++;
      }
    }
  }
  
  return alignedCount;
}

/**
 * Check if edges of two panels are aligned
 */
function edgesAreAligned(panel1, panel2) {
  const tolerance = 1; // 1 foot tolerance
  
  // Check for horizontal alignment
  if (Math.abs(panel1.y - panel2.y) < tolerance || 
      Math.abs((panel1.y + panel1.length) - (panel2.y + panel2.length)) < tolerance) {
    return true;
  }
  
  // Check for vertical alignment
  if (Math.abs(panel1.x - panel2.x) < tolerance || 
      Math.abs((panel1.x + panel1.width) - (panel2.x + panel2.width)) < tolerance) {
    return true;
  }
  
  return false;
}

/**
 * Calculate installation efficiency
 */
function calculateInstallationEfficiency(panels) {
  // Based on logical sequencing and neighbor alignment
  const sequenceScore = calculateSequenceScore(panels);
  const alignmentScore = calculateSeamReduction(panels);
  
  return (sequenceScore + alignmentScore) / 2;
}

/**
 * Calculate sequence score for installation efficiency
 */
function calculateSequenceScore(panels) {
  let score = 0;
  
  for (let i = 1; i < panels.length; i++) {
    const current = panels[i];
    const previous = panels[i - 1];
    
    // Score based on logical progression (left to right, top to bottom)
    if (current.y >= previous.y && current.x >= previous.x) {
      score++;
    }
  }
  
  return (score / (panels.length - 1)) * 100;
}

/**
 * Calculate overall efficiency for balanced strategy
 */
function calculateOverallEfficiency(panels, siteConfig) {
  const materialScore = calculateMaterialUtilization(panels, siteConfig);
  const laborScore = calculateInstallationEfficiency(panels);
  
  return (materialScore + laborScore) / 2;
}

/**
 * Calculate site coverage percentage
 */
function calculateSiteCoverage(panels, siteConfig) {
  const totalPanelArea = panels.reduce((sum, panel) => sum + (panel.width * panel.length), 0);
  const siteArea = (parseFloat(siteConfig.width) || 4000) * (parseFloat(siteConfig.length) || 4000);
  
  return Math.min((totalPanelArea / siteArea) * 100, 100);
}

/**
 * Group panels by installation zone
 */
function groupByInstallationZone(panels, siteConfig) {
  // Simple zoning based on grid sections
  const zoneSize = 500; // 500 foot zones
  
  panels.forEach(panel => {
    panel.installationZone = {
      x: Math.floor(panel.x / zoneSize),
      y: Math.floor(panel.y / zoneSize)
    };
  });
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    optimizePanelLayout,
    optimizeMaterialEfficiency,
    optimizeLaborEfficiency,
    optimizeBalanced,
    OPTIMIZATION_CONFIG
  };
}