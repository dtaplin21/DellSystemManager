const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const panelDocumentAnalyzer = require('./panelDocumentAnalyzer');

class EnhancedAILayoutGenerator {
  /**
   * Generate layout actions using enhanced AI analysis
   */
  async generateLayoutActions(documents, projectId) {
    try {
      console.log(`[ENHANCED AI] Starting layout generation for project ${projectId}`);
      console.log(`[ENHANCED AI] Documents received: ${documents?.length || 0}`);
      
      // Log document details for debugging
      if (documents && documents.length > 0) {
        documents.forEach((doc, index) => {
          console.log(`[ENHANCED AI] Document ${index + 1}:`, {
            id: doc.id,
            name: doc.name || doc.filename,
            hasText: !!doc.text,
            textLength: doc.text ? doc.text.length : 0,
            textPreview: doc.text ? doc.text.substring(0, 100) + '...' : 'No text'
          });
        });
      }
      
      // Check if we have documents with text content
      const documentsWithText = documents?.filter(doc => doc.text && doc.text.trim().length > 0) || [];
      console.log(`[ENHANCED AI] Documents with text content: ${documentsWithText.length}`);
      
      if (documentsWithText.length === 0) {
        console.warn('[ENHANCED AI] No documents with text content found');
        return this.generateInsufficientInformationResponse('No document text content available');
      }
      
      // Step 1: Analyze documents for panel-specific information
      const documentAnalysis = await panelDocumentAnalyzer.analyzePanelDocuments(documents);
      console.log(`[ENHANCED AI] Document analysis complete. Confidence: ${documentAnalysis.confidence}`);
      
      // Step 2: Analyze information completeness and identify missing parameters
      const completenessAnalysis = this.analyzeInformationCompleteness(documentAnalysis);
      console.log(`[ENHANCED AI] Completeness analysis: ${completenessAnalysis.status}`);
      
      // Step 3: If insufficient information, return guidance response
      if (completenessAnalysis.status === 'insufficient') {
        return {
          success: false,
          status: 'insufficient_information',
          guidance: completenessAnalysis.guidance,
          missingParameters: completenessAnalysis.missingParameters,
          analysis: documentAnalysis,
          actions: [],
          summary: {
            totalActions: 0,
            actionTypes: {},
            estimatedPanels: 0,
            estimatedArea: 0,
            confidence: documentAnalysis.confidence,
            documentTypes: documentAnalysis.documentTypes,
            materialUsed: 'Unknown',
            siteDimensions: null
          }
        };
      }
      
      // Step 4: Generate layout actions based on analysis
      const layoutActions = await this.generateActionsFromAnalysis(documentAnalysis, projectId);
      
      // Step 5: Validate and optimize the layout
      const optimizedActions = this.optimizeLayoutActions(layoutActions, documentAnalysis);
      
      // Step 6: Add warnings for any remaining missing information
      const warnings = this.generateWarnings(documentAnalysis, completenessAnalysis);
      
      return {
        success: true,
        status: 'success',
        actions: optimizedActions,
        summary: this.generateActionSummary(optimizedActions, documentAnalysis),
        analysis: documentAnalysis,
        warnings: warnings,
        guidance: completenessAnalysis.guidance,
        tokensUsed: 0
      };

    } catch (error) {
      console.error('[ENHANCED AI] Error generating layout actions:', error);
      return {
        success: false,
        status: 'error',
        error: error.message,
        actions: [],
        analysis: null,
        guidance: {
          title: 'System Error',
          message: 'An error occurred while processing your documents. Please try again.',
          requiredDocuments: [],
          recommendedActions: ['Check document format', 'Ensure documents contain panel information', 'Try uploading different documents']
        }
      };
    }
  }

  /**
   * Analyze information completeness and identify missing parameters
   */
  analyzeInformationCompleteness(analysis) {
    const missingParameters = {
      panelSpecifications: [],
      siteConstraints: [],
      materialRequirements: [],
      rollInformation: [],
      installationNotes: []
    };

    const guidance = {
      title: '',
      message: '',
      requiredDocuments: [],
      recommendedActions: [],
      confidence: analysis.confidence
    };

    // Check panel specifications completeness
    if (analysis.panelSpecifications.length === 0) {
      missingParameters.panelSpecifications.push('No panel specifications found');
      guidance.requiredDocuments.push('Panel specifications document');
    } else {
      // Check each panel specification for completeness
      analysis.panelSpecifications.forEach((panel, index) => {
        const panelIssues = [];
        
        if (!panel.panelNumber) panelIssues.push('Panel number missing');
        if (!panel.rollNumber) panelIssues.push('Roll number missing');
        if (!panel.dimensions || !panel.dimensions.width || !panel.dimensions.length) {
          panelIssues.push('Panel dimensions missing or incomplete');
        }
        if (!panel.material) panelIssues.push('Material type missing');
        if (!panel.thickness) panelIssues.push('Material thickness missing');
        
        if (panelIssues.length > 0) {
          missingParameters.panelSpecifications.push(`Panel ${index + 1}: ${panelIssues.join(', ')}`);
        }
      });
    }

    // Check site constraints completeness
    if (!analysis.siteConstraints.siteDimensions) {
      missingParameters.siteConstraints.push('Site dimensions missing');
      guidance.requiredDocuments.push('Site plan document');
    } else {
      if (!analysis.siteConstraints.siteDimensions.width || !analysis.siteConstraints.siteDimensions.length) {
        missingParameters.siteConstraints.push('Site dimensions incomplete (width or length missing)');
      }
    }

    if (analysis.siteConstraints.obstacles === undefined) {
      missingParameters.siteConstraints.push('Site obstacles information missing');
    }

    // Check material requirements completeness
    if (!analysis.materialRequirements.primaryMaterial) {
      missingParameters.materialRequirements.push('Primary material specifications missing');
      guidance.requiredDocuments.push('Material specifications document');
    } else {
      if (!analysis.materialRequirements.primaryMaterial.type) {
        missingParameters.materialRequirements.push('Material type missing');
      }
      if (!analysis.materialRequirements.primaryMaterial.thickness) {
        missingParameters.materialRequirements.push('Material thickness missing');
      }
    }

    if (!analysis.materialRequirements.seamRequirements) {
      missingParameters.materialRequirements.push('Seam requirements missing');
    } else {
      if (!analysis.materialRequirements.seamRequirements.overlap) {
        missingParameters.materialRequirements.push('Seam overlap specification missing');
      }
    }

    // Check roll information completeness
    if (analysis.rollInformation.length === 0) {
      missingParameters.rollInformation.push('No roll inventory information found');
      guidance.requiredDocuments.push('Roll inventory document');
    } else {
      analysis.rollInformation.forEach((roll, index) => {
        const rollIssues = [];
        
        if (!roll.rollNumber) rollIssues.push('Roll number missing');
        if (!roll.dimensions || !roll.dimensions.width || !roll.dimensions.length) {
          rollIssues.push('Roll dimensions missing or incomplete');
        }
        if (!roll.material) rollIssues.push('Roll material missing');
        
        if (rollIssues.length > 0) {
          missingParameters.rollInformation.push(`Roll ${index + 1}: ${rollIssues.join(', ')}`);
        }
      });
    }

    // Check installation notes completeness
    if (analysis.installationNotes.length === 0) {
      missingParameters.installationNotes.push('No installation requirements found');
      guidance.requiredDocuments.push('Installation notes document');
    }

    // Determine overall status
    const totalMissing = Object.values(missingParameters).flat().length;
    const criticalMissing = missingParameters.panelSpecifications.length + 
                           missingParameters.siteConstraints.length + 
                           missingParameters.materialRequirements.length;

    let status = 'sufficient';
    if (criticalMissing > 0) {
      status = 'insufficient';
    } else if (totalMissing > 0) {
      status = 'partial';
    }

    // Generate guidance based on missing information
    if (status === 'insufficient') {
      guidance.title = 'Insufficient Information for Panel Generation';
      guidance.message = 'The AI cannot generate accurate panel layouts because critical information is missing. Please provide the required documents and information.';
      
      if (missingParameters.panelSpecifications.length > 0) {
        guidance.recommendedActions.push('Upload panel specifications document with panel numbers, dimensions, and materials');
      }
      if (missingParameters.siteConstraints.length > 0) {
        guidance.recommendedActions.push('Upload site plan document with site dimensions and constraints');
      }
      if (missingParameters.materialRequirements.length > 0) {
        guidance.recommendedActions.push('Upload material specifications document with material type, thickness, and seam requirements');
      }
    } else if (status === 'partial') {
      guidance.title = 'Partial Information - Panel Generation May Be Limited';
      guidance.message = 'The AI can generate panel layouts, but some information is missing which may affect accuracy. Consider providing additional documents for better results.';
      
      if (missingParameters.rollInformation.length > 0) {
        guidance.recommendedActions.push('Upload roll inventory for optimal material usage');
      }
      if (missingParameters.installationNotes.length > 0) {
        guidance.recommendedActions.push('Upload installation notes for better positioning and overlap specifications');
      }
    } else {
      guidance.title = 'Complete Information Available';
      guidance.message = 'All required information is available. The AI can generate accurate panel layouts based on your specifications.';
      guidance.recommendedActions.push('Review generated layout and make adjustments as needed');
    }

    return {
      status,
      missingParameters,
      guidance,
      totalMissing,
      criticalMissing
    };
  }

  /**
   * Generate warnings for any remaining missing information
   */
  generateWarnings(analysis, completenessAnalysis) {
    const warnings = [];

    if (completenessAnalysis.status === 'partial') {
      warnings.push({
        type: 'warning',
        message: 'Some information is missing. Generated layout may use default values.',
        details: completenessAnalysis.missingParameters
      });
    }

    if (analysis.confidence < 0.5) {
      warnings.push({
        type: 'low_confidence',
        message: 'Low confidence in document analysis. Please verify extracted information.',
        details: `Analysis confidence: ${(analysis.confidence * 100).toFixed(1)}%`
      });
    }

    if (analysis.panelSpecifications.length > 0) {
      const incompletePanels = analysis.panelSpecifications.filter(panel => 
        !panel.dimensions || !panel.material || !panel.thickness
      );
      
      if (incompletePanels.length > 0) {
        warnings.push({
          type: 'incomplete_panels',
          message: `${incompletePanels.length} panel(s) have incomplete specifications.`,
          details: incompletePanels.map((panel, index) => 
            `Panel ${index + 1}: Missing ${this.getMissingPanelFields(panel)}`
          )
        });
      }
    }

    return warnings;
  }

  /**
   * Get missing fields for a panel specification
   */
  getMissingPanelFields(panel) {
    const missing = [];
    if (!panel.dimensions) missing.push('dimensions');
    if (!panel.material) missing.push('material');
    if (!panel.thickness) missing.push('thickness');
    if (!panel.rollNumber) missing.push('roll number');
    return missing.join(', ');
  }

  /**
   * Generate actions based on document analysis
   */
  async generateActionsFromAnalysis(analysis, projectId) {
    const actions = [];
    let actionId = 1;

    // If we have specific panel specifications, use them
    if (analysis.panelSpecifications.length > 0) {
      console.log(`[ENHANCED AI] Using ${analysis.panelSpecifications.length} panel specifications from documents`);
      
      for (const panelSpec of analysis.panelSpecifications) {
        const action = this.createPanelAction(panelSpec, actionId++, projectId);
        if (action) {
          actions.push(action);
        }
      }
    } else {
      // Generate panels based on roll data and site constraints
      console.log('[ENHANCED AI] No panel specifications found, generating from roll data and site constraints');
      const generatedActions = await this.generatePanelsFromRollData(analysis, projectId);
      actions.push(...generatedActions);
    }

    // Add optimization actions
    const optimizationActions = this.generateOptimizationActions(analysis, projectId);
    actions.push(...optimizationActions);

    return actions;
  }

  /**
   * Create a panel action from panel specification
   */
  createPanelAction(panelSpec, actionId, projectId) {
    try {
      // Validate panel specification
      if (!panelSpec.panelNumber || !panelSpec.dimensions) {
        console.warn(`[ENHANCED AI] Invalid panel specification:`, panelSpec);
        return null;
      }

      // Calculate position based on priority and available space
      const position = this.calculatePanelPosition(panelSpec, actionId);
      
      return {
        type: 'CREATE_PANEL',
        id: `action_${actionId}`,
        payload: {
          position: position,
          dimensions: {
            width: panelSpec.dimensions.width,
            height: panelSpec.dimensions.length
          },
          rotation: 0,
          properties: {
            panelNumber: panelSpec.panelNumber,
            rollNumber: panelSpec.rollNumber || `R${actionId.toString().padStart(3, '0')}`,
            material: panelSpec.material || 'HDPE',
            thickness: panelSpec.thickness || 60,
            location: panelSpec.location || `Zone ${Math.ceil(actionId / 5)}`,
            notes: panelSpec.notes || `Panel ${panelSpec.panelNumber} from specifications`,
            priority: panelSpec.priority || 3
          }
        }
      };
    } catch (error) {
      console.error('[ENHANCED AI] Error creating panel action:', error);
      return null;
    }
  }

  /**
   * Generate panels from roll data when no specifications are available
   */
  async generatePanelsFromRollData(analysis, projectId) {
    const actions = [];
    let actionId = 1;

    const siteConstraints = analysis.siteConstraints;
    const rollData = analysis.rollInformation;
    const materialSpecs = analysis.materialRequirements;

    // Get site dimensions
    const siteWidth = siteConstraints.siteDimensions?.width || 1000;
    const siteLength = siteConstraints.siteDimensions?.length || 800;

    // Get material specifications
    const material = materialSpecs.primaryMaterial?.type || 'HDPE';
    const thickness = materialSpecs.primaryMaterial?.thickness || 60;
    const overlap = materialSpecs.seamRequirements?.overlap || 6;

    // Calculate optimal panel dimensions based on roll data
    let panelWidth = 40; // Default width
    let panelLength = 100; // Default length

    if (rollData.length > 0) {
      // Use the most common roll dimensions
      const rollWidths = rollData.map(roll => roll.dimensions?.width).filter(w => w > 0);
      const rollLengths = rollData.map(roll => roll.dimensions?.length).filter(l => l > 0);
      
      if (rollWidths.length > 0) {
        panelWidth = Math.min(...rollWidths);
      }
      if (rollLengths.length > 0) {
        panelLength = Math.min(...rollLengths);
      }
    }

    // Calculate spacing (overlap in feet)
    const spacing = overlap / 12;

    // Calculate how many panels fit in the site
    const maxPanelsX = Math.floor((siteWidth - 100) / (panelWidth + spacing));
    const maxPanelsY = Math.floor((siteLength - 100) / (panelLength + spacing));
    const totalPanels = Math.min(maxPanelsX * maxPanelsY, 20); // Cap at 20 panels

    console.log(`[ENHANCED AI] Generating ${totalPanels} panels: ${maxPanelsX}x${maxPanelsY} grid`);

    // Generate panels in a grid pattern
    for (let i = 0; i < totalPanels; i++) {
      const row = Math.floor(i / maxPanelsX);
      const col = i % maxPanelsX;

      const x = 50 + col * (panelWidth + spacing);
      const y = 50 + row * (panelLength + spacing);

      // Assign roll number if available
      let rollNumber = `R${(i + 1).toString().padStart(3, '0')}`;
      if (rollData.length > 0) {
        const rollIndex = i % rollData.length;
        rollNumber = rollData[rollIndex].rollNumber || rollNumber;
      }

      actions.push({
        type: 'CREATE_PANEL',
        id: `action_${actionId++}`,
        payload: {
          position: { x, y },
          dimensions: { width: panelWidth, height: panelLength },
          rotation: 0,
          properties: {
            panelNumber: `P${(i + 1).toString().padStart(3, '0')}`,
            rollNumber: rollNumber,
            material: material,
            thickness: thickness,
            location: `Grid ${row + 1}-${col + 1}`,
            notes: `Generated panel from roll data analysis`,
            priority: 3
          }
        }
      });
    }

    return actions;
  }

  /**
   * Calculate optimal panel position based on specifications
   */
  calculatePanelPosition(panelSpec, actionId) {
    // Simple positioning logic - can be enhanced with more sophisticated algorithms
    const baseX = 50;
    const baseY = 50;
    const spacing = 10; // 10 feet between panels
    
    const row = Math.floor((actionId - 1) / 5);
    const col = (actionId - 1) % 5;
    
    return {
      x: baseX + col * (panelSpec.dimensions.width + spacing),
      y: baseY + row * (panelSpec.dimensions.length + spacing)
    };
  }

  /**
   * Generate optimization actions based on analysis
   */
  generateOptimizationActions(analysis, projectId) {
    const actions = [];
    let actionId = 1000; // Start optimization actions at higher ID

    // Add overlap optimization actions
    if (analysis.materialRequirements.seamRequirements?.overlap) {
      const overlap = analysis.materialRequirements.seamRequirements.overlap;
      actions.push({
        type: 'OPTIMIZE_OVERLAP',
        id: `action_${actionId++}`,
        payload: {
          overlap: overlap,
          notes: `Optimize panel overlap to ${overlap} inches based on material specifications`
        }
      });
    }

    // Add anchoring actions based on installation notes
    const anchoringNotes = analysis.installationNotes.filter(note => 
      note.type === 'anchoring' || note.requirement.toLowerCase().includes('anchor')
    );
    
    if (anchoringNotes.length > 0) {
      actions.push({
        type: 'ADD_ANCHORING',
        id: `action_${actionId++}`,
        payload: {
          requirements: anchoringNotes.map(note => note.requirement),
          notes: 'Add anchoring based on installation requirements'
        }
      });
    }

    // Add drainage considerations
    const drainageNotes = analysis.installationNotes.filter(note => 
      note.type === 'drainage' || note.requirement.toLowerCase().includes('drain')
    );
    
    if (drainageNotes.length > 0) {
      actions.push({
        type: 'OPTIMIZE_DRAINAGE',
        id: `action_${actionId++}`,
        payload: {
          requirements: drainageNotes.map(note => note.requirement),
          notes: 'Optimize layout for drainage requirements'
        }
      });
    }

    return actions;
  }

  /**
   * Optimize layout actions based on analysis
   */
  optimizeLayoutActions(actions, analysis) {
    // Remove duplicate panels
    const uniqueActions = this.removeDuplicatePanels(actions);
    
    // Sort by priority
    const sortedActions = uniqueActions.sort((a, b) => {
      const priorityA = a.payload?.properties?.priority || 3;
      const priorityB = b.payload?.properties?.priority || 3;
      return priorityA - priorityB;
    });

    // Validate panel positions don't overlap
    const validatedActions = this.validatePanelPositions(sortedActions);

    return validatedActions;
  }

  /**
   * Remove duplicate panels based on panel number
   */
  removeDuplicatePanels(actions) {
    const seen = new Set();
    return actions.filter(action => {
      if (action.type !== 'CREATE_PANEL') return true;
      
      const panelNumber = action.payload?.properties?.panelNumber;
      if (!panelNumber) return true;
      
      if (seen.has(panelNumber)) {
        console.log(`[ENHANCED AI] Removing duplicate panel: ${panelNumber}`);
        return false;
      }
      
      seen.add(panelNumber);
      return true;
    });
  }

  /**
   * Validate that panel positions don't overlap
   */
  validatePanelPositions(actions) {
    const panels = actions.filter(action => action.type === 'CREATE_PANEL');
    const validatedActions = [];

    for (const action of actions) {
      if (action.type !== 'CREATE_PANEL') {
        validatedActions.push(action);
        continue;
      }

      const position = action.payload.position;
      const dimensions = action.payload.dimensions;
      
      // Check for overlap with existing panels
      let hasOverlap = false;
      for (const existingAction of validatedActions) {
        if (existingAction.type !== 'CREATE_PANEL') continue;
        
        const existingPos = existingAction.payload.position;
        const existingDims = existingAction.payload.dimensions;
        
        if (this.panelsOverlap(position, dimensions, existingPos, existingDims)) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        validatedActions.push(action);
      } else {
        // Adjust position to avoid overlap
        const adjustedAction = this.adjustPanelPosition(action, validatedActions);
        if (adjustedAction) {
          validatedActions.push(adjustedAction);
        }
      }
    }

    return validatedActions;
  }

  /**
   * Check if two panels overlap
   */
  panelsOverlap(pos1, dim1, pos2, dim2) {
    return !(pos1.x + dim1.width <= pos2.x || 
             pos2.x + dim2.width <= pos1.x || 
             pos1.y + dim1.height <= pos2.y || 
             pos2.y + dim2.height <= pos1.y);
  }

  /**
   * Adjust panel position to avoid overlap
   */
  adjustPanelPosition(action, existingActions) {
    const position = action.payload.position;
    const dimensions = action.payload.dimensions;
    const spacing = 2; // 2 feet minimum spacing

    // Try different positions
    const positions = [
      { x: position.x + dimensions.width + spacing, y: position.y },
      { x: position.x, y: position.y + dimensions.height + spacing },
      { x: position.x + dimensions.width + spacing, y: position.y + dimensions.height + spacing }
    ];

    for (const newPos of positions) {
      let hasOverlap = false;
      
      for (const existingAction of existingActions) {
        if (existingAction.type !== 'CREATE_PANEL') continue;
        
        const existingPos = existingAction.payload.position;
        const existingDims = existingAction.payload.dimensions;
        
        if (this.panelsOverlap(newPos, dimensions, existingPos, existingDims)) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        return {
          ...action,
          payload: {
            ...action.payload,
            position: newPos
          }
        };
      }
    }

    return null; // Could not find non-overlapping position
  }

  /**
   * Generate summary of actions and analysis
   */
  generateActionSummary(actions, analysis) {
    const summary = {
      totalActions: actions.length,
      actionTypes: {},
      estimatedPanels: 0,
      estimatedArea: 0,
      confidence: analysis.confidence,
      documentTypes: analysis.documentTypes,
      materialUsed: analysis.materialRequirements.primaryMaterial?.type || 'Unknown',
      siteDimensions: analysis.siteConstraints.siteDimensions
    };

    actions.forEach(action => {
      // Count action types
      summary.actionTypes[action.type] = (summary.actionTypes[action.type] || 0) + 1;

      // Calculate panel statistics for CREATE_PANEL actions
      if (action.type === 'CREATE_PANEL') {
        summary.estimatedPanels++;
        if (action.payload.dimensions) {
          const area = action.payload.dimensions.width * action.payload.dimensions.height;
          summary.estimatedArea += area;
        }
      }
    });

    return summary;
  }

  /**
   * Generate a response indicating insufficient information
   */
  generateInsufficientInformationResponse(message) {
    return {
      success: false,
      status: 'insufficient_information',
      guidance: {
        title: 'Insufficient Information',
        message: message || 'The AI cannot generate accurate panel layouts because critical information is missing. Please provide the required documents and information.',
        requiredDocuments: [],
        recommendedActions: ['Check document format', 'Ensure documents contain panel information', 'Try uploading different documents']
      },
      missingParameters: {},
      analysis: null,
      actions: [],
      summary: {
        totalActions: 0,
        actionTypes: {},
        estimatedPanels: 0,
        estimatedArea: 0,
        confidence: 0,
        documentTypes: [],
        materialUsed: 'Unknown',
        siteDimensions: null
      },
      warnings: []
    };
  }
}

module.exports = new EnhancedAILayoutGenerator(); 