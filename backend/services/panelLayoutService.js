const { db } = require('../db/index');
const { panelLayouts, projects } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { v4: uuidv4 } = require('uuid');

class PanelLayoutService {
  /**
   * Check if a panel exists in the project
   */
  async checkPanelExists(projectId, panelId) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        return false;
      }

      let currentPanels = [];
      try {
        if (Array.isArray(existingLayout.panels)) {
          currentPanels = existingLayout.panels;
        } else if (typeof existingLayout.panels === 'string') {
          currentPanels = JSON.parse(existingLayout.panels || '[]');
        }
      } catch (error) {
        console.error('Error parsing panels in checkPanelExists:', error);
        return false;
      }

      return currentPanels.some(p => 
        p.id === panelId || 
        p.rollNumber === panelId || 
        p.panelNumber === panelId ||
        `panel-${projectId}-${p.x}-${p.y}-${p.width}-${p.height}` === panelId
      );
    } catch (error) {
      console.error('Error checking panel existence:', error);
      return false;
    }
  }

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
          // Standardized JSONB parsing - panels should always be an array
          if (Array.isArray(existingLayout.panels)) {
            currentPanels = existingLayout.panels;
          } else if (typeof existingLayout.panels === 'string') {
            // Handle legacy TEXT format
            currentPanels = JSON.parse(existingLayout.panels || '[]');
          } else {
            console.warn('Unexpected panels data type:', typeof existingLayout.panels);
            currentPanels = [];
          }
        } catch (error) {
          console.error('Error parsing existing panels:', error);
          currentPanels = [];
        }
      }

      // Validate panel shape
      const validShapes = ['rectangle', 'right-triangle'];
      const panelShape = panelData.shape || panelData.properties?.shape || 'rectangle';
      
      if (!validShapes.includes(panelShape)) {
        throw new Error(`Invalid panel shape: ${panelShape}. Must be one of: ${validShapes.join(', ')}`);
      }

      // Set default dimensions for rectangle and right-triangle panels
      const defaultWidth = 40;
      const defaultHeight = 100;

      // Create new panel with unique UUID
      const newPanel = {
        id: uuidv4(),
        date: new Date().toISOString().slice(0, 10),
        panelNumber: panelData.panel_number || panelData.panelNumber || `${currentPanels.length + 1}`,
        height: panelData.dimensions?.height || panelData.height_feet || panelData.height || defaultHeight,
        width: panelData.dimensions?.width || panelData.width_feet || panelData.width || defaultWidth,
        rollNumber: panelData.roll_number || panelData.rollNumber || `R-${100 + currentPanels.length + 1}`,
        location: panelData.properties?.location || 'AI Generated',
        x: panelData.position?.x || panelData.x || (currentPanels.length * 400 + 200),
        y: panelData.position?.y || panelData.y || (Math.floor(currentPanels.length / 5) * 300 + 200),
        shape: panelShape,
        rotation: panelData.rotation || 0,
        fill: panelData.properties?.fill || '#87CEEB',
        color: panelData.properties?.color || '#87CEEB',
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
            panels: currentPanels, // JSONB handles serialization automatically
            lastUpdated: new Date()
          })
          .where(eq(panelLayouts.projectId, projectId));
      } else {
        await db.insert(panelLayouts).values({
          id: require('uuid').v4(), // Generate UUID for the panel layout
          projectId,
          panels: currentPanels, // JSONB handles serialization automatically
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
      console.log('🔍 [movePanel] Starting panel move:', {
        projectId,
        panelId,
        newPosition
      });

      // Validate panelId parameter
      if (!panelId || typeof panelId !== 'string' || panelId.trim() === '') {
        throw new Error('Invalid panelId: must be a non-empty string');
      }

      // Check if panel exists before attempting to move
      const panelExists = await this.checkPanelExists(projectId, panelId);
      if (!panelExists) {
        throw new Error(`Panel with ID '${panelId}' does not exist in this project`);
      }

      // Validate newPosition data
      if (!newPosition || typeof newPosition !== 'object') {
        throw new Error('Invalid newPosition: must be an object');
      }

      console.log('🔍 [movePanel] Validating newPosition data:', {
        newPosition,
        x: newPosition.x,
        y: newPosition.y,
        rotation: newPosition.rotation,
        xType: typeof newPosition.x,
        yType: typeof newPosition.y,
        rotationType: typeof newPosition.rotation
      });

      if (typeof newPosition.x !== 'number' || typeof newPosition.y !== 'number') {
        throw new Error(`Invalid newPosition: x and y must be numbers. Received x: ${newPosition.x} (${typeof newPosition.x}), y: ${newPosition.y} (${typeof newPosition.y})`);
      }

      // Check for NaN values
      if (isNaN(newPosition.x) || isNaN(newPosition.y)) {
        console.warn(`⚠️ [movePanel] NaN values detected, converting to 0. Received x: ${newPosition.x}, y: ${newPosition.y}`);
        newPosition.x = isNaN(newPosition.x) ? 0 : newPosition.x;
        newPosition.y = isNaN(newPosition.y) ? 0 : newPosition.y;
      }

      // Check for infinite values
      if (!isFinite(newPosition.x) || !isFinite(newPosition.y)) {
        console.warn(`⚠️ [movePanel] Infinite values detected, clamping to reasonable range. Received x: ${newPosition.x}, y: ${newPosition.y}`);
        newPosition.x = !isFinite(newPosition.x) ? 0 : Math.max(-10000, Math.min(10000, newPosition.x));
        newPosition.y = !isFinite(newPosition.y) ? 0 : Math.max(-10000, Math.min(10000, newPosition.y));
      }

      // Validate rotation if present
      if (newPosition.rotation !== undefined) {
        if (typeof newPosition.rotation !== 'number') {
          throw new Error('Invalid rotation: must be a number');
        }
        if (newPosition.rotation < 0 || newPosition.rotation >= 360) {
          throw new Error('Invalid rotation: must be between 0 and 360 degrees');
        }
        if (!isFinite(newPosition.rotation)) {
          throw new Error('Invalid rotation: must be a finite number');
        }
      }

      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentPanels = [];
      try {
        // Standardized JSONB parsing - panels should always be an array
        if (Array.isArray(existingLayout.panels)) {
          currentPanels = existingLayout.panels;
        } else if (typeof existingLayout.panels === 'string') {
          // Handle legacy TEXT format
          currentPanels = JSON.parse(existingLayout.panels || '[]');
        } else {
          console.warn('Unexpected panels data type:', typeof existingLayout.panels);
          currentPanels = [];
        }
        
        console.log('🔍 [movePanel] Current panels loaded:', {
          panelCount: currentPanels.length,
          firstPanel: currentPanels[0] ? {
            id: currentPanels[0].id,
            x: currentPanels[0].x,
            y: currentPanels[0].y,
            width: currentPanels[0].width,
            height: currentPanels[0].height,
            rotation: currentPanels[0].rotation
          } : 'No panels'
        });
      } catch (error) {
        console.error('Error parsing panels in movePanel:', error);
        currentPanels = [];
      }
      // Find panel by ID - check multiple possible ID fields with better logging
      console.log('🔍 [movePanel] Searching for panel with ID:', panelId);
      console.log('🔍 [movePanel] Available panels:', currentPanels.map(p => ({
        id: p.id,
        panelNumber: p.panelNumber,
        rollNumber: p.rollNumber,
        x: p.x,
        y: p.y
      })));

      const panelIndex = currentPanels.findIndex(p => {
        // Check exact matches first
        if (p.id === panelId || p.rollNumber === panelId || p.panelNumber === panelId) {
          console.log('🔍 [movePanel] Found panel by exact match:', {
            panelId,
            matchedField: p.id === panelId ? 'id' : (p.rollNumber === panelId ? 'rollNumber' : 'panelNumber'),
            panel: p
          });
          return true;
        }
        
        // Check generated ID pattern: panel-{projectId}-{x}-{y}-{width}-{height}
        const generatedId = `panel-${projectId}-${p.x}-${p.y}-${p.width}-${p.height}`;
        if (generatedId === panelId) {
          console.log('🔍 [movePanel] Found panel by generated ID pattern:', {
            panelId,
            generatedId,
            panel: p
          });
          return true;
        }
        
        return false;
      });

      if (panelIndex === -1) {
        const errorDetails = {
          requestedPanelId: panelId,
          totalPanels: currentPanels.length,
          availablePanelIds: currentPanels.map(p => p.id).filter(id => id),
          availablePanelNumbers: currentPanels.map(p => p.panelNumber).filter(num => num),
          availableRollNumbers: currentPanels.map(p => p.rollNumber).filter(roll => roll)
        };
        
        console.error('❌ [movePanel] Panel not found:', errorDetails);
        throw new Error(`Panel with ID '${panelId}' not found in project. Available panels: ${errorDetails.availablePanelIds.join(', ')}`);
      }

      console.log('🔍 [movePanel] Found panel at index:', {
        panelIndex,
        panel: currentPanels[panelIndex],
        newPosition
      });

      // Update panel position
      currentPanels[panelIndex] = {
        ...currentPanels[panelIndex],
        x: newPosition.x,
        y: newPosition.y,
        rotation: newPosition.rotation !== undefined ? newPosition.rotation : currentPanels[panelIndex].rotation
      };

      console.log('🔍 [movePanel] Updated panel:', {
        panelId,
        oldPosition: {
          x: currentPanels[panelIndex].x,
          y: currentPanels[panelIndex].y,
          rotation: currentPanels[panelIndex].rotation
        },
        newPosition
      });

      // Update layout
      await db
        .update(panelLayouts)
        .set({
          panels: currentPanels, // JSONB handles serialization automatically
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
   * Update panel properties such as dimensions, rotation, or metadata
   */
  async updatePanelProperties(projectId, panelIdentifier, updates = {}) {
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      if (!panelIdentifier || typeof panelIdentifier !== 'string') {
        throw new Error('Panel identifier must be a non-empty string');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates payload must be an object');
      }

      const ALLOWED_FIELDS = new Set(['width', 'height', 'rotation', 'x', 'y', 'panelNumber', 'rollNumber', 'shape', 'material', 'thickness', 'notes', 'color', 'fill']);
      const hasAllowedField = Object.keys(updates).some(key => ALLOWED_FIELDS.has(key));

      if (!hasAllowedField) {
        throw new Error(`No valid update fields provided. Allowed fields: ${Array.from(ALLOWED_FIELDS).join(', ')}`);
      }

      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentPanels = [];
      try {
        if (Array.isArray(existingLayout.panels)) {
          currentPanels = existingLayout.panels;
        } else if (typeof existingLayout.panels === 'string') {
          currentPanels = JSON.parse(existingLayout.panels || '[]');
        } else {
          console.warn('Unexpected panels data type:', typeof existingLayout.panels);
        }
      } catch (error) {
        console.error('Error parsing panels in updatePanelProperties:', error);
        currentPanels = [];
      }

      if (!currentPanels.length) {
        throw new Error('No panels available to update');
      }

      const panelIndex = currentPanels.findIndex(panel => {
        if (!panel) return false;

        if (panel.id === panelIdentifier || panel.panelNumber === panelIdentifier || panel.rollNumber === panelIdentifier) {
          return true;
        }

        const generatedId = `panel-${projectId}-${panel.x}-${panel.y}-${panel.width}-${panel.height}`;
        return generatedId === panelIdentifier;
      });

      if (panelIndex === -1) {
        throw new Error(`Panel '${panelIdentifier}' not found in project ${projectId}`);
      }

      const targetPanel = currentPanels[panelIndex];
      const nextPanel = { ...targetPanel };

      if (updates.width !== undefined) {
        const width = Number(updates.width);
        if (isNaN(width) || width <= 0) {
          throw new Error('Width must be a positive number');
        }
        nextPanel.width = width;
      }

      if (updates.height !== undefined) {
        const height = Number(updates.height);
        if (isNaN(height) || height <= 0) {
          throw new Error('Height must be a positive number');
        }
        nextPanel.height = height;
      }

      if (updates.rotation !== undefined) {
        const rotation = Number(updates.rotation);
        if (isNaN(rotation) || rotation < 0 || rotation >= 360) {
          throw new Error('Rotation must be a number between 0 and 360 degrees');
        }
        nextPanel.rotation = rotation;
      }

      if (updates.x !== undefined) {
        const x = Number(updates.x);
        if (isNaN(x) || !isFinite(x)) {
          throw new Error('X position must be a finite number');
        }
        nextPanel.x = x;
      }

      if (updates.y !== undefined) {
        const y = Number(updates.y);
        if (isNaN(y) || !isFinite(y)) {
          throw new Error('Y position must be a finite number');
        }
        nextPanel.y = y;
      }

      ['panelNumber', 'rollNumber', 'shape', 'material', 'thickness', 'notes', 'color', 'fill'].forEach(field => {
        if (updates[field] !== undefined) {
          nextPanel[field] = updates[field];
        }
      });

      currentPanels[panelIndex] = nextPanel;

      await db
        .update(panelLayouts)
        .set({
          panels: currentPanels,
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return nextPanel;
    } catch (error) {
      console.error('Error updating panel properties:', error);
      throw error;
    }
  }

  /**
   * Delete a panel from the layout
   */
  async deletePanel(projectId, panelId) {
    try {
      console.log('🔍 [deletePanel] Starting deletion:', { projectId, panelId });
      
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      console.log('🔍 [deletePanel] Found layout:', !!existingLayout);

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentPanels = [];
      try {
        // Standardized JSONB parsing - panels should always be an array
        if (Array.isArray(existingLayout.panels)) {
          currentPanels = existingLayout.panels;
        } else if (typeof existingLayout.panels === 'string') {
          // Handle legacy TEXT format
          currentPanels = JSON.parse(existingLayout.panels || '[]');
        } else {
          console.warn('Unexpected panels data type:', typeof existingLayout.panels);
          currentPanels = [];
        }
      } catch (error) {
        console.error('Error parsing panels in deletePanel:', error);
        currentPanels = [];
      }
      
      console.log('🔍 [deletePanel] Current panels count:', currentPanels.length);
      console.log('🔍 [deletePanel] Looking for panel ID:', panelId);
      console.log('🔍 [deletePanel] Available panel IDs:', currentPanels.map(p => p.id));
      
      const filteredPanels = currentPanels.filter(p => p.id !== panelId);
      console.log('🔍 [deletePanel] Filtered panels count:', filteredPanels.length);

      if (filteredPanels.length === currentPanels.length) {
        console.log('❌ [deletePanel] Panel not found in current panels');
        throw new Error('Panel not found');
      }

      // Update layout
      await db
        .update(panelLayouts)
        .set({
          panels: filteredPanels, // JSONB handles serialization automatically
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
        // Standardized JSONB parsing - panels should always be an array
        if (Array.isArray(layout.panels)) {
          currentPanels = layout.panels;
        } else if (typeof layout.panels === 'string') {
          // Handle legacy TEXT format
          currentPanels = JSON.parse(layout.panels || '[]');
        } else {
          console.warn('Unexpected panels data type:', typeof layout.panels);
          currentPanels = [];
        }
      } catch (error) {
        console.error('Error parsing panels:', error);
        currentPanels = [];
      }

      return {
        panels: currentPanels,
        width: parseFloat(layout.width) || 15000,
        height: parseFloat(layout.height) || 15000,
        scale: parseFloat(layout.scale) || 1.0,
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
          panels: optimizedPanels, // JSONB handles serialization automatically
          lastUpdated: new Date()
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
      // Create a copy to avoid mutating the original
      const optimizedPanel = { ...panel };
      
      // Check if panel fits in current row
      if (currentX + optimizedPanel.width + spacing <= maxWidth) {
        optimizedPanel.x = currentX;
        optimizedPanel.y = currentY;
        currentX += optimizedPanel.width + spacing;
        maxHeightInRow = Math.max(maxHeightInRow, optimizedPanel.height);
      } else {
        // Move to next row
        currentX = 50;
        currentY += maxHeightInRow + spacing;
        maxHeightInRow = 0;
        
        optimizedPanel.x = currentX;
        optimizedPanel.y = currentY;
        currentX += optimizedPanel.width + spacing;
        maxHeightInRow = optimizedPanel.height;
      }
      
      // Preserve rotation and other properties
      optimized.push(optimizedPanel);
    }

    return optimized;
  }

  /**
   * Material efficiency optimization
   */
  optimizeMaterialEfficiency(panels) {
    // Sort by area (largest first) to maximize material usage, preserving all properties
    return panels.map(panel => ({ ...panel })).sort((a, b) => (b.width * b.height) - (a.width * a.height));
  }

  /**
   * Labor efficiency optimization
   */
  optimizeLaborEfficiency(panels) {
    // Group similar panels together, preserving all properties
    const groups = {};
    panels.forEach(panel => {
      const key = `${panel.width}x${panel.height}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...panel }); // Create copy to preserve original
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
    // Combine material and labor efficiency, preserving all properties
    const materialOptimized = this.optimizeMaterialEfficiency(panels);
    return this.optimizeGridLayout(materialOptimized, spacing);
  }

  // ==================== PATCH METHODS ====================

  /**
   * Get all patches for a project
   */
  async getPatches(projectId) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        return [];
      }

      let currentPatches = [];
      try {
        if (Array.isArray(existingLayout.patches)) {
          currentPatches = existingLayout.patches;
        } else if (typeof existingLayout.patches === 'string') {
          currentPatches = JSON.parse(existingLayout.patches || '[]');
        }
      } catch (error) {
        console.error('Error parsing patches in getPatches:', error);
        return [];
      }

      return currentPatches;
    } catch (error) {
      console.error('Error getting patches:', error);
      throw error;
    }
  }

  /**
   * Create a patch
   */
  async createPatch(projectId, patchData) {
    try {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      let [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      let currentPatches = [];
      if (existingLayout) {
        try {
          if (Array.isArray(existingLayout.patches)) {
            currentPatches = existingLayout.patches;
          } else if (typeof existingLayout.patches === 'string') {
            currentPatches = JSON.parse(existingLayout.patches || '[]');
          }
        } catch (error) {
          console.error('Error parsing existing patches:', error);
          currentPatches = [];
        }
      }

      const PATCH_RADIUS = (400 / 30) / 2; // 6.67 feet radius
      const newPatch = {
        id: uuidv4(),
        x: patchData.x || (currentPatches.length * 50 + 100),
        y: patchData.y || (Math.floor(currentPatches.length / 5) * 50 + 100),
        radius: PATCH_RADIUS,
        rotation: patchData.rotation || 0,
        isValid: true,
        patchNumber: patchData.patchNumber || `PATCH-${currentPatches.length + 1}`,
        date: patchData.date || new Date().toISOString().slice(0, 10),
        location: patchData.location || '',
        notes: patchData.notes || '',
        fill: '#ef4444', // Red color
        color: '#b91c1c',
        material: patchData.material || 'HDPE',
        thickness: patchData.thickness || 60,
      };

      currentPatches.push(newPatch);

      if (existingLayout) {
        await db
          .update(panelLayouts)
          .set({
            patches: currentPatches,
            lastUpdated: new Date()
          })
          .where(eq(panelLayouts.projectId, projectId));
      } else {
        await db.insert(panelLayouts).values({
          id: uuidv4(),
          projectId,
          panels: [],
          patches: currentPatches,
          destructiveTests: [],
          width: project.layoutWidth || 4000,
          height: project.layoutHeight || 4000,
          scale: project.scale || 1,
          lastUpdated: new Date()
        });
      }

      return newPatch;
    } catch (error) {
      console.error('Error creating patch:', error);
      throw error;
    }
  }

  /**
   * Update a patch
   */
  async updatePatch(projectId, patchId, updates) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentPatches = [];
      try {
        if (Array.isArray(existingLayout.patches)) {
          currentPatches = existingLayout.patches;
        } else if (typeof existingLayout.patches === 'string') {
          currentPatches = JSON.parse(existingLayout.patches || '[]');
        }
      } catch (error) {
        console.error('Error parsing patches in updatePatch:', error);
        throw error;
      }

      const patchIndex = currentPatches.findIndex(p => p.id === patchId);
      if (patchIndex === -1) {
        throw new Error('Patch not found');
      }

      currentPatches[patchIndex] = {
        ...currentPatches[patchIndex],
        ...updates
      };

      await db
        .update(panelLayouts)
        .set({
          patches: currentPatches,
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return currentPatches[patchIndex];
    } catch (error) {
      console.error('Error updating patch:', error);
      throw error;
    }
  }

  /**
   * Delete a patch
   */
  async deletePatch(projectId, patchId) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentPatches = [];
      try {
        if (Array.isArray(existingLayout.patches)) {
          currentPatches = existingLayout.patches;
        } else if (typeof existingLayout.patches === 'string') {
          currentPatches = JSON.parse(existingLayout.patches || '[]');
        }
      } catch (error) {
        console.error('Error parsing patches in deletePatch:', error);
        throw error;
      }

      const filteredPatches = currentPatches.filter(p => p.id !== patchId);
      if (filteredPatches.length === currentPatches.length) {
        throw new Error('Patch not found');
      }

      await db
        .update(panelLayouts)
        .set({
          patches: filteredPatches,
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return true;
    } catch (error) {
      console.error('Error deleting patch:', error);
      throw error;
    }
  }

  // ==================== DESTRUCTIVE TEST METHODS ====================

  /**
   * Get all destructive tests for a project
   */
  async getDestructiveTests(projectId) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        return [];
      }

      let currentTests = [];
      try {
        if (Array.isArray(existingLayout.destructiveTests)) {
          currentTests = existingLayout.destructiveTests;
        } else if (typeof existingLayout.destructiveTests === 'string') {
          currentTests = JSON.parse(existingLayout.destructiveTests || '[]');
        }
      } catch (error) {
        console.error('Error parsing destructive tests in getDestructiveTests:', error);
        return [];
      }

      return currentTests;
    } catch (error) {
      console.error('Error getting destructive tests:', error);
      throw error;
    }
  }

  /**
   * Create a destructive test
   */
  async createDestructiveTest(projectId, testData) {
    try {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      let [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      let currentTests = [];
      if (existingLayout) {
        try {
          if (Array.isArray(existingLayout.destructiveTests)) {
            currentTests = existingLayout.destructiveTests;
          } else if (typeof existingLayout.destructiveTests === 'string') {
            currentTests = JSON.parse(existingLayout.destructiveTests || '[]');
          }
        } catch (error) {
          console.error('Error parsing existing destructive tests:', error);
          currentTests = [];
        }
      }

      const newTest = {
        id: uuidv4(),
        x: testData.x || (currentTests.length * 100 + 200),
        y: testData.y || (Math.floor(currentTests.length / 5) * 100 + 200),
        width: testData.width || 20,
        height: testData.height || 20,
        rotation: testData.rotation || 0,
        isValid: true,
        sampleId: testData.sampleId || `D-${currentTests.length + 1}`,
        date: testData.date || new Date().toISOString().slice(0, 10),
        testResult: testData.testResult || 'pending',
        notes: testData.notes || '',
        location: testData.location || '',
        fill: '#f59e0b', // Orange/amber color
        color: '#d97706',
        material: testData.material || 'HDPE',
        thickness: testData.thickness || 60,
      };

      currentTests.push(newTest);

      if (existingLayout) {
        await db
          .update(panelLayouts)
          .set({
            destructiveTests: currentTests,
            lastUpdated: new Date()
          })
          .where(eq(panelLayouts.projectId, projectId));
      } else {
        await db.insert(panelLayouts).values({
          id: uuidv4(),
          projectId,
          panels: [],
          patches: [],
          destructiveTests: currentTests,
          width: project.layoutWidth || 4000,
          height: project.layoutHeight || 4000,
          scale: project.scale || 1,
          lastUpdated: new Date()
        });
      }

      return newTest;
    } catch (error) {
      console.error('Error creating destructive test:', error);
      throw error;
    }
  }

  /**
   * Update a destructive test
   */
  async updateDestructiveTest(projectId, testId, updates) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentTests = [];
      try {
        if (Array.isArray(existingLayout.destructiveTests)) {
          currentTests = existingLayout.destructiveTests;
        } else if (typeof existingLayout.destructiveTests === 'string') {
          currentTests = JSON.parse(existingLayout.destructiveTests || '[]');
        }
      } catch (error) {
        console.error('Error parsing destructive tests in updateDestructiveTest:', error);
        throw error;
      }

      const testIndex = currentTests.findIndex(t => t.id === testId);
      if (testIndex === -1) {
        throw new Error('Destructive test not found');
      }

      currentTests[testIndex] = {
        ...currentTests[testIndex],
        ...updates
      };

      await db
        .update(panelLayouts)
        .set({
          destructiveTests: currentTests,
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return currentTests[testIndex];
    } catch (error) {
      console.error('Error updating destructive test:', error);
      throw error;
    }
  }

  /**
   * Delete a destructive test
   */
  async deleteDestructiveTest(projectId, testId) {
    try {
      const [existingLayout] = await db
        .select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId));

      if (!existingLayout) {
        throw new Error('Panel layout not found');
      }

      let currentTests = [];
      try {
        if (Array.isArray(existingLayout.destructiveTests)) {
          currentTests = existingLayout.destructiveTests;
        } else if (typeof existingLayout.destructiveTests === 'string') {
          currentTests = JSON.parse(existingLayout.destructiveTests || '[]');
        }
      } catch (error) {
        console.error('Error parsing destructive tests in deleteDestructiveTest:', error);
        throw error;
      }

      const filteredTests = currentTests.filter(t => t.id !== testId);
      if (filteredTests.length === currentTests.length) {
        throw new Error('Destructive test not found');
      }

      await db
        .update(panelLayouts)
        .set({
          destructiveTests: filteredTests,
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.projectId, projectId));

      return true;
    } catch (error) {
      console.error('Error deleting destructive test:', error);
      throw error;
    }
  }
}

module.exports = new PanelLayoutService(); 
