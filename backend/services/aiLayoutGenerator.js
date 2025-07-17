const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AILayoutGenerator {
  /**
   * Generate AI layout actions based on documents and site constraints
   */
  async generateLayoutActions(documents, siteConstraints = {}) {
    try {
      // Extract text content from documents
      const documentText = this.extractDocumentText(documents);
      
      // Create enhanced prompt for action generation
      const prompt = this.createActionPrompt(documentText, siteConstraints);
      
      // Call OpenAI to generate actions
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert geosynthetic engineer and panel layout specialist. 
            Your task is to analyze project documents and generate specific panel layout actions.
            
            You must return ONLY a valid JSON array of actions. Each action should have:
            - type: The action type (CREATE_PANEL, MOVE_PANEL, DELETE_PANEL)
            - payload: The data needed to execute the action
            - id: A unique identifier for the action
            
            Consider:
            - Optimal spacing between panels (typically 6-12 inches)
            - Site boundaries and obstacles
            - Material efficiency and waste reduction
            - Installation logistics and access paths
            - Industry standards for geosynthetic installations`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Validate and process the generated actions
      const validatedActions = this.validateActions(result.actions || []);
      
      return {
        success: true,
        actions: validatedActions,
        summary: this.generateActionSummary(validatedActions),
        tokensUsed: response.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error('Error generating AI layout actions:', error);
      return {
        success: false,
        error: error.message,
        actions: []
      };
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
        if (doc.text) {
          return `Document: ${doc.filename || doc.name || 'Unknown'}\n${doc.text}`;
        }
        return `Document: ${doc.filename || doc.name || 'Unknown'} (No text content)`;
      })
      .join('\n\n');
  }

  /**
   * Create the prompt for action generation
   */
  createActionPrompt(documentText, siteConstraints) {
    const {
      siteWidth = 1000,
      siteLength = 800,
      panelWidth = 40,
      panelLength = 100,
      overlap = 6,
      terrainType = 'flat',
      obstacles = []
    } = siteConstraints;

    return `
Analyze these project documents and generate specific panel layout actions for a geosynthetic installation.

DOCUMENTS:
${documentText}

SITE CONSTRAINTS:
- Site dimensions: ${siteWidth} ft x ${siteLength} ft
- Panel dimensions: ${panelWidth} ft x ${panelLength} ft
- Overlap requirement: ${overlap} inches
- Terrain type: ${terrainType}
- Obstacles: ${obstacles.length > 0 ? obstacles.join(', ') : 'None specified'}

GENERATE PANEL LAYOUT ACTIONS:
Create a JSON response with an "actions" array containing specific panel creation and positioning actions.

Example action format:
{
  "type": "CREATE_PANEL",
  "id": "action_1",
  "payload": {
    "position": { "x": 50, "y": 50 },
    "dimensions": { "width": 40, "height": 100 },
    "rotation": 0,
    "properties": {
      "material": "HDPE",
      "thickness": 60,
      "seamsType": "fusion",
      "location": "Northwest corner",
      "notes": "Starting panel for grid layout"
    }
  }
}

REQUIREMENTS:
1. Calculate optimal panel placement based on site dimensions
2. Ensure proper overlap between panels (${overlap} inches)
3. Avoid obstacles and site boundaries
4. Optimize for material efficiency
5. Consider installation logistics
6. Use realistic panel dimensions and spacing
7. Generate 5-20 panels depending on site size
8. Include descriptive notes for each panel

Return ONLY the JSON response with the actions array.
`;
  }

  /**
   * Validate generated actions
   */
  validateActions(actions) {
    if (!Array.isArray(actions)) {
      console.warn('Actions is not an array, returning empty array');
      return [];
    }

    const validatedActions = [];
    let actionId = 1;

    for (const action of actions) {
      try {
        const validatedAction = this.validateSingleAction(action, actionId);
        if (validatedAction) {
          validatedActions.push(validatedAction);
          actionId++;
        }
      } catch (error) {
        console.warn(`Invalid action skipped:`, error.message, action);
      }
    }

    return validatedActions;
  }

  /**
   * Validate a single action
   */
  validateSingleAction(action, actionId) {
    // Ensure required fields
    if (!action.type || !action.payload) {
      throw new Error('Action missing required fields');
    }

    // Validate action type
    const validTypes = ['CREATE_PANEL', 'MOVE_PANEL', 'DELETE_PANEL'];
    if (!validTypes.includes(action.type)) {
      throw new Error(`Invalid action type: ${action.type}`);
    }

    // Validate payload based on action type
    switch (action.type) {
      case 'CREATE_PANEL':
        if (!action.payload.position || !action.payload.dimensions) {
          throw new Error('CREATE_PANEL missing position or dimensions');
        }
        
        // Ensure position is within reasonable bounds
        if (action.payload.position.x < 0 || action.payload.position.y < 0) {
          throw new Error('Panel position cannot be negative');
        }
        
        // Ensure dimensions are reasonable
        if (action.payload.dimensions.width <= 0 || action.payload.dimensions.height <= 0) {
          throw new Error('Panel dimensions must be positive');
        }
        
        break;

      case 'MOVE_PANEL':
        if (!action.payload.panelId || !action.payload.newPosition) {
          throw new Error('MOVE_PANEL missing panelId or newPosition');
        }
        break;

      case 'DELETE_PANEL':
        if (!action.payload.panelId) {
          throw new Error('DELETE_PANEL missing panelId');
        }
        break;
    }

    // Add or ensure action ID
    return {
      ...action,
      id: action.id || `action_${actionId}`
    };
  }

  /**
   * Generate summary of actions
   */
  generateActionSummary(actions) {
    const summary = {
      totalActions: actions.length,
      actionTypes: {},
      estimatedPanels: 0,
      estimatedArea: 0
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
   * Generate fallback layout actions when AI fails
   */
  generateFallbackActions(siteConstraints = {}) {
    const {
      siteWidth = 1000,
      siteLength = 800,
      panelWidth = 40,
      panelLength = 100,
      overlap = 6
    } = siteConstraints;

    const actions = [];
    let panelCount = 0;
    let currentX = 50;
    let currentY = 50;
    let maxHeightInRow = 0;
    const spacing = overlap / 12; // Convert inches to feet

    // Calculate how many panels fit in the site
    const maxPanelsX = Math.floor((siteWidth - 100) / (panelWidth + spacing));
    const maxPanelsY = Math.floor((siteLength - 100) / (panelLength + spacing));
    const totalPanels = Math.min(maxPanelsX * maxPanelsY, 20); // Cap at 20 panels

    for (let i = 0; i < totalPanels; i++) {
      const row = Math.floor(i / maxPanelsX);
      const col = i % maxPanelsX;

      const x = 50 + col * (panelWidth + spacing);
      const y = 50 + row * (panelLength + spacing);

      actions.push({
        type: 'CREATE_PANEL',
        id: `fallback_action_${i + 1}`,
        payload: {
          position: { x, y },
          dimensions: { width: panelWidth, height: panelLength },
          rotation: 0,
          properties: {
            material: 'HDPE',
            thickness: 60,
            seamsType: 'fusion',
            location: `Grid position ${row + 1}-${col + 1}`,
            notes: `Fallback panel ${i + 1} - AI generation failed`
          }
        }
      });

      panelCount++;
    }

    return {
      success: true,
      actions,
      summary: {
        totalActions: actions.length,
        actionTypes: { CREATE_PANEL: actions.length },
        estimatedPanels: panelCount,
        estimatedArea: panelCount * panelWidth * panelLength,
        isFallback: true
      }
    };
  }

  /**
   * Analyze documents for site-specific information
   */
  async analyzeDocuments(documents) {
    try {
      const documentText = this.extractDocumentText(documents);
      
      const prompt = `
Analyze these project documents and extract key site information for panel layout planning.

DOCUMENTS:
${documentText}

Extract and return the following information in JSON format:
{
  "siteDimensions": { "width": number, "length": number },
  "obstacles": ["obstacle1", "obstacle2"],
  "terrainType": "flat|sloped|irregular",
  "accessPaths": ["path1", "path2"],
  "electricalRequirements": ["req1", "req2"],
  "materialSpecifications": { "type": "string", "thickness": number },
  "installationConstraints": ["constraint1", "constraint2"],
  "confidence": number (0-1)
}

If specific information is not found, use reasonable defaults based on industry standards.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert geosynthetic engineer. Extract site information from documents and return structured data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.2
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('Error analyzing documents:', error);
      return {
        siteDimensions: { width: 1000, length: 800 },
        obstacles: [],
        terrainType: 'flat',
        accessPaths: [],
        electricalRequirements: [],
        materialSpecifications: { type: 'HDPE', thickness: 60 },
        installationConstraints: [],
        confidence: 0.5
      };
    }
  }
}

module.exports = new AILayoutGenerator(); 