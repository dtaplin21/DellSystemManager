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

// Validate panel data - updated to handle the actual format sent from frontend
const validatePanel = (panel) => {
  if (!panel || typeof panel !== 'object') {
    console.warn('❌ Panel validation failed - not an object:', panel);
    return false;
  }
  
  // The frontend sends panels in this format:
  // { project_id, type, x, y, width_feet, height_feet, roll_number, panel_number, fill, stroke, stroke_width, rotation }
  
  // Required fields for the frontend format
  const requiredFields = ['project_id', 'type', 'x', 'y', 'width_feet', 'height_feet'];
  for (const field of requiredFields) {
    if (!(field in panel)) {
      console.warn('❌ Panel validation failed - missing required field:', field, 'Panel:', panel.project_id || 'unknown');
      return false;
    }
  }
  
  // Validate data types for required fields
  const isValid = (
    typeof panel.project_id === 'string' &&
    typeof panel.type === 'string' &&
    typeof panel.x === 'number' &&
    typeof panel.y === 'number' &&
    typeof panel.width_feet === 'number' &&
    typeof panel.height_feet === 'number'
  );
  
  if (!isValid) {
    console.warn('❌ Panel validation failed - invalid data types:', {
      panel: panel.project_id || 'unknown',
      types: {
        project_id: typeof panel.project_id,
        type: typeof panel.type,
        x: typeof panel.x,
        y: typeof panel.y,
        width_feet: typeof panel.width_feet,
        height_feet: typeof panel.height_feet
      }
    });
    return false;
  }
  
  // Optional fields - validate if present
  if (panel.rotation !== undefined && typeof panel.rotation !== 'number') {
    console.warn('❌ Panel validation failed - rotation must be a number if present:', {
      panel: panel.project_id || 'unknown',
      rotation: panel.rotation,
      type: typeof panel.rotation
    });
    return false;
  }
  
  if (panel.stroke_width !== undefined && typeof panel.stroke_width !== 'number') {
    console.warn('❌ Panel validation failed - stroke_width must be a number if present:', {
      panel: panel.project_id || 'unknown',
      stroke_width: panel.stroke_width,
      type: typeof panel.stroke_width
    });
    return false;
  }
  
  console.log('✅ Panel validation passed:', panel.project_id || 'unknown');
  return true;
};

// Map panel to canonical format - REMOVED: No longer needed after fixing data transformation issues
/*
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
  color: panel.color || panel.fill || '#3b82f6',
  rollNumber: panel.rollNumber || '',
  panelNumber: panel.panelNumber || '',
  date: panel.date || new Date().toISOString(),
  location: panel.location || '',
  meta: {
    repairs: panel.meta?.repairs || [],
    location: panel.meta?.location || { x: panel.x || 0, y: panel.y || 0, gridCell: { row: 0, col: 0 } }
  }
});
*/

// Get panel layout for a project
router.get('/layout/:projectId', async (req, res, next) => {
  console.log('🔍 [PANELS] === GET /layout/:projectId START ===');
  console.log('🔍 [PANELS] Request params:', req.params);
  console.log('🔍 [PANELS] Request headers:', {
    authorization: req.headers?.authorization ? 'Present' : 'Missing',
    contentType: req.headers?.['content-type'],
    userAgent: req.headers?.['user-agent']?.substring(0, 50) + '...'
  });
  
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
      console.error('❌ [PANELS] Invalid project ID:', projectId);
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
      console.error('❌ [PANELS] Project not found or access denied');
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get panel layout
    let [panelLayout] = await db
      .select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId));
    
    console.log('🔍 [PANELS] Panel layout query result:', {
      found: !!panelLayout,
      id: panelLayout?.id,
      projectId: panelLayout?.projectId
    });
    
    // If layout doesn't exist, create a default one
    if (!panelLayout) {
      console.log('🔍 [PANELS] Creating new panel layout for project:', projectId);
      [panelLayout] = await db
        .insert(panelLayouts)
        .values({
          id: uuidv4(),
          projectId,
          panels: [], // Empty array as JSONB
          width: DEFAULT_LAYOUT_WIDTH,
          height: DEFAULT_LAYOUT_HEIGHT,
          scale: DEFAULT_SCALE,
          lastUpdated: new Date(),
        })
        .returning();
      
      console.log('✅ [PANELS] New panel layout created:', {
        id: panelLayout.id,
        projectId: panelLayout.projectId,
        panels: panelLayout.panels
      });
    }
    
    // Parse the panels JSONB data to an actual array
    let parsedPanels = [];
    try {
      if (panelLayout.panels) {
        if (typeof panelLayout.panels === 'string') {
          // Handle legacy TEXT format
          parsedPanels = JSON.parse(panelLayout.panels);
        } else if (Array.isArray(panelLayout.panels)) {
          // Handle JSONB array format
          parsedPanels = panelLayout.panels;
        } else if (typeof panelLayout.panels === 'object') {
          // Handle JSONB object format
          parsedPanels = Array.isArray(panelLayout.panels) ? panelLayout.panels : [];
        }
      }
      console.log('🔍 [PANELS] Panels parsed successfully:', {
        count: parsedPanels.length,
        isArray: Array.isArray(parsedPanels),
        firstPanel: parsedPanels[0],
        lastPanel: parsedPanels[parsedPanels.length - 1]
      });
    } catch (parseError) {
      console.error('🔍 Error parsing panels JSON:', parseError);
      console.error('🔍 Panel data type:', typeof panelLayout.panels);
      console.error('🔍 Panel data:', panelLayout.panels);
      parsedPanels = [];
    }
    
    // Prepare response
    const responseData = {
      id: panelLayout.id,
      projectId: panelLayout.projectId,
      panels: parsedPanels,
      width: typeof panelLayout.width === 'number' ? panelLayout.width : DEFAULT_LAYOUT_WIDTH,
      height: typeof panelLayout.height === 'number' ? panelLayout.height : DEFAULT_LAYOUT_HEIGHT,
      scale: typeof panelLayout.scale === 'number' ? panelLayout.scale : DEFAULT_SCALE,
      lastUpdated: panelLayout.lastUpdated
    };
    
    console.log('✅ [PANELS] Response data prepared:', {
      id: responseData.id,
      projectId: responseData.projectId,
      panelCount: responseData.panels.length,
      width: responseData.width,
      height: responseData.height,
      scale: responseData.scale,
      lastUpdated: responseData.lastUpdated
    });
    
    console.log('🔍 [PANELS] === GET /layout/:projectId END ===');
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('❌ [PANELS] GET /layout/:projectId error:', error);
    console.error('❌ [PANELS] Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Update panel layout for a project
router.patch('/layout/:projectId', async (req, res, next) => {
  console.log('🔍 [PANELS] === PATCH /layout/:projectId START ===');
  console.log('🔍 [PANELS] Request params:', req.params);
  console.log('🔍 [PANELS] Request body:', req.body);
  console.log('🔍 [PANELS] Request headers:', {
    authorization: req.headers?.authorization ? 'Present' : 'Missing',
    contentType: req.headers?.['content-type'],
    userAgent: req.headers?.['user-agent']?.substring(0, 50) + '...'
  });
  
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
    const updateData = req.body;
    
    console.log('🔍 [PANELS] Processing PATCH for project:', projectId);
    console.log('🔍 [PANELS] Update data received:', {
      hasPanels: !!updateData.panels,
      panelCount: updateData.panels?.length || 0,
      width: updateData.width,
      height: updateData.height,
      scale: updateData.scale
    });
    
    if (updateData.panels && Array.isArray(updateData.panels)) {
      console.log('🔍 [PANELS] First panel:', updateData.panels[0]);
      console.log('🔍 [PANELS] Last panel:', updateData.panels[updateData.panels.length - 1]);
    }
    
    // Basic ID validation
    if (!projectId || projectId.length === 0) {
      console.error('❌ [PANELS] Invalid project ID:', projectId);
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
      console.error('❌ [PANELS] Project not found or access denied');
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get existing panel layout
    let [existingLayout] = await db
      .select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId));
    
    console.log('🔍 [PANELS] Existing layout found:', existingLayout ? 'YES' : 'NO');
    if (existingLayout) {
      console.log('🔍 [PANELS] Existing layout data:', {
        id: existingLayout.id,
        projectId: existingLayout.projectId,
        hasPanels: !!existingLayout.panels,
        panelCount: existingLayout.panels ? (Array.isArray(existingLayout.panels) ? existingLayout.panels.length : 'Not array') : 'No panels',
        width: existingLayout.width,
        height: existingLayout.height,
        scale: existingLayout.scale,
        lastUpdated: existingLayout.lastUpdated
      });
    }
    
    // If no existing layout, create one
    if (!existingLayout) {
      console.log('🔍 [PANELS] Creating new panel layout for project:', projectId);
      [existingLayout] = await db
        .insert(panelLayouts)
        .values({
          id: uuidv4(),
          projectId,
          panels: [], // Empty array as JSONB
          width: DEFAULT_LAYOUT_WIDTH,
          height: DEFAULT_LAYOUT_HEIGHT,
          scale: DEFAULT_SCALE,
          lastUpdated: new Date(),
        })
        .returning();
      
      console.log('✅ [PANELS] New panel layout created:', existingLayout);
    }
    
    // Parse existing panels
    let currentPanels = [];
    try {
      if (existingLayout.panels) {
        if (typeof existingLayout.panels === 'string') {
          // Handle legacy TEXT format
          currentPanels = JSON.parse(existingLayout.panels);
        } else if (Array.isArray(existingLayout.panels)) {
          // Handle JSONB array format
          currentPanels = existingLayout.panels;
        } else if (typeof existingLayout.panels === 'object') {
          // Handle JSONB object format
          currentPanels = Array.isArray(existingLayout.panels) ? existingLayout.panels : [];
        }
      }
      console.log('🔍 [PANELS] Current panels parsed:', {
        count: currentPanels.length,
        isArray: Array.isArray(currentPanels)
      });
    } catch (parseError) {
      console.error('🔍 Error parsing existing panels JSON:', parseError);
      currentPanels = [];
    }
    
    // If panels are provided, update the layout
    if (updateData.panels && Array.isArray(updateData.panels)) {
      console.log('🔍 [PANELS] Updating layout with new panels:', {
        newPanelCount: updateData.panels.length,
        oldPanelCount: currentPanels.length
      });
      
      // Log each panel before validation
      console.log('🔍 [PANELS] Raw panels received:', updateData.panels);
      
      // Validate panels
      const validPanels = updateData.panels.filter(panel => {
        const isValid = validatePanel(panel);
        if (!isValid) {
          console.warn('⚠️ [PANELS] Panel validation failed for panel:', {
            project_id: panel?.project_id,
            type: panel?.type,
            x: panel?.x,
            y: panel?.y,
            width_feet: panel?.width_feet,
            height_feet: panel?.height_feet,
            roll_number: panel?.roll_number,
            panel_number: panel?.panel_number,
            rotation: panel?.rotation
          });
        }
        return isValid;
      });
      
      console.log('🔍 [PANELS] Panel validation results:', {
        total: updateData.panels.length,
        valid: validPanels.length,
        invalid: updateData.panels.length - validPanels.length
      });
      
      if (validPanels.length === 0) {
        console.warn('⚠️ [PANELS] No valid panels provided after validation');
        console.warn('⚠️ [PANELS] All panels failed validation');
        return res.status(400).json({ message: 'No valid panels provided' });
      }
      
      // Update the layout with new panels
      const [updatedLayout] = await db
        .update(panelLayouts)
        .set({
          panels: validPanels, // Store as JSONB directly
          width: updateData.width || existingLayout.width,
          height: updateData.height || existingLayout.height,
          scale: updateData.scale || existingLayout.scale,
          lastUpdated: new Date(),
        })
        .where(eq(panelLayouts.projectId, projectId))
        .returning();
      
      console.log('✅ [PANELS] Layout updated in database:', {
        id: updatedLayout.id,
        projectId: updatedLayout.projectId,
        panelCount: validPanels.length,
        width: updatedLayout.width,
        height: updatedLayout.height,
        scale: updatedLayout.scale,
        lastUpdated: updatedLayout.lastUpdated
      });
      
      // Log what's actually stored in the database
      console.log('🔍 [PANELS] Database stored panels:', {
        rawPanels: updatedLayout.panels,
        panelCount: Array.isArray(updatedLayout.panels) ? updatedLayout.panels.length : 'Not array',
        firstPanel: Array.isArray(updatedLayout.panels) ? updatedLayout.panels[0] : 'N/A'
      });
      
      // Return panels exactly as saved - no transformation needed for JSONB
      console.log('🔍 [PANELS] Returning saved panels without transformation:', updatedLayout.panels);
      
      const parsedLayout = {
        ...updatedLayout,
        width: typeof updatedLayout.width === 'number' ? updatedLayout.width : DEFAULT_LAYOUT_WIDTH,
        height: typeof updatedLayout.height === 'number' ? updatedLayout.height : DEFAULT_LAYOUT_HEIGHT,
        scale: typeof updatedLayout.scale === 'number' ? updatedLayout.scale : DEFAULT_SCALE,
        panels: updatedLayout.panels, // Return panels exactly as saved
      };
      
      // Notify other clients via WebSockets
      try {
        wsSendToRoom(`panel_layout_${projectId}`, {
          type: 'PANEL_UPDATE',
          projectId,
          panels: updatedLayout.panels || [],
          userId: req.user.id,
          timestamp: updatedLayout.lastUpdated,
        });
        console.log('✅ [PANELS] WebSocket notification sent');
      } catch (wsError) {
        console.warn('⚠️ [PANELS] WebSocket notification failed:', wsError.message);
      }
      
      console.log('🔍 [PANELS] === PATCH /layout/:projectId END ===');
      return res.status(200).json(parsedLayout);
      
    } else {
      // No panels provided, return existing layout - Return panels exactly as stored, no transformation
      console.log('🔍 [PANELS] No panels provided, returning existing layout - Return panels exactly as stored, no transformation');
      console.log('🔍 [PANELS] Returning stored panels without transformation:', existingLayout.panels);
      
      const parsedLayout = {
        ...existingLayout,
        width: typeof existingLayout.width === 'number' ? existingLayout.width : DEFAULT_LAYOUT_WIDTH,
        height: typeof existingLayout.height === 'number' ? existingLayout.height : DEFAULT_LAYOUT_HEIGHT,
        scale: typeof existingLayout.scale === 'number' ? existingLayout.scale : DEFAULT_SCALE,
        panels: existingLayout.panels || [], // Return panels exactly as stored
      };
      
      console.log('🔍 [PANELS] === PATCH /layout/:projectId END ===');
      return res.status(200).json(parsedLayout);
    }
    
  } catch (error) {
    console.error('❌ [PANELS] PATCH /layout/:projectId error:', error);
    console.error('❌ [PANELS] Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
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
        if (panelLayout.panels) {
          if (typeof panelLayout.panels === 'string') {
            // Handle legacy TEXT format
            const parsedPanels = JSON.parse(panelLayout.panels);
            panelsCount = Array.isArray(parsedPanels) ? parsedPanels.length : 0;
          } else if (Array.isArray(panelLayout.panels)) {
            // Handle JSONB array format
            panelsCount = panelLayout.panels.length;
          } else {
            panelsCount = 0;
          }
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
    
    let panels = [];
    try {
      if (panelLayout && panelLayout.panels) {
        if (typeof panelLayout.panels === 'string') {
          // Handle legacy TEXT format
          panels = JSON.parse(panelLayout.panels);
        } else if (Array.isArray(panelLayout.panels)) {
          // Handle JSONB array format
          panels = panelLayout.panels;
        }
        if (!Array.isArray(panels)) {
          panels = [];
        }
      }
    } catch (parseError) {
      console.warn('⚠️ [DEBUG] Could not parse panels JSON for response:', parseError.message);
      panels = [];
    }
    
    res.status(200).json({
      project: project ? { id: project.id, name: project.name } : null,
      panelLayout: panelLayout ? {
        id: panelLayout.id,
        projectId: panelLayout.projectId,
        panels: panels,
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
