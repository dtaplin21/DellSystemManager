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

// Get panel layout for a project
router.get('/layout/:projectId', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
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
          width: 100,
          height: 100,
          scale: 1,
          lastUpdated: new Date(),
        })
        .returning();
    }
    
    // Parse the panels JSON string to an actual array
    const parsedLayout = {
      ...panelLayout,
      panels: JSON.parse(panelLayout.panels),
    };
    
    res.status(200).json(parsedLayout);
  } catch (error) {
    next(error);
  }
});

// Update panel layout
router.patch('/layout/:projectId', auth, subscriptionCheck('premium'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const updateData = req.body;
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
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
    
    // Get existing layout
    const [existingLayout] = await db
      .select()
      .from(panels)
      .where(eq(panels.projectId, projectId));
    
    if (!existingLayout) {
      return res.status(404).json({ message: 'Panel layout not found' });
    }
    
    // Prepare update data
    const updateValues = {};
    
    // Handle panels array - we store it as a JSON string in the database
    if (updateData.panels) {
      updateValues.panels = JSON.stringify(updateData.panels);
    }
    
    // Handle other properties
    if (updateData.width !== undefined) updateValues.width = updateData.width;
    if (updateData.height !== undefined) updateValues.height = updateData.height;
    if (updateData.scale !== undefined) updateValues.scale = updateData.scale;
    
    // Always update lastUpdated timestamp
    updateValues.lastUpdated = new Date().toISOString();
    
    // Update panel layout
    const [updatedLayout] = await db
      .update(panels)
      .set(updateValues)
      .where(eq(panels.projectId, projectId))
      .returning();
    
    // Parse the panels for the response
    const parsedLayout = {
      ...updatedLayout,
      panels: JSON.parse(updatedLayout.panels),
    };
    
    // Notify other clients via WebSockets
    wsSendToRoom(`panel_layout_${projectId}`, {
      type: 'PANEL_UPDATE',
      projectId,
      panels: JSON.parse(updatedLayout.panels),
      userId: req.user.id,
      timestamp: updatedLayout.lastUpdated,
    });
    
    res.status(200).json(parsedLayout);
  } catch (error) {
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
    const parsedPanels = JSON.parse(panelLayout.panels);
    
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
