const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { projects } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const logger = require('../lib/logger');

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// GET /api/mobile/projects
// Get all projects for the authenticated user
router.get('/projects', auth, async (req, res, next) => {
  try {
    logger.debug('[MOBILE] Fetching projects for user', { userId: req.user.id });
    
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, req.user.id))
      .orderBy(projects.createdAt);
    
    res.json({
      success: true,
      projects: userProjects
    });
  } catch (error) {
    logger.error('[MOBILE] Error fetching projects', { error: error.message });
    next(error);
  }
});

// POST /api/mobile/projects
// Create a new project
router.post('/projects', auth, async (req, res, next) => {
  try {
    const { name, description, location } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }
    
    logger.debug('[MOBILE] Creating project', {
      userId: req.user.id,
      name
    });
    
    const [newProject] = await db
      .insert(projects)
      .values({
        id: uuidv4(),
        name: name.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        userId: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    logger.info('[MOBILE] Project created successfully', {
      projectId: newProject.id,
      userId: req.user.id
    });
    
    res.status(201).json({
      success: true,
      project: newProject
    });
  } catch (error) {
    logger.error('[MOBILE] Error creating project', { error: error.message });
    next(error);
  }
});

// POST /api/mobile/upload-defect/:projectId
// Upload defect photo and trigger browser automation
router.post('/upload-defect/:projectId', auth, upload.single('image'), async (req, res, next) => {
  const uploadId = uuidv4();
  
  try {
    const { projectId } = req.params;
    const { location, notes, defectType, latitude, longitude } = req.body;
    
    logger.info('[MOBILE] Defect upload started', {
      uploadId,
      projectId,
      userId: req.user.id
    });
    
    // Validate project access
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
        message: 'Project not found or access denied'
      });
    }
    
    // Validate image file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }
    
    // Convert image to base64
    const imageBase64 = req.file.buffer.toString('base64');
    const imageType = req.file.mimetype || 'image/jpeg';
    
    logger.debug('[MOBILE] Image prepared for AI service', {
      uploadId,
      imageSize: req.file.size,
      imageType
    });
    
    // Call AI service for defect detection
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
    
    let defectResult;
    try {
      const defectResponse = await axios.post(
        `${AI_SERVICE_URL}/api/ai/detect-defects`,
        {
          image_base64: imageBase64,
          image_type: imageType,
          project_id: projectId,
          metadata: {
            location,
            notes,
            defect_type: defectType,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            uploaded_by: req.user.id,
            upload_id: uploadId
          }
        },
        {
          timeout: 120000, // 2 minutes for vision analysis
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      defectResult = defectResponse.data;
      logger.info('[MOBILE] Defect detection completed', {
        uploadId,
        defectsFound: defectResult.defects?.length || 0
      });
    } catch (aiError) {
      logger.error('[MOBILE] AI service error', {
        uploadId,
        error: aiError.message,
        code: aiError.code
      });
      
      if (aiError.code === 'ECONNREFUSED' || aiError.code === 'ETIMEDOUT') {
        return res.status(503).json({
          success: false,
          message: 'AI service unavailable. Please ensure the AI service is running.',
          error: aiError.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to detect defects in image',
        error: aiError.response?.data?.error || aiError.message
      });
    }
    
    // Trigger browser automation workflow
    let automationStatus = 'pending';
    try {
      const automationResponse = await axios.post(
        `${AI_SERVICE_URL}/api/ai/automate-panel-population`,
        {
          project_id: projectId,
          defect_data: defectResult,
          user_id: req.user.id,
          upload_id: uploadId
        },
        {
          timeout: 180000, // 3 minutes for browser automation
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      automationStatus = automationResponse.data.status || 'success';
      logger.info('[MOBILE] Browser automation completed', {
        uploadId,
        status: automationStatus
      });
    } catch (automationError) {
      logger.error('[MOBILE] Browser automation error', {
        uploadId,
        error: automationError.message
      });
      
      // Don't fail the upload if automation fails - defects were still detected
      automationStatus = 'failed';
    }
    
    // Return results
    res.json({
      success: true,
      defects: defectResult.defects || [],
      overall_assessment: defectResult.overall_assessment || 'Analysis complete',
      total_defects: defectResult.total_defects || 0,
      critical_defects: defectResult.critical_defects || 0,
      recommendations: defectResult.recommendations || [],
      automation_status: automationStatus,
      message: automationStatus === 'success' 
        ? 'Defect uploaded and panel layout updated automatically'
        : 'Defect uploaded. Panel layout update may be pending.',
      upload_id: uploadId
    });
    
  } catch (error) {
    logger.error('[MOBILE] Error processing defect upload', {
      uploadId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

// GET /api/mobile/upload-status/:uploadId
// Check upload status (for future use with async processing)
router.get('/upload-status/:uploadId', auth, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    
    // This would query a status table if we implement async processing
    // For now, return a simple response
    res.json({
      success: true,
      upload_id: uploadId,
      status: 'completed',
      message: 'Upload processing completed'
    });
  } catch (error) {
    logger.error('[MOBILE] Error checking upload status', { error: error.message });
    next(error);
  }
});

module.exports = router;

