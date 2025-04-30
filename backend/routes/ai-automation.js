const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { projects, panels, qcData, documents } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { validateObjectId } = require('../utils/validate');
const { 
  analyzeDocuments, 
  analyzeQCData, 
  generateRecommendations, 
  generateProjectReport, 
  isOpenAIConfigured 
} = require('../services/ai-connector');

// Check if AI is available
router.get('/status', (req, res) => {
  const aiStatus = {
    openai: isOpenAIConfigured(),
    availableFeatures: {
      documentAnalysis: true,
      qcDataAnalysis: true,
      panelLayoutOptimization: true,
      recommendations: isOpenAIConfigured(),
      reporting: isOpenAIConfigured()
    }
  };
  
  res.status(200).json(aiStatus);
});

// Auto-analyze documents for a project
router.post('/:projectId/analyze-documents', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Check if user has access to this project
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
      
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get project documents
    const projectDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));
      
    if (projectDocuments.length === 0) {
      return res.status(404).json({ message: 'No documents found for this project' });
    }
    
    // Perform AI analysis
    const analysisResult = await analyzeDocuments(
      projectDocuments, 
      req.body.question || 'Analyze these documents for project insights'
    );
    
    res.status(200).json(analysisResult);
  } catch (error) {
    next(error);
  }
});

// Auto-analyze QC data for a project
router.post('/:projectId/analyze-qc-data', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Check if user has access to this project
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
      
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get project QC data
    const projectQCData = await db
      .select()
      .from(qcData)
      .where(eq(qcData.projectId, projectId));
      
    if (projectQCData.length === 0) {
      return res.status(404).json({ message: 'No QC data found for this project' });
    }
    
    // Perform AI analysis
    const analysisResult = await analyzeQCData(projectQCData);
    
    res.status(200).json(analysisResult);
  } catch (error) {
    next(error);
  }
});

// Auto-optimize panel layout for a project
router.post('/:projectId/optimize-panels', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { optimizationSettings } = req.body;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Check if user has access to this project
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
      
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get current panel layout
    const [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
      
    if (!panelLayout) {
      return res.status(404).json({ message: 'No panel layout found for this project' });
    }
    
    // Parse the panels JSON
    let currentPanels;
    try {
      currentPanels = JSON.parse(panelLayout.panels);
    } catch (error) {
      return res.status(500).json({ message: 'Error parsing panel data' });
    }
    
    // Apply optimization algorithm
    const optimizedPanels = optimizePanelLayout(currentPanels, optimizationSettings || {}, panelLayout.width, panelLayout.height);
    
    // Update the panel layout
    const [updatedLayout] = await db
      .update(panels)
      .set({
        panels: JSON.stringify(optimizedPanels),
        lastUpdated: new Date().toISOString(),
      })
      .where(eq(panels.projectId, projectId))
      .returning();
      
    res.status(200).json({ 
      layout: updatedLayout,
      optimizedPanels,
      message: 'Panel layout optimized successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Generate recommendations for a project
router.post('/:projectId/recommendations', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Check if user has access to this project
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
      
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get project data
    const [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
      
    const projectQCData = await db
      .select()
      .from(qcData)
      .where(eq(qcData.projectId, projectId));
      
    const projectDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));
    
    // Assemble project data for AI analysis
    const projectData = {
      project,
      panelLayout: panelLayout || { width: 0, height: 0, panels: '[]' },
      qcData: projectQCData || [],
      documents: projectDocuments || []
    };
    
    // Generate recommendations
    const recommendations = await generateRecommendations(projectData);
    
    res.status(200).json(recommendations);
  } catch (error) {
    next(error);
  }
});

// Generate project report
router.post('/:projectId/generate-report', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { reportType = 'summary' } = req.body;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Validate report type
    if (!['summary', 'technical', 'compliance'].includes(reportType)) {
      return res.status(400).json({ message: 'Invalid report type' });
    }
    
    // Check if user has access to this project
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
      
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get project data
    const [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
      
    const projectQCData = await db
      .select()
      .from(qcData)
      .where(eq(qcData.projectId, projectId));
      
    const projectDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));
    
    // Assemble project data for AI analysis
    const projectData = {
      project,
      panelLayout: panelLayout || { width: 0, height: 0, panels: '[]' },
      qcData: projectQCData || [],
      documents: projectDocuments || []
    };
    
    // Generate report
    const report = await generateProjectReport(projectData, reportType);
    
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
});

// Helper function to optimize panel layout
function optimizePanelLayout(panels, settings, containerWidth, containerHeight) {
  // Default settings
  const defaults = {
    minimumPanelWidth: 2,
    minimumPanelHeight: 2,
    wasteReduction: 90,
    respectExisting: true,
    panelAlignment: 75
  };
  
  // Merge with provided settings
  const optimizationSettings = { ...defaults, ...settings };
  
  // Clone panels to avoid modifying the original
  const optimizedPanels = JSON.parse(JSON.stringify(panels));
  
  // Apply optimization logic
  for (let panel of optimizedPanels) {
    // Ensure minimum dimensions
    if (panel.width < optimizationSettings.minimumPanelWidth) {
      panel.width = optimizationSettings.minimumPanelWidth;
    }
    
    if (panel.height < optimizationSettings.minimumPanelHeight) {
      panel.height = optimizationSettings.minimumPanelHeight;
    }
    
    // Panel alignment (snap to grid)
    if (optimizationSettings.panelAlignment > 50) {
      // Snap to integer grid
      panel.x = Math.round(panel.x);
      panel.y = Math.round(panel.y);
      panel.width = Math.round(panel.width);
      panel.height = Math.round(panel.height);
    }
    
    // Respect container bounds
    if (panel.x + panel.width > containerWidth) {
      panel.width = containerWidth - panel.x;
    }
    
    if (panel.y + panel.height > containerHeight) {
      panel.height = containerHeight - panel.y;
    }
  }
  
  // More sophisticated waste reduction algorithm would go here
  // For real implementation, this would use AI to optimize the layout
  
  return optimizedPanels;
}

module.exports = router;