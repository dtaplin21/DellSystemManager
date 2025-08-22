const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middlewares/auth');
const { subscriptionCheck } = require('../middlewares/subscription');
// const { validateObjectId } = require('../utils/validate');
const { db } = require('../db');
const { panels, projects } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { wsSendToRoom } = require('../services/websocket');
const axios = require('axios');
const { z } = require('zod');

const DEFAULT_LAYOUT_WIDTH = 15000;
const DEFAULT_LAYOUT_HEIGHT = 15000;
const DEFAULT_SCALE = 1.0; // Reasonable default scale - 1.0 means no scaling

const CanonicalPanelSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  panelNumber: z.string(),
  length: z.number(),
  width: z.number(),
  rollNumber: z.string(),
  location: z.string().optional(),
  x: z.number(),
  y: z.number(),
  shape: z.string(),
  points: z.array(z.number()).optional(),
  radius: z.number().optional(),
  rotation: z.number().optional(),
  fill: z.string(),
  color: z.string(),
});

function validatePanel(panel) {
  const result = CanonicalPanelSchema.safeParse(panel);
  if (!result.success) {
    console.warn('Panel validation failed:', result.error.errors, panel);
    return false;
  }
  return true;
}

function mapPanelToCanonical(panel) {
  return {
    id: panel.id || panel.panel_id || uuidv4(), // Generate UUID if no ID exists
    date: panel.date || '',
    panelNumber: panel.panel_number || panel.panelNumber || '',
    length: panel.length || panel.height || panel.height_feet || 0, // Handle height_feet from frontend
    width: panel.width || panel.width_feet || 0, // Handle width_feet from frontend
    rollNumber: panel.roll_number || panel.rollNumber || '',
    location: panel.location || '',
    x: panel.x || 0,
    y: panel.y || 0,
    shape: panel.shape || panel.type || 'rectangle', // Handle type from frontend
    points: panel.points,
    radius: panel.radius,
    rotation: panel.rotation || 0,
    fill: panel.fill || '#3b82f6',
    color: panel.color || panel.fill || panel.stroke || '#3b82f6', // Handle stroke from frontend
  };
}

// Get panel layout for a project
router.get('/layout/:projectId', async (req, res, next) => {
  // Development mode bypass
  if (process.env.NODE_ENV === 'development' && req.headers['x-development-mode'] === 'true') {
    console.log('🔧 [DEV] Development mode bypass for panel layout');
    req.user = { id: '00000000-0000-0000-0000-000000000000', email: 'dev@example.com', isAdmin: true };
  } else {
    // Apply auth middleware for production
    try {
      await auth(req, res, () => {});
    } catch (error) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
  }
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const { projectId } = req.params;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access - GET ROUTE
    let [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    // In development mode, if no project found, try to find any project with this ID
    if (!project && process.env.NODE_ENV === 'development' && req.headers['x-development-mode'] === 'true') {
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
    }
    
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
  // Development mode bypass
  if (process.env.NODE_ENV === 'development' && req.headers['x-development-mode'] === 'true') {
    console.log('🔧 [DEV] Development mode bypass for panel layout update');
    req.user = { id: '00000000-0000-0000-0000-000000000000', email: 'dev@example.com', isAdmin: true };
  } else {
    // Apply auth middleware for production
    try {
      await auth(req, res, () => {});
    } catch (error) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
  }
  try {
    res.setHeader('Cache-Control', 'no-store');
    const { projectId } = req.params;
    const updateData = req.body;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access - PATCH ROUTE
    let [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    // In development mode, if no project found, try to find any project with this ID
    if (!project && process.env.NODE_ENV === 'development' && req.headers['x-development-mode'] === 'true') {
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
    }
    
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

// Export panel layout to CAD format
router.get('/export/:projectId', auth, subscriptionCheck('premium'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { format = 'dwg' } = req.query;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Validate format
    if (!['dwg', 'dxf'].includes(format)) {
      return res.status(400).json({ message: 'Invalid format. Supported formats: dwg, dxf' });
    }
    
    // Verify project access
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
    
    // Get panel layout
    const [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    if (!panelLayout) {
      return res.status(404).json({ message: 'Panel layout not found' });
    }
    
    // Parse panels
    const parsedPanels = JSON.parse(panelLayout.panels || '[]');
    
    // Call CAD service for conversion
    try {
      const cadServiceUrl = process.env.CAD_SERVICE_URL || 'http://localhost:5002';
      
      const response = await axios.post(
        `${cadServiceUrl}/export`,
        {
          panels: parsedPanels,
          width: panelLayout.width,
          height: panelLayout.height,
          scale: panelLayout.scale,
          format,
          projectName: project.name,
        },
        {
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'application/octet-stream'
          }
        }
      );
      
      // Set response headers for file download
      res.setHeader('Content-Type', format === 'dwg' ? 'application/acad' : 'application/dxf');
      res.setHeader('Content-Disposition', `attachment; filename="panel_layout_${projectId}.${format}"`);
      
      // Send the file data
      res.send(Buffer.from(response.data));
    } catch (cadError) {
      console.error('CAD service error:', cadError);
      res.status(500).json({ message: 'Failed to export to CAD format' });
    }
  } catch (error) {
    console.error('Export error:', error);
    next(error);
  }
});

module.exports = router;
