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
   * Extract numeric value from panel number
   */
  extractNumericValue(panelNumber) {
    const match = panelNumber.toString().match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  /**
   * Normalize panel number to standard format P###
   */
  normalizePanelNumber(panelNumber) {
    const numeric = this.extractNumericValue(panelNumber);
    return numeric !== null ? `P${numeric.toString().padStart(3, '0')}` : null;
  }

  /**
   * Find panel ID by panel number from the panel layout system
   * Handles multiple panel number formats: 8, 08, 008, P8, P-8, P-008, etc.
   */
  async findPanelIdByNumber(panelNumber, projectId) {
    try {
      console.log(`🔍 [PANEL_LOOKUP] Looking for: "${panelNumber}" in project: ${projectId}`);
      
      const query = `SELECT panels FROM panel_layouts WHERE project_id = $1`;
      const result = await this.pool.query(query, [projectId]);
      
      if (result.rows.length === 0 || !Array.isArray(result.rows[0].panels)) {
        console.log(`❌ [PANEL_LOOKUP] No panel layout found`);
        return null;
      }
      
      const panels = result.rows[0].panels;
      const searchNormalized = this.normalizePanelNumber(panelNumber);
      
      console.log(`🔍 [PANEL_LOOKUP] Normalized search: "${panelNumber}" → "${searchNormalized}"`);
      
      // Find by exact numeric match
      const panel = panels.find(p => {
        const dbNormalized = this.normalizePanelNumber(p.panelNumber);
        const match = dbNormalized === searchNormalized;
        
        if (match) {
          console.log(`✅ [PANEL_LOOKUP] MATCH: "${p.panelNumber}" → "${dbNormalized}" === "${searchNormalized}"`);
        }
        
        return match;
      });
      
      if (panel) {
        console.log(`✅ [PANEL_LOOKUP] Found panel ID: ${panel.id}`);
        return panel.id;
      }
      
      console.log(`❌ [PANEL_LOOKUP] No match found for "${searchNormalized}"`);
      console.log(`🔍 [PANEL_LOOKUP] Available panels:`, panels.map(p => ({
        id: p.id,
        panelNumber: p.panelNumber,
        normalized: this.normalizePanelNumber(p.panelNumber)
      })));
      
      return null;
      
    } catch (error) {
      console.error(`❌ [PANEL_LOOKUP] Error:`, error);
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
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = PanelLookupService;
