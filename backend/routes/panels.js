const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { projects, panelLayouts } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { wsSendToRoom } = require('../services/websocket');

// Constants for default layout
const DEFAULT_LAYOUT_WIDTH = 4000;
const DEFAULT_LAYOUT_HEIGHT = 4000;
const DEFAULT_SCALE = 1.0;

// Panel validation function
const validatePanel = (panel) => {
  if (!panel || typeof panel !== 'object') return false;
  
  const requiredFields = ['id', 'shape', 'x', 'y', 'width', 'height', 'length'];
  const hasRequiredFields = requiredFields.every(field => panel.hasOwnProperty(field));
  
  if (!hasRequiredFields) {
    console.warn('❌ Panel validation failed - missing required fields:', {
      panel: panel.id,
      missing: requiredFields.filter(field => !panel.hasOwnProperty(field))
    });
    return false;
  }
  
  // Validate data types
  const isValid = (
    typeof panel.id === 'string' &&
    typeof panel.shape === 'string' &&
    typeof panel.x === 'number' &&
    typeof panel.y === 'number' &&
    typeof panel.width === 'number' &&
    typeof panel.height === 'number' &&
    typeof panel.length === 'number'
  );
  
  if (!isValid) {
    console.warn('❌ Panel validation failed - invalid data types:', {
      panel: panel.id,
      types: {
        id: typeof panel.id,
        shape: typeof panel.shape,
        x: typeof panel.x,
        y: typeof panel.y,
        width: typeof panel.width,
        height: typeof panel.height,
        length: typeof panel.length
      }
    });
    return false;
  }
  
  return true;
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
  console.log('🔍 [PANELS] GET request received for project:', req.params.projectId);
  console.log('🔍 [PANELS] Request headers:', req.headers);
  
  // Apply auth middleware for production
  try {
    await auth(req, res, () => {});
    console.log('✅ [PANELS] Auth middleware passed, user:', req.user?.id);
  } catch (error) {
    console.log('❌ [PANELS] Auth middleware failed:', error.message);
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    const { projectId } = req.params;
    
    console.log('🔍 [PANELS] Processing GET for project:', projectId);
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    console.log('🔍 [PANELS] Verifying project access for user:', req.user.id);
    let [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    console.log('🔍 [PANELS] Project found:', project ? 'YES' : 'NO');
    if (project) {
      console.log('🔍 [PANELS] Project details:', { id: project.id, name: project.name, userId: project.userId });
    }
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get panel layout
    let [panelLayout] = await db
      .select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId));
    
    console.log('🔍 [PANELS] Panel layout query result:', panelLayout);
    
    // If layout doesn't exist, create a default one
    if (!panelLayout) {
      console.log('🔍 [PANELS] Creating new panel layout for project:', projectId);
      [panelLayout] = await db
        .insert(panelLayouts)
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
      
      console.log('✅ [PANELS] New panel layout created:', panelLayout);
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
  console.log('🔍 [PANELS] PATCH request received for project:', req.params.projectId);
  console.log('🔍 [PANELS] Request headers:', req.headers);
  console.log('🔍 [PANELS] Request body:', req.body);
  
  // Apply auth middleware for production
  try {
    await auth(req, res, () => {});
    console.log('✅ [PANELS] Auth middleware passed, user:', req.user?.id);
  } catch (error) {
    console.log('❌ [PANELS] Auth middleware failed:', error.message);
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    res.setHeader('Cache-Control', 'no-store');
    const { projectId } = req.params;
    const updateData = req.body;
    
    console.log('🔍 [PANELS] Processing update for project:', projectId);
    console.log('🔍 [PANELS] Update data:', JSON.stringify(updateData, null, 2));
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    console.log('🔍 [PANELS] Verifying project access for user:', req.user.id);
    let [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    console.log('🔍 [PANELS] Project found:', project ? 'YES' : 'NO');
    if (project) {
      console.log('🔍 [PANELS] Project details:', { id: project.id, name: project.name, userId: project.userId });
    }
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get existing panel layout
    let [existingLayout] = await db
      .select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId));
    
    console.log('🔍 [PANELS] Existing layout query result:', existingLayout);
    
    // If layout doesn't exist, create a default one
    if (!existingLayout) {
      console.log('🔍 [PANELS] Creating new panel layout for PATCH operation');
      [existingLayout] = await db
        .insert(panelLayouts)
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
      
      console.log('✅ [PANELS] New panel layout created for PATCH:', existingLayout);
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
      console.log('🔍 [PANELS] Processing panel update with', updateData.panels.length, 'panels');
      
      // Validate all panels before updating
      const validPanels = updateData.panels.filter(panel => validatePanel(panel));
      
      if (validPanels.length !== updateData.panels.length) {
        const invalidCount = updateData.panels.length - validPanels.length;
        console.warn(`⚠️ [PANELS] ${invalidCount} panels were invalid and were filtered out`);
        console.warn('⚠️ [PANELS] Invalid panels:', updateData.panels.filter(panel => !validatePanel(panel)));
      }
      
      console.log('✅ [PANELS] Valid panels for update:', validPanels.length);
      
      try {
        // Update the layout with new panels
        const [updatedLayout] = await db
          .update(panelLayouts)
          .set({
            panels: JSON.stringify(validPanels),
            width: updateData.width || existingLayout.width,
            height: updateData.height || existingLayout.height,
            scale: updateData.scale || existingLayout.scale,
            lastUpdated: new Date(),
          })
          .where(eq(panelLayouts.projectId, projectId))
          .returning();
        
        console.log('✅ [PANELS] Database update successful:', {
          projectId,
          panelsCount: validPanels.length,
          updatedAt: updatedLayout.lastUpdated
        });
        
        // Parse the panels for the response
        const parsedLayout = {
          ...updatedLayout,
          width: typeof updatedLayout.width === 'number' ? updatedLayout.width : DEFAULT_LAYOUT_WIDTH,
          height: typeof updatedLayout.height === 'number' ? updatedLayout.height : DEFAULT_LAYOUT_HEIGHT,
          scale: typeof updatedLayout.scale === 'number' ? updatedLayout.scale : DEFAULT_SCALE,
          panels: JSON.parse(updatedLayout.panels || '[]').map(mapPanelToCanonical),
        };
        
        // Notify other clients via WebSockets
        try {
          wsSendToRoom(`panel_layout_${projectId}`, {
            type: 'PANEL_UPDATE',
            projectId,
            panels: JSON.parse(updatedLayout.panels || '[]'),
            userId: req.user.id,
            timestamp: updatedLayout.lastUpdated,
          });
          console.log('✅ [PANELS] WebSocket notification sent');
        } catch (wsError) {
          console.warn('⚠️ [PANELS] WebSocket notification failed:', wsError.message);
        }
        
        res.status(200).json(parsedLayout);
      } catch (dbError) {
        console.error('❌ [PANELS] Database update failed:', dbError);
        console.error('❌ [PANELS] Update data:', {
          projectId,
          panelsCount: validPanels.length,
          error: dbError.message
        });
        return res.status(500).json({ 
          message: 'Failed to update panel layout',
          error: 'DATABASE_UPDATE_FAILED'
        });
      }
    } else {
      console.log('🔍 [PANELS] No panels provided, returning existing layout');
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

// Debug endpoint to test panel operations
router.get('/debug/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    console.log('🔍 [DEBUG] Debug endpoint called for project:', projectId);
    
    // Check if project exists
    let [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    
    console.log('🔍 [DEBUG] Project found:', project ? 'YES' : 'NO');
    
    // Check if panel layout exists
    let [panelLayout] = await db
      .select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId));
    
    console.log('🔍 [DEBUG] Panel layout found:', panelLayout ? 'YES' : 'NO');
    if (panelLayout) {
      let panelsCount = 0;
      try {
        if (panelLayout.panels && typeof panelLayout.panels === 'string') {
          const parsedPanels = JSON.parse(panelLayout.panels);
          panelsCount = Array.isArray(parsedPanels) ? parsedPanels.length : 0;
        }
      } catch (parseError) {
        console.warn('⚠️ [DEBUG] Could not parse panels JSON:', parseError.message);
        panelsCount = 0;
      }
      
      console.log('🔍 [DEBUG] Panel layout data:', {
        id: panelLayout.id,
        projectId: panelLayout.projectId,
        panelsCount: panelsCount,
        width: panelLayout.width,
        height: panelLayout.height,
        scale: panelLayout.scale,
        lastUpdated: panelLayout.lastUpdated
      });
    }
    
    res.status(200).json({
      project: project ? { id: project.id, name: project.name } : null,
      panelLayout: panelLayout ? {
        id: panelLayout.id,
        projectId: panelLayout.projectId,
        panels: panelLayout.panels ? JSON.parse(panelLayout.panels) : [],
        width: panelLayout.width,
        height: panelLayout.height,
        scale: panelLayout.scale,
        lastUpdated: panelLayout.lastUpdated
      } : null
    });
  } catch (error) {
    console.error('❌ [DEBUG] Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
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
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId));
    
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
