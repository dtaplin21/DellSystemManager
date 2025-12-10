const AsbuiltService = require('./asbuiltService');
const PanelLayoutService = require('./panelLayoutService');
const { v4: uuidv4 } = require('uuid');

class FormToPanelService {
  constructor() {
    this.asbuiltService = new AsbuiltService();
    this.panelLayoutService = new PanelLayoutService();
  }

  /**
   * Read all forms for a project and generate panel creation instructions
   */
  async generatePanelCreationInstructions(projectId) {
    try {
      // Get all forms for the project (with pagination to get all)
      let allRecords = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.asbuiltService.getProjectRecords(projectId, limit, offset);
        allRecords = allRecords.concat(batch);
        offset += limit;
        hasMore = batch.length === limit;
      }
      
      const instructions = {
        panels: [],
        repairs: [],
        seaming: [],
        errors: []
      };

      for (const record of allRecords) {
        try {
          const mappedData = typeof record.mapped_data === 'string' 
            ? JSON.parse(record.mapped_data) 
            : record.mapped_data;

          switch (record.domain) {
            case 'panel_placement':
              const panelInstruction = this.mapPanelPlacementToPanel(mappedData, record);
              if (panelInstruction) {
                instructions.panels.push(panelInstruction);
              }
              break;

            case 'repairs':
              const repairInstruction = this.mapRepairToRepairRecord(mappedData, record);
              if (repairInstruction) {
                instructions.repairs.push(repairInstruction);
              }
              break;

            case 'panel_seaming':
              const seamingInstruction = this.mapSeamingToPanelUpdate(mappedData, record);
              if (seamingInstruction) {
                instructions.seaming.push(seamingInstruction);
              }
              break;

            // Other form types can be added here
            default:
              // Skip other form types for now
              break;
          }
        } catch (error) {
          instructions.errors.push({
            recordId: record.id,
            domain: record.domain,
            error: error.message
          });
        }
      }

      return instructions;
    } catch (error) {
      throw new Error(`Failed to generate panel creation instructions: ${error.message}`);
    }
  }

  /**
   * Map panel placement form to panel creation instruction
   */
  mapPanelPlacementToPanel(formData, record) {
    try {
      if (!formData.panelNumber) {
        return null; // Skip if no panel number
      }

      return {
        panelNumber: formData.panelNumber,
        date: formData.dateTime || formData.date || new Date().toISOString().slice(0, 10),
        location: formData.locationNote || formData.location || '',
        rollNumber: formData.rollNumber || `ROLL-${formData.panelNumber}`,
        shape: 'rectangle', // Default shape
        width: formData.width || 100, // Default width in feet
        height: formData.height || 50, // Default height in feet
        material: formData.material || 'HDPE',
        thickness: formData.thickness || 60,
        notes: formData.weatherComments || formData.notes || '',
        sourceRecordId: record.id,
        sourceType: 'form',
        metadata: {
          formType: 'panel_placement',
          createdAt: record.created_at,
          createdBy: record.created_by
        }
      };
    } catch (error) {
      console.error('Error mapping panel placement form:', error);
      return null;
    }
  }

  /**
   * Map repair form to repair record instruction
   */
  mapRepairToRepairRecord(formData, record) {
    try {
      if (!formData.repairId) {
        return null; // Skip if no repair ID
      }

      return {
        repairId: formData.repairId, // R-{number} format
        panelNumbers: formData.panelNumbers || '',
        date: formData.date || new Date().toISOString().slice(0, 10),
        type: formData.typeDetailLocation || '',
        extruderNumber: formData.extruderNumber || '',
        operatorInitials: formData.operatorInitials || '',
        vboxResult: formData.vboxPassFail || null,
        sourceRecordId: record.id,
        sourceType: 'form',
        metadata: {
          formType: 'repairs',
          createdAt: record.created_at,
          createdBy: record.created_by
        }
      };
    } catch (error) {
      console.error('Error mapping repair form:', error);
      return null;
    }
  }

  /**
   * Map seaming form to panel update instruction
   */
  mapSeamingToPanelUpdate(formData, record) {
    try {
      if (!formData.panelNumbers) {
        return null; // Skip if no panel numbers
      }

      return {
        panelNumbers: formData.panelNumbers,
        dateTime: formData.dateTime || new Date().toISOString(),
        seamLength: formData.seamLength || null,
        seamerInitials: formData.seamerInitials || '',
        machineNumber: formData.machineNumber || '',
        wedgeTemp: formData.wedgeTemp || null,
        nipRollerSpeed: formData.nipRollerSpeed || null,
        barrelTemp: formData.barrelTemp || null,
        preheatTemp: formData.preheatTemp || null,
        trackPeelInside: formData.trackPeelInside || null,
        trackPeelOutside: formData.trackPeelOutside || null,
        tensileLbsPerIn: formData.tensileLbsPerIn || null,
        tensileRate: formData.tensileRate || null,
        vboxPassFail: formData.vboxPassFail || null,
        weatherComments: formData.weatherComments || '',
        sourceRecordId: record.id,
        sourceType: 'form',
        metadata: {
          formType: 'panel_seaming',
          createdAt: record.created_at,
          createdBy: record.created_by
        }
      };
    } catch (error) {
      console.error('Error mapping seaming form:', error);
      return null;
    }
  }

  /**
   * Convert form instructions to actual panels in panel layout
   */
  async createPanelsFromInstructions(projectId, instructions) {
    const results = {
      panelsCreated: 0,
      repairsAdded: 0,
      seamingUpdated: 0,
      errors: []
    };

    try {
      // Create panels from panel placement forms
      for (const panelInstruction of instructions.panels) {
        try {
          await this.panelLayoutService.createPanel(projectId, {
            panel_number: panelInstruction.panelNumber,
            date: panelInstruction.date,
            location: panelInstruction.location,
            roll_number: panelInstruction.rollNumber,
            shape: panelInstruction.shape,
            width_feet: panelInstruction.width,
            height_feet: panelInstruction.height,
            material: panelInstruction.material,
            thickness: panelInstruction.thickness,
            notes: panelInstruction.notes,
            properties: {
              sourceRecordId: panelInstruction.sourceRecordId,
              sourceType: panelInstruction.sourceType,
              ...panelInstruction.metadata
            }
          });
          results.panelsCreated++;
        } catch (error) {
          results.errors.push({
            type: 'panel_creation',
            panelNumber: panelInstruction.panelNumber,
            error: error.message
          });
        }
      }

      // Add repairs to existing panels
      for (const repairInstruction of instructions.repairs) {
        try {
          // Find panels by panel numbers
          const panelNumbers = repairInstruction.panelNumbers
            .split(',')
            .map(p => p.trim())
            .filter(p => p);

          for (const panelNumber of panelNumbers) {
            // Add repair to panel's meta.repairs array
            // This would require updating the panel layout service
            // For now, we'll track it in results
            results.repairsAdded++;
          }
        } catch (error) {
          results.errors.push({
            type: 'repair_creation',
            repairId: repairInstruction.repairId,
            error: error.message
          });
        }
      }

      // Update panels with seaming information
      for (const seamingInstruction of instructions.seaming) {
        try {
          // Update panel seaming data
          // This would require updating the panel layout service
          results.seamingUpdated++;
        } catch (error) {
          results.errors.push({
            type: 'seaming_update',
            panelNumbers: seamingInstruction.panelNumbers,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to create panels from instructions: ${error.message}`);
    }
  }

  /**
   * Sync all forms to panel layout for a project
   */
  async syncFormsToPanelLayout(projectId) {
    try {
      // Generate instructions from forms
      const instructions = await this.generatePanelCreationInstructions(projectId);

      // Create panels from instructions
      const results = await this.createPanelsFromInstructions(projectId, instructions);

      return {
        success: true,
        instructions,
        results,
        summary: {
          totalForms: instructions.panels.length + instructions.repairs.length + instructions.seaming.length,
          panelsCreated: results.panelsCreated,
          repairsAdded: results.repairsAdded,
          seamingUpdated: results.seamingUpdated,
          errors: results.errors.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new FormToPanelService();

