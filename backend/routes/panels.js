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
const DEFAULT_SCALE = 0.0025;

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
    id: panel.id || panel.panel_id,
    date: panel.date || '',
    panelNumber: panel.panel_number || panel.panelNumber || '',
    length: panel.length || panel.height || 0,
    width: panel.width || 0,
    rollNumber: panel.roll_number || panel.rollNumber || '',
    location: panel.location || '',
    x: panel.x || 0,
    y: panel.y || 0,
    shape: panel.shape || panel.type || 'rectangle',
    points: panel.points,
    radius: panel.radius,
    rotation: panel.rotation || 0,
    fill: panel.fill || '#3b82f6',
    color: panel.color || panel.fill || '#3b82f6',
  };
}

// Get panel layout for a project
router.get('/layout/:projectId', auth, async (req, res, next) => {
  try {
    console.log('🔍 GET /layout/:projectId called');
    console.log('🔍 Project ID:', req.params.projectId);
    console.log('🔍 User:', req.user);
    
    // Set cache control headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const { projectId } = req.params;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      console.log('❌ Invalid project ID');
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    console.log('🔍 Checking project access...');
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    console.log('🔍 Project found:', !!project);
    
    if (!project) {
      console.log('❌ Project not found');
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get panel layout
    console.log('🔍 Getting panel layout...');
    let [panelLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    console.log('🔍 Panel layout found:', !!panelLayout);
    
    // If layout doesn't exist, create a default one
    if (!panelLayout) {
      console.log('🔍 Creating default panel layout...');
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
      console.log('🔍 Default layout created:', !!panelLayout);
    }
    
    // Parse the panels JSON string to an actual array
    const parsedLayout = {
      ...panelLayout,
      width: typeof panelLayout.width === 'number' ? panelLayout.width : DEFAULT_LAYOUT_WIDTH,
      height: typeof panelLayout.height === 'number' ? panelLayout.height : DEFAULT_LAYOUT_HEIGHT,
      scale: typeof panelLayout.scale === 'number' ? panelLayout.scale : DEFAULT_SCALE,
      panels: JSON.parse(panelLayout.panels || '[]').map(mapPanelToCanonical),
    };
    
    console.log('✅ Panels loaded from DB:', parsedLayout.panels);
    res.status(200).json(parsedLayout);
  } catch (error) {
    console.error('❌ Error in GET /layout/:projectId:', error);
    next(error);
  }
});

// Update panel layout
router.patch('/layout/:projectId', auth, subscriptionCheck('premium'), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    console.log('🔍 PATCH /layout/:projectId called');
    console.log('🔍 Project ID:', req.params.projectId);
    console.log('🔍 Request body:', req.body);
    console.log('🔍 User:', req.user);
    
    const { projectId } = req.params;
    const updateData = req.body;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      console.log('❌ Invalid project ID');
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    console.log('🔍 Checking project access...');
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    console.log('🔍 Project found:', !!project);
    
    if (!project) {
      console.log('❌ Project not found');
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get existing layout
    console.log('🔍 Getting existing layout...');
    const [existingLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    console.log('🔍 Existing layout found:', !!existingLayout);
    
    if (!existingLayout) {
      console.log('❌ Panel layout not found');
      return res.status(404).json({ message: 'Panel layout not found' });
    }
    
    // Prepare update data
    const updateValues = {};
    
    // Handle panels array - we store it as a JSON string in the database
    if (updateData.panels) {
      // Ensure every panel is mapped to canonical format
      updateData.panels = updateData.panels.map(mapPanelToCanonical);
      // Validate all panels
      updateData.panels = updateData.panels.filter(validatePanel);
      updateValues.panels = JSON.stringify(updateData.panels);
      console.log('\ud83d\udd0d Panels being saved to DB:', updateData.panels);
    }
    
    // Handle other properties
    if (updateData.width !== undefined) updateValues.width = updateData.width;
    if (updateData.height !== undefined) updateValues.height = updateData.height;
    if (updateData.scale !== undefined) updateValues.scale = updateData.scale;
    
    // Always update lastUpdated timestamp
    updateValues.lastUpdated = new Date();
    
    console.log('🔍 Update values:', updateValues);
    
    // Update panel layout
    console.log('🔍 Updating panel layout...');
    const [updatedLayout] = await db
      .update(panels)
      .set(updateValues)
      .where(eq(panels.projectId, projectId))
      .returning();
    
    console.log('🔍 Update successful:', !!updatedLayout);
    
    // Parse the panels for the response
    const parsedLayout = {
      ...updatedLayout,
      width: typeof updatedLayout.width === 'number' ? updatedLayout.width : DEFAULT_LAYOUT_WIDTH,
      height: typeof updatedLayout.height === 'number' ? updatedLayout.height : DEFAULT_LAYOUT_HEIGHT,
      scale: typeof updatedLayout.scale === 'number' ? updatedLayout.scale : DEFAULT_SCALE,
      panels: JSON.parse(updatedLayout.panels || '[]').map(mapPanelToCanonical),
    };
    console.log('✅ Panels returned to client:', parsedLayout.panels);
    
    // Notify other clients via WebSockets
    wsSendToRoom(`panel_layout_${projectId}`, {
      type: 'PANEL_UPDATE',
      projectId,
      panels: JSON.parse(updatedLayout.panels || '[]'),
      userId: req.user.id,
      timestamp: updatedLayout.lastUpdated,
    });
    
    console.log('✅ Panel layout updated successfully');
    res.status(200).json(parsedLayout);
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
      console.error('CAD service error:', cadError.message);
      res.status(500).json({ 
        message: 'CAD export failed',
        error: cadError.message
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
