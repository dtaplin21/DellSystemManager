const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class PanelDocumentAnalyzer {
  /**
   * Analyze documents for panel-specific information
   */
  async analyzePanelDocuments(documents) {
    try {
      console.log(`[PANEL ANALYZER] Analyzing ${documents.length} documents for panel information`);
      
      const analysisResults = {
        panelSpecifications: [],
        rollInformation: [],
        siteConstraints: {},
        materialRequirements: {},
        installationNotes: [],
        confidence: 0,
        documentTypes: []
      };

      // Categorize documents by type
      const categorizedDocs = this.categorizeDocuments(documents);
      analysisResults.documentTypes = Object.keys(categorizedDocs);

      // Analyze each document type
      for (const [docType, docs] of Object.entries(categorizedDocs)) {
        console.log(`[PANEL ANALYZER] Processing ${docType} documents:`, docs.length);
        
        switch (docType) {
          case 'panel_specs':
            analysisResults.panelSpecifications = await this.analyzePanelSpecifications(docs);
            break;
          case 'roll_data':
            analysisResults.rollInformation = await this.analyzeRollData(docs);
            break;
          case 'site_plans':
            analysisResults.siteConstraints = await this.analyzeSitePlans(docs);
            break;
          case 'material_specs':
            analysisResults.materialRequirements = await this.analyzeMaterialSpecifications(docs);
            break;
          case 'installation_notes':
            analysisResults.installationNotes = await this.analyzeInstallationNotes(docs);
            break;
          default:
            console.log(`[PANEL ANALYZER] Unknown document type: ${docType}`);
        }
      }

      // Calculate overall confidence
      analysisResults.confidence = this.calculateConfidence(analysisResults);

      console.log(`[PANEL ANALYZER] Analysis complete. Confidence: ${analysisResults.confidence}`);
      return analysisResults;

    } catch (error) {
      console.error('[PANEL ANALYZER] Error analyzing panel documents:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Categorize documents by their content and filename
   */
  categorizeDocuments(documents) {
    const categories = {
      panel_specs: [],
      roll_data: [],
      site_plans: [],
      material_specs: [],
      installation_notes: [],
      other: []
    };

    documents.forEach(doc => {
      const filename = (doc.filename || doc.name || '').toLowerCase();
      const text = (doc.text || '').toLowerCase();

      // Check filename patterns
      if (filename.includes('panel') || filename.includes('spec') || filename.includes('layout')) {
        categories.panel_specs.push(doc);
      } else if (filename.includes('roll') || filename.includes('material') || filename.includes('inventory')) {
        categories.roll_data.push(doc);
      } else if (filename.includes('site') || filename.includes('plan') || filename.includes('drawing')) {
        categories.site_plans.push(doc);
      } else if (filename.includes('material') || filename.includes('specification')) {
        categories.material_specs.push(doc);
      } else if (filename.includes('install') || filename.includes('procedure') || filename.includes('method')) {
        categories.installation_notes.push(doc);
      } else {
        // Check content patterns
        if (text.includes('panel') && (text.includes('dimension') || text.includes('size') || text.includes('measurement'))) {
          categories.panel_specs.push(doc);
        } else if (text.includes('roll') && (text.includes('number') || text.includes('id') || text.includes('inventory'))) {
          categories.roll_data.push(doc);
        } else if (text.includes('site') && (text.includes('boundary') || text.includes('area') || text.includes('dimension'))) {
          categories.site_plans.push(doc);
        } else if (text.includes('material') && (text.includes('type') || text.includes('thickness') || text.includes('grade'))) {
          categories.material_specs.push(doc);
        } else if (text.includes('install') && (text.includes('procedure') || text.includes('method') || text.includes('overlap'))) {
          categories.installation_notes.push(doc);
        } else {
          categories.other.push(doc);
        }
      }
    });

    return categories;
  }

  /**
   * Analyze panel specification documents
   */
  async analyzePanelSpecifications(documents) {
    if (documents.length === 0) return [];

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these panel specification documents and extract detailed panel information.

DOCUMENTS:
${documentText}

Extract panel specifications in this exact JSON format:
{
  "panels": [
    {
      "panelNumber": "string (e.g., P001, Panel-1)",
      "rollNumber": "string (e.g., R001, Roll-1)",
      "dimensions": {
        "length": "number in feet",
        "width": "number in feet"
      },
      "material": "string (e.g., HDPE, LLDPE)",
      "thickness": "number in mils",
      "location": "string (e.g., Northwest corner, Zone A)",
      "notes": "string (any additional specifications)",
      "priority": "number (1-5, where 1 is highest priority)"
    }
  ]
}

IMPORTANT RULES:
1. Extract ONLY panels that have clear specifications (panel number, dimensions, roll number)
2. If dimensions are in different units, convert to feet
3. If panel numbers are missing, generate sequential numbers (P001, P002, etc.)
4. If roll numbers are missing, generate sequential numbers (R001, R002, etc.)
5. Use reasonable defaults for missing material/thickness information
6. Return empty array if no valid panel specifications found

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert geosynthetic engineer. Extract panel specifications from documents with high accuracy."
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
      console.log(`[PANEL ANALYZER] Extracted ${result.panels?.length || 0} panel specifications`);
      return result.panels || [];

    } catch (error) {
      console.error('[PANEL ANALYZER] Error analyzing panel specifications:', error);
      return [];
    }
  }

  /**
   * Analyze roll data documents
   */
  async analyzeRollData(documents) {
    if (documents.length === 0) return [];

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these roll data documents and extract roll information.

DOCUMENTS:
${documentText}

Extract roll information in this exact JSON format:
{
  "rolls": [
    {
      "rollNumber": "string (e.g., R001, Roll-1)",
      "material": "string (e.g., HDPE, LLDPE)",
      "thickness": "number in mils",
      "dimensions": {
        "length": "number in feet",
        "width": "number in feet"
      },
      "availableArea": "number in square feet",
      "location": "string (e.g., Warehouse A, On-site)",
      "notes": "string (any additional information)"
    }
  ]
}

IMPORTANT RULES:
1. Extract ONLY rolls that have clear identification (roll number)
2. Calculate available area from dimensions if not provided
3. Use reasonable defaults for missing material/thickness information
4. Return empty array if no valid roll data found

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert geosynthetic engineer. Extract roll data from documents with high accuracy."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[PANEL ANALYZER] Extracted ${result.rolls?.length || 0} roll records`);
      return result.rolls || [];

    } catch (error) {
      console.error('[PANEL ANALYZER] Error analyzing roll data:', error);
      return [];
    }
  }

  /**
   * Analyze site plan documents
   */
  async analyzeSitePlans(documents) {
    if (documents.length === 0) return {};

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these site plan documents and extract site constraints.

DOCUMENTS:
${documentText}

Extract site information in this exact JSON format:
{
  "siteDimensions": {
    "width": "number in feet",
    "length": "number in feet"
  },
  "obstacles": [
    {
      "type": "string (e.g., building, tree, utility)",
      "location": { "x": "number in feet", "y": "number in feet" },
      "dimensions": { "width": "number in feet", "length": "number in feet" },
      "description": "string"
    }
  ],
  "accessPaths": [
    {
      "start": { "x": "number in feet", "y": "number in feet" },
      "end": { "x": "number in feet", "y": "number in feet" },
      "width": "number in feet"
    }
  ],
  "terrainType": "string (flat|sloped|irregular)",
  "installationConstraints": ["string array of constraints"]
}

IMPORTANT RULES:
1. Extract site dimensions if clearly specified
2. Identify obstacles and their locations
3. Mark access paths for installation
4. Determine terrain type
5. List any installation constraints
6. Use reasonable defaults if information is missing

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert geosynthetic engineer. Extract site information from documents with high accuracy."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[PANEL ANALYZER] Extracted site constraints with ${result.obstacles?.length || 0} obstacles`);
      return result;

    } catch (error) {
      console.error('[PANEL ANALYZER] Error analyzing site plans:', error);
      return {};
    }
  }

  /**
   * Analyze material specification documents
   */
  async analyzeMaterialSpecifications(documents) {
    if (documents.length === 0) return {};

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these material specification documents and extract material requirements.

DOCUMENTS:
${documentText}

Extract material information in this exact JSON format:
{
  "primaryMaterial": {
    "type": "string (e.g., HDPE, LLDPE, PVC)",
    "thickness": "number in mils",
    "grade": "string (e.g., Standard, Premium)",
    "color": "string (e.g., Black, White)"
  },
  "seamRequirements": {
    "type": "string (e.g., fusion, adhesive, mechanical)",
    "overlap": "number in inches",
    "temperature": "number in degrees Fahrenheit (if applicable)"
  },
  "qualityStandards": ["string array of standards"],
  "testingRequirements": ["string array of tests"]
}

IMPORTANT RULES:
1. Extract primary material specifications
2. Identify seam requirements and overlap specifications
3. List quality standards and testing requirements
4. Use industry defaults if information is missing

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert geosynthetic engineer. Extract material specifications from documents with high accuracy."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[PANEL ANALYZER] Extracted material specifications`);
      return result;

    } catch (error) {
      console.error('[PANEL ANALYZER] Error analyzing material specifications:', error);
      return {};
    }
  }

  /**
   * Analyze installation notes documents
   */
  async analyzeInstallationNotes(documents) {
    if (documents.length === 0) return [];

    const documentText = this.extractDocumentText(documents);
    
    const prompt = `
Analyze these installation notes documents and extract installation requirements.

DOCUMENTS:
${documentText}

Extract installation information in this exact JSON format:
{
  "installationNotes": [
    {
      "type": "string (e.g., overlap, anchoring, drainage)",
      "requirement": "string (specific requirement)",
      "priority": "number (1-5, where 1 is highest priority)",
      "location": "string (if location-specific)"
    }
  ]
}

IMPORTANT RULES:
1. Extract specific installation requirements
2. Prioritize requirements by importance
3. Note location-specific requirements
4. Focus on overlap, anchoring, and drainage requirements

Return ONLY the JSON response.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert geosynthetic engineer. Extract installation requirements from documents with high accuracy."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log(`[PANEL ANALYZER] Extracted ${result.installationNotes?.length || 0} installation notes`);
      return result.installationNotes || [];

    } catch (error) {
      console.error('[PANEL ANALYZER] Error analyzing installation notes:', error);
      return [];
    }
  }

  /**
   * Extract text content from documents
   */
  extractDocumentText(documents) {
    if (!documents || !Array.isArray(documents)) {
      return 'No documents provided';
    }

    return documents
      .map(doc => {
        const filename = doc.filename || doc.name || 'Unknown';
        const text = doc.text || 'No text content';
        return `Document: ${filename}\n${text}`;
      })
      .join('\n\n');
  }

  /**
   * Calculate confidence score based on analysis results
   */
  calculateConfidence(analysisResults) {
    let confidence = 0;
    let totalChecks = 0;

    // Check panel specifications
    if (analysisResults.panelSpecifications.length > 0) {
      confidence += 0.3;
      totalChecks++;
    }

    // Check roll data
    if (analysisResults.rollInformation.length > 0) {
      confidence += 0.2;
      totalChecks++;
    }

    // Check site constraints
    if (analysisResults.siteConstraints.siteDimensions) {
      confidence += 0.2;
      totalChecks++;
    }

    // Check material requirements
    if (analysisResults.materialRequirements.primaryMaterial) {
      confidence += 0.15;
      totalChecks++;
    }

    // Check installation notes
    if (analysisResults.installationNotes.length > 0) {
      confidence += 0.15;
      totalChecks++;
    }

    return totalChecks > 0 ? Math.min(confidence, 1.0) : 0;
  }

  /**
   * Get default analysis when no documents are available
   */
  getDefaultAnalysis() {
    return {
      panelSpecifications: [],
      rollInformation: [],
      siteConstraints: {
        siteDimensions: { width: 1000, length: 800 },
        obstacles: [],
        accessPaths: [],
        terrainType: 'flat',
        installationConstraints: []
      },
      materialRequirements: {
        primaryMaterial: { type: 'HDPE', thickness: 60, grade: 'Standard', color: 'Black' },
        seamRequirements: { type: 'fusion', overlap: 6, temperature: 450 },
        qualityStandards: ['ASTM D4437'],
        testingRequirements: ['Seam peel test', 'Tensile strength test']
      },
      installationNotes: [
        { type: 'overlap', requirement: 'Minimum 6-inch overlap on all seams', priority: 1, location: 'All seams' },
        { type: 'anchoring', requirement: 'Anchor panels at 10-foot intervals', priority: 2, location: 'Perimeter' }
      ],
      confidence: 0,
      documentTypes: []
    };
  }
}

module.exports = new PanelDocumentAnalyzer(); 