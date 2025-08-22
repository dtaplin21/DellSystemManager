const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { projects, panels } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { wsSendToRoom } = require('../services/websocket');

// Constants for default layout
const DEFAULT_LAYOUT_WIDTH = 4000;
const DEFAULT_LAYOUT_HEIGHT = 4000;
const DEFAULT_SCALE = 1.0;

// Panel validation function
const validatePanel = (panel) => {
  if (!panel || typeof panel !== 'object') return false;
  
  const requiredFields = ['id', 'shape', 'x', 'y', 'width', 'height'];
  return requiredFields.every(field => panel.hasOwnProperty(field));
};

// Map panel to canonical format
const mapPanelToCanonical = (panel) => ({
  id: panel.id,
  shape: panel.shape || 'rectangle',
  x: panel.x || 0,
  y: panel.y || 0,
  width: panel.width || 100,
  height: panel.height || 100,
  length: panel.length || panel.height || 100,
  rotation: panel.rotation || 0,
  fill: panel.fill || '#3b82f6',
  color: panel.color || '#3b82f6',
  rollNumber: panel.rollNumber || '',
  panelNumber: panel.panelNumber || '',
  date: panel.date || new Date().toISOString(),
  location: panel.location || '',
  meta: {
    repairs: panel.meta?.repairs || [],
    location: panel.meta?.location || { x: panel.x || 0, y: panel.y || 0, gridCell: { row: 0, col: 0 } }
  }
});

// Get panel layout for a project
router.get('/layout/:projectId', async (req, res, next) => {
  // Apply auth middleware for production
  try {
    await auth(req, res, () => {});
  } catch (error) {
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    const { projectId } = req.params;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    let [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get panel layout
    let [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    // If layout doesn't exist, create a default one
    if (!panelLayout) {
      [panelLayout] = await db
        .insert(panels)
        .values({
          id: uuidv4(),
          projectId,
          panels: '[]', // Empty array as string
          width: DEFAULT_LAYOUT_WIDTH,
          height: DEFAULT_LAYOUT_HEIGHT,
          scale: DEFAULT_SCALE,
          lastUpdated: new Date(),
        })
        .returning();
    }
    
    // Parse the panels JSON string to an actual array
    let parsedPanels = [];
    try {
      if (panelLayout.panels && typeof panelLayout.panels === 'string') {
        parsedPanels = JSON.parse(panelLayout.panels);
      } else if (Array.isArray(panelLayout.panels)) {
        parsedPanels = panelLayout.panels;
      } else {
        parsedPanels = [];
      }
    } catch (parseError) {
      console.error('🔍 Error parsing panels JSON:', parseError);
      parsedPanels = [];
    }
    
    const parsedLayout = {
      ...panelLayout,
      panels: parsedPanels,
      width: typeof panelLayout.width === 'number' ? panelLayout.width : DEFAULT_LAYOUT_WIDTH,
      height: typeof panelLayout.height === 'number' ? panelLayout.height : DEFAULT_LAYOUT_HEIGHT,
      scale: typeof panelLayout.scale === 'number' ? panelLayout.scale : DEFAULT_SCALE,
    };
    
    res.status(200).json(parsedLayout);
  } catch (error) {
    console.error('❌ Error in GET /layout/:projectId:', error);
    next(error);
  }
});

// Update panel layout
router.patch('/layout/:projectId', async (req, res, next) => {
  // Apply auth middleware for production
  try {
    await auth(req, res, () => {});
  } catch (error) {
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    res.setHeader('Cache-Control', 'no-store');
    const { projectId } = req.params;
    const updateData = req.body;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    let [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get existing panel layout
    let [existingLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    // If layout doesn't exist, create a default one
    if (!existingLayout) {
      [existingLayout] = await db
        .insert(panels)
        .values({
          id: uuidv4(),
          projectId,
          panels: '[]',
          width: DEFAULT_LAYOUT_WIDTH,
          height: DEFAULT_LAYOUT_HEIGHT,
          scale: DEFAULT_SCALE,
          lastUpdated: new Date(),
        })
        .returning();
    }
    
    // Parse existing panels
    let currentPanels = [];
    try {
      currentPanels = JSON.parse(existingLayout.panels || '[]');
    } catch (parseError) {
      console.error('Error parsing existing panels:', parseError);
      currentPanels = [];
    }
    
    // Update panels if provided
    if (updateData.panels && Array.isArray(updateData.panels)) {
      // Validate all panels before updating
      const validPanels = updateData.panels.filter(panel => validatePanel(panel));
      
      if (validPanels.length !== updateData.panels.length) {
        console.warn('Some panels were invalid and were filtered out');
      }
      
      // Update the layout with new panels
      const [updatedLayout] = await db
        .update(panels)
        .set({
          panels: JSON.stringify(validPanels),
          width: updateData.width || existingLayout.width,
          height: updateData.height || existingLayout.height,
          scale: updateData.scale || existingLayout.scale,
          lastUpdated: new Date(),
        })
        .where(eq(panels.projectId, projectId))
        .returning();
      
      // Parse the panels for the response
      const parsedLayout = {
        ...updatedLayout,
        width: typeof updatedLayout.width === 'number' ? updatedLayout.width : DEFAULT_LAYOUT_WIDTH,
        height: typeof updatedLayout.height === 'number' ? updatedLayout.height : DEFAULT_LAYOUT_HEIGHT,
        scale: typeof updatedLayout.scale === 'number' ? updatedLayout.scale : DEFAULT_SCALE,
        panels: JSON.parse(updatedLayout.panels || '[]').map(mapPanelToCanonical),
      };
      
      // Notify other clients via WebSockets
      wsSendToRoom(`panel_layout_${projectId}`, {
        type: 'PANEL_UPDATE',
        projectId,
        panels: JSON.parse(updatedLayout.panels || '[]'),
        userId: req.user.id,
        timestamp: updatedLayout.lastUpdated,
      });
      
      res.status(200).json(parsedLayout);
    } else {
      // No panels provided, return existing layout
      const parsedLayout = {
        ...existingLayout,
        width: typeof existingLayout.width === 'number' ? existingLayout.width : DEFAULT_LAYOUT_WIDTH,
        height: typeof existingLayout.height === 'number' ? existingLayout.height : DEFAULT_LAYOUT_HEIGHT,
        scale: typeof existingLayout.scale === 'number' ? existingLayout.scale : DEFAULT_SCALE,
        panels: currentPanels.map(mapPanelToCanonical),
      };
      
      res.status(200).json(parsedLayout);
    }
  } catch (error) {
    console.error('❌ Error in PATCH /layout/:projectId:', error);
    next(error);
  }
});

// Get panel requirements for a project
router.get('/requirements/:projectId', async (req, res, next) => {
  // Apply auth middleware for production
  try {
    await auth(req, res, () => {});
  } catch (error) {
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    const { projectId } = req.params;
    
    // Verify project access
    let [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get panel requirements from the database
    const { data: requirements, error } = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    if (error) {
      console.error('Error fetching panel requirements:', error);
      return res.status(500).json({ message: 'Failed to fetch panel requirements' });
    }
    
    res.status(200).json(requirements || []);
  } catch (error) {
    console.error('❌ Error in GET /requirements/:projectId:', error);
    next(error);
  }
});

module.exports = router;
