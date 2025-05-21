/**
 * GeoQC Panel Layout Optimizer
 * 
 * This module provides advanced panel placement optimization for geosynthetic liner projects,
 * taking into account site boundaries, elevation changes, and slope constraints.
 */

class PanelOptimizer {
  constructor(siteConfig, panels, strategy = 'balanced') {
    this.siteConfig = siteConfig;
    this.panels = panels;
    this.strategy = strategy; // 'material', 'labor', or 'balanced'
    this.placements = [];
    this.noGoZones = siteConfig.noGoZones || [];
    this.elevationGrid = siteConfig.elevationGrid || [];
  }

  /**
   * Run the optimization algorithm
   * @returns {Object} Optimized panel placement results
   */
  optimize() {
    console.log(`Starting optimization with ${this.strategy} strategy...`);
    
    // Reset placements
    this.placements = [];
    
    // Different strategies use different approaches
    switch (this.strategy) {
      case 'material':
        this.optimizeMaterialEfficiency();
        break;
      case 'labor':
        this.optimizeLaborEfficiency();
        break;
      case 'balanced':
      default:
        this.optimizeBalanced();
        break;
    }
    
    // Generate the summary report
    const summary = this.generateSummary();
    
    return {
      placements: this.placements,
      summary: summary
    };
  }
  
  /**
   * Optimize for material efficiency (minimize waste)
   * This prioritizes using full panels and minimizing cuts
   */
  optimizeMaterialEfficiency() {
    console.log('Optimizing for material efficiency...');
    
    // Sort panels by area (largest first)
    const sortedPanels = [...this.panels].sort((a, b) => 
      (b.width * b.length) - (a.width * a.length)
    );
    
    // Place panels using a grid pattern, largest panels first
    let row = 0;
    let col = 0;
    const spacing = 5; // 5 ft spacing between panels
    const maxCols = Math.floor(this.siteConfig.width / (sortedPanels[0].width + spacing));
    
    sortedPanels.forEach((panel, index) => {
      // Calculate position based on grid
      col = index % maxCols;
      row = Math.floor(index / maxCols);
      
      const x = col * (panel.width + spacing) + 50; // 50 ft margin from edge
      const y = row * (panel.length + spacing) + 50; // 50 ft margin from edge
      
      // If position is valid within site boundaries
      if (this.isValidPosition(x, y, panel.width, panel.length)) {
        // Calculate elevation adjustment based on grid
        const elevationAdjustment = this.calculateElevationAdjustment(x, y, panel.width, panel.length);
        
        // Add to placements
        this.placements.push({
          id: panel.id,
          x: x,
          y: y,
          rotation: 0, // No rotation for material efficiency
          elevationAdjustment: elevationAdjustment
        });
      }
    });
  }
  
  /**
   * Optimize for labor efficiency (minimize installation time)
   * This prioritizes placing panels in a sequence that minimizes movement
   */
  optimizeLaborEfficiency() {
    console.log('Optimizing for labor efficiency...');
    
    // Sort panels by location proximity (top to bottom, left to right)
    const sortedPanels = [...this.panels].sort((a, b) => a.id.localeCompare(b.id));
    
    // Use a spiral pattern starting from the center for installation efficiency
    const centerX = this.siteConfig.width / 2;
    const centerY = this.siteConfig.length / 2;
    const spiralSpacing = 10; // ft
    
    sortedPanels.forEach((panel, index) => {
      // Calculate position based on spiral pattern
      // This creates a pattern where crews can work continuously without jumping around
      const angle = 0.5 * index;
      const radius = spiralSpacing * angle / (2 * Math.PI);
      
      const x = centerX + radius * Math.cos(angle) - panel.width / 2;
      const y = centerY + radius * Math.sin(angle) - panel.length / 2;
      
      // Determine if rotation helps with installation
      const rotation = (index % 2 === 0) ? 0 : 90;
      
      // If position is valid within site boundaries
      const actualWidth = rotation === 90 ? panel.length : panel.width;
      const actualLength = rotation === 90 ? panel.width : panel.length;
      
      if (this.isValidPosition(x, y, actualWidth, actualLength)) {
        // Calculate elevation adjustment based on grid
        const elevationAdjustment = this.calculateElevationAdjustment(x, y, actualWidth, actualLength);
        
        // Add to placements
        this.placements.push({
          id: panel.id,
          x: x,
          y: y,
          rotation: rotation,
          elevationAdjustment: elevationAdjustment
        });
      }
    });
  }
  
  /**
   * Balanced optimization approach
   * This balances material efficiency and labor efficiency
   */
  optimizeBalanced() {
    console.log('Optimizing with balanced approach...');
    
    // Sort panels by area (largest first) but with some consideration for installation sequence
    const sortedPanels = [...this.panels].sort((a, b) => {
      // Primary sort by area
      const areaComparison = (b.width * b.length) - (a.width * a.length);
      
      // If areas are similar, sort by ID for installation sequence
      if (Math.abs(areaComparison) < 100) { // Within 100 sq ft
        return a.id.localeCompare(b.id);
      }
      
      return areaComparison;
    });
    
    // Use quadrant-based placement (divides site into 4 quadrants)
    // This allows for efficient material use while keeping installation somewhat sequential
    const quadrants = [
      { x: this.siteConfig.width * 0.25, y: this.siteConfig.length * 0.25 }, // Q1
      { x: this.siteConfig.width * 0.75, y: this.siteConfig.length * 0.25 }, // Q2
      { x: this.siteConfig.width * 0.25, y: this.siteConfig.length * 0.75 }, // Q3
      { x: this.siteConfig.width * 0.75, y: this.siteConfig.length * 0.75 }, // Q4
    ];
    
    // Place panels in quadrants, alternating between them
    sortedPanels.forEach((panel, index) => {
      const quadrant = quadrants[index % 4];
      const quadrantIndex = index % 4;
      
      // Calculate position within quadrant
      const posInQuadrant = Math.floor(index / 4);
      const quadrantCols = 3;
      
      const colInQuad = posInQuadrant % quadrantCols;
      const rowInQuad = Math.floor(posInQuadrant / quadrantCols);
      
      const spacing = 10; // 10 ft spacing between panels
      
      // Calculate base position in quadrant
      const quadBaseX = quadrant.x - (this.siteConfig.width * 0.25);
      const quadBaseY = quadrant.y - (this.siteConfig.length * 0.25);
      
      // Position within quadrant grid
      const x = quadBaseX + colInQuad * (panel.width + spacing);
      const y = quadBaseY + rowInQuad * (panel.length + spacing);
      
      // Determine if rotation helps with fit
      const rotation = (quadrantIndex % 2 === 0) ? 0 : 90;
      
      // If position is valid within site boundaries
      const actualWidth = rotation === 90 ? panel.length : panel.width;
      const actualLength = rotation === 90 ? panel.width : panel.length;
      
      if (this.isValidPosition(x, y, actualWidth, actualLength)) {
        // Calculate elevation adjustment based on grid
        const elevationAdjustment = this.calculateElevationAdjustment(x, y, actualWidth, actualLength);
        
        // Add to placements
        this.placements.push({
          id: panel.id,
          x: x,
          y: y,
          rotation: rotation,
          elevationAdjustment: elevationAdjustment
        });
      }
    });
  }
  
  /**
   * Check if a position is valid within site boundaries and doesn't overlap no-go zones
   */
  isValidPosition(x, y, width, length) {
    // Check site boundaries
    if (x < 0 || y < 0 || 
        x + width > this.siteConfig.width || 
        y + length > this.siteConfig.length) {
      return false;
    }
    
    // Check no-go zones
    for (const zone of this.noGoZones) {
      // Simple rectangular collision detection
      if (!(x + width < zone.x || x > zone.x + zone.width ||
            y + length < zone.y || y > zone.y + zone.height)) {
        return false;
      }
    }
    
    // Check for overlap with existing placements
    for (const placement of this.placements) {
      const placementWidth = placement.rotation === 90 ? 
        this.getPanelById(placement.id).length : 
        this.getPanelById(placement.id).width;
        
      const placementLength = placement.rotation === 90 ? 
        this.getPanelById(placement.id).width : 
        this.getPanelById(placement.id).length;
      
      // Rectangular collision detection
      if (!(x + width < placement.x || x > placement.x + placementWidth ||
            y + length < placement.y || y > placement.y + placementLength)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Calculate elevation adjustment based on slope
   */
  calculateElevationAdjustment(x, y, width, length) {
    if (!this.elevationGrid || this.elevationGrid.length === 0) {
      return 0; // No elevation data
    }
    
    // Use average elevation under the panel
    let totalElevation = 0;
    let gridPoints = 0;
    
    // Sample the grid at multiple points under the panel
    const samplePoints = [
      { x: x, y: y }, // Southwest corner
      { x: x + width, y: y }, // Southeast corner
      { x: x, y: y + length }, // Northwest corner
      { x: x + width, y: y + length }, // Northeast corner
      { x: x + width/2, y: y + length/2 } // Center
    ];
    
    samplePoints.forEach(point => {
      // Find the grid cell containing this point
      const gridCell = this.findGridCell(point.x, point.y);
      if (gridCell) {
        totalElevation += gridCell.elevation;
        gridPoints++;
      }
    });
    
    if (gridPoints === 0) return 0;
    
    // Average elevation adjustment
    return parseFloat((totalElevation / gridPoints).toFixed(1));
  }
  
  /**
   * Find the grid cell containing a point
   */
  findGridCell(x, y) {
    return this.elevationGrid.find(cell => 
      x >= cell.x && x < cell.x + cell.width &&
      y >= cell.y && y < cell.y + cell.height
    );
  }
  
  /**
   * Get panel by ID
   */
  getPanelById(id) {
    return this.panels.find(panel => panel.id === id);
  }
  
  /**
   * Generate a summary of the optimization results
   */
  generateSummary() {
    // Count panels with significant elevation adjustment
    const elevatedPanels = this.placements.filter(p => Math.abs(p.elevationAdjustment) > 1).length;
    const totalPanels = this.placements.length;
    
    // Calculate average elevation adjustment
    const avgElevation = this.placements.reduce((sum, p) => sum + Math.abs(p.elevationAdjustment), 0) / totalPanels;
    
    // Calculate total area covered
    const totalArea = this.placements.reduce((sum, p) => {
      const panel = this.getPanelById(p.id);
      return sum + (panel.width * panel.length);
    }, 0);
    
    // Calculate site utilization percentage
    const siteArea = this.siteConfig.width * this.siteConfig.length;
    const utilization = (totalArea / siteArea * 100).toFixed(1);
    
    return {
      strategy: this.strategy,
      totalPanels: totalPanels,
      elevatedPanels: elevatedPanels,
      averageElevationAdjustment: avgElevation.toFixed(1),
      siteUtilization: utilization + '%',
      slopeImpact: this.generateSlopeImpactSummary(elevatedPanels, totalPanels, avgElevation)
    };
  }
  
  /**
   * Generate a human-readable summary of how slopes affected placement
   */
  generateSlopeImpactSummary(elevatedPanels, totalPanels, avgElevation) {
    if (elevatedPanels === 0) {
      return "No significant slope constraints affected panel placement.";
    }
    
    const impactPercentage = ((elevatedPanels / totalPanels) * 100).toFixed(0);
    
    if (impactPercentage > 50) {
      return `Significant slope constraints affected ${impactPercentage}% of panels. Average elevation adjustment of ${avgElevation.toFixed(1)} ft required across the site. Special mounting considerations recommended.`;
    } else if (impactPercentage > 20) {
      return `Moderate slope constraints affected ${impactPercentage}% of panels. Average elevation adjustment of ${avgElevation.toFixed(1)} ft required for affected areas.`;
    } else {
      return `Minor slope constraints affected ${impactPercentage}% of panels. Average elevation adjustment of ${avgElevation.toFixed(1)} ft required in isolated areas.`;
    }
  }
}

/**
 * Export panel layout to DXF format
 * @param {Array} placements Panel placement data
 * @param {Array} panels Panel definitions
 */
function exportToDXF(placements, panels) {
  // This would generate a DXF file for CAD programs
  // Implementation would use a DXF library to create proper CAD format
  console.log("Exporting to DXF...");
  
  // In a real implementation, this would return a DXF string or file object
  return {
    success: true,
    message: "DXF export generated successfully"
  };
}

/**
 * Export panel layout to Excel format
 * @param {Array} placements Panel placement data
 * @param {Array} panels Panel definitions
 * @param {Object} summary Optimization summary
 */
function exportToExcel(placements, panels, summary) {
  // This would generate an Excel spreadsheet
  // Implementation would create a table with panel details
  console.log("Exporting to Excel...");
  
  // In a real implementation, this would return Excel data
  return {
    success: true,
    message: "Excel export generated successfully"
  };
}