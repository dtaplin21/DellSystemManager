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

// Enhanced AI layout generation endpoint with action-based system
router.post('/automate-layout', requireAuth, async (req, res) => {
  try {
    const { projectId, documents, siteConstraints = {} } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    console.log(`[AI ROUTE] Starting enhanced layout generation for project ${projectId}`);
    console.log(`[AI ROUTE] Documents provided: ${documents?.length || 0}`);

    // Set job status to processing
    jobStatus.set(projectId, {
      status: 'processing',
      created_at: new Date().toISOString(),
      completed_at: null
    });

    // Enhance documents with text content if not already present
    let enhancedDocuments = documents || [];
    if (enhancedDocuments.length > 0) {
      console.log('[AI ROUTE] Enhancing documents with text content...');
      
      try {
        // Import document service to fetch text content
        const documentService = require('../services/documentService');
        
        enhancedDocuments = await Promise.all(
          enhancedDocuments.map(async (doc) => {
            if (!doc.text && doc.id) {
              try {
                console.log(`[AI ROUTE] Fetching text for document: ${doc.name || doc.id}`);
                const documentText = await documentService.getDocumentText(doc.id);
                return {
                  ...doc,
                  text: documentText,
                  filename: doc.name || doc.filename
                };
              } catch (textError) {
                console.warn(`[AI ROUTE] Could not fetch text for document ${doc.id}:`, textError.message);
                return doc;
              }
            }
            return {
              ...doc,
              filename: doc.name || doc.filename
            };
          })
        );
        
        console.log(`[AI ROUTE] Enhanced ${enhancedDocuments.length} documents with text content`);
        console.log(`[AI ROUTE] Documents with text: ${enhancedDocuments.filter(d => d.text).length}`);
      } catch (enhanceError) {
        console.warn('[AI ROUTE] Error enhancing documents with text:', enhanceError.message);
        // Continue with original documents if enhancement fails
      }
    }

    // Import the enhanced AI layout generator
    const enhancedAILayoutGenerator = require('../services/enhancedAILayoutGenerator');

    // Generate AI layout actions using enhanced generator with text content
    const result = await enhancedAILayoutGenerator.generateLayoutActions(enhancedDocuments, projectId);

    console.log(`[AI ROUTE] Enhanced AI generation result status: ${result.status}`);

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
        analysis: result.analysis
      });

      res.json({
        success: false,
        status: 'insufficient_information',
        message: result.guidance.title,
        guidance: result.guidance,
        missingParameters: result.missingParameters,
        analysis: result.analysis,
        jobId: projectId
      });
      return;
    }

    if (!result.success) {
      console.warn('[AI ROUTE] Enhanced AI generation failed, using fallback actions');
      
      // Import the original AI layout generator for fallback
      const aiLayoutGenerator = require('../services/aiLayoutGenerator');
      const fallbackResult = aiLayoutGenerator.generateFallbackActions(siteConstraints);
      
      // Update job status with fallback actions
      jobStatus.set(projectId, {
        status: 'completed_fallback',
        created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        actions: fallbackResult.actions,
        summary: fallbackResult.summary,
        isFallback: true,
        guidance: {
          title: 'Fallback Mode',
          message: 'AI generation failed, using default panel layout. Please check your documents and try again.',
          requiredDocuments: ['Panel specifications', 'Site plan', 'Material specifications'],
          recommendedActions: ['Upload properly formatted documents', 'Check document content', 'Try again with different documents']
        }
      });

      res.json({
        success: true,
        status: 'fallback',
        message: 'Layout generation completed (fallback mode)',
        actions: fallbackResult.actions,
        summary: fallbackResult.summary,
        guidance: {
          title: 'Fallback Mode',
          message: 'AI generation failed, using default panel layout. Please check your documents and try again.',
          requiredDocuments: ['Panel specifications', 'Site plan', 'Material specifications'],
          recommendedActions: ['Upload properly formatted documents', 'Check document content', 'Try again with different documents']
        },
        jobId: projectId,
        isFallback: true
      });
      return;
    }

    console.log(`[AI ROUTE] Enhanced AI generation successful. Generated ${result.actions.length} actions`);
    console.log(`[AI ROUTE] Analysis confidence: ${result.analysis?.confidence || 0}`);
    if (result.warnings && result.warnings.length > 0) {
      console.log(`[AI ROUTE] Warnings: ${result.warnings.length}`);
    }

    // Update job status with generated actions
    jobStatus.set(projectId, {
      status: 'completed',
      created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      actions: result.actions,
      summary: result.summary,
      analysis: result.analysis,
      warnings: result.warnings,
      guidance: result.guidance,
      tokensUsed: result.tokensUsed
    });

    res.json({
      success: true,
      status: 'success',
      message: 'Enhanced AI layout actions generated successfully',
      actions: result.actions,
      summary: result.summary,
      analysis: result.analysis,
      warnings: result.warnings,
      guidance: result.guidance,
      jobId: projectId,
      tokensUsed: result.tokensUsed
    });

  } catch (error) {
    console.error('[AI ROUTE] Error in enhanced AI layout generation:', error);
    
    // Update job status to failed
    if (req.body.projectId) {
      jobStatus.set(req.body.projectId, {
        status: 'failed',
        created_at: jobStatus.get(req.body.projectId)?.created_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error: error.message,
        guidance: {
          title: 'System Error',
          message: 'An error occurred while processing your documents. Please try again.',
          requiredDocuments: [],
          recommendedActions: ['Check document format', 'Ensure documents contain panel information', 'Try uploading different documents']
        }
      });
    }

    res.status(500).json({ 
      success: false,
      status: 'error',
      error: 'Failed to generate enhanced AI layout',
      details: error.message,
      guidance: {
        title: 'System Error',
        message: 'An error occurred while processing your documents. Please try again.',
        requiredDocuments: [],
        recommendedActions: ['Check document format', 'Ensure documents contain panel information', 'Try uploading different documents']
      }
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
            const newPanel = await panelLayoutService.createPanel(projectId, action.payload);
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
              action.payload.panelId, 
              action.payload.newPosition
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
              action.payload.panelId
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