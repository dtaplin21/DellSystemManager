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
   * Calculate confidence score based on available data
   */
  calculateConfidenceScore(requirements) {
    let score = 0;
    let totalFields = 0;

    // Panel Specifications (25% weight)
    if (requirements.panelSpecifications) {
      const panelSpecs = requirements.panelSpecifications;
      if (panelSpecs.panelCount && panelSpecs.dimensions && panelSpecs.materials) {
        score += 25;
      } else if (panelSpecs.panelCount || panelSpecs.dimensions || panelSpecs.materials) {
        score += 12.5;
      }
    }
    totalFields += 25;

    // Material Requirements (25% weight)
    if (requirements.materialRequirements) {
      const materialReqs = requirements.materialRequirements;
      if (materialReqs.primaryMaterial && materialReqs.thickness && materialReqs.seamRequirements) {
        score += 25;
      } else if (materialReqs.primaryMaterial || materialReqs.thickness || materialReqs.seamRequirements) {
        score += 12.5;
      }
    }
    totalFields += 25;

    // Roll Inventory (20% weight)
    if (requirements.rollInventory) {
      const rollInv = requirements.rollInventory;
      if (rollInv.rolls && rollInv.dimensions && rollInv.quantities) {
        score += 20;
      } else if (rollInv.rolls || rollInv.dimensions || rollInv.quantities) {
        score += 10;
      }
    }
    totalFields += 20;

    // Installation Notes (15% weight)
    if (requirements.installationNotes) {
      const installNotes = requirements.installationNotes;
      if (installNotes.requirements && installNotes.constraints && installNotes.notes) {
        score += 15;
      } else if (installNotes.requirements || installNotes.constraints || installNotes.notes) {
        score += 7.5;
      }
    }
    totalFields += 15;

    // Site Dimensions (15% weight)
    if (requirements.siteDimensions) {
      const siteDims = requirements.siteDimensions;
      if (siteDims.width && siteDims.length && siteDims.terrainType) {
        score += 15;
      } else if (siteDims.width || siteDims.length || siteDims.terrainType) {
        score += 7.5;
      }
    }
    totalFields += 15;

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

    // Check Panel Specifications
    if (!requirements.panelSpecifications) {
      missing.panelSpecifications.push('No panel specifications found');
    } else {
      const specs = requirements.panelSpecifications;
      if (!specs.panelCount) missing.panelSpecifications.push('Panel count missing');
      if (!specs.dimensions) missing.panelSpecifications.push('Panel dimensions missing');
      if (!specs.materials) missing.panelSpecifications.push('Panel materials missing');
    }

    // Check Material Requirements
    if (!requirements.materialRequirements) {
      missing.materialRequirements.push('No material requirements found');
    } else {
      const materials = requirements.materialRequirements;
      if (!materials.primaryMaterial) missing.materialRequirements.push('Primary material specifications missing');
      if (!materials.thickness) missing.materialRequirements.push('Material thickness missing');
      if (!materials.seamRequirements) missing.materialRequirements.push('Seam requirements missing');
    }

    // Check Roll Inventory
    if (!requirements.rollInventory) {
      missing.rollInventory.push('No roll inventory information found');
    } else {
      const rolls = requirements.rollInventory;
      if (!rolls.rolls) missing.rollInventory.push('Roll list missing');
      if (!rolls.dimensions) missing.rollInventory.push('Roll dimensions missing');
      if (!rolls.quantities) missing.rollInventory.push('Roll quantities missing');
    }

    // Check Installation Notes
    if (!requirements.installationNotes) {
      missing.installationNotes.push('No installation requirements found');
    } else {
      const install = requirements.installationNotes;
      if (!install.requirements) missing.installationNotes.push('Installation requirements missing');
      if (!install.constraints) missing.installationNotes.push('Installation constraints missing');
    }

    // Check Site Dimensions
    if (!requirements.siteDimensions) {
      missing.siteDimensions.push('No site dimensions found');
    } else {
      const site = requirements.siteDimensions;
      if (!site.width) missing.siteDimensions.push('Site width missing');
      if (!site.length) missing.siteDimensions.push('Site length missing');
      if (!site.terrainType) missing.siteDimensions.push('Terrain type missing');
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