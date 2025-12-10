const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { projects, panelLayouts } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { wsSendToRoom } = require('../services/websocket');
const config = require('../config/env');

// Constants for default layout
const DEFAULT_LAYOUT_WIDTH = 4000;
const DEFAULT_LAYOUT_HEIGHT = 4000;
const DEFAULT_SCALE = 1.0;

// Validate panel data - updated to handle the actual format used in the system
const validatePanel = (panel) => {
  if (!panel || typeof panel !== 'object') {
    console.warn('❌ Panel validation failed - not an object:', panel);
    return false;
  }
  
  // The system uses panels in this format:
  // { id, x, y, width, height, rotation, shape, panelNumber, rollNumber, ... }
  
  // Required fields for the system format
  const requiredFields = ['id', 'x', 'y', 'width', 'height'];
  for (const field of requiredFields) {
    if (!(field in panel)) {
      console.warn('❌ Panel validation failed - missing required field:', field, 'Panel:', panel.id || 'unknown');
      return false;
    }
  }
  
  // Validate data types for required fields
  const isValid = (
    typeof panel.id === 'string' &&
    typeof panel.x === 'number' &&
    typeof panel.y === 'number' &&
    typeof panel.width === 'number' &&
    typeof panel.height === 'number'
  );
  
  if (!isValid) {
    console.warn('❌ Panel validation failed - invalid data types:', {
      panel: panel.id || 'unknown',
      types: {
        id: typeof panel.id,
        x: typeof panel.x,
        y: typeof panel.y,
        width: typeof panel.width,
        height: typeof panel.height
      }
    });
    return false;
  }
  
  // Validate panel shape if present
  if (panel.shape !== undefined) {
    const validShapes = ['rectangle', 'right-triangle', 'patch'];
    if (!validShapes.includes(panel.shape)) {
      console.warn('❌ Panel validation failed - invalid shape:', {
        panel: panel.project_id || 'unknown',
        shape: panel.shape,
        validShapes: validShapes
      });
      return false;
    }
  }
  
  // Optional fields - validate if present
  if (panel.rotation !== undefined) {
    if (typeof panel.rotation !== 'number') {
      console.warn('❌ Panel validation failed - rotation must be a number if present:', {
        panel: panel.id || 'unknown',
        rotation: panel.rotation,
        type: typeof panel.rotation
      });
      return false;
    }
    
    // Validate rotation range (0-360 degrees)
    if (panel.rotation < 0 || panel.rotation >= 360) {
      console.warn('❌ Panel validation failed - rotation must be between 0 and 360 degrees:', {
        panel: panel.id || 'unknown',
        rotation: panel.rotation
      });
      return false;
    }
    
    // Validate rotation is a valid number (not NaN or Infinity)
    if (!isFinite(panel.rotation)) {
      console.warn('❌ Panel validation failed - rotation must be a finite number:', {
        panel: panel.id || 'unknown',
        rotation: panel.rotation
      });
      return false;
    }
  }
  
  if (panel.strokeWidth !== undefined && typeof panel.strokeWidth !== 'number') {
    console.warn('❌ Panel validation failed - strokeWidth must be a number if present:', {
      panel: panel.id || 'unknown',
      strokeWidth: panel.strokeWidth,
      type: typeof panel.strokeWidth
    });
    return false;
  }
  
  console.log('✅ Panel validation passed:', panel.id || 'unknown');
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
    
    // Verify project access - allow dev bypass to skip ownership check
    const isDevBypass = config.isDevelopment && req.headers['x-dev-bypass'] === 'true';
    console.log('🔍 [PANELS] Verifying project access for user:', req.user.id, 'devBypass:', isDevBypass);
    
    let [project] = await db
      .select()
      .from(projects)
      .where(
        isDevBypass 
          ? eq(projects.id, projectId)  // In dev bypass, just check if project exists
          : and(
              eq(projects.id, projectId),
              eq(projects.userId, req.user.id)
            )
      );
    
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
      console.log('🔍 [PANELS] First panel structure:', {
        keys: updateData.panels[0] ? Object.keys(updateData.panels[0]) : 'No panels',
        firstPanel: updateData.panels[0]
      });
      
      // Validate panels
      const validPanels = updateData.panels.filter(panel => {
        console.log('🔍 [PANELS] Validating panel:', {
          id: panel?.id || 'unknown',
          keys: Object.keys(panel || {}),
          hasRequiredFields: {
            id: !!panel?.id,
            x: !!panel?.x,
            y: !!panel?.y,
            width: !!panel?.width,
            height: !!panel?.height
          }
        });
        
        const isValid = validatePanel(panel);
        if (!isValid) {
          console.warn('⚠️ [PANELS] Panel validation failed for panel:', {
            id: panel?.id,
            x: panel?.x,
            y: panel?.y,
            width: panel?.width,
            height: panel?.height,
            rollNumber: panel?.rollNumber,
            panelNumber: panel?.panelNumber,
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

// Configure multer for image uploads
const imageStorage = multer.memoryStorage();
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'));
    }
  }
});

// POST /api/panels/image-analysis/:projectId
// Analyze an image and extract panel information
router.post('/image-analysis/:projectId', auth, imageUpload.single('image'), async (req, res, next) => {
  console.log('🔍 [IMAGE ANALYSIS] === POST /image-analysis/:projectId START ===');
  
  try {
    const { projectId } = req.params;
    
    // Validate project ID
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
    
    // Check if image file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    
    console.log('🔍 [IMAGE ANALYSIS] Image received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    
    // Convert image to base64
    const imageBase64 = req.file.buffer.toString('base64');
    
    // Call AI service for vision analysis
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
    
    try {
      const analysisResponse = await axios.post(
        `${AI_SERVICE_URL}/api/ai/analyze-image`,
        {
          image_base64: imageBase64,
          image_type: req.file.mimetype,
          project_id: projectId,
        },
        {
          timeout: 120000, // 2 minutes for vision analysis
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('✅ [IMAGE ANALYSIS] AI analysis completed');
      
      res.status(200).json({
        success: true,
        panels: analysisResponse.data.panels || [],
        detectedInfo: analysisResponse.data.detectedInfo || {},
      });
    } catch (aiError) {
      console.error('❌ [IMAGE ANALYSIS] AI service error:', aiError.message);
      
      if (aiError.code === 'ECONNREFUSED' || aiError.code === 'ETIMEDOUT') {
        return res.status(503).json({
          message: 'AI service unavailable. Please ensure the AI service is running.',
          error: aiError.message,
        });
      }
      
      return res.status(500).json({
        message: 'Failed to analyze image',
        error: aiError.response?.data?.error || aiError.message,
      });
    }
  } catch (error) {
    console.error('❌ [IMAGE ANALYSIS] Error:', error);
    next(error);
  }
});

// POST /api/panels/sync-from-forms/:projectId
// Sync forms to panel layout (manual trigger)
router.post('/sync-from-forms/:projectId', auth, async (req, res, next) => {
  console.log('🔍 [SYNC FORMS] === POST /sync-from-forms/:projectId START ===');
  
  try {
    const { projectId } = req.params;
    
    // Validate project ID
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid project ID' 
      });
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
      return res.status(404).json({ 
        success: false,
        message: 'Project not found' 
      });
    }
    
    // Import formToPanelService
    const formToPanelService = require('../services/formToPanelService');
    
    // Sync forms to panel layout
    const syncResult = await formToPanelService.syncFormsToPanelLayout(projectId);
    
    if (!syncResult.success) {
      return res.status(500).json({
        success: false,
        message: syncResult.error || 'Failed to sync forms to panel layout'
      });
    }
    
    console.log('✅ [SYNC FORMS] Sync completed:', syncResult.summary);
    
    res.json({
      success: true,
      message: 'Forms synced to panel layout successfully',
      summary: syncResult.summary,
      results: syncResult.results
    });
    
  } catch (error) {
    console.error('❌ [SYNC FORMS] Error syncing forms:', error);
    next(error);
  }
});

// POST /api/panels/populate-from-analysis/:projectId
// Populate panel layout from AI analysis results and form data
router.post('/populate-from-analysis/:projectId', auth, async (req, res, next) => {
  console.log('🔍 [POPULATE PANELS] === POST /populate-from-analysis/:projectId START ===');
  
  try {
    const { projectId } = req.params;
    const { panels, formData } = req.body;
    
    // Validate project ID
    if (!projectId || projectId.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Validate panels array
    if (!panels || !Array.isArray(panels) || panels.length === 0) {
      return res.status(400).json({ message: 'No panels provided' });
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
    
    // Get existing panel layout or create new one
    let [existingLayout] = await db
      .select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId));
    
    if (!existingLayout) {
      [existingLayout] = await db
        .insert(panelLayouts)
        .values({
          id: uuidv4(),
          projectId,
          panels: [],
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
      if (existingLayout.panels) {
        if (Array.isArray(existingLayout.panels)) {
          currentPanels = existingLayout.panels;
        } else if (typeof existingLayout.panels === 'string') {
          currentPanels = JSON.parse(existingLayout.panels || '[]');
        }
      }
    } catch (error) {
      console.error('Error parsing existing panels:', error);
      currentPanels = [];
    }
    
    // Create new panels from analysis results
    const newPanels = panels.map((panel, index) => {
      const panelId = uuidv4();
      return {
        id: panelId,
        x: panel.x || 100 + (index * 50),
        y: panel.y || 100 + (index * 30),
        width: panel.width || 100,
        height: panel.height || 50,
        shape: panel.shape || 'rectangle',
        rotation: panel.rotation || 0,
        fill: '#87CEEB',
        color: '#87CEEB',
        panelNumber: `P${String(index + 1).padStart(3, '0')}`,
        rollNumber: `ROLL-${index + 1}`,
        date: formData?.date || new Date().toISOString().slice(0, 10),
        location: formData?.location || panel.notes || 'AI Generated',
        material: formData?.material || 'Material type not specified - will be determined during installation',
        thickness: formData?.thickness || 'Thickness not specified - will be determined during installation',
        seamsType: formData?.seamsType || 'Standard 6-inch overlap',
        notes: formData?.notes || panel.notes || 'AI-generated panel',
        isValid: true,
        meta: {
          repairs: [],
          airTest: { result: 'pending' }
        }
      };
    });
    
    // Combine existing and new panels
    const updatedPanels = [...currentPanels, ...newPanels];
    
    // Update panel layout
    const [updatedLayout] = await db
      .update(panelLayouts)
      .set({
        panels: updatedPanels,
        lastUpdated: new Date(),
      })
      .where(eq(panelLayouts.id, existingLayout.id))
      .returning();
    
    console.log('✅ [POPULATE PANELS] Panel layout updated:', {
      totalPanels: updatedPanels.length,
      newPanels: newPanels.length
    });
    
    // Notify via WebSocket if available
    try {
      wsSendToRoom(`project:${projectId}`, {
        type: 'panels_updated',
        projectId,
        panelCount: updatedPanels.length,
      });
    } catch (wsError) {
      console.warn('WebSocket notification failed:', wsError);
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully populated ${newPanels.length} panel(s)`,
      panelCount: updatedPanels.length,
      newPanelCount: newPanels.length,
    });
  } catch (error) {
    console.error('❌ [POPULATE PANELS] Error:', error);
    next(error);
  }
});

module.exports = router;
