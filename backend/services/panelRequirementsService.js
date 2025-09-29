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
      
      const result = requirements[0] || null;
      
      if (result) {
        console.log('📋 Retrieved requirements from database:', {
          projectId: result.projectId,
          panelCount: result.panelSpecifications?.panelCount || 0,
          actualPanels: result.panelSpecifications?.panelSpecifications?.length || 0,
          hasPanelData: !!result.panelSpecifications?.panelSpecifications?.length,
          rollNumbersCount: result.panelSpecifications?.rollNumbers?.length || 0,
          panelNumbersCount: result.panelSpecifications?.panelNumbers?.length || 0,
          hasDimensions: !!result.panelSpecifications?.dimensions,
          confidenceScore: result.confidenceScore
        });
      }
      
      return result;
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

    console.log('🔍 Calculating confidence score for requirements:', {
      hasPanelSpecs: !!requirements.panelSpecifications,
      panelCount: requirements.panelSpecifications?.panelCount || 0,
      hasDimensions: !!requirements.panelSpecifications?.dimensions,
      rollNumbersCount: requirements.panelSpecifications?.rollNumbers?.length || 0,
      panelNumbersCount: requirements.panelSpecifications?.panelNumbers?.length || 0,
      actualPanelsCount: requirements.panelSpecifications?.panelSpecifications?.length || 0
    });

    // Panel Specifications (70% weight - ESSENTIAL)
    if (requirements.panelSpecifications) {
      const specs = requirements.panelSpecifications;
      if (specs.panelCount && specs.panelCount > 0) {
        score += 20;
        console.log('✅ Panel count found:', specs.panelCount, '(+20 points)');
      }
      if (specs.dimensions) {
        score += 20;
        console.log('✅ Panel dimensions found:', specs.dimensions, '(+20 points)');
      }
      // Accept either rollNumbers OR panelNumbers for full points
      if ((specs.rollNumbers && specs.rollNumbers.length > 0) || (specs.panelNumbers && specs.panelNumbers.length > 0)) {
        score += 20;
        console.log('✅ Roll/panel numbers found:', (specs.rollNumbers?.length || specs.panelNumbers?.length || 0), '(+20 points)');
      }
      // Give additional points if both are present
      if (specs.rollNumbers && specs.rollNumbers.length > 0 && specs.panelNumbers && specs.panelNumbers.length > 0) {
        score += 10;
        console.log('✅ Both roll and panel numbers found (+10 bonus points)');
      }
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

    console.log('🔍 Checking for missing requirements:', {
      hasPanelSpecs: !!requirements.panelSpecifications,
      panelCount: requirements.panelSpecifications?.panelCount || 0,
      hasDimensions: !!requirements.panelSpecifications?.dimensions,
      rollNumbersCount: requirements.panelSpecifications?.rollNumbers?.length || 0,
      panelNumbersCount: requirements.panelSpecifications?.panelNumbers?.length || 0,
      actualPanelsCount: requirements.panelSpecifications?.panelSpecifications?.length || 0
    });

    // Check Panel Specifications (REQUIRED)
    if (!requirements.panelSpecifications) {
      missing.panelSpecifications.push('No panel specifications found');
      console.log('❌ No panel specifications found');
    } else {
      const specs = requirements.panelSpecifications;
      console.log('🔍 Detailed panel specs check:', {
        panelCount: specs.panelCount,
        hasDimensions: !!specs.dimensions,
        dimensionsValue: specs.dimensions,
        rollNumbersType: typeof specs.rollNumbers,
        rollNumbersIsArray: Array.isArray(specs.rollNumbers),
        rollNumbersLength: specs.rollNumbers?.length || 0,
        rollNumbersSample: specs.rollNumbers?.slice(0, 3) || 'No roll numbers',
        panelNumbersType: typeof specs.panelNumbers,
        panelNumbersIsArray: Array.isArray(specs.panelNumbers),
        panelNumbersLength: specs.panelNumbers?.length || 0,
        actualPanelsType: typeof specs.panelSpecifications,
        actualPanelsIsArray: Array.isArray(specs.panelSpecifications),
        actualPanelsLength: specs.panelSpecifications?.length || 0
      });
      
      if (!specs.panelCount || specs.panelCount === 0) {
        missing.panelSpecifications.push('Panel count missing or zero');
        console.log('❌ Panel count missing or zero:', specs.panelCount);
      } else {
        console.log('✅ Panel count found:', specs.panelCount);
      }
      if (!specs.dimensions) {
        missing.panelSpecifications.push('Panel dimensions missing');
        console.log('❌ Panel dimensions missing');
      } else {
        console.log('✅ Panel dimensions found:', specs.dimensions);
      }
      // Accept either rollNumbers OR panelNumbers
      if ((!specs.rollNumbers || specs.rollNumbers.length === 0) && (!specs.panelNumbers || specs.panelNumbers.length === 0)) {
        missing.panelSpecifications.push('Roll numbers or panel numbers missing');
        console.log('❌ Both roll numbers and panel numbers missing');
      } else {
        if (specs.rollNumbers && specs.rollNumbers.length > 0) {
          console.log('✅ Roll numbers found:', specs.rollNumbers.length);
          console.log('✅ Roll numbers sample:', specs.rollNumbers.slice(0, 5));
        }
        if (specs.panelNumbers && specs.panelNumbers.length > 0) {
          console.log('✅ Panel numbers found:', specs.panelNumbers.length);
          console.log('✅ Panel numbers sample:', specs.panelNumbers.slice(0, 5));
        }
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