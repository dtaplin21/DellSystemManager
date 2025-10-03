const { Pool } = require('pg');
require('dotenv').config();

class PanelLookupService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  /**
   * Find panel ID by panel number from the panel layout system
   */
  async findPanelIdByNumber(panelNumber, projectId) {
    try {
      console.log(`🔍 [PANEL_LOOKUP] Looking for panel number: ${panelNumber} in project: ${projectId}`);
      
      // Query the panel_layouts table to find the panel
      const query = `
        SELECT panels 
        FROM panel_layouts 
        WHERE project_id = $1
      `;
      
      const result = await this.pool.query(query, [projectId]);
      
      if (result.rows.length === 0) {
        console.log(`❌ [PANEL_LOOKUP] No panel layout found for project: ${projectId}`);
        return null;
      }
      
      const panels = result.rows[0].panels;
      if (!Array.isArray(panels)) {
        console.log(`❌ [PANEL_LOOKUP] Invalid panels data structure for project: ${projectId}`);
        return null;
      }
      
      // Search for panel by panelNumber
      const panel = panels.find(p => {
        const dbPanelNumber = p.panelNumber?.toString() || '';
        const searchPanelNumber = panelNumber?.toString() || '';
        
        // Exact match
        if (dbPanelNumber === searchPanelNumber) return true;
        
        // Handle P- prefix format difference: P-001 vs P001
        const normalizedDb = dbPanelNumber.replace(/^P-?/, 'P');
        const normalizedSearch = searchPanelNumber.replace(/^P-?/, 'P');
        if (normalizedDb === normalizedSearch) return true;
        
        // ID match
        if (p.id === panelNumber) return true;
        
        return false;
      });
      
      if (panel) {
        console.log(`✅ [PANEL_LOOKUP] Found panel: ${panel.id} for panel number: ${panelNumber}`);
        return panel.id;
      }
      
      // Try fuzzy matching for common variations
      const fuzzyMatch = panels.find(p => {
        const pn = p.panelNumber?.toString().toLowerCase() || '';
        const search = panelNumber?.toString().toLowerCase() || '';
        
        // Normalize both for P- prefix comparison
        const normalizedPn = pn.replace(/^p-?/, 'p');
        const normalizedSearch = search.replace(/^p-?/, 'p');
        
        return normalizedPn.includes(normalizedSearch) || 
               normalizedSearch.includes(normalizedPn) ||
               normalizedPn.replace(/[^a-z0-9]/g, '') === normalizedSearch.replace(/[^a-z0-9]/g, '');
      });
      
      if (fuzzyMatch) {
        console.log(`✅ [PANEL_LOOKUP] Found panel (fuzzy match): ${fuzzyMatch.id} for panel number: ${panelNumber}`);
        return fuzzyMatch.id;
      }
      
      console.log(`❌ [PANEL_LOOKUP] No panel found for panel number: ${panelNumber}`);
      return null;
      
    } catch (error) {
      console.error(`❌ [PANEL_LOOKUP] Error finding panel:`, error);
      return null;
    }
  }

  /**
   * Get all panels for a project (for debugging)
   */
  async getAllPanels(projectId) {
    try {
      const query = `
        SELECT panels 
        FROM panel_layouts 
        WHERE project_id = $1
      `;
      
      const result = await this.pool.query(query, [projectId]);
      
      if (result.rows.length === 0) {
        return [];
      }
      
      return result.rows[0].panels || [];
    } catch (error) {
      console.error(`❌ [PANEL_LOOKUP] Error getting all panels:`, error);
      return [];
    }
  }

  /**
   * Create a new panel if it doesn't exist (for auto-creation)
   */
  async createPanelIfNotExists(panelNumber, projectId, additionalData = {}) {
    try {
      console.log(`🔍 [PANEL_LOOKUP] Creating panel if not exists: ${panelNumber} in project: ${projectId}`);
      
      // First check if panel already exists
      const existingPanelId = await this.findPanelIdByNumber(panelNumber, projectId);
      if (existingPanelId) {
        return existingPanelId;
      }
      
      // Create new panel
      const newPanel = {
        id: `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        panelNumber: panelNumber,
        shape: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        ...additionalData
      };
      
      // Get existing panel layout
      const layoutQuery = `
        SELECT id, panels 
        FROM panel_layouts 
        WHERE project_id = $1
      `;
      
      const layoutResult = await this.pool.query(layoutQuery, [projectId]);
      
      if (layoutResult.rows.length === 0) {
        // Create new panel layout
        const createLayoutQuery = `
          INSERT INTO panel_layouts (project_id, panels, width, height, scale)
          VALUES ($1, $2, 4000, 4000, 1.0)
          RETURNING id
        `;
        
        await this.pool.query(createLayoutQuery, [projectId, JSON.stringify([newPanel])]);
        console.log(`✅ [PANEL_LOOKUP] Created new panel layout with panel: ${newPanel.id}`);
      } else {
        // Add panel to existing layout
        const existingPanels = layoutResult.rows[0].panels || [];
        const updatedPanels = [...existingPanels, newPanel];
        
        const updateLayoutQuery = `
          UPDATE panel_layouts 
          SET panels = $1, last_updated = NOW()
          WHERE project_id = $2
        `;
        
        await this.pool.query(updateLayoutQuery, [JSON.stringify(updatedPanels), projectId]);
        console.log(`✅ [PANEL_LOOKUP] Added panel to existing layout: ${newPanel.id}`);
      }
      
      return newPanel.id;
      
    } catch (error) {
      console.error(`❌ [PANEL_LOOKUP] Error creating panel:`, error);
      return null;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = PanelLookupService;
