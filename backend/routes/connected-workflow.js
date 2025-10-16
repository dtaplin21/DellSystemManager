console.log('✅ connected-workflow.js route file loaded');
const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const aiWorkflowOrchestrator = require('../services/ai-workflow-orchestrator');
const structuredWorkflowOrchestrator = require('../services/structured-workflow-orchestrator');
const projectContextStore = require('../services/project-context-store');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/connected-workflow/status/:projectId
 * Get the current status of connected workflows for a project
 */
router.get('/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const context = await projectContextStore.getProjectContext(projectId);
    const crossInsights = await projectContextStore.getCrossComponentInsights(projectId);
    const aiInsights = await projectContextStore.getAIInsights(projectId);
    
    res.json({
      success: true,
      projectId,
      context: {
        documents: context.documents.length,
        panels: context.panelLayout ? context.panelLayout.panels.length : 0,
        qcRecords: context.qcData.length,
        lastUpdated: context.lastUpdated
      },
      crossInsights,
      aiInsights: Object.keys(aiInsights),
      availableWorkflows: [
        'comprehensive',
        'document_analysis',
        'handwritten_analysis',
        'specification_compliance',
        'panel_optimization',
        'qc_analysis',
        'cross_component',
        'project_management',
        'asbuilt_automation'
      ]
    });
  } catch (error) {
    console.error('Error getting workflow status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/connected-workflow/trigger/:projectId
 * Trigger a specific workflow for a project
 */
router.post('/trigger/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { workflowType = 'comprehensive', triggerSource } = req.body;
    
    console.log(`Triggering ${workflowType} workflow for project ${projectId} from ${triggerSource}`);
    
    if (workflowType === 'asbuilt_automation') {
      const runResult = await structuredWorkflowOrchestrator.runAsbuiltAutomation({
        projectId,
        userId: req.user?.id,
        excelPath: req.body?.excelPath,
        domain: req.body?.domain,
        fileId: req.body?.fileId,
        fileName: req.body?.fileName,
        handwrittenFilePath: req.body?.handwrittenFilePath,
        handwrittenMimeType: req.body?.handwrittenMimeType,
        metadata: req.body?.metadata
      });

      return res.json({
        success: true,
        projectId,
        workflowType,
        triggerSource,
        results: runResult,
        timestamp: new Date().toISOString()
      });
    }

    const results = await aiWorkflowOrchestrator.orchestrateProjectWorkflow(projectId, workflowType);
    
    res.json({
      success: true,
      projectId,
      workflowType,
      triggerSource,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/connected-workflow/auto-trigger/:projectId
 * Automatically trigger appropriate workflows based on data changes
 */
router.post('/auto-trigger/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { changeType, componentType, data } = req.body;
    
    console.log(`Auto-triggering workflows for project ${projectId} due to ${changeType} in ${componentType}`);
    
    // Determine which workflows to trigger based on the change
    const workflowsToTrigger = [];
    
    switch (componentType) {
      case 'documents':
        workflowsToTrigger.push('asbuilt_automation');
        workflowsToTrigger.push('document_analysis');
        if (data.type === 'handwritten') {
          workflowsToTrigger.push('handwritten_analysis');
        }
        workflowsToTrigger.push('specification_compliance');
        workflowsToTrigger.push('cross_component');
        break;
        
      case 'panel_layout':
        workflowsToTrigger.push('panel_optimization');
        workflowsToTrigger.push('specification_compliance');
        workflowsToTrigger.push('cross_component');
        break;
        
      case 'qc_data':
        workflowsToTrigger.push('qc_analysis');
        workflowsToTrigger.push('specification_compliance');
        workflowsToTrigger.push('cross_component');
        break;
        
      case 'project':
        workflowsToTrigger.push('specification_compliance');
        workflowsToTrigger.push('project_management');
        break;
        
      default:
        workflowsToTrigger.push('comprehensive');
    }
    
    // Trigger workflows sequentially
    const results = {};
    for (const workflowType of workflowsToTrigger) {
      try {
        console.log(`Triggering ${workflowType} workflow`);
        results[workflowType] = await aiWorkflowOrchestrator.orchestrateProjectWorkflow(projectId, workflowType);
      } catch (error) {
        console.error(`Error in ${workflowType} workflow:`, error);
        results[workflowType] = { error: error.message };
      }
    }
    
    res.json({
      success: true,
      projectId,
      changeType,
      componentType,
      triggeredWorkflows: workflowsToTrigger,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in auto-trigger:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/connected-workflow/insights/:projectId
 * Get AI insights and recommendations for a project
 */
router.get('/insights/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { insightType } = req.query;
    
    let insights;
    if (insightType) {
      insights = await projectContextStore.getAIInsight(projectId, insightType);
    } else {
      insights = await projectContextStore.getAIInsights(projectId);
    }
    
    res.json({
      success: true,
      projectId,
      insightType: insightType || 'all',
      insights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/connected-workflow/excel-export/:projectId
 * Get Excel export data for handwritten documents
 */
router.get('/excel-export/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { documentName } = req.query;
    
    const excelData = await projectContextStore.getAIInsight(projectId, 'excel_export');
    
    if (!excelData) {
      return res.status(404).json({ 
        success: false, 
        error: 'No Excel export data found for this project' 
      });
    }
    
    // Filter by document name if specified
    if (documentName) {
      const filteredData = excelData.filter(excelExport => 
        excelExport.metadata && excelExport.metadata.documentName === documentName
      );
      
      if (filteredData.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: `No Excel export data found for document: ${documentName}` 
        });
      }
      
      return res.json({
        success: true,
        projectId,
        documentName,
        excelData: filteredData[0],
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      projectId,
      excelData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting Excel export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/connected-workflow/update-context/:projectId
 * Update project context and trigger relevant workflows
 */
router.post('/update-context/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentType, data, action } = req.body;
    
    console.log(`Updating context for project ${projectId}: ${action} ${componentType}`);
    
    // Update the project context
    await projectContextStore.updateProjectContext(projectId, componentType, data, action);
    
    // Trigger relevant workflows based on the update
    const autoTriggerResponse = await fetch(`${req.protocol}://${req.get('host')}/api/connected-workflow/auto-trigger/${projectId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: action,
        componentType,
        data
      })
    });
    
    const autoTriggerResults = await autoTriggerResponse.json();
    
    res.json({
      success: true,
      projectId,
      componentType,
      action,
      contextUpdated: true,
      workflowsTriggered: autoTriggerResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/connected-workflow/recommendations/:projectId
 * Get AI recommendations for a project
 */
router.get('/recommendations/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { category } = req.query;
    
    // Get project management insights
    const context = await projectContextStore.getProjectContext(projectId);
    const projectManagement = await aiWorkflowOrchestrator.runProjectManagementWorkflow(context);
    
    // Get action items
    const actionItems = await aiWorkflowOrchestrator.generateActionItems(context, { projectManagement });
    
    // Get specification compliance
    const compliance = await aiWorkflowOrchestrator.checkSpecificationCompliance(context);
    
    const recommendations = {
      projectManagement: projectManagement,
      actionItems: actionItems,
      specificationCompliance: compliance,
      categories: {
        critical: actionItems.critical || [],
        high: actionItems.high || [],
        medium: actionItems.medium || [],
        low: actionItems.low || []
      }
    };
    
    if (category && recommendations.categories[category]) {
      res.json({
        success: true,
        projectId,
        category,
        recommendations: recommendations.categories[category],
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        projectId,
        recommendations,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Q&A endpoint for project-specific questions
router.post('/ask-question/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'No question provided.' });
    }

    // Get project context
    const context = await projectContextStore.getProjectContext(projectId);

    // Compose context summary for the AI
    const contextSummary = `Project: ${context.project.name}\n` +
      `Description: ${context.project.description || ''}\n` +
      `Documents: ${context.documents.map(d => d.name).join(', ')}\n` +
      `Panel count: ${context.panelLayout ? context.panelLayout.panels.length : 0}\n` +
      `QC records: ${context.qcData.length}`;

    // Call OpenAI with project context and user question
    const response = await aiWorkflowOrchestrator.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert geosynthetic project assistant. Answer user questions using ONLY the context below. If the answer is not in the documents or project context, say so.\n\nContext:\n${contextSummary}`
        },
        {
          role: "user",
          content: question
        }
      ],
      max_tokens: 1200
    });

    res.json({
      answer: response.choices[0].message.content,
      references: [] // Optionally, add document references if you extract them
    });
  } catch (error) {
    console.error('AI Q&A error:', error);
    res.status(500).json({ error: 'Failed to answer question.' });
  }
});

// Set up multer storage for document uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created upload directory:', uploadDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { projectId } = req.params;
    const projectDir = path.join(uploadDir, projectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      console.log('📁 Created project upload directory:', projectDir);
    }
    cb(null, projectDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const originalName = file.originalname;
    const filename = `${timestamp}-${originalName}`;
    console.log('📝 Generated filename:', filename);
    cb(null, filename);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = ['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Excel, Word, text, and CSV files are allowed.'));
    }
  }
});

// Document upload endpoint
router.post('/upload-document/:projectId', auth, upload.single('file'), async (req, res) => {
  console.log('=== Document Upload Request Received ===');
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer [HIDDEN]' : 'none',
    'user-agent': req.headers['user-agent']
  });
  console.log('Request body keys:', Object.keys(req.body || {}));
  console.log('Request files:', req.files ? Object.keys(req.files) : 'none');
  console.log('Request file (single):', req.file ? 'present' : 'none');
  
  try {
    const { projectId } = req.params;
    console.log('Project ID:', projectId);
    console.log('User info:', {
      id: req.user?.id,
      email: req.user?.email,
      displayName: req.user?.displayName
    });
    
    const file = req.file;
    if (!file) {
      console.log('❌ No file uploaded in request.');
      console.log('Request body:', req.body);
      console.log('Request files:', req.files);
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    console.log('✅ File received:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      fieldname: file.fieldname
    });
    
    // Save document metadata in DB
    const docMeta = {
      projectId,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedAt: new Date(),
      uploadedBy: req.user ? req.user.id : 'anonymous',
    };
    
    console.log('💾 Saving document metadata to projectContextStore:', docMeta);
    await projectContextStore.updateDocuments(projectId, docMeta, 'add');
    console.log('✅ Document metadata saved successfully.');
    
    res.json({ success: true, document: docMeta });
  } catch (error) {
    console.error('❌ Document upload failed:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get documents for a project
router.get('/documents/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const context = await projectContextStore.getProjectContext(projectId);
    res.json({ success: true, documents: context.documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 