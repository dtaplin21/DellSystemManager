const { db } = require('../db/index');
const { panelLayouts, projects } = require('../db/schema');
const { eq, and } = require('drizzle-orm');

class PanelLayoutService {
  /**
   * Create a single panel in the layout
   */
  async createPanel(projectId, panelData) {
    try {
      // Validate project exists
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      // Get existing panel layout or create new one
      let [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      let currentPanels = [];
      if (existingLayout) {
        try {
          // Check if panels is already an object (JSONB) or needs parsing
          if (typeof existingLayout.panels === 'string') {
            currentPanels = JSON.parse(existingLayout.panels || '[]');
          } else if (Array.isArray(existingLayout.panels)) {
            currentPanels = existingLayout.panels;
          } else {
            currentPanels = [];
          }
        } catch (error) {
          console.error('Error parsing existing panels:', error);
          currentPanels = [];
        }
      }

      // Create new panel with unique ID
      const newPanel = {
        id: Date.now().toString(),
        date: new Date().toISOString().slice(0, 10),
        panelNumber: panelData.panelNumber || `P${currentPanels.length + 1}`,
        length: panelData.dimensions?.height || panelData.height || 100,
        width: panelData.dimensions?.width || panelData.width || 40,
        rollNumber: panelData.rollNumber || `R-${100 + currentPanels.length + 1}`,
        location: panelData.properties?.location || 'AI Generated',
        x: panelData.position?.x || panelData.x || (currentPanels.length * 400 + 200),
        y: panelData.position?.y || panelData.y || (Math.floor(currentPanels.length / 5) * 300 + 200),
        shape: panelData.properties?.shape || 'rectangle',
        rotation: panelData.rotation || 0,
        fill: panelData.properties?.fill || '#E3F2FD',
        color: panelData.properties?.color || '#E3F2FD',
        material: panelData.material || panelData.properties?.material || 'HDPE',
        thickness: panelData.thickness || panelData.properties?.thickness || 60,
        seamsType: panelData.seamRequirements || panelData.properties?.seamsType || 'fusion',
        notes: panelData.properties?.notes || `AI-generated panel ${currentPanels.length + 1}`,
        ...panelData.properties
      };

      currentPanels.push(newPanel);

      // Update or create panel layout
      if (existingLayout) {
        await db
          .update(panelLayouts)
          .set({
            panels: JSON.stringify(currentPanels),
            lastUpdated: new Date()
          })
          .where(eq(panelLayouts.projectId, projectId));
      } else {
        await db.insert(panelLayouts).values({
          projectId,
          panels: JSON.stringify(currentPanels),
          width: project.layoutWidth || 1000,
          height: project.layoutHeight || 800,
          scale: project.scale || 1,
          lastUpdated: new Date()
        });
      }

      return newPanel;
    } catch (error) {
      console.error('Error creating panel:', error);
      throw error;
    }
  }

  /**
   * Move a panel to a new position
   */
  async movePanel(projectId, panelId, newPosition) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentPanels = [];
      try {
        // Check if panels is already an object (JSONB) or needs parsing
        if (typeof existingLayout.panels === 'string') {
          currentPanels = JSON.parse(existingLayout.panels || '[]');
        } else if (Array.isArray(existingLayout.panels)) {
          currentPanels = existingLayout.panels;
        } else {
          currentPanels = [];
        }
      } catch (error) {
        console.error('Error parsing panels in movePanel:', error);
        currentPanels = [];
      }
      const panelIndex = currentPanels.findIndex(p => p.id === panelId);

      if (panelIndex === -1) {
        throw new Error('Panel not found');
      }

      // Update panel position
      currentPanels[panelIndex] = {
        ...currentPanels[panelIndex],
        x: newPosition.x,
        y: newPosition.y,
        rotation: newPosition.rotation || currentPanels[panelIndex].rotation
      };

      // Update layout
      await db
        .update(panelLayouts)
        .set({
          panels: JSON.stringify(currentPanels),
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return currentPanels[panelIndex];
    } catch (error) {
      console.error('Error moving panel:', error);
      throw error;
    }
  }

  /**
   * Delete a panel from the layout
   */
  async deletePanel(projectId, panelId) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentPanels = [];
      try {
        // Check if panels is already an object (JSONB) or needs parsing
        if (typeof existingLayout.panels === 'string') {
          currentPanels = JSON.parse(existingLayout.panels || '[]');
        } else if (Array.isArray(existingLayout.panels)) {
          currentPanels = existingLayout.panels;
        } else {
          currentPanels = [];
        }
      } catch (error) {
        console.error('Error parsing panels in deletePanel:', error);
        currentPanels = [];
      }
      const filteredPanels = currentPanels.filter(p => p.id !== panelId);

      if (filteredPanels.length === currentPanels.length) {
        throw new Error('Panel not found');
      }

      // Update layout
      await db
        .update(panelLayouts)
        .set({
          panels: JSON.stringify(filteredPanels),
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return { success: true, deletedPanelId: panelId };
    } catch (error) {
      console.error('Error deleting panel:', error);
      throw error;
    }
  }

  /**
   * Create multiple panels in batch
   */
  async batchCreatePanels(projectId, panelsArray) {
    try {
      const results = [];
      
      for (const panelData of panelsArray) {
        try {
          const newPanel = await this.createPanel(projectId, panelData);
          results.push({ success: true, panel: newPanel });
        } catch (error) {
          results.push({ success: false, error: error.message, panelData });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in batch panel creation:', error);
      throw error;
    }
  }

  /**
   * Get the current layout for a project
   */
  async getLayout(projectId) {
    try {
      const [layout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!layout) {
        return { panels: [], width: 1000, height: 800, scale: 1 };
      }

      let currentPanels = [];
      try {
        // Check if panels is already an object (JSONB) or needs parsing
        if (typeof layout.panels === 'string') {
          currentPanels = JSON.parse(layout.panels || '[]');
        } else if (Array.isArray(layout.panels)) {
          currentPanels = layout.panels;
        } else {
          currentPanels = [];
        }
      } catch (error) {
        console.error('Error parsing panels:', error);
        currentPanels = [];
      }

      return {
        panels: currentPanels,
        width: layout.width,
        height: layout.height,
        scale: layout.scale,
        lastUpdated: layout.lastUpdated
      };
    } catch (error) {
      console.error('Error getting layout:', error);
      throw error;
    }
  }

  /**
   * Optimize layout based on constraints
   */
  async optimizeLayout(projectId, constraints = {}) {
    try {
      const layout = await this.getLayout(projectId);
      const { panels: currentPanels } = layout;

      // Apply optimization logic based on constraints
      const optimizedPanels = this.applyOptimization(currentPanels, constraints);

      // Update layout with optimized panels
      await db
        .update(panelLayouts)
        .set({
          panels: JSON.stringify(optimizedPanels),
          lastUpdated: new Date().toISOString()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return optimizedPanels;
    } catch (error) {
      console.error('Error optimizing layout:', error);
      throw error;
    }
  }

  /**
   * Apply optimization algorithms to panels
   */
  applyOptimization(panels, constraints) {
    const { strategy = 'balanced', spacing = 10 } = constraints;
    
    let optimizedPanels = [...panels];

    switch (strategy) {
      case 'grid':
        optimizedPanels = this.optimizeGridLayout(panels, spacing);
        break;
      case 'material':
        optimizedPanels = this.optimizeMaterialEfficiency(panels);
        break;
      case 'labor':
        optimizedPanels = this.optimizeLaborEfficiency(panels);
        break;
      default:
        optimizedPanels = this.optimizeBalanced(panels, spacing);
    }

    return optimizedPanels;
  }

  /**
   * Grid-based optimization
   */
  optimizeGridLayout(panels, spacing = 10) {
    const optimized = [];
    let currentX = 50;
    let currentY = 50;
    let maxHeightInRow = 0;
    const maxWidth = 1000;

    for (const panel of panels) {
      // Check if panel fits in current row
      if (currentX + panel.width + spacing <= maxWidth) {
        panel.x = currentX;
        panel.y = currentY;
        currentX += panel.width + spacing;
        maxHeightInRow = Math.max(maxHeightInRow, panel.length);
      } else {
        // Move to next row
        currentX = 50;
        currentY += maxHeightInRow + spacing;
        maxHeightInRow = 0;
        
        panel.x = currentX;
        panel.y = currentY;
        currentX += panel.width + spacing;
        maxHeightInRow = panel.length;
      }
      
      optimized.push(panel);
    }

    return optimized;
  }

  /**
   * Material efficiency optimization
   */
  optimizeMaterialEfficiency(panels) {
    // Sort by area (largest first) to maximize material usage
    return panels.sort((a, b) => (b.width * b.length) - (a.width * a.length));
  }

  /**
   * Labor efficiency optimization
   */
  optimizeLaborEfficiency(panels) {
    // Group similar panels together
    const groups = {};
    panels.forEach(panel => {
      const key = `${panel.width}x${panel.length}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(panel);
    });

    const optimized = [];
    Object.values(groups).forEach(group => {
      optimized.push(...group);
    });

    return optimized;
  }

  /**
   * Balanced optimization
   */
  optimizeBalanced(panels, spacing = 10) {
    // Combine material and labor efficiency
    const materialOptimized = this.optimizeMaterialEfficiency(panels);
    return this.optimizeGridLayout(materialOptimized, spacing);
  }
}

module.exports = new PanelLayoutService(); 