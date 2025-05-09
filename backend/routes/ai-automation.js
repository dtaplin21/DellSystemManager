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
    panelAlignment: 75,
    optimizationStrategy: 'material-efficient', // 'material-efficient', 'labor-efficient', 'balanced'
    gridSize: 20,
    marginBetweenPanels: 5
  };
  
  // Merge with provided settings
  const optimizationSettings = { ...defaults, ...settings };
  
  // Clone panels to avoid modifying the original
  const optimizedPanels = JSON.parse(JSON.stringify(panels));
  
  // First pass: Apply basic constraints and align to grid
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
      const gridSize = optimizationSettings.gridSize;
      panel.x = Math.round(panel.x / gridSize) * gridSize;
      panel.y = Math.round(panel.y / gridSize) * gridSize;
      panel.width = Math.round(panel.width / gridSize) * gridSize;
      panel.height = Math.round(panel.height / gridSize) * gridSize;
    }
    
    // Respect container bounds
    if (panel.x + panel.width > containerWidth) {
      if (panel.x > containerWidth / 2) {
        panel.x = containerWidth - panel.width;
      } else {
        panel.width = containerWidth - panel.x;
      }
    }
    
    if (panel.y + panel.height > containerHeight) {
      if (panel.y > containerHeight / 2) {
        panel.y = containerHeight - panel.height;
      } else {
        panel.height = containerHeight - panel.y;
      }
    }
  }
  
  // Second pass: Apply optimization strategy
  switch (optimizationSettings.optimizationStrategy) {
    case 'material-efficient':
      // Group panels by material type and organize them to minimize waste
      optimizeMaterialEfficiency(optimizedPanels, containerWidth, containerHeight, optimizationSettings);
      break;
      
    case 'labor-efficient':
      // Organize panels to minimize seam lengths and optimize for installation
      optimizeLaborEfficiency(optimizedPanels, containerWidth, containerHeight, optimizationSettings);
      break;
      
    case 'balanced':
    default:
      // A compromise between material and labor efficiency
      optimizeBalanced(optimizedPanels, containerWidth, containerHeight, optimizationSettings);
      break;
  }
  
  // Third pass: Resolve any panel overlaps
  resolveOverlaps(optimizedPanels, optimizationSettings);
  
  return optimizedPanels;
}

// Function to optimize for material efficiency
function optimizeMaterialEfficiency(panels, containerWidth, containerHeight, settings) {
  // Group panels by material type
  const materialGroups = {};
  
  panels.forEach(panel => {
    const material = panel.material || 'unknown';
    if (!materialGroups[material]) {
      materialGroups[material] = [];
    }
    materialGroups[material].push(panel);
  });
  
  // For each material group, arrange panels in a grid pattern to minimize waste
  let yOffset = 0;
  const margin = settings.marginBetweenPanels;
  
  Object.keys(materialGroups).forEach(material => {
    const groupPanels = materialGroups[material];
    
    // Sort panels by width (descending)
    groupPanels.sort((a, b) => b.width - a.width);
    
    let currentRowWidth = 0;
    let currentRowHeight = 0;
    let xPosition = 0;
    
    groupPanels.forEach(panel => {
      // Check if adding this panel exceeds container width
      if (xPosition + panel.width > containerWidth) {
        // Move to next row
        xPosition = 0;
        yOffset += currentRowHeight + margin;
        currentRowHeight = 0;
      }
      
      // Position the panel
      panel.x = xPosition;
      panel.y = yOffset;
      
      // Update current row info
      currentRowWidth = xPosition + panel.width;
      currentRowHeight = Math.max(currentRowHeight, panel.height);
      
      // Prepare for next panel
      xPosition += panel.width + margin;
    });
    
    // Move to next material group
    yOffset += currentRowHeight + margin * 2;
  });
}

// Function to optimize for labor efficiency
function optimizeLaborEfficiency(panels, containerWidth, containerHeight, settings) {
  // Group panels by seam type
  const seamGroups = {};
  
  panels.forEach(panel => {
    const seamType = panel.seamsType || 'unknown';
    if (!seamGroups[seamType]) {
      seamGroups[seamType] = [];
    }
    seamGroups[seamType].push(panel);
  });
  
  // For each seam group, arrange panels to minimize total seam length
  let yOffset = 0;
  const margin = settings.marginBetweenPanels;
  
  Object.keys(seamGroups).forEach(seamType => {
    const groupPanels = seamGroups[seamType];
    
    // For labor efficiency, we want to minimize the number of seams
    // Larger panels should be placed first
    groupPanels.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    // Place panels in a spiral pattern starting from center
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    let angle = 0;
    let radius = 0;
    const radiusIncrement = 50;
    
    groupPanels.forEach((panel, index) => {
      if (index === 0) {
        // Place first (largest) panel at center
        panel.x = centerX - panel.width / 2;
        panel.y = centerY - panel.height / 2;
      } else {
        // Place subsequent panels in a spiral
        angle += Math.PI / 4;
        if (index % 8 === 0) {
          radius += radiusIncrement;
        }
        
        panel.x = centerX + radius * Math.cos(angle) - panel.width / 2;
        panel.y = centerY + radius * Math.sin(angle) - panel.height / 2;
        
        // Ensure panel stays within bounds
        panel.x = Math.max(0, Math.min(containerWidth - panel.width, panel.x));
        panel.y = Math.max(0, Math.min(containerHeight - panel.height, panel.y));
      }
    });
  });
}

// Function for balanced optimization
function optimizeBalanced(panels, containerWidth, containerHeight, settings) {
  // Combination of both strategies
  // Sort panels by area (largest first)
  panels.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  const margin = settings.marginBetweenPanels;
  let rowHeight = 0;
  let xPosition = margin;
  let yPosition = margin;
  
  panels.forEach(panel => {
    // Check if we need to start a new row
    if (xPosition + panel.width + margin > containerWidth) {
      xPosition = margin;
      yPosition += rowHeight + margin;
      rowHeight = 0;
    }
    
    // Position panel
    panel.x = xPosition;
    panel.y = yPosition;
    
    // Update position for next panel
    xPosition += panel.width + margin;
    rowHeight = Math.max(rowHeight, panel.height);
  });
}

// Function to resolve overlaps between panels
function resolveOverlaps(panels, settings) {
  const margin = settings.marginBetweenPanels;
  
  // Check each pair of panels for overlap
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const a = panels[i];
      const b = panels[j];
      
      // Check if panels overlap
      if (a.x < b.x + b.width && a.x + a.width > b.x &&
          a.y < b.y + b.height && a.y + a.height > b.y) {
        
        // Calculate overlap amounts in each direction
        const overlapLeft = (a.x + a.width) - b.x;
        const overlapRight = (b.x + b.width) - a.x;
        const overlapTop = (a.y + a.height) - b.y;
        const overlapBottom = (b.y + b.height) - a.y;
        
        // Find the smallest overlap direction
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        
        if (minOverlap === overlapLeft) {
          // Move panel B to the right
          b.x += overlapLeft + margin;
        } else if (minOverlap === overlapRight) {
          // Move panel A to the right
          a.x += overlapRight + margin;
        } else if (minOverlap === overlapTop) {
          // Move panel B down
          b.y += overlapTop + margin;
        } else {
          // Move panel A down
          a.y += overlapBottom + margin;
        }
      }
    }
  }
}

module.exports = router;