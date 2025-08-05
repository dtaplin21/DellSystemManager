const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory storage for job status (in production, use Redis or database)
const jobStatus = new Map();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  // For now, we'll skip auth check for development
  // In production, implement proper JWT verification
  next();
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    openaiConfigured: !!process.env.OPENAI_API_KEY 
  });
});

// Query endpoint for chat functionality
router.post('/query', requireAuth, async (req, res) => {
  try {
    const { projectId, question, documents } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Prepare context from documents
    let context = '';
    const references = [];
    
    if (documents && documents.length > 0) {
      documents.forEach((doc, index) => {
        if (doc.text) {
          context += `Document: ${doc.filename}\nContent: ${doc.text}\n\n`;
          
          // Extract relevant excerpts for references
          const words = doc.text.split(' ');
          if (words.length > 20) {
            references.push({
              docId: doc.id,
              page: 1,
              excerpt: words.slice(0, 20).join(' ') + '...'
            });
          }
        }
      });
    }

    // Create the prompt
    const prompt = `Based on the following project documents and context, please answer the user's question.

Project ID: ${projectId}

Documents Context:
${context}

User Question: ${question}

Please provide a comprehensive answer based on the available information. If you need to reference specific documents, be specific about which document you're referencing.`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an AI assistant specialized in geosynthetic engineering and quality control. Provide detailed, technical answers based on the provided documents and context."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    const answer = response.choices[0].message.content;

    res.json({
      answer,
      references: references.slice(0, 3), // Limit to 3 references
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('Error in AI query:', error);
    res.status(500).json({ 
      error: 'Failed to process AI query',
      details: error.message 
    });
  }
});

// Document analysis endpoint
router.post('/analyze-documents', requireAuth, async (req, res) => {
  try {
    const { documents, analysisType = 'general' } = req.body;

    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'Documents are required' });
    }

    // Prepare document content for analysis
    let documentContent = '';
    documents.forEach(doc => {
      if (doc.text) {
        documentContent += `Document: ${doc.filename}\n${doc.text}\n\n`;
      }
    });

    const analysisPrompts = {
      general: "Analyze these geosynthetic engineering documents and provide key insights, important specifications, and any quality control requirements mentioned.",
      qc: "Focus on quality control requirements, testing procedures, and compliance standards mentioned in these documents.",
      specifications: "Extract technical specifications, material properties, and design requirements from these documents.",
      layout: "Identify site dimensions, panel requirements, installation guidelines, and any layout-specific information from these documents."
    };

    const prompt = `${analysisPrompts[analysisType] || analysisPrompts.general}

Documents to analyze:
${documentContent}

Please provide a structured analysis in JSON format with the following sections:
- summary: Overall summary of the documents
- key_findings: Important findings and insights
- specifications: Technical specifications found
- recommendations: Recommendations based on the analysis
- qc_requirements: Quality control requirements identified`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert in geosynthetic engineering and quality control. Analyze documents and provide structured insights."
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

    const analysis = JSON.parse(response.choices[0].message.content);

    res.json({
      analysis,
      documentsAnalyzed: documents.length,
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('Error in document analysis:', error);
    res.status(500).json({ 
      error: 'Failed to analyze documents',
      details: error.message 
    });
  }
});

// Enhanced AI layout generation endpoint with panel requirements system
router.post('/automate-layout', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    console.log(`[AI ROUTE] Starting panel requirements-based layout generation for project ${projectId}`);

    // Set job status to processing
    jobStatus.set(projectId, {
      status: 'processing',
      created_at: new Date().toISOString(),
      completed_at: null
    });

    // Import the enhanced AI layout generator
    const enhancedAILayoutGenerator = require('../services/enhancedAILayoutGenerator');

    // Generate AI layout actions using panel requirements
    const result = await enhancedAILayoutGenerator.generateLayoutActions(projectId);

    console.log(`[AI ROUTE] Panel requirements-based generation result status: ${result.status}`);

    // Handle different response statuses
    if (result.status === 'insufficient_information') {
      console.log('[AI ROUTE] Insufficient information - returning guidance');
      
      // Update job status with guidance
      jobStatus.set(projectId, {
        status: 'insufficient_information',
        created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        guidance: result.guidance,
        missingParameters: result.missingParameters,
        analysis: result.analysis,
        confidence: result.confidence
      });

      res.json({
        success: true,
        status: 'insufficient_information',
        message: result.guidance.title,
        guidance: result.guidance,
        missingParameters: result.missingParameters,
        analysis: result.analysis,
        confidence: result.confidence,
        jobId: projectId
      });
      return;
    }

    if (!result.success) {
      console.warn('[AI ROUTE] Panel requirements-based generation failed');
      
      // Update job status with error
      jobStatus.set(projectId, {
        status: 'error',
        created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error: result.error || 'Unknown error'
      });

      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to generate panel layout',
        error: result.error || 'Unknown error',
        jobId: projectId
      });
      return;
    }

    // Success case
    console.log('[AI ROUTE] Panel requirements-based generation successful');
    
    // Update job status with success
    jobStatus.set(projectId, {
      status: result.status || 'success',
      created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      actions: result.actions,
      summary: result.summary,
      analysis: result.analysis,
      confidence: result.confidence
    });

    res.json({
      success: true,
      status: result.status || 'success',
      actions: result.actions,
      summary: result.summary,
      analysis: result.analysis,
      confidence: result.confidence,
      jobId: projectId
    });

  } catch (error) {
    console.error('[AI ROUTE] Error in automate-layout:', error);
    
    // Update job status with error
    jobStatus.set(req.body.projectId, {
      status: 'error',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error: error.message
    });

    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to generate panel layout',
      error: error.message
    });
  }
});

// New endpoint to execute AI-generated layout actions
router.post('/execute-ai-layout', requireAuth, async (req, res) => {
  try {
    const { projectId, actions } = req.body;

    if (!projectId || !actions || !Array.isArray(actions)) {
      return res.status(400).json({ 
        error: 'Project ID and actions array are required' 
      });
    }

    // Import the panel layout service
    const panelLayoutService = require('../services/panelLayoutService');

    const results = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'CREATE_PANEL':
            const newPanel = await panelLayoutService.createPanel(projectId, action.data || action.payload);
            results.push({ 
              success: true, 
              type: 'CREATE_PANEL', 
              panel: newPanel,
              actionId: action.id 
            });
            break;

          case 'MOVE_PANEL':
            const movedPanel = await panelLayoutService.movePanel(
              projectId, 
              (action.data || action.payload).panelId, 
              (action.data || action.payload).newPosition
            );
            results.push({ 
              success: true, 
              type: 'MOVE_PANEL', 
              panel: movedPanel,
              actionId: action.id 
            });
            break;

          case 'DELETE_PANEL':
            const deleteResult = await panelLayoutService.deletePanel(
              projectId, 
              (action.data || action.payload).panelId
            );
            results.push({ 
              success: true, 
              type: 'DELETE_PANEL', 
              result: deleteResult,
              actionId: action.id 
            });
            break;

          default:
            results.push({ 
              success: false, 
              type: action.type, 
              error: 'Unknown action type',
              actionId: action.id 
            });
        }
      } catch (error) {
        results.push({ 
          success: false, 
          type: action.type, 
          error: error.message,
          actionId: action.id 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    res.json({
      success: true,
      results,
      summary: {
        totalActions: totalCount,
        successfulActions: successCount,
        failedActions: totalCount - successCount,
        successRate: (successCount / totalCount) * 100
      },
      message: `Executed ${successCount}/${totalCount} AI layout actions successfully`
    });

  } catch (error) {
    console.error('Error executing AI layout:', error);
    res.status(500).json({
      error: 'Failed to execute AI layout',
      details: error.message
    });
  }
});

// Job status endpoint
router.get('/job-status/:projectId', requireAuth, (req, res) => {
  const { projectId } = req.params;
  const status = jobStatus.get(projectId) || { status: 'idle' };
  
  res.json(status);
});

// Extract data from documents endpoint
router.post('/extract-data', requireAuth, async (req, res) => {
  try {
    const { documents, extractionType = 'qc_data' } = req.body;

    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'Documents are required' });
    }

    let documentContent = '';
    documents.forEach(doc => {
      if (doc.text) {
        documentContent += `Document: ${doc.filename}\n${doc.text}\n\n`;
      }
    });

    const extractionPrompts = {
      qc_data: "Extract quality control test data, measurements, and results from these documents. Include test dates, values, pass/fail status, and standards referenced.",
      material_specs: "Extract material specifications, properties, and technical parameters from these documents.",
      site_info: "Extract site information including dimensions, coordinates, soil conditions, and environmental factors.",
      test_results: "Extract all test results, measurements, and quality assurance data with their corresponding values and units."
    };

    const prompt = `${extractionPrompts[extractionType] || extractionPrompts.qc_data}

Documents:
${documentContent}

Please extract the data in a structured JSON format with appropriate fields for the extracted information. Include source document references where possible.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a data extraction specialist for geosynthetic engineering documents. Extract structured data accurately and completely."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.2
    });

    const extractedData = JSON.parse(response.choices[0].message.content);

    res.json({
      extractedData,
      extractionType,
      documentsProcessed: documents.length,
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('Error in data extraction:', error);
    res.status(500).json({ 
      error: 'Failed to extract data from documents',
      details: error.message 
    });
  }
});

// Enhanced document analysis for panel requirements (Phase 2)
router.post('/analyze-panel-requirements', requireAuth, async (req, res) => {
  try {
    const { projectId, documentIds } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!documentIds || documentIds.length === 0) {
      return res.status(400).json({ error: 'Document IDs are required' });
    }

    console.log(`[AI ROUTE] Phase 2: Analyzing ${documentIds.length} documents for panel requirements in project ${projectId}`);
    console.log(`[AI ROUTE] Document IDs received:`, documentIds);

    // Import enhanced services for Phase 2
    const EnhancedDocumentAnalyzer = require('../services/enhancedDocumentAnalyzer');
    const EnhancedValidationService = require('../services/enhancedValidationService');
    const EnhancedConfidenceService = require('../services/enhancedConfidenceService');
    
    // Import Phase 3 services
    const Phase3AILayoutGenerator = require('../services/phase3AILayoutGenerator');
    
    // Instantiate enhanced services
    const enhancedDocumentAnalyzer = new EnhancedDocumentAnalyzer();
    const enhancedValidationService = new EnhancedValidationService();
    const enhancedConfidenceService = new EnhancedConfidenceService();
    
    // Instantiate Phase 3 services
    const phase3AILayoutGenerator = new Phase3AILayoutGenerator();
    const documentService = require('../services/documentService');
    const panelRequirementsService = require('../services/panelRequirementsService');

    // Fetch document content from database using document IDs
    let enhancedDocuments = [];
    try {
      enhancedDocuments = await Promise.all(
        documentIds.map(async (docId) => {
          try {
            console.log(`[AI ROUTE] Processing document ID: ${docId}`);
            const documentText = await documentService.getDocumentText(docId);
            // Get document metadata from database
            const { db } = require('../db/index');
            const { documents } = require('../db/schema');
            const { eq } = require('drizzle-orm');
            
            const [doc] = await db
              .select()
              .from(documents)
              .where(eq(documents.id, docId));
            
            console.log(`[AI ROUTE] Document metadata for ${docId}:`, {
              name: doc?.name,
              type: doc?.type,
              size: doc?.size,
              hasTextContent: !!documentText,
              textContentLength: documentText ? documentText.length : 0
            });
            
            return {
              id: docId,
              text: documentText,
              filename: doc?.name || 'Unknown document',
              type: doc?.type || 'application/octet-stream',
              size: doc?.size || 0
            };
          } catch (textError) {
            console.warn(`[AI ROUTE] Text extraction failed for ${docId}:`, textError.message);
            return {
              id: docId,
              text: '',
              filename: 'Unknown document',
              type: 'application/octet-stream',
              size: 0
            };
          }
        })
      );
    } catch (enhanceError) {
      console.warn('[AI ROUTE] Document enhancement failed:', enhanceError.message);
      return res.status(500).json({ error: 'Failed to fetch document content' });
    }

    // Phase 2: Enhanced document analysis with advanced parsing and validation
    const enhancedAnalysisResult = await enhancedDocumentAnalyzer.analyzeDocumentsEnhanced(enhancedDocuments, { projectId });
    
    console.log(`[AI ROUTE] Phase 2: Enhanced analysis completed with confidence: ${enhancedAnalysisResult.confidence}%`);

    // Phase 2: Enhanced validation with detailed results
    const validationResults = await enhancedValidationService.validateExtractedData(enhancedAnalysisResult);
    
    console.log(`[AI ROUTE] Phase 2: Validation completed. Valid: ${validationResults.isValid}, Issues: ${validationResults.issues.length}`);

    // Phase 2: Enhanced confidence calculation with detailed breakdown
    const confidenceResults = await enhancedConfidenceService.calculateEnhancedConfidence(enhancedAnalysisResult, validationResults);
    
    console.log(`[AI ROUTE] Phase 2: Enhanced confidence calculation completed. Overall: ${confidenceResults.overall}%`);

    // Extract panel requirements from enhanced analysis
    const extractedRequirements = {
      panelSpecifications: {
        panelCount: enhancedAnalysisResult.panelSpecifications?.length || 0,
        dimensions: extractPanelDimensions(enhancedAnalysisResult.panelSpecifications),
        materials: extractMaterials(enhancedAnalysisResult.panelSpecifications, enhancedAnalysisResult.materialRequirements),
        panelNumbers: enhancedAnalysisResult.panelSpecifications?.map(p => p.panelId) || [],
        rollNumbers: extractRollNumbers(enhancedAnalysisResult.panelSpecifications),
        confidence: enhancedAnalysisResult.panelSpecifications?.map(p => p.confidence) || [],
        // Include the actual panel specifications for layout generation
        panelSpecifications: enhancedAnalysisResult.panelSpecifications || []
      },
      materialRequirements: {
        primaryMaterial: extractPrimaryMaterial(enhancedAnalysisResult.panelSpecifications),
        thickness: extractThickness(enhancedAnalysisResult.panelSpecifications),
        seamRequirements: enhancedAnalysisResult.materialRequirements?.seamRequirements || 'Standard 6-inch overlap',
        secondaryMaterial: enhancedAnalysisResult.materialRequirements?.secondaryMaterial || null,
        qualityStandards: enhancedAnalysisResult.materialRequirements?.qualityStandards || []
      },
      rollInventory: {
        rolls: enhancedAnalysisResult.rollInformation?.map(roll => ({
          id: roll.rollNumber,
          dimensions: `${roll.dimensions?.width || 0}ft x ${roll.dimensions?.length || 0}ft`,
          quantity: 1,
          status: roll.status || 'available',
          confidence: roll.confidence || 0
        })) || [],
        totalQuantity: enhancedAnalysisResult.rollInformation?.length || 0,
        totalArea: enhancedAnalysisResult.rollInformation?.reduce((total, roll) => {
          return total + (roll.dimensions?.width * roll.dimensions?.length || 0);
        }, 0) || 0
      },
      installationNotes: {
        requirements: extractInstallationRequirements(enhancedAnalysisResult.installationNotes),
        constraints: extractInstallationConstraints(enhancedAnalysisResult.siteConstraints),
        notes: extractInstallationNotes(enhancedAnalysisResult.installationNotes),
        safety: enhancedAnalysisResult.installationNotes?.safety || {}
      },
      siteDimensions: {
        width: enhancedAnalysisResult.siteConstraints?.siteDimensions?.width || null,
        length: enhancedAnalysisResult.siteConstraints?.siteDimensions?.length || null,
        terrainType: enhancedAnalysisResult.siteConstraints?.terrain?.type || 'flat',
        constraints: enhancedAnalysisResult.siteConstraints?.constraints || []
      }
    };

    // Phase 2: Enhanced missing requirements analysis
    const missingRequirements = panelRequirementsService.getMissingRequirements(extractedRequirements);

    // Save extracted requirements to database
    const savedRequirements = await panelRequirementsService.upsertRequirements(projectId, extractedRequirements);

    console.log(`[AI ROUTE] Panel requirements extracted and saved with confidence: ${confidenceResults.overall}%`);
    console.log(`[AI ROUTE] Saved panel specifications:`, {
      panelCount: extractedRequirements.panelSpecifications.panelCount,
      actualPanels: extractedRequirements.panelSpecifications.panelSpecifications?.length || 0,
      hasPanelData: !!extractedRequirements.panelSpecifications.panelSpecifications?.length,
      panelData: extractedRequirements.panelSpecifications.panelSpecifications?.slice(0, 3) || 'No panel data'
    });

    res.json({
      success: true,
      requirements: extractedRequirements,
      confidence: confidenceResults.overall,
      missingRequirements,
      analysis: {
        documentTypes: enhancedAnalysisResult.documentTypes,
        panelSpecifications: enhancedAnalysisResult.panelSpecifications,
        rollInformation: enhancedAnalysisResult.rollInformation,
        materialRequirements: enhancedAnalysisResult.materialRequirements,
        siteConstraints: enhancedAnalysisResult.siteConstraints,
        installationNotes: enhancedAnalysisResult.installationNotes
      },
      savedRequirements
    });

  } catch (error) {
    console.error('[AI ROUTE] Error analyzing panel requirements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze documents for panel requirements',
      details: error.message
    });
  }
});

// Phase 3: Advanced AI Layout Generation Route
router.post('/generate-advanced-layout', requireAuth, async (req, res) => {
  try {
    console.log('[AI ROUTE] Phase 3: Advanced layout generation request received');
    
    const { projectId, options = {} } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    console.log('[AI ROUTE] Phase 3: Generating advanced layout for project:', projectId);
    console.log('[AI ROUTE] Phase 3: Options:', options);

    // Import Phase 3 services if not already imported
    const Phase3AILayoutGenerator = require('../services/phase3AILayoutGenerator');
    const phase3AILayoutGenerator = new Phase3AILayoutGenerator();

    // Generate advanced layout using Phase 3 AI Layout Generator
    const result = await phase3AILayoutGenerator.generateAdvancedLayout(projectId, options);

    console.log('[AI ROUTE] Phase 3: Advanced layout generation completed');
    console.log('[AI ROUTE] Phase 3: Result status:', result.success);
    console.log('[AI ROUTE] Phase 3: Panel count:', result.layout?.length || 0);

    res.json(result);

  } catch (error) {
    console.error('[AI ROUTE] Phase 3: Error generating advanced layout:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate advanced layout',
      details: error.message,
      phase: '3'
    });
  }
});

// Helper methods for extracting specific data
function extractPanelDimensions(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) return null;
  
  const dimensions = panelSpecs.map(p => `${p.dimensions?.width || 0}ft x ${p.dimensions?.length || 0}ft`);
  return dimensions.join(', ');
}

function extractMaterials(panelSpecs, materialReqs) {
  // Material information is optional for panel generation
  // Return default if no material information is available
  if (!materialReqs && (!panelSpecs || panelSpecs.length === 0)) {
    return 'Material type not specified - will be determined during installation';
  }
  
  const materials = new Set();
  
  if (materialReqs?.primaryMaterial?.type) {
    materials.add(materialReqs.primaryMaterial.type);
  }
  
  if (panelSpecs) {
    panelSpecs.forEach(p => {
      if (p.material?.type) materials.add(p.material.type);
    });
  }
  
  return Array.from(materials).join(', ') || 'Material type not specified - will be determined during installation';
}

function extractPrimaryMaterial(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) {
    return 'Material type not specified - will be determined during installation';
  }
  
  const materialCounts = {};
  panelSpecs.forEach(p => {
    if (p.material?.type) {
      materialCounts[p.material.type] = (materialCounts[p.material.type] || 0) + 1;
    }
  });
  
  return Object.keys(materialCounts).sort((a, b) => materialCounts[b] - materialCounts[a])[0] || 
         'Material type not specified - will be determined during installation';
}

function extractThickness(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) {
    return 'Thickness not specified - will be determined during installation';
  }
  
  const thicknesses = panelSpecs.map(p => p.material?.thickness).filter(t => t);
  if (thicknesses.length === 0) {
    return 'Thickness not specified - will be determined during installation';
  }
  
  return thicknesses[0] + ' mils';
}

function extractRollNumbers(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) return [];
  
  return panelSpecs.map(p => p.rollNumber).filter(r => r);
}

function extractInstallationRequirements(installationNotes) {
  if (!installationNotes || installationNotes.length === 0) {
    return 'Standard geosynthetic installation procedures';
  }
  
  return installationNotes.map(note => note.requirements).filter(r => r).join('; ') || 
         'Standard geosynthetic installation procedures';
}

function extractInstallationConstraints(siteConstraints) {
  if (!siteConstraints) return 'Standard site constraints apply';
  
  const constraints = [];
  if (siteConstraints.obstacles && siteConstraints.obstacles.length > 0) {
    constraints.push(`Site obstacles: ${siteConstraints.obstacles.join(', ')}`);
  }
  if (siteConstraints.terrainType && siteConstraints.terrainType !== 'flat') {
    constraints.push(`Terrain type: ${siteConstraints.terrainType}`);
  }
  
  return constraints.join('; ') || 'Standard site constraints apply';
}

function extractInstallationNotes(installationNotes) {
  if (!installationNotes || installationNotes.length === 0) {
    return 'Follow manufacturer specifications and industry standards';
  }
  
  return installationNotes.map(note => note.notes).filter(n => n).join('; ') || 
         'Follow manufacturer specifications and industry standards';
}

// Test endpoint for enhanced AI services
router.get('/test-enhanced', requireAuth, async (req, res) => {
  try {
    // Test the enhanced layout generator
    const enhancedAILayoutGenerator = require('../services/enhancedAILayoutGenerator');
    const panelDocumentAnalyzer = require('../services/panelDocumentAnalyzer');
    
    // Test with sample data
    const testDocuments = [
      {
        filename: 'test-panel-specs.txt',
        text: 'Panel P001: Roll Number: R001, Dimensions: 40 ft x 100 ft, Material: HDPE, Thickness: 60 mils'
      }
    ];
    
    const result = await enhancedAILayoutGenerator.generateLayoutActions(testDocuments, 'test-project');
    
    res.json({
      success: true,
      message: 'Enhanced AI services are working correctly',
      testResult: {
        success: result.success,
        actionsCount: result.actions?.length || 0,
        analysis: result.analysis ? {
          confidence: result.analysis.confidence,
          documentTypes: result.analysis.documentTypes,
          panelSpecsCount: result.analysis.panelSpecifications?.length || 0
        } : null
      }
    });
    
  } catch (error) {
    console.error('[AI TEST] Error testing enhanced services:', error);
    res.status(500).json({ 
      success: false,
      error: 'Enhanced AI services test failed',
      details: error.message 
    });
  }
});

// Test endpoint to verify document analysis workflow
router.post('/test-document-analysis', requireAuth, async (req, res) => {
  try {
    const { projectId, documents } = req.body;

    console.log(`[TEST] Testing document analysis for project ${projectId}`);
    console.log(`[TEST] Documents provided: ${documents?.length || 0}`);

    // Test document enhancement
    let enhancedDocuments = documents || [];
    if (enhancedDocuments.length > 0) {
      console.log('[TEST] Testing document enhancement...');
      
      try {
        const documentService = require('../services/documentService');
        
        enhancedDocuments = await Promise.all(
          enhancedDocuments.map(async (doc) => {
            console.log(`[TEST] Processing document: ${doc.name || doc.id}`);
            if (!doc.text && doc.id) {
              try {
                const documentText = await documentService.getDocumentText(doc.id);
                console.log(`[TEST] Extracted text length: ${documentText ? documentText.length : 0}`);
                return {
                  ...doc,
                  text: documentText,
                  filename: doc.name || doc.filename
                };
              } catch (textError) {
                console.warn(`[TEST] Text extraction failed for ${doc.id}:`, textError.message);
                return doc;
              }
            }
            return {
              ...doc,
              filename: doc.name || doc.filename
            };
          })
        );
      } catch (enhanceError) {
        console.warn('[TEST] Document enhancement failed:', enhanceError.message);
      }
    }

    // Test document categorization
    const panelDocumentAnalyzer = require('../services/panelDocumentAnalyzer');
    const categories = panelDocumentAnalyzer.categorizeDocuments(enhancedDocuments);
    
    console.log('[TEST] Document categorization results:');
    Object.entries(categories).forEach(([category, docs]) => {
      console.log(`[TEST] ${category}: ${docs.length} documents`);
      docs.forEach(doc => {
        console.log(`[TEST]   - ${doc.name || doc.filename} (text: ${doc.text ? 'yes' : 'no'})`);
      });
    });

    // Test AI analysis
    const analysis = await panelDocumentAnalyzer.analyzePanelDocuments(enhancedDocuments);
    
    console.log('[TEST] AI analysis results:', {
      confidence: analysis.confidence,
      panelCount: analysis.panels?.length || 0,
      rollCount: analysis.rolls?.length || 0,
      siteInfo: !!analysis.siteInfo,
      materialInfo: !!analysis.materialInfo,
      installationInfo: !!analysis.installationInfo
    });

    res.json({
      success: true,
      testResults: {
        documentsProcessed: enhancedDocuments.length,
        documentsWithText: enhancedDocuments.filter(d => d.text).length,
        categorization: categories,
        analysis: {
          confidence: analysis.confidence,
          panelCount: analysis.panels?.length || 0,
          rollCount: analysis.rolls?.length || 0,
          hasSiteInfo: !!analysis.siteInfo,
          hasMaterialInfo: !!analysis.materialInfo,
          hasInstallationInfo: !!analysis.installationInfo
        }
      }
    });

  } catch (error) {
    console.error('[TEST] Error in document analysis test:', error);
    res.status(500).json({ 
      success: false,
      error: 'Test failed',
      details: error.message 
    });
  }
});

module.exports = router;