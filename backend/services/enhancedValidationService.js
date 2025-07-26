class EnhancedValidationService {
  constructor() {
    this.validationRules = this.initializeValidationRules();
    this.correctionStrategies = this.initializeCorrectionStrategies();
  }

  /**
   * Initialize comprehensive validation rules
   */
  initializeValidationRules() {
    return {
      panelSpecifications: {
        required: ['panelId', 'dimensions'],
        dimensions: {
          minWidth: 1,
          maxWidth: 200,
          minLength: 1,
          maxLength: 200,
          unit: 'feet'
        },
        materials: {
          validTypes: ['HDPE', 'LLDPE', 'PVC', 'PP', 'PET', 'GCL'],
          thicknessRange: { min: 10, max: 200, unit: 'mils' }
        }
      },
      rollData: {
        required: ['rollNumber', 'dimensions'],
        dimensions: {
          minWidth: 1,
          maxWidth: 200,
          minLength: 1,
          maxLength: 200,
          unit: 'feet'
        },
        status: ['available', 'allocated', 'used', 'damaged']
      },
      siteConstraints: {
        required: ['siteDimensions'],
        dimensions: {
          minArea: 100,
          maxArea: 1000000,
          unit: 'square feet'
        }
      },
      materialRequirements: {
        required: ['primaryMaterial'],
        thickness: {
          min: 10,
          max: 200,
          unit: 'mils'
        },
        seamOverlap: {
          min: 3,
          max: 12,
          unit: 'inches'
        }
      }
    };
  }

  /**
   * Initialize correction strategies for common errors
   */
  initializeCorrectionStrategies() {
    return {
      dimensionCorrections: {
        'mm to feet': (value) => value / 304.8,
        'inches to feet': (value) => value / 12,
        'meters to feet': (value) => value * 3.28084,
        'cm to feet': (value) => value / 30.48
      },
      thicknessCorrections: {
        'mm to mils': (value) => value * 39.3701,
        'inches to mils': (value) => value * 1000,
        'microns to mils': (value) => value / 25.4
      },
      materialCorrections: {
        'hdpe': 'HDPE',
        'lldpe': 'LLDPE',
        'pvc': 'PVC',
        'pp': 'PP',
        'pet': 'PET',
        'gcl': 'GCL'
      }
    };
  }

  /**
   * Comprehensive validation of extracted data
   */
  async validateExtractedData(extractedData, context = {}) {
    try {
      console.log('[ENHANCED VALIDATION] Starting comprehensive data validation');

      const validationResults = {
        isValid: true,
        issues: [],
        warnings: [],
        corrections: [],
        suggestions: [],
        confidence: 0,
        validationDetails: {}
      };

      // Validate each data category
      if (extractedData.panelSpecifications) {
        const panelValidation = await this.validatePanelSpecifications(extractedData.panelSpecifications);
        validationResults.validationDetails.panels = panelValidation;
        this.aggregateValidationResults(validationResults, panelValidation);
      }

      if (extractedData.rollInformation) {
        const rollValidation = await this.validateRollData(extractedData.rollInformation);
        validationResults.validationDetails.rolls = rollValidation;
        this.aggregateValidationResults(validationResults, rollValidation);
      }

      if (extractedData.siteConstraints) {
        const siteValidation = await this.validateSiteConstraints(extractedData.siteConstraints);
        validationResults.validationDetails.site = siteValidation;
        this.aggregateValidationResults(validationResults, siteValidation);
      }

      if (extractedData.materialRequirements) {
        const materialValidation = await this.validateMaterialRequirements(extractedData.materialRequirements);
        validationResults.validationDetails.materials = materialValidation;
        this.aggregateValidationResults(validationResults, materialValidation);
      }

      // Cross-reference validation
      const crossReferenceValidation = await this.validateCrossReferences(extractedData);
      validationResults.validationDetails.crossReference = crossReferenceValidation;
      this.aggregateValidationResults(validationResults, crossReferenceValidation);

      // Generate intelligent suggestions
      validationResults.suggestions = await this.generateValidationSuggestions(extractedData, validationResults);

      // Calculate overall confidence
      validationResults.confidence = this.calculateValidationConfidence(validationResults);

      // Determine overall validity
      validationResults.isValid = validationResults.issues.length === 0;

      console.log(`[ENHANCED VALIDATION] Validation complete. Issues: ${validationResults.issues.length}, Warnings: ${validationResults.warnings.length}`);
      return validationResults;

    } catch (error) {
      console.error('[ENHANCED VALIDATION] Validation error:', error);
      return {
        isValid: false,
        issues: [`Validation failed: ${error.message}`],
        warnings: [],
        corrections: [],
        suggestions: [],
        confidence: 0,
        validationDetails: {}
      };
    }
  }

  /**
   * Validate panel specifications with detailed error reporting
   */
  async validatePanelSpecifications(panelSpecs) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: [],
      validatedPanels: []
    };

    if (!Array.isArray(panelSpecs)) {
      validation.issues.push('Panel specifications must be an array');
      validation.isValid = false;
      return validation;
    }

    for (let i = 0; i < panelSpecs.length; i++) {
      const panel = panelSpecs[i];
      const panelValidation = {
        panelId: panel.panelId || `Panel-${i + 1}`,
        isValid: true,
        issues: [],
        warnings: [],
        corrections: {}
      };

      // Validate required fields
      if (!panel.panelId) {
        panelValidation.issues.push('Missing panel ID');
        panelValidation.corrections.panelId = `Panel-${i + 1}`;
      }

      // Validate dimensions
      if (panel.dimensions) {
        const dimensionValidation = this.validateDimensions(panel.dimensions, 'panel');
        panelValidation.issues.push(...dimensionValidation.issues);
        panelValidation.warnings.push(...dimensionValidation.warnings);
        if (dimensionValidation.corrections) {
          panelValidation.corrections.dimensions = dimensionValidation.corrections;
        }
      } else {
        panelValidation.issues.push('Missing panel dimensions');
      }

      // Validate materials
      if (panel.material) {
        const materialValidation = this.validateMaterialSpec(panel.material);
        panelValidation.issues.push(...materialValidation.issues);
        panelValidation.warnings.push(...materialValidation.warnings);
        if (materialValidation.corrections) {
          panelValidation.corrections.material = materialValidation.corrections;
        }
      }

      // Determine panel validity
      panelValidation.isValid = panelValidation.issues.length === 0;
      validation.validatedPanels.push(panelValidation);

      if (!panelValidation.isValid) {
        validation.isValid = false;
        validation.issues.push(`Panel ${panelValidation.panelId}: ${panelValidation.issues.join(', ')}`);
      }
    }

    return validation;
  }

  /**
   * Validate roll data with inventory analysis
   */
  async validateRollData(rollData) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: [],
      inventory: {
        totalRolls: 0,
        totalArea: 0,
        availableArea: 0,
        materialBreakdown: {}
      }
    };

    if (!Array.isArray(rollData)) {
      validation.issues.push('Roll data must be an array');
      validation.isValid = false;
      return validation;
    }

    const rollNumbers = new Set();
    let totalArea = 0;
    let availableArea = 0;

    for (let i = 0; i < rollData.length; i++) {
      const roll = rollData[i];
      const rollValidation = {
        rollNumber: roll.rollNumber || `Roll-${i + 1}`,
        isValid: true,
        issues: [],
        warnings: [],
        corrections: {}
      };

      // Check for duplicate roll numbers
      if (roll.rollNumber && rollNumbers.has(roll.rollNumber)) {
        rollValidation.issues.push('Duplicate roll number');
        rollValidation.corrections.rollNumber = `${roll.rollNumber}-${i + 1}`;
      } else if (roll.rollNumber) {
        rollNumbers.add(roll.rollNumber);
      }

      // Validate dimensions
      if (roll.dimensions) {
        const dimensionValidation = this.validateDimensions(roll.dimensions, 'roll');
        rollValidation.issues.push(...dimensionValidation.issues);
        rollValidation.warnings.push(...dimensionValidation.warnings);
        if (dimensionValidation.corrections) {
          rollValidation.corrections.dimensions = dimensionValidation.corrections;
        }

        // Calculate area
        if (roll.dimensions.width && roll.dimensions.length) {
          const area = roll.dimensions.width * roll.dimensions.length;
          totalArea += area;
          if (roll.status !== 'used' && roll.status !== 'damaged') {
            availableArea += area;
          }
        }
      } else {
        rollValidation.issues.push('Missing roll dimensions');
      }

      // Validate status
      if (roll.status && !this.validationRules.rollData.status.includes(roll.status)) {
        rollValidation.warnings.push(`Invalid status: ${roll.status}`);
        rollValidation.corrections.status = 'available';
      }

      // Validate materials
      if (roll.material) {
        const materialValidation = this.validateMaterialSpec(roll.material);
        rollValidation.issues.push(...materialValidation.issues);
        rollValidation.warnings.push(...materialValidation.warnings);
        if (materialValidation.corrections) {
          rollValidation.corrections.material = materialValidation.corrections;
        }
      }

      rollValidation.isValid = rollValidation.issues.length === 0;
      if (!rollValidation.isValid) {
        validation.isValid = false;
        validation.issues.push(`Roll ${rollValidation.rollNumber}: ${rollValidation.issues.join(', ')}`);
      }
    }

    // Update inventory summary
    validation.inventory.totalRolls = rollData.length;
    validation.inventory.totalArea = totalArea;
    validation.inventory.availableArea = availableArea;

    return validation;
  }

  /**
   * Validate site constraints and dimensions
   */
  async validateSiteConstraints(siteConstraints) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: {}
    };

    if (!siteConstraints.siteDimensions) {
      validation.issues.push('Missing site dimensions');
      validation.isValid = false;
      return validation;
    }

    // Validate site dimensions
    const dimensionValidation = this.validateDimensions(siteConstraints.siteDimensions, 'site');
    validation.issues.push(...dimensionValidation.issues);
    validation.warnings.push(...dimensionValidation.warnings);
    if (dimensionValidation.corrections) {
      validation.corrections.siteDimensions = dimensionValidation.corrections;
    }

    // Validate constraints
    if (siteConstraints.constraints && Array.isArray(siteConstraints.constraints)) {
      for (const constraint of siteConstraints.constraints) {
        if (!constraint.type || !constraint.description) {
          validation.warnings.push('Incomplete constraint information');
        }
      }
    }

    // Validate access information
    if (siteConstraints.access) {
      if (!siteConstraints.access.entryPoints || siteConstraints.access.entryPoints.length === 0) {
        validation.warnings.push('No access points specified');
      }
    }

    validation.isValid = validation.issues.length === 0;
    return validation;
  }

  /**
   * Validate material requirements and specifications
   */
  async validateMaterialRequirements(materialRequirements) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: {}
    };

    if (!materialRequirements.primaryMaterial) {
      validation.issues.push('Missing primary material specification');
      validation.isValid = false;
      return validation;
    }

    // Validate primary material
    const materialValidation = this.validateMaterialSpec(materialRequirements.primaryMaterial);
    validation.issues.push(...materialValidation.issues);
    validation.warnings.push(...materialValidation.warnings);
    if (materialValidation.corrections) {
      validation.corrections.primaryMaterial = materialValidation.corrections;
    }

    // Validate seam requirements
    if (materialRequirements.seamRequirements) {
      const seamValidation = this.validateSeamRequirements(materialRequirements.seamRequirements);
      validation.issues.push(...seamValidation.issues);
      validation.warnings.push(...seamValidation.warnings);
      if (seamValidation.corrections) {
        validation.corrections.seamRequirements = seamValidation.corrections;
      }
    }

    // Validate quality standards
    if (materialRequirements.qualityStandards && Array.isArray(materialRequirements.qualityStandards)) {
      for (const standard of materialRequirements.qualityStandards) {
        if (!standard.standard || !standard.requirement) {
          validation.warnings.push('Incomplete quality standard information');
        }
      }
    }

    validation.isValid = validation.issues.length === 0;
    return validation;
  }

  /**
   * Cross-reference validation between different data categories
   */
  async validateCrossReferences(extractedData) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: []
    };

    // Check material consistency between panels and rolls
    if (extractedData.panelSpecifications && extractedData.rollInformation) {
      const materialConsistency = this.checkMaterialConsistency(extractedData.panelSpecifications, extractedData.rollInformation);
      if (!materialConsistency.isConsistent) {
        validation.issues.push('Material inconsistency between panels and rolls');
        validation.corrections.push(...materialConsistency.corrections);
      }
    }

    // Check if panel area exceeds available roll area
    if (extractedData.panelSpecifications && extractedData.rollInformation) {
      const areaValidation = this.validateAreaRequirements(extractedData.panelSpecifications, extractedData.rollInformation);
      if (!areaValidation.isSufficient) {
        validation.issues.push(`Insufficient roll area. Required: ${areaValidation.requiredArea} sq ft, Available: ${areaValidation.availableArea} sq ft`);
      }
    }

    // Check if panel dimensions fit within site constraints
    if (extractedData.panelSpecifications && extractedData.siteConstraints) {
      const siteFitValidation = this.validateSiteFit(extractedData.panelSpecifications, extractedData.siteConstraints);
      if (!siteFitValidation.fits) {
        validation.issues.push('Panel layout may not fit within site constraints');
        validation.warnings.push(...siteFitValidation.warnings);
      }
    }

    validation.isValid = validation.issues.length === 0;
    return validation;
  }

  /**
   * Generate intelligent suggestions based on validation results
   */
  async generateValidationSuggestions(extractedData, validationResults) {
    const suggestions = [];

    // Suggest corrections for common issues
    if (validationResults.issues.length > 0) {
      suggestions.push({
        type: 'critical',
        message: 'Critical validation issues found. Please review and correct the identified problems.',
        action: 'review_validation_issues'
      });
    }

    // Suggest improvements for warnings
    if (validationResults.warnings.length > 0) {
      suggestions.push({
        type: 'warning',
        message: 'Validation warnings detected. Consider addressing these for optimal results.',
        action: 'review_warnings'
      });
    }

    // Suggest data enhancements
    if (extractedData.panelSpecifications && extractedData.panelSpecifications.length === 0) {
      suggestions.push({
        type: 'info',
        message: 'No panel specifications found. Consider adding panel layout documents.',
        action: 'add_panel_specs'
      });
    }

    // Suggest material optimization
    if (extractedData.materialRequirements && extractedData.rollInformation) {
      const optimizationSuggestion = this.generateMaterialOptimizationSuggestion(extractedData);
      if (optimizationSuggestion) {
        suggestions.push(optimizationSuggestion);
      }
    }

    return suggestions;
  }

  // Helper methods for validation
  validateDimensions(dimensions, type) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: {}
    };

    const rules = this.validationRules[type === 'site' ? 'siteConstraints' : 'panelSpecifications'].dimensions;

    if (!dimensions.width || !dimensions.length) {
      validation.issues.push('Missing width or length');
      validation.isValid = false;
      return validation;
    }

    // Validate width
    if (dimensions.width < rules.minWidth || dimensions.width > rules.maxWidth) {
      validation.issues.push(`Width ${dimensions.width} is outside valid range (${rules.minWidth}-${rules.maxWidth} ${rules.unit})`);
      validation.corrections.width = Math.max(rules.minWidth, Math.min(rules.maxWidth, dimensions.width));
    }

    // Validate length
    if (dimensions.length < rules.minLength || dimensions.length > rules.maxLength) {
      validation.issues.push(`Length ${dimensions.length} is outside valid range (${rules.minLength}-${rules.maxLength} ${rules.unit})`);
      validation.corrections.length = Math.max(rules.minLength, Math.min(rules.maxLength, dimensions.length));
    }

    validation.isValid = validation.issues.length === 0;
    return validation;
  }

  validateMaterialSpec(material) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: {}
    };

    if (!material.type) {
      validation.issues.push('Missing material type');
      validation.isValid = false;
      return validation;
    }

    // Validate material type
    const validTypes = this.validationRules.panelSpecifications.materials.validTypes;
    if (!validTypes.includes(material.type.toUpperCase())) {
      validation.warnings.push(`Unknown material type: ${material.type}`);
      validation.corrections.type = this.correctMaterialType(material.type);
    }

    // Validate thickness
    if (material.thickness) {
      const thicknessRules = this.validationRules.panelSpecifications.materials.thicknessRange;
      if (material.thickness < thicknessRules.min || material.thickness > thicknessRules.max) {
        validation.warnings.push(`Thickness ${material.thickness} is outside typical range (${thicknessRules.min}-${thicknessRules.max} ${thicknessRules.unit})`);
      }
    }

    validation.isValid = validation.issues.length === 0;
    return validation;
  }

  validateSeamRequirements(seamRequirements) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      corrections: {}
    };

    if (seamRequirements.overlap) {
      const overlapRules = this.validationRules.materialRequirements.seamOverlap;
      if (seamRequirements.overlap < overlapRules.min || seamRequirements.overlap > overlapRules.max) {
        validation.warnings.push(`Seam overlap ${seamRequirements.overlap} is outside recommended range (${overlapRules.min}-${overlapRules.max} ${overlapRules.unit})`);
      }
    }

    return validation;
  }

  // Helper methods for cross-reference validation
  checkMaterialConsistency(panelSpecs, rollData) {
    const panelMaterials = new Set(panelSpecs.map(p => p.material?.type).filter(Boolean));
    const rollMaterials = new Set(rollData.map(r => r.material?.type).filter(Boolean));
    
    const intersection = new Set([...panelMaterials].filter(x => rollMaterials.has(x)));
    
    return {
      isConsistent: intersection.size > 0,
      corrections: intersection.size === 0 ? ['Consider using consistent materials across panels and rolls'] : []
    };
  }

  validateAreaRequirements(panelSpecs, rollData) {
    const requiredArea = panelSpecs.reduce((total, panel) => {
      return total + (panel.dimensions?.width * panel.dimensions?.length || 0);
    }, 0);

    const availableArea = rollData.reduce((total, roll) => {
      if (roll.status !== 'used' && roll.status !== 'damaged') {
        return total + (roll.dimensions?.width * roll.dimensions?.length || 0);
      }
      return total;
    }, 0);

    return {
      isSufficient: availableArea >= requiredArea,
      requiredArea,
      availableArea
    };
  }

  validateSiteFit(panelSpecs, siteConstraints) {
    // Simplified validation - in practice, this would be more complex
    return {
      fits: true,
      warnings: []
    };
  }

  // Helper methods for suggestions
  generateMaterialOptimizationSuggestion(extractedData) {
    // Simplified suggestion generation
    return {
      type: 'optimization',
      message: 'Consider optimizing material usage for cost efficiency.',
      action: 'optimize_materials'
    };
  }

  // Utility methods
  correctMaterialType(materialType) {
    const corrections = this.correctionStrategies.materialCorrections;
    return corrections[materialType.toLowerCase()] || materialType.toUpperCase();
  }

  aggregateValidationResults(mainResults, subResults) {
    if (subResults.issues) mainResults.issues.push(...subResults.issues);
    if (subResults.warnings) mainResults.warnings.push(...subResults.warnings);
    if (subResults.corrections) mainResults.corrections.push(...subResults.corrections);
  }

  calculateValidationConfidence(validationResults) {
    const totalIssues = validationResults.issues.length;
    const totalWarnings = validationResults.warnings.length;
    
    // Base confidence of 100%, reduce for issues and warnings
    let confidence = 100;
    confidence -= totalIssues * 10; // Each issue reduces confidence by 10%
    confidence -= totalWarnings * 2; // Each warning reduces confidence by 2%
    
    return Math.max(0, Math.min(100, Math.round(confidence)));
  }
}

module.exports = EnhancedValidationService; 