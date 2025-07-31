const { db } = require('../db/index');
const { panelLayoutRequirements } = require('../db/schema');
const { eq, and } = require('drizzle-orm');

class PanelRequirementsService {
  /**
   * Create or update panel layout requirements for a project
   */
  async upsertRequirements(projectId, requirements) {
    try {
      const existing = await this.getRequirementsByProjectId(projectId);
      
      if (existing) {
        // Update existing requirements
        const updatedRequirements = await db
          .update(panelLayoutRequirements)
          .set({
            ...requirements,
            lastUpdated: new Date(),
          })
          .where(eq(panelLayoutRequirements.projectId, projectId))
          .returning();
        
        return updatedRequirements[0];
      } else {
        // Create new requirements
        const newRequirements = await db
          .insert(panelLayoutRequirements)
          .values({
            projectId,
            ...requirements,
          })
          .returning();
        
        return newRequirements[0];
      }
    } catch (error) {
      console.error('Error upserting panel requirements:', error);
      throw error;
    }
  }

  /**
   * Get requirements by project ID
   */
  async getRequirementsByProjectId(projectId) {
    try {
      const requirements = await db
        .select()
        .from(panelLayoutRequirements)
        .where(eq(panelLayoutRequirements.projectId, projectId))
        .limit(1);
      
      return requirements[0] || null;
    } catch (error) {
      console.error('Error getting panel requirements:', error);
      throw error;
    }
  }

  /**
   * Update specific requirement fields
   */
  async updateRequirementFields(projectId, fields) {
    try {
      const updatedRequirements = await db
        .update(panelLayoutRequirements)
        .set({
          ...fields,
          lastUpdated: new Date(),
        })
        .where(eq(panelLayoutRequirements.projectId, projectId))
        .returning();
      
      return updatedRequirements[0];
    } catch (error) {
      console.error('Error updating panel requirements:', error);
      throw error;
    }
  }

  /**
   * Calculate confidence score for requirements completeness
   */
  calculateConfidenceScore(requirements) {
    let score = 0;
    let totalFields = 0;

    // Panel Specifications (70% weight - ESSENTIAL)
    if (requirements.panelSpecifications) {
      const specs = requirements.panelSpecifications;
      if (specs.panelCount && specs.panelCount > 0) score += 20;
      if (specs.dimensions) score += 20;
      if (specs.rollNumbers && specs.rollNumbers.length > 0) score += 20;
      if (specs.panelNumbers && specs.panelNumbers.length > 0) score += 10;
    }
    totalFields += 70;

    // Material Requirements (10% weight - OPTIONAL)
    if (requirements.materialRequirements) {
      const materials = requirements.materialRequirements;
      if (materials.primaryMaterial && materials.primaryMaterial !== 'Material type not specified - will be determined during installation') {
        score += 5;
      }
      if (materials.thickness && materials.thickness !== 'Thickness not specified - will be determined during installation') {
        score += 5;
      }
    }
    totalFields += 10;

    // Roll Inventory (10% weight - OPTIONAL)
    if (requirements.rollInventory) {
      const rolls = requirements.rollInventory;
      if (rolls.rolls && rolls.rolls.length > 0) {
        score += 10;
      }
    }
    totalFields += 10;

    // Installation Notes (5% weight - OPTIONAL)
    if (requirements.installationNotes) {
      const install = requirements.installationNotes;
      if (install.requirements && install.requirements !== 'Standard geosynthetic installation procedures') {
        score += 5;
      }
    }
    totalFields += 5;

    // Site Dimensions (5% weight - OPTIONAL)
    if (requirements.siteDimensions) {
      const siteDims = requirements.siteDimensions;
      if (siteDims.width && siteDims.length) {
        score += 5;
      }
    }
    totalFields += 5;

    return Math.round(score);
  }

  /**
   * Get missing requirements analysis
   */
  getMissingRequirements(requirements) {
    const missing = {
      panelSpecifications: [],
      materialRequirements: [],
      rollInventory: [],
      installationNotes: [],
      siteDimensions: []
    };

    // Check Panel Specifications (REQUIRED)
    if (!requirements.panelSpecifications) {
      missing.panelSpecifications.push('No panel specifications found');
    } else {
      const specs = requirements.panelSpecifications;
      if (!specs.panelCount || specs.panelCount === 0) {
        missing.panelSpecifications.push('Panel count missing or zero');
      }
      if (!specs.dimensions) {
        missing.panelSpecifications.push('Panel dimensions missing');
      }
      if (!specs.rollNumbers || specs.rollNumbers.length === 0) {
        missing.panelSpecifications.push('Roll numbers missing');
      }
    }

    // Check Material Requirements (OPTIONAL - for recognition only)
    if (requirements.materialRequirements) {
      const materials = requirements.materialRequirements;
      if (materials.primaryMaterial === 'Material type not specified - will be determined during installation') {
        // This is expected - material is optional
      }
    }

    // Check Roll Inventory (OPTIONAL - for recognition only)
    if (requirements.rollInventory) {
      const rolls = requirements.rollInventory;
      if (!rolls.rolls || rolls.rolls.length === 0) {
        // This is optional - roll inventory is for reference only
      }
    }

    // Check Installation Notes (OPTIONAL)
    if (requirements.installationNotes) {
      const install = requirements.installationNotes;
      if (!install.requirements || install.requirements === 'Standard geosynthetic installation procedures') {
        // This is expected - installation notes are optional
      }
    }

    // Check Site Dimensions (OPTIONAL)
    if (requirements.siteDimensions) {
      const site = requirements.siteDimensions;
      if (!site.width || !site.length) {
        // This is optional - site dimensions are not required for panel generation
      }
    }

    return missing;
  }

  /**
   * Delete requirements for a project
   */
  async deleteRequirements(projectId) {
    try {
      await db
        .delete(panelLayoutRequirements)
        .where(eq(panelLayoutRequirements.projectId, projectId));
      
      return true;
    } catch (error) {
      console.error('Error deleting panel requirements:', error);
      throw error;
    }
  }
}

module.exports = new PanelRequirementsService(); 