/**
 * GeoQC Panel Optimizer Connector
 * 
 * This module provides connectivity between the frontend panel layout tool
 * and the Python-based panel optimizer API.
 */

/**
 * Optimize panel layout using the Python optimization service
 * @param {Object} siteConfig Site configuration data
 * @param {Array} panels Panel definitions
 * @param {string} strategy Optimization strategy ('material', 'labor', or 'balanced')
 * @returns {Promise<Object>} Optimization results
 */
async function optimizePanelLayout(siteConfig, panels, strategy = 'balanced') {
  try {
    const response = await fetch('/api/optimize-panels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteConfig,
        panels,
        strategy
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to optimize panel layout: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in panel layout optimization:', error);
    throw error;
  }
}

/**
 * Generate contour visualization for site topography
 * @param {Object} siteConfig Site configuration with elevation data
 * @returns {Promise<Object>} Contour visualization data
 */
async function generateContourVisualization(siteConfig) {
  try {
    const response = await fetch('/api/generate-contours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteConfig
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate contours: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error generating contour visualization:', error);
    throw error;
  }
}

/**
 * Export panel layout to DXF or Excel format
 * @param {string} format Export format ('dxf' or 'excel')
 * @param {Array} placements Panel placement data
 * @param {Array} panels Panel definitions
 * @param {Object} summary Optimization summary
 * @returns {Promise<Object>} Export result
 */
async function exportPanelLayout(format, placements, panels, summary) {
  try {
    const response = await fetch('/api/export-layout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format,
        placements,
        panels,
        summary
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to export layout: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error exporting panel layout to ${format}:`, error);
    throw error;
  }
}