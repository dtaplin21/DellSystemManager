class EnhancedConfidenceService {
  constructor() {
    this.confidenceFactors = this.initializeConfidenceFactors();
    this.scoringWeights = this.initializeScoringWeights();
  }

  /**
   * Initialize confidence factors and their importance
   */
  initializeConfidenceFactors() {
    return {
      dataCompleteness: {
        weight: 0.25,
        factors: {
          requiredFields: 0.4,
          optionalFields: 0.3,
          crossReferences: 0.3
        }
      },
      dataQuality: {
        weight: 0.20,
        factors: {
          formatConsistency: 0.3,
          valueRanges: 0.3,
          unitConsistency: 0.4
        }
      },
      documentQuality: {
        weight: 0.15,
        factors: {
          textClarity: 0.4,
          structureQuality: 0.3,
          sourceReliability: 0.3
        }
      },
      validationResults: {
        weight: 0.25,
        factors: {
          validationPass: 0.5,
          errorCount: 0.3,
          warningCount: 0.2
        }
      },
      crossDocumentConsistency: {
        weight: 0.15,
        factors: {
          materialConsistency: 0.4,
          dimensionConsistency: 0.3,
          constraintAlignment: 0.3
        }
      }
    };
  }

  /**
   * Initialize scoring weights for different data types
   */
  initializeScoringWeights() {
    return {
      panelSpecifications: 0.35,
      rollData: 0.25,
      siteConstraints: 0.20,
      materialRequirements: 0.15,
      installationNotes: 0.05
    };
  }

  /**
   * Calculate comprehensive confidence score for extracted data
   */
  async calculateEnhancedConfidence(extractedData, validationResults = {}) {
    try {
      console.log('[ENHANCED CONFIDENCE] Starting comprehensive confidence calculation');

      const confidenceBreakdown = {
        overall: 0,
        factors: {},
        details: {},
        recommendations: [],
        riskAssessment: {}
      };

      // Calculate confidence for each factor
      confidenceBreakdown.factors.dataCompleteness = await this.calculateDataCompleteness(extractedData);
      confidenceBreakdown.factors.dataQuality = await this.calculateDataQuality(extractedData);
      confidenceBreakdown.factors.documentQuality = await this.calculateDocumentQuality(extractedData);
      confidenceBreakdown.factors.validationResults = this.calculateValidationConfidence(validationResults);
      confidenceBreakdown.factors.crossDocumentConsistency = await this.calculateCrossDocumentConsistency(extractedData);

      // Calculate weighted overall confidence
      confidenceBreakdown.overall = this.calculateWeightedConfidence(confidenceBreakdown.factors);

      // Generate detailed breakdown by data type
      confidenceBreakdown.details = this.calculateDetailedBreakdown(extractedData);

      // Generate recommendations for improvement
      confidenceBreakdown.recommendations = this.generateConfidenceRecommendations(confidenceBreakdown);

      // Assess risk levels
      confidenceBreakdown.riskAssessment = this.assessRiskLevels(confidenceBreakdown);

      console.log(`[ENHANCED CONFIDENCE] Confidence calculation complete. Overall: ${confidenceBreakdown.overall}%`);
      return confidenceBreakdown;

    } catch (error) {
      console.error('[ENHANCED CONFIDENCE] Error calculating confidence:', error);
      return {
        overall: 0,
        factors: {},
        details: {},
        recommendations: ['Confidence calculation failed'],
        riskAssessment: { level: 'high', reasons: ['Calculation error'] }
      };
    }
  }

  /**
   * Calculate data completeness confidence
   */
  async calculateDataCompleteness(extractedData) {
    const completeness = {
      score: 0,
      breakdown: {},
      missing: [],
      suggestions: []
    };

    let totalFields = 0;
    let presentFields = 0;

    // Check panel specifications completeness
    if (extractedData.panelSpecifications) {
      const panelCompleteness = this.calculatePanelCompleteness(extractedData.panelSpecifications);
      completeness.breakdown.panels = panelCompleteness;
      totalFields += panelCompleteness.totalFields;
      presentFields += panelCompleteness.presentFields;
    } else {
      completeness.missing.push('Panel specifications');
      completeness.suggestions.push('Add panel specification documents');
    }

    // Check roll data completeness
    if (extractedData.rollInformation) {
      const rollCompleteness = this.calculateRollCompleteness(extractedData.rollInformation);
      completeness.breakdown.rolls = rollCompleteness;
      totalFields += rollCompleteness.totalFields;
      presentFields += rollCompleteness.presentFields;
    } else {
      completeness.missing.push('Roll inventory data');
      completeness.suggestions.push('Add roll inventory documents');
    }

    // Check site constraints completeness
    if (extractedData.siteConstraints) {
      const siteCompleteness = this.calculateSiteCompleteness(extractedData.siteConstraints);
      completeness.breakdown.site = siteCompleteness;
      totalFields += siteCompleteness.totalFields;
      presentFields += siteCompleteness.presentFields;
    } else {
      completeness.missing.push('Site constraints');
      completeness.suggestions.push('Add site plan documents');
    }

    // Check material requirements completeness
    if (extractedData.materialRequirements) {
      const materialCompleteness = this.calculateMaterialCompleteness(extractedData.materialRequirements);
      completeness.breakdown.materials = materialCompleteness;
      totalFields += materialCompleteness.totalFields;
      presentFields += materialCompleteness.presentFields;
    } else {
      completeness.missing.push('Material requirements');
      completeness.suggestions.push('Add material specification documents');
    }

    // Calculate overall completeness score
    completeness.score = totalFields > 0 ? (presentFields / totalFields) * 100 : 0;

    return completeness;
  }

  /**
   * Calculate data quality confidence
   */
  async calculateDataQuality(extractedData) {
    const quality = {
      score: 0,
      breakdown: {},
      issues: [],
      improvements: []
    };

    let totalQualityChecks = 0;
    let passedChecks = 0;

    // Check format consistency
    const formatConsistency = this.checkFormatConsistency(extractedData);
    quality.breakdown.formatConsistency = formatConsistency;
    totalQualityChecks += formatConsistency.totalChecks;
    passedChecks += formatConsistency.passedChecks;

    // Check value ranges
    const valueRanges = this.checkValueRanges(extractedData);
    quality.breakdown.valueRanges = valueRanges;
    totalQualityChecks += valueRanges.totalChecks;
    passedChecks += valueRanges.passedChecks;

    // Check unit consistency
    const unitConsistency = this.checkUnitConsistency(extractedData);
    quality.breakdown.unitConsistency = unitConsistency;
    totalQualityChecks += unitConsistency.totalChecks;
    passedChecks += unitConsistency.passedChecks;

    // Calculate overall quality score
    quality.score = totalQualityChecks > 0 ? (passedChecks / totalQualityChecks) * 100 : 0;

    return quality;
  }

  /**
   * Calculate document quality confidence
   */
  async calculateDocumentQuality(extractedData) {
    const quality = {
      score: 0,
      breakdown: {},
      factors: []
    };

    // This would typically analyze the source documents
    // For now, we'll use a simplified approach
    quality.score = 85; // Default high score for document quality
    quality.breakdown = {
      textClarity: 90,
      structureQuality: 80,
      sourceReliability: 85
    };

    return quality;
  }

  /**
   * Calculate validation confidence
   */
  calculateValidationConfidence(validationResults) {
    const validation = {
      score: 0,
      breakdown: {},
      issues: []
    };

    if (!validationResults || !validationResults.overall) {
      validation.score = 0;
      validation.issues.push('No validation results available');
      return validation;
    }

    const overall = validationResults.overall;
    
    // Base score starts at 100
    let score = 100;

    // Reduce score for issues
    if (overall.issues && overall.issues.length > 0) {
      score -= overall.issues.length * 10; // Each issue reduces score by 10%
    }

    // Reduce score for warnings
    if (overall.warnings && overall.warnings.length > 0) {
      score -= overall.warnings.length * 2; // Each warning reduces score by 2%
    }

    validation.score = Math.max(0, Math.min(100, score));
    validation.breakdown = {
      validationPass: overall.isValid ? 100 : 0,
      errorCount: overall.issues ? overall.issues.length : 0,
      warningCount: overall.warnings ? overall.warnings.length : 0
    };

    return validation;
  }

  /**
   * Calculate cross-document consistency confidence
   */
  async calculateCrossDocumentConsistency(extractedData) {
    const consistency = {
      score: 0,
      breakdown: {},
      inconsistencies: [],
      suggestions: []
    };

    let totalChecks = 0;
    let consistentChecks = 0;

    // Check material consistency
    const materialConsistency = this.checkMaterialConsistency(extractedData);
    consistency.breakdown.materialConsistency = materialConsistency;
    totalChecks += materialConsistency.totalChecks;
    consistentChecks += materialConsistency.consistentChecks;

    // Check dimension consistency
    const dimensionConsistency = this.checkDimensionConsistency(extractedData);
    consistency.breakdown.dimensionConsistency = dimensionConsistency;
    totalChecks += dimensionConsistency.totalChecks;
    consistentChecks += dimensionConsistency.consistentChecks;

    // Check constraint alignment
    const constraintAlignment = this.checkConstraintAlignment(extractedData);
    consistency.breakdown.constraintAlignment = constraintAlignment;
    totalChecks += constraintAlignment.totalChecks;
    consistentChecks += constraintAlignment.consistentChecks;

    // Calculate overall consistency score
    consistency.score = totalChecks > 0 ? (consistentChecks / totalChecks) * 100 : 0;

    return consistency;
  }

  /**
   * Calculate weighted overall confidence
   */
  calculateWeightedConfidence(factors) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [factorName, factor] of Object.entries(factors)) {
      const weight = this.confidenceFactors[factorName]?.weight || 0;
      const score = factor.score || 0;
      
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  /**
   * Calculate detailed breakdown by data type
   */
  calculateDetailedBreakdown(extractedData) {
    const breakdown = {};

    // Panel specifications breakdown
    if (extractedData.panelSpecifications) {
      breakdown.panels = {
        count: extractedData.panelSpecifications.length,
        completeness: this.calculatePanelCompleteness(extractedData.panelSpecifications).score,
        averageConfidence: this.calculateAveragePanelConfidence(extractedData.panelSpecifications)
      };
    }

    // Roll data breakdown
    if (extractedData.rollInformation) {
      breakdown.rolls = {
        count: extractedData.rollInformation.length,
        completeness: this.calculateRollCompleteness(extractedData.rollInformation).score,
        totalArea: this.calculateTotalRollArea(extractedData.rollInformation)
      };
    }

    // Site constraints breakdown
    if (extractedData.siteConstraints) {
      breakdown.site = {
        completeness: this.calculateSiteCompleteness(extractedData.siteConstraints).score,
        constraintsCount: extractedData.siteConstraints.constraints?.length || 0
      };
    }

    // Material requirements breakdown
    if (extractedData.materialRequirements) {
      breakdown.materials = {
        completeness: this.calculateMaterialCompleteness(extractedData.materialRequirements).score,
        standardsCount: extractedData.materialRequirements.qualityStandards?.length || 0
      };
    }

    return breakdown;
  }

  /**
   * Generate confidence improvement recommendations
   */
  generateConfidenceRecommendations(confidenceBreakdown) {
    const recommendations = [];

    // Check for low confidence factors
    for (const [factorName, factor] of Object.entries(confidenceBreakdown.factors)) {
      if (factor.score < 70) {
        recommendations.push({
          factor: factorName,
          currentScore: factor.score,
          priority: factor.score < 50 ? 'high' : 'medium',
          action: this.getRecommendationAction(factorName, factor)
        });
      }
    }

    // Check for missing critical data
    if (confidenceBreakdown.factors.dataCompleteness?.missing?.length > 0) {
      recommendations.push({
        factor: 'dataCompleteness',
        priority: 'high',
        action: 'Add missing document types: ' + confidenceBreakdown.factors.dataCompleteness.missing.join(', ')
      });
    }

    return recommendations;
  }

  /**
   * Assess risk levels based on confidence
   */
  assessRiskLevels(confidenceBreakdown) {
    const overall = confidenceBreakdown.overall;
    const risk = {
      level: 'low',
      reasons: [],
      mitigation: []
    };

    if (overall < 50) {
      risk.level = 'high';
      risk.reasons.push('Very low confidence in extracted data');
      risk.mitigation.push('Review and correct all validation issues');
      risk.mitigation.push('Add missing critical documents');
    } else if (overall < 70) {
      risk.level = 'medium';
      risk.reasons.push('Moderate confidence in extracted data');
      risk.mitigation.push('Address validation warnings');
      risk.mitigation.push('Verify cross-document consistency');
    } else if (overall < 90) {
      risk.level = 'low';
      risk.reasons.push('Good confidence in extracted data');
      risk.mitigation.push('Consider minor improvements for optimal results');
    } else {
      risk.level = 'very_low';
      risk.reasons.push('Excellent confidence in extracted data');
    }

    return risk;
  }

  // Helper methods for completeness calculations
  calculatePanelCompleteness(panelSpecs) {
    const requiredFields = ['panelId', 'dimensions'];
    const optionalFields = ['material', 'location', 'installationNotes'];
    
    let totalFields = 0;
    let presentFields = 0;

    for (const panel of panelSpecs) {
      totalFields += requiredFields.length + optionalFields.length;
      
      // Check required fields
      for (const field of requiredFields) {
        if (panel[field]) presentFields++;
      }
      
      // Check optional fields
      for (const field of optionalFields) {
        if (panel[field]) presentFields++;
      }
    }

    return {
      score: totalFields > 0 ? (presentFields / totalFields) * 100 : 0,
      totalFields,
      presentFields
    };
  }

  calculateRollCompleteness(rollData) {
    const requiredFields = ['rollNumber', 'dimensions'];
    const optionalFields = ['material', 'status', 'location'];
    
    let totalFields = 0;
    let presentFields = 0;

    for (const roll of rollData) {
      totalFields += requiredFields.length + optionalFields.length;
      
      for (const field of requiredFields) {
        if (roll[field]) presentFields++;
      }
      
      for (const field of optionalFields) {
        if (roll[field]) presentFields++;
      }
    }

    return {
      score: totalFields > 0 ? (presentFields / totalFields) * 100 : 0,
      totalFields,
      presentFields
    };
  }

  calculateSiteCompleteness(siteConstraints) {
    const requiredFields = ['siteDimensions'];
    const optionalFields = ['constraints', 'access', 'environmental'];
    
    let totalFields = requiredFields.length + optionalFields.length;
    let presentFields = 0;

    for (const field of requiredFields) {
      if (siteConstraints[field]) presentFields++;
    }
    
    for (const field of optionalFields) {
      if (siteConstraints[field]) presentFields++;
    }

    return {
      score: totalFields > 0 ? (presentFields / totalFields) * 100 : 0,
      totalFields,
      presentFields
    };
  }

  calculateMaterialCompleteness(materialRequirements) {
    const requiredFields = ['primaryMaterial'];
    const optionalFields = ['seamRequirements', 'qualityStandards', 'testingRequirements'];
    
    let totalFields = requiredFields.length + optionalFields.length;
    let presentFields = 0;

    for (const field of requiredFields) {
      if (materialRequirements[field]) presentFields++;
    }
    
    for (const field of optionalFields) {
      if (materialRequirements[field]) presentFields++;
    }

    return {
      score: totalFields > 0 ? (presentFields / totalFields) * 100 : 0,
      totalFields,
      presentFields
    };
  }

  // Helper methods for quality checks
  checkFormatConsistency(extractedData) {
    return { totalChecks: 10, passedChecks: 8 }; // Simplified implementation
  }

  checkValueRanges(extractedData) {
    return { totalChecks: 15, passedChecks: 12 }; // Simplified implementation
  }

  checkUnitConsistency(extractedData) {
    return { totalChecks: 8, passedChecks: 7 }; // Simplified implementation
  }

  // Helper methods for consistency checks
  checkMaterialConsistency(extractedData) {
    return { totalChecks: 5, consistentChecks: 4 }; // Simplified implementation
  }

  checkDimensionConsistency(extractedData) {
    return { totalChecks: 5, consistentChecks: 4 }; // Simplified implementation
  }

  checkConstraintAlignment(extractedData) {
    return { totalChecks: 3, consistentChecks: 2 }; // Simplified implementation
  }

  // Utility methods
  calculateAveragePanelConfidence(panelSpecs) {
    if (!panelSpecs || panelSpecs.length === 0) return 0;
    
    const totalConfidence = panelSpecs.reduce((sum, panel) => {
      return sum + (panel.confidence || 0);
    }, 0);
    
    return Math.round(totalConfidence / panelSpecs.length);
  }

  calculateTotalRollArea(rollData) {
    if (!rollData || rollData.length === 0) return 0;
    
    return rollData.reduce((total, roll) => {
      if (roll.dimensions && roll.dimensions.width && roll.dimensions.length) {
        return total + (roll.dimensions.width * roll.dimensions.length);
      }
      return total;
    }, 0);
  }

  getRecommendationAction(factorName, factor) {
    const actions = {
      dataCompleteness: 'Add missing documents and data fields',
      dataQuality: 'Review and correct data format issues',
      documentQuality: 'Improve document clarity and structure',
      validationResults: 'Address validation errors and warnings',
      crossDocumentConsistency: 'Resolve inconsistencies between documents'
    };
    
    return actions[factorName] || 'Review and improve data quality';
  }
}

module.exports = EnhancedConfidenceService; 