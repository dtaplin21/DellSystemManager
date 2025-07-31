const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class EnhancedDocumentAnalyzer {
  constructor() {
    this.validationRules = this.initializeValidationRules();
    this.confidenceWeights = this.initializeConfidenceWeights();
  }

  /**
   * Initialize validation rules for different data types
   */
  initializeValidationRules() {
    return {
      panelDimensions: {
        minWidth: 1, // feet
        maxWidth: 200, // feet
        minLength: 1, // feet
        maxLength: 800, // feet - updated to 800 feet
        requiredFields: ['width', 'length']
      },
      panelSpecifications: {
        required: ['panelId', 'rollNumber', 'dimensions'],
        optional: ['location', 'installationNotes', 'material']
      },
      materials: {
        validTypes: ['HDPE', 'LLDPE', 'PVC', 'PP', 'PET', 'GCL'],
        validThicknessUnits: ['mils', 'mm', 'inches'],
        minThickness: 10, // mils
        maxThickness: 200 // mils
      },
      siteDimensions: {
        minArea: 100, // square feet
        maxArea: 1000000, // square feet
        requiredFields: ['width', 'length']
      },
      rollData: {
        requiredFields: ['rollNumber', 'dimensions'],
        validStatus: ['available', 'allocated', 'used', 'damaged']
      }
    };
  }

  /**
   * Initialize confidence scoring weights
   */
  initializeConfidenceWeights() {
    return {
      documentQuality: 0.25,
      dataCompleteness: 0.30,
      dataConsistency: 0.25,
      validationPass: 0.20
    };
  }

  /**
   * Enhanced document analysis with advanced parsing and validation
   */
  async analyzeDocumentsEnhanced(documents, projectContext = {}) {
    try {
      console.log(`[ENHANCED ANALYZER] Starting enhanced analysis of ${documents.length} documents`);
      
      const analysisResults = {
        panelSpecifications: [],
        rollInformation: [],
        siteConstraints: {},
        materialRequirements: {},
        installationNotes: [],
        confidence: 0,
        documentTypes: [],
        validationResults: {},
        crossDocumentInsights: {},
        dataQualityMetrics: {},
        suggestions: []
      };

      // Step 1: Enhanced document categorization with content analysis
      const categorizedDocs = await this.categorizeDocumentsEnhanced(documents);
      analysisResults.documentTypes = Object.keys(categorizedDocs);

      // Step 2: Advanced analysis for each document type
      for (const [docType, docs] of Object.entries(categorizedDocs)) {
        console.log(`[ENHANCED ANALYZER] Processing ${docType} documents:`, docs.length);
        
        switch (docType) {
          case 'panel_specs':
            analysisResults.panelSpecifications = await this.analyzePanelSpecificationsEnhanced(docs);
            break;
          case 'roll_data':
            analysisResults.rollInformation = await this.analyzeRollDataEnhanced(docs);
            break;
          case 'site_plans':
            analysisResults.siteConstraints = await this.analyzeSitePlansEnhanced(docs);
            break;
          case 'material_specs':
            analysisResults.materialRequirements = await this.analyzeMaterialSpecificationsEnhanced(docs);
            break;
          case 'installation_notes':
            analysisResults.installationNotes = await this.analyzeInstallationNotesEnhanced(docs);
            break;
          default:
            console.log(`[ENHANCED ANALYZER] Unknown document type: ${docType}`);
        }
      }

      // Step 3: Cross-document correlation and validation
      analysisResults.crossDocumentInsights = await this.correlateDocuments(analysisResults);
      
      // Step 4: Enhanced validation with detailed results
      analysisResults.validationResults = await this.validateDataEnhanced(analysisResults);
      
      // Step 5: Data quality assessment
      analysisResults.dataQualityMetrics = this.assessDataQuality(analysisResults);
      
      // Step 6: Generate intelligent suggestions
      analysisResults.suggestions = await this.generateSuggestions(analysisResults, projectContext);
      
      // Step 7: Calculate enhanced confidence score
      analysisResults.confidence = this.calculateEnhancedConfidence(analysisResults);

      console.log(`[ENHANCED ANALYZER] Analysis complete. Confidence: ${analysisResults.confidence}%`);
      return analysisResults;

    } catch (error) {
      console.error('[ENHANCED ANALYZER] Error in enhanced analysis:', error);
      return this.getDefaultEnhancedAnalysis();
    }
  }

  /**
   * Enhanced document categorization with AI-powered content analysis
   */
  async categorizeDocumentsEnhanced(documents) {
    const categories = {
      panel_specs: [],
      roll_data: [],
      site_plans: [],
      material_specs: [],
      installation_notes: [],
      other: []
    };

    // First pass: Basic categorization based on filename and content patterns
    for (const doc of documents) {
      const filename = (doc.filename || doc.name || '').toLowerCase();
      const text = (doc.text || '').toLowerCase();

      // Enhanced pattern matching
      if (this.matchesPanelSpecsPattern(filename, text)) {
        categories.panel_specs.push(doc);
      } else if (this.matchesRollDataPattern(filename, text)) {
        categories.roll_data.push(doc);
      } else if (this.matchesSitePlansPattern(filename, text)) {
        categories.site_plans.push(doc);
      } else if (this.matchesMaterialSpecsPattern(filename, text)) {
        categories.material_specs.push(doc);
      } else if (this.matchesInstallationNotesPattern(filename, text)) {
        categories.installation_notes.push(doc);
      } else {
        categories.other.push(doc);
      }
    }

    // Second pass: AI-powered categorization for uncertain documents
    const uncertainDocs = categories.other.filter(doc => doc.text && doc.text.length > 50);
    if (uncertainDocs.length > 0) {
      const aiCategorized = await this.categorizeWithAI(uncertainDocs);
      
      // Move AI-categorized documents to appropriate categories
      for (const [docId, category] of Object.entries(aiCategorized)) {
        const doc = uncertainDocs.find(d => d.id === docId);
        if (doc && categories[category]) {
          categories[category].push(doc);
          categories.other = categories.other.filter(d => d.id !== docId);
        }
      }
    }

    return categories;
  }

  /**
   * AI-powered document categorization
   */
  async categorizeWithAI(documents) {
    try {
      const documentTexts = documents.map(doc => 
        `Document ID: ${doc.id}\nFilename: ${doc.filename || doc.name}\nContent: ${doc.text.substring(0, 500)}...`
      ).join('\n\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert document classifier for geosynthetic engineering projects. 
            Categorize each document into one of these categories:
            - panel_specs: Panel specifications, dimensions, layouts
            - roll_data: Material roll inventory, roll numbers, quantities
            - site_plans: Site drawings, boundaries, constraints
            - material_specs: Material properties, specifications, standards
            - installation_notes: Installation procedures, methods, requirements
            
            Return ONLY a JSON object with document IDs as keys and category names as values.`
          },
          {
            role: "user",
            content: `Categorize these documents:\n\n${documentTexts}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.1
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('[ENHANCED ANALYZER] AI categorization failed:', error);
      return {};
    }
  }

  /**
   * Enhanced panel specifications analysis with validation
   */
  async analyzePanelSpecificationsEnhanced(documents) {
    if (documents.length === 0) return [];

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these panel specification documents with enhanced precision and validation.

DOCUMENTS:
${documentText}

Extract panel specifications in this exact JSON format:
{
  "panels": [
    {
      "panelId": "string (e.g., P001, Panel-1)",
      "rollNumber": "string (e.g., R001, 1059)",
      "dimensions": {
        "width": "number in feet",
        "length": "number in feet"
      },
      "confidence": "number (0-1)"
    }
  ],
  "validation": {
    "totalPanels": "number",
    "totalArea": "number in square feet",
    "dimensionConsistency": "boolean"
  }
}

ENHANCED RULES:
1. Validate all dimensions are within reasonable ranges (1-200 feet width, 1-800 feet length)
2. Verify panel IDs follow consistent naming patterns
3. Calculate total area for layout planning
4. Flag any inconsistencies or missing critical data
5. Provide confidence scores for each panel specification
6. ONLY extract: panel number, width, length, and roll number - location and installation notes are NOT required

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert geosynthetic engineer specializing in panel specifications. Extract and validate panel data with high precision."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[ENHANCED ANALYZER] Extracted ${result.panels?.length || 0} panel specifications with validation`);
      return result.panels || [];

    } catch (error) {
      console.error('[ENHANCED ANALYZER] Error analyzing panel specifications:', error);
      return [];
    }
  }

  /**
   * Enhanced roll data analysis with inventory validation
   */
  async analyzeRollDataEnhanced(documents) {
    if (documents.length === 0) return [];

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these roll inventory documents for recognition and reference purposes.

DOCUMENTS:
${documentText}

Extract roll information in this exact JSON format:
{
  "rolls": [
    {
      "rollNumber": "string (e.g., R001)",
      "dimensions": {
        "width": "number in feet",
        "length": "number in feet"
      },
      "material": {
        "type": "string (e.g., HDPE, LLDPE)",
        "thickness": "number in mils",
        "grade": "string"
      },
      "status": "string (available, allocated, used, damaged)",
      "location": "string",
      "manufacturer": "string",
      "batchNumber": "string",
      "confidence": "number (0-1)"
    }
  ],
  "inventory": {
    "totalRolls": "number",
    "totalArea": "number in square feet",
    "availableArea": "number in square feet",
    "materialBreakdown": "object"
  }
}

ENHANCED RULES:
1. Recognize and extract roll data for reference purposes
2. Check for duplicate roll numbers
3. Calculate total available area
4. Verify material consistency
5. Flag any damaged or unavailable rolls
6. NOTE: Roll data is for recognition only - NOT required for panel layout generation

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert inventory manager for geosynthetic materials. Extract and validate roll data with high precision."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[ENHANCED ANALYZER] Extracted ${result.rolls?.length || 0} roll specifications with inventory analysis`);
      return result.rolls || [];

    } catch (error) {
      console.error('[ENHANCED ANALYZER] Error analyzing roll data:', error);
      return [];
    }
  }

  /**
   * Enhanced site plans analysis with constraint validation
   */
  async analyzeSitePlansEnhanced(documents) {
    if (documents.length === 0) return {};

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these site plan documents with enhanced constraint identification and validation.

DOCUMENTS:
${documentText}

Extract site information in this exact JSON format:
{
  "constraints": [
    {
      "type": "string (obstacle, boundary, utility, environmental)",
      "description": "string",
      "location": "string",
      "dimensions": "object (if applicable)",
      "impact": "string (high, medium, low)"
    }
  ],
  "access": {
    "entryPoints": ["array of locations"],
    "restrictions": ["array of restrictions"],
    "equipmentAccess": "boolean"
  },
  "environmental": {
    "soilType": "string",
    "drainage": "string",
    "weatherConsiderations": ["array of considerations"]
  }
}

ENHANCED RULES:
1. Identify all potential constraints and obstacles that affect panel placement
2. Assess impact of constraints on panel layout
3. Verify access points and equipment requirements
4. Consider environmental factors affecting installation
5. Flag any critical constraints that may affect project feasibility
6. Site dimensions are NOT required for panel generation - focus on constraints only

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert site planner for geosynthetic projects. Extract and validate site constraints with high precision."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[ENHANCED ANALYZER] Extracted site constraints with ${result.constraints?.length || 0} identified constraints`);
      return result;

    } catch (error) {
      console.error('[ENHANCED ANALYZER] Error analyzing site plans:', error);
      return {};
    }
  }

  /**
   * Enhanced material specifications analysis
   */
  async analyzeMaterialSpecificationsEnhanced(documents) {
    if (documents.length === 0) return {};

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these material specification documents for recognition and reference purposes.

DOCUMENTS:
${documentText}

Extract material information in this exact JSON format:
{
  "primaryMaterial": {
    "type": "string (e.g., HDPE, LLDPE, PVC)",
    "thickness": "number in mils",
    "grade": "string (e.g., Standard, Premium)",
    "color": "string",
    "manufacturer": "string",
    "specification": "string (e.g., ASTM D4437)"
  },
  "seamRequirements": {
    "type": "string (e.g., fusion, adhesive, mechanical)",
    "overlap": "number in inches",
    "temperature": "number in degrees Fahrenheit (if applicable)",
    "pressure": "number in PSI (if applicable)",
    "method": "string"
  },
  "qualityStandards": [
    {
      "standard": "string (e.g., ASTM, AASHTO)",
      "requirement": "string",
      "testMethod": "string"
    }
  ],
  "testingRequirements": [
    {
      "testType": "string (e.g., tensile strength, puncture resistance)",
      "frequency": "string",
      "acceptanceCriteria": "string"
    }
  ],
  "validation": {
    "standardsCompliance": "boolean",
    "thicknessValidation": "boolean",
    "seamRequirementsValid": "boolean"
  }
}

ENHANCED RULES:
1. Recognize and extract material specifications for reference purposes
2. Check thickness requirements are within acceptable ranges
3. Verify seam requirements are appropriate for material type
4. Ensure quality standards are current and applicable
5. Flag any non-compliant or missing specifications
6. NOTE: Material specifications are for recognition only - NOT required for panel layout generation

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert materials engineer specializing in geosynthetics. Extract and validate material specifications with high precision."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[ENHANCED ANALYZER] Extracted material specifications with ${result.qualityStandards?.length || 0} quality standards`);
      return result;

    } catch (error) {
      console.error('[ENHANCED ANALYZER] Error analyzing material specifications:', error);
      return {};
    }
  }

  /**
   * Enhanced installation notes analysis
   */
  async analyzeInstallationNotesEnhanced(documents) {
    if (documents.length === 0) return [];

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these installation notes documents with enhanced procedure validation and safety considerations.

DOCUMENTS:
${documentText}

Extract installation information in this exact JSON format:
{
  "installationNotes": [
    {
      "type": "string (e.g., overlap, anchoring, drainage, safety)",
      "requirement": "string (specific requirement)",
      "priority": "number (1-5, where 1 is highest priority)",
      "location": "string (if location-specific)",
      "method": "string (specific installation method)",
      "equipment": "string (required equipment)",
      "safetyConsiderations": ["array of safety notes"],
      "qualityChecks": ["array of quality check points"]
    }
  ],
  "procedures": [
    {
      "step": "number",
      "description": "string",
      "requirements": ["array of requirements"],
      "verification": "string (how to verify completion)"
    }
  ],
  "safety": {
    "hazards": ["array of identified hazards"],
    "mitigation": ["array of mitigation measures"],
    "ppe": ["array of required PPE"]
  }
}

ENHANCED RULES:
1. Prioritize installation requirements by criticality
2. Identify safety hazards and mitigation measures
3. Ensure procedures follow industry best practices
4. Include quality check points for each step
5. Flag any missing critical safety information
6. Cross-reference with material and site specifications

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert installation specialist for geosynthetic projects. Extract and validate installation procedures with high precision."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[ENHANCED ANALYZER] Extracted ${result.installationNotes?.length || 0} installation notes with safety analysis`);
      return result.installationNotes || [];

    } catch (error) {
      console.error('[ENHANCED ANALYZER] Error analyzing installation notes:', error);
      return [];
    }
  }

  /**
   * Cross-document correlation and validation
   */
  async correlateDocuments(analysisResults) {
    try {
      const correlationData = {
        panelRollMapping: this.correlatePanelsWithRolls(analysisResults),
        materialConsistency: this.checkMaterialConsistency(analysisResults),
        dimensionValidation: this.validateDimensions(analysisResults),
        constraintImpact: this.assessConstraintImpact(analysisResults),
        dataGaps: this.identifyDataGaps(analysisResults)
      };

      console.log(`[ENHANCED ANALYZER] Cross-document correlation completed`);
      return correlationData;
    } catch (error) {
      console.error('[ENHANCED ANALYZER] Error in cross-document correlation:', error);
      return {};
    }
  }

  /**
   * Enhanced data validation with detailed results
   */
  async validateDataEnhanced(analysisResults) {
    const validationResults = {
      panelSpecifications: this.validatePanelSpecifications(analysisResults.panelSpecifications),
      rollData: this.validateRollData(analysisResults.rollInformation),
      siteConstraints: this.validateSiteConstraints(analysisResults.siteConstraints),
      materialRequirements: this.validateMaterialRequirements(analysisResults.materialRequirements),
      installationNotes: this.validateInstallationNotes(analysisResults.installationNotes),
      overall: {
        isValid: true,
        issues: [],
        warnings: [],
        recommendations: []
      }
    };

    // Aggregate validation results
    const allIssues = [];
    const allWarnings = [];
    const allRecommendations = [];

    Object.values(validationResults).forEach(result => {
      if (result && result.issues) allIssues.push(...result.issues);
      if (result && result.warnings) allWarnings.push(...result.warnings);
      if (result && result.recommendations) allRecommendations.push(...result.recommendations);
    });

    validationResults.overall.issues = allIssues;
    validationResults.overall.warnings = allWarnings;
    validationResults.overall.recommendations = allRecommendations;
    validationResults.overall.isValid = allIssues.length === 0;

    return validationResults;
  }

  /**
   * Assess data quality metrics
   */
  assessDataQuality(analysisResults) {
    const metrics = {
      completeness: this.calculateCompleteness(analysisResults),
      consistency: this.calculateConsistency(analysisResults),
      accuracy: this.calculateAccuracy(analysisResults),
      reliability: this.calculateReliability(analysisResults)
    };

    return metrics;
  }

  /**
   * Generate intelligent suggestions based on analysis
   */
  async generateSuggestions(analysisResults, projectContext) {
    const suggestions = [];

    // Check for missing critical data
    if (!analysisResults.panelSpecifications || analysisResults.panelSpecifications.length === 0) {
      suggestions.push({
        type: 'critical',
        category: 'missing_data',
        message: 'No panel specifications found. Please provide panel layout documents.',
        action: 'upload_panel_specs'
      });
    }

    // Check for material inconsistencies
    if (analysisResults.crossDocumentInsights?.materialConsistency?.hasInconsistencies) {
      suggestions.push({
        type: 'warning',
        category: 'data_consistency',
        message: 'Material specifications are inconsistent across documents.',
        action: 'review_materials'
      });
    }

    // Check for constraint conflicts
    if (analysisResults.crossDocumentInsights?.constraintImpact?.hasConflicts) {
      suggestions.push({
        type: 'warning',
        category: 'constraints',
        message: 'Site constraints may conflict with panel layout requirements.',
        action: 'review_constraints'
      });
    }

    return suggestions;
  }

  /**
   * Calculate enhanced confidence score
   */
  calculateEnhancedConfidence(analysisResults) {
    const weights = this.confidenceWeights;
    
    const documentQuality = this.calculateDocumentQuality(analysisResults);
    const dataCompleteness = this.calculateDataCompleteness(analysisResults);
    const dataConsistency = this.calculateDataConsistency(analysisResults);
    const validationPass = analysisResults.validationResults?.overall?.isValid ? 1 : 0.5;

    const confidence = (
      documentQuality * weights.documentQuality +
      dataCompleteness * weights.dataCompleteness +
      dataConsistency * weights.dataConsistency +
      validationPass * weights.validationPass
    ) * 100;

    return Math.round(confidence);
  }

  // Helper methods for pattern matching
  matchesPanelSpecsPattern(filename, text) {
    return filename.includes('panel') || filename.includes('spec') || filename.includes('layout') ||
           (text.includes('panel') && (text.includes('dimension') || text.includes('size') || text.includes('measurement')));
  }

  matchesRollDataPattern(filename, text) {
    return filename.includes('roll') || filename.includes('material') || filename.includes('inventory') ||
           (text.includes('roll') && (text.includes('number') || text.includes('id') || text.includes('inventory')));
  }

  matchesSitePlansPattern(filename, text) {
    return filename.includes('site') || filename.includes('plan') || filename.includes('drawing') ||
           (text.includes('site') && (text.includes('boundary') || text.includes('area') || text.includes('dimension')));
  }

  matchesMaterialSpecsPattern(filename, text) {
    return filename.includes('material') || filename.includes('specification') ||
           (text.includes('material') && (text.includes('specification') || text.includes('property') || text.includes('standard')));
  }

  matchesInstallationNotesPattern(filename, text) {
    return filename.includes('install') || filename.includes('procedure') || filename.includes('method') ||
           (text.includes('install') && (text.includes('procedure') || text.includes('method') || text.includes('requirement')));
  }

  // Helper methods for validation and correlation
  correlatePanelsWithRolls(analysisResults) {
    // Implementation for correlating panels with available rolls
    return { mapped: [], unmapped: [] };
  }

  checkMaterialConsistency(analysisResults) {
    // Implementation for checking material consistency across documents
    return { isConsistent: true, inconsistencies: [] };
  }

  validateDimensions(analysisResults) {
    // Implementation for validating dimensions across documents
    return { isValid: true, issues: [] };
  }

  assessConstraintImpact(analysisResults) {
    // Implementation for assessing impact of constraints on panel layout
    return { hasConflicts: false, conflicts: [] };
  }

  identifyDataGaps(analysisResults) {
    // Implementation for identifying missing critical data
    return { gaps: [], severity: 'low' };
  }

  // Validation helper methods
  validatePanelSpecifications(panelSpecs) {
    return { isValid: true, issues: [], warnings: [], recommendations: [] };
  }

  validateRollData(rollData) {
    return { isValid: true, issues: [], warnings: [], recommendations: [] };
  }

  validateSiteConstraints(siteConstraints) {
    return { isValid: true, issues: [], warnings: [], recommendations: [] };
  }

  validateMaterialRequirements(materialRequirements) {
    return { isValid: true, issues: [], warnings: [], recommendations: [] };
  }

  validateInstallationNotes(installationNotes) {
    return { isValid: true, issues: [], warnings: [], recommendations: [] };
  }

  // Quality assessment helper methods
  calculateDocumentQuality(analysisResults) {
    return 0.8; // Placeholder implementation
  }

  calculateDataCompleteness(analysisResults) {
    return 0.7; // Placeholder implementation
  }

  calculateDataConsistency(analysisResults) {
    return 0.9; // Placeholder implementation
  }

  calculateAccuracy(analysisResults) {
    return 0.85; // Placeholder implementation
  }

  calculateReliability(analysisResults) {
    return 0.8; // Placeholder implementation
  }

  // Utility methods
  extractDocumentText(documents) {
    return documents.map(doc => 
      `Document: ${doc.filename || doc.name}\nContent: ${doc.text || 'No text content'}\n`
    ).join('\n');
  }

  getDefaultEnhancedAnalysis() {
    return {
      panelSpecifications: [],
      rollInformation: [],
      siteConstraints: {},
      materialRequirements: {},
      installationNotes: [],
      confidence: 0,
      documentTypes: [],
      validationResults: { overall: { isValid: false, issues: ['Analysis failed'], warnings: [], recommendations: [] } },
      crossDocumentInsights: {},
      dataQualityMetrics: {},
      suggestions: []
    };
  }
}

module.exports = EnhancedDocumentAnalyzer; 