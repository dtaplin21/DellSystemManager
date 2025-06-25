const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { projects, panels, qcData, documents } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { 
  analyzeDocuments, 
  analyzeQCData, 
  generateRecommendations, 
  generateProjectReport, 
  isOpenAIConfigured 
} = require('../services/ai-connector');

// Simple validation function
const validateObjectId = (id) => {
  return id && typeof id === 'string' && id.length > 0;
};

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
    
    // Get project data for recommendations
    const [projectDocuments] = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));
      
    const [projectQCData] = await db
      .select()
      .from(qcData)
      .where(eq(qcData.projectId, projectId));
      
    const [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    // Generate recommendations
    const recommendations = await generateRecommendations({
      project,
      documents: projectDocuments,
      qcData: projectQCData,
      panelLayout
    });
    
    res.status(200).json(recommendations);
  } catch (error) {
    next(error);
  }
});

// Generate project report
router.post('/:projectId/report', auth, async (req, res, next) => {
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
    
    // Get all project data
    const projectDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));
      
    const projectQCData = await db
      .select()
      .from(qcData)
      .where(eq(qcData.projectId, projectId));
      
    const [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    // Generate comprehensive report
    const report = await generateProjectReport({
      project,
      documents: projectDocuments,
      qcData: projectQCData,
      panelLayout
    });
    
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
});

// Panel layout optimization functions
function optimizePanelLayout(panels, settings, containerWidth, containerHeight) {
  const optimizationMode = settings.mode || 'balanced';
  
  switch (optimizationMode) {
    case 'material':
      return optimizeMaterialEfficiency(panels, containerWidth, containerHeight, settings);
    case 'labor':
      return optimizeLaborEfficiency(panels, containerWidth, containerHeight, settings);
    case 'balanced':
    default:
      return optimizeBalanced(panels, containerWidth, containerHeight, settings);
  }
}

function optimizeMaterialEfficiency(panels, containerWidth, containerHeight, settings) {
  // Sort panels by area (largest first) to maximize material usage
  const sortedPanels = [...panels].sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  let currentX = 0;
  let currentY = 0;
  let maxHeightInRow = 0;
  const optimizedPanels = [];
  
  for (const panel of sortedPanels) {
    // Check if panel fits in current row
    if (currentX + panel.width <= containerWidth) {
      panel.x = currentX;
      panel.y = currentY;
      currentX += panel.width;
      maxHeightInRow = Math.max(maxHeightInRow, panel.height);
    } else {
      // Move to next row
      currentX = 0;
      currentY += maxHeightInRow;
      maxHeightInRow = 0;
      
      // Check if panel fits in new row
      if (currentX + panel.width <= containerWidth) {
        panel.x = currentX;
        panel.y = currentY;
        currentX += panel.width;
        maxHeightInRow = panel.height;
      } else {
        // Panel is too wide, place it anyway and start new row
        panel.x = 0;
        panel.y = currentY;
        currentX = panel.width;
        maxHeightInRow = panel.height;
      }
    }
    
    optimizedPanels.push(panel);
  }
  
  return optimizedPanels;
}

function optimizeLaborEfficiency(panels, containerWidth, containerHeight, settings) {
  // Group panels by type/size to minimize setup changes
  const panelGroups = {};
  
  panels.forEach(panel => {
    const key = `${panel.width}x${panel.height}`;
    if (!panelGroups[key]) {
      panelGroups[key] = [];
    }
    panelGroups[key].push(panel);
  });
  
  const optimizedPanels = [];
  let currentX = 0;
  let currentY = 0;
  let maxHeightInRow = 0;
  
  // Process each group together
  Object.values(panelGroups).forEach(group => {
    group.forEach(panel => {
      if (currentX + panel.width <= containerWidth) {
        panel.x = currentX;
        panel.y = currentY;
        currentX += panel.width;
        maxHeightInRow = Math.max(maxHeightInRow, panel.height);
      } else {
        currentX = 0;
        currentY += maxHeightInRow;
        maxHeightInRow = 0;
        
        panel.x = currentX;
        panel.y = currentY;
        currentX += panel.width;
        maxHeightInRow = panel.height;
      }
      
      optimizedPanels.push(panel);
    });
  });
  
  return optimizedPanels;
}

function optimizeBalanced(panels, containerWidth, containerHeight, settings) {
  // Combine material and labor efficiency
  const materialOptimized = optimizeMaterialEfficiency(panels, containerWidth, containerHeight, settings);
  
  // Apply some labor optimization by grouping similar panels
  const groupedPanels = [];
  const panelGroups = {};
  
  materialOptimized.forEach(panel => {
    const key = `${panel.width}x${panel.height}`;
    if (!panelGroups[key]) {
      panelGroups[key] = [];
    }
    panelGroups[key].push(panel);
  });
  
  // Sort groups by frequency (most common first)
  const sortedGroups = Object.entries(panelGroups)
    .sort(([,a], [,b]) => b.length - a.length)
    .flatMap(([, group]) => group);
  
  return sortedGroups;
}

function resolveOverlaps(panels, settings) {
  const overlapThreshold = settings.overlapThreshold || 0.1;
  
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const panelA = panels[i];
      const panelB = panels[j];
      
      // Check for overlap
      const overlapX = Math.max(0, Math.min(panelA.x + panelA.width, panelB.x + panelB.width) - Math.max(panelA.x, panelB.x));
      const overlapY = Math.max(0, Math.min(panelA.y + panelA.height, panelB.y + panelB.height) - Math.max(panelA.y, panelB.y));
      
      if (overlapX > overlapThreshold && overlapY > overlapThreshold) {
        // Move panelB to avoid overlap
        panelB.x = panelA.x + panelA.width + overlapThreshold;
      }
    }
  }
  
  return panels;
}

module.exports = router;