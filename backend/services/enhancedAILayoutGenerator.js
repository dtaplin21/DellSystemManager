const panelRequirementsService = require('./panelRequirementsService');

class EnhancedAILayoutGenerator {
  /**
   * Generate layout actions based on panel requirements
   */
  async generateLayoutActions(projectId) {
    try {
      console.log('🤖 Starting AI layout generation for project:', projectId);
      
      // Get panel requirements from dedicated storage
      const requirements = await panelRequirementsService.getRequirementsByProjectId(projectId);
      
      if (!requirements) {
        console.log('❌ No panel requirements found for project:', projectId);
        return {
          success: false,
          status: 'insufficient_information',
          guidance: {
            title: 'No Panel Requirements Found',
            message: 'Please complete the panel requirements form before generating layouts.',
            requiredDocuments: [
              'Panel specifications with panel numbers, dimensions, and roll numbers'
            ],
            recommendedActions: [
              'Fill out the panel requirements form with essential panel data',
              'Upload documents containing panel specifications'
            ]
          },
          confidence: 0,
          missingParameters: {
            panelSpecifications: ['No panel specifications found'],
            materialRequirements: [],
            rollInventory: [],
            installationNotes: [],
            siteDimensions: []
          }
        };
      }

      // Calculate confidence score
      const confidence = panelRequirementsService.calculateConfidenceScore(requirements);
      const missing = panelRequirementsService.getMissingRequirements(requirements);

      console.log('📊 Requirements confidence score:', confidence);
      console.log('🔍 Missing requirements:', missing);

      // Check if we have sufficient information (lowered threshold to 30%)
      if (confidence < 30) {
        console.log('⚠️ Insufficient information for panel generation');
        return {
          success: false,
          status: 'insufficient_information',
          guidance: {
            title: 'Insufficient Information for Panel Generation',
            message: 'The AI cannot generate accurate panel layouts because essential panel information is missing. Please provide panel specifications with panel numbers, dimensions, and roll numbers.',
            requiredDocuments: [
              'Panel specifications document with panel numbers, dimensions, and roll numbers'
            ],
            recommendedActions: [
              'Upload panel specifications document with panel numbers, dimensions, and roll numbers',
              'Ensure panel specifications include panel ID, dimensions, and roll numbers'
            ]
          },
          confidence,
          missingParameters: missing,
          warnings: [
            'Low confidence score indicates missing essential panel data',
            'Panel generation requires panel numbers, dimensions, and roll numbers'
          ],
          analysis: {
            panelSpecifications: requirements.panelSpecifications || {},
            materialRequirements: requirements.materialRequirements || {},
            rollInventory: requirements.rollInventory || {},
            installationNotes: requirements.installationNotes || {},
            siteDimensions: requirements.siteDimensions || {}
          }
        };
      }

      // Generate panel actions based on requirements
      const actions = await this.generateActionsFromRequirements(requirements);
      
      console.log('✅ Generated panel actions:', actions.length);

      return {
        success: true,
        status: confidence >= 80 ? 'success' : 'partial',
        actions,
        confidence,
        summary: this.generateActionSummary(actions, requirements),
        analysis: {
          panelSpecifications: requirements.panelSpecifications,
          materialRequirements: requirements.materialRequirements,
          rollInventory: requirements.rollInventory,
          installationNotes: requirements.installationNotes,
          siteDimensions: requirements.siteDimensions
        }
      };

    } catch (error) {
      console.error('❌ Error generating layout actions:', error);
      return {
        success: false,
        status: 'error',
        error: error.message,
        confidence: 0
      };
    }
  }

  /**
   * Generate panel actions from requirements
   */
  async generateActionsFromRequirements(requirements) {
    const actions = [];
    
    try {
      const { panelSpecifications, materialRequirements, rollInventory, siteDimensions } = requirements;

      // Generate panels based on specifications
      if (panelSpecifications && panelSpecifications.panelCount) {
        const panelCount = panelSpecifications.panelCount;
        const dimensions = panelSpecifications.dimensions || '20ft x 100ft';
        
        // Parse dimensions
        const [width, height] = this.parseDimensions(dimensions);
        
        for (let i = 1; i <= panelCount; i++) {
          const position = this.calculatePanelPosition(i, panelCount, width, height, siteDimensions);
          
          actions.push({
            type: 'CREATE_PANEL',
            data: {
              id: `panel-${i}`,
              x: position.x,
              y: position.y,
              width: width,
              height: height,
              panelNumber: i,
              material: materialRequirements?.primaryMaterial || 'HDPE Geomembrane',
              thickness: materialRequirements?.thickness || '60 mil',
              seamRequirements: materialRequirements?.seamRequirements || 'Standard seam'
            }
          });
        }
      }

      // Add optimization actions
      if (actions.length > 0) {
        actions.push({
          type: 'OPTIMIZE_LAYOUT',
          data: {
            strategy: 'balanced',
            constraints: {
              siteWidth: siteDimensions?.width || 400,
              siteLength: siteDimensions?.length || 400,
              terrainType: siteDimensions?.terrainType || 'flat'
            }
          }
        });
      }

      return actions;

    } catch (error) {
      console.error('Error generating actions from requirements:', error);
      return [];
    }
  }

  /**
   * Parse dimensions string to width and height
   */
  parseDimensions(dimensions) {
    const match = dimensions.match(/(\d+)\s*ft\s*x\s*(\d+)\s*ft/i);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2])];
    }
    return [20, 100]; // Default dimensions
  }

  /**
   * Calculate panel position based on index and total count
   */
  calculatePanelPosition(index, total, panelWidth, panelHeight, siteDimensions) {
    const siteWidth = siteDimensions?.width || 400;
    const siteLength = siteDimensions?.length || 400;
    
    // Simple grid layout
    const panelsPerRow = Math.ceil(Math.sqrt(total));
    const row = Math.floor((index - 1) / panelsPerRow);
    const col = (index - 1) % panelsPerRow;
    
    const x = col * (panelWidth + 10); // 10ft spacing
    const y = row * (panelHeight + 10);
    
    return { x, y };
  }

  /**
   * Generate summary of actions
   */
  generateActionSummary(actions, requirements) {
    const panelActions = actions.filter(a => a.type === 'CREATE_PANEL');
    const totalPanels = panelActions.length;
    
    if (totalPanels === 0) {
      return 'No panels generated due to insufficient requirements';
    }

    const totalArea = panelActions.reduce((sum, action) => {
      return sum + (action.data.width * action.data.height);
    }, 0);

    return {
      totalPanels,
      totalArea: Math.round(totalArea),
      estimatedCost: this.estimateCost(totalArea, requirements.materialRequirements),
      layoutType: 'Grid-based optimization',
      confidence: requirements.confidenceScore || 0
    };
  }

  /**
   * Estimate cost based on area and materials
   */
  estimateCost(area, materialRequirements) {
    const baseCostPerSqFt = 2.50; // Base cost
    const materialMultiplier = materialRequirements?.thickness?.includes('80') ? 1.3 : 1.0;
    const seamMultiplier = materialRequirements?.seamRequirements?.includes('special') ? 1.2 : 1.0;
    
    return Math.round(area * baseCostPerSqFt * materialMultiplier * seamMultiplier);
  }
}

module.exports = new EnhancedAILayoutGenerator(); 