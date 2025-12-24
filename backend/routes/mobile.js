const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { projects, panelLayouts } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const logger = require('../lib/logger');
const FormFieldExtractor = require('../services/form-field-extractor');

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
    
    // Map Drizzle camelCase to snake_case for iOS compatibility
    const mappedProjects = userProjects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      location: project.location,
      user_id: project.userId, // Explicitly map userId to user_id
      created_at: project.createdAt ? project.createdAt.toISOString() : null,
      updated_at: project.updatedAt ? project.updatedAt.toISOString() : null
    }));
    
    res.json({
      success: true,
      projects: mappedProjects
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

// POST /api/mobile/extract-form-data/:projectId
// Extract form fields from defect image using AI vision
router.post('/extract-form-data/:projectId', auth, upload.single('image'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { formType } = req.body; // Get form type from request body
    
    logger.info('[MOBILE] Form field extraction started', {
      projectId,
      formType: formType || 'none',
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
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      logger.error('[MOBILE] OpenAI API key not configured');
      return res.status(503).json({
        success: false,
        message: 'AI extraction service is not available. OPENAI_API_KEY not configured.',
        extractedFields: {},
        confidence: 0
      });
    }
    
    // List of as-built form types that should use AI service
    const asbuiltFormTypes = [
      'panel_placement',
      'panel_seaming',
      'non_destructive',
      'trial_weld',
      'repairs',
      'destructive'
    ];
    
    try {
      // If formType is an as-built form, use AI service endpoint
      if (formType && asbuiltFormTypes.includes(formType)) {
        logger.info('[MOBILE] Using AI service for as-built form extraction', {
          projectId,
          formType
        });
        
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
        const imageBase64 = req.file.buffer.toString('base64');
        const imageType = req.file.mimetype || 'image/jpeg';
        
        try {
          const aiResponse = await axios.post(
            `${AI_SERVICE_URL}/api/ai/extract-asbuilt-fields`,
            {
              image_base64: imageBase64,
              form_type: formType,
              project_id: projectId
            },
            {
              timeout: 120000, // 2 minutes
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (aiResponse.data && aiResponse.data.success) {
            const extractedFields = aiResponse.data.extracted_fields || {};
            
            logger.info('[MOBILE] As-built form field extraction completed', {
              projectId,
              formType,
              fieldsExtracted: Object.keys(extractedFields).filter(
                key => extractedFields[key] !== null && extractedFields[key] !== undefined
              ).length,
              extractedFields: JSON.stringify(extractedFields), // Log all extracted fields
              repairId: extractedFields.repairId || extractedFields.repair_id || 'NOT FOUND'
            });
            
            return res.json({
              success: true,
              extracted_fields: extractedFields, // Use snake_case to match Swift CodingKeys
              confidence: 0.85, // Default confidence for AI extraction
              message: 'Form fields extracted successfully',
              form_type: formType // Use snake_case to match Swift CodingKeys
            });
          } else {
            throw new Error('AI service returned unsuccessful response');
          }
        } catch (aiError) {
          logger.error('[MOBILE] AI service extraction error', {
            projectId,
            formType,
            error: aiError.message,
            responseStatus: aiError.response?.status,
            responseData: aiError.response?.data
          });
          
          // Fall through to return empty fields
          return res.status(200).json({
            success: false,
            extracted_fields: {}, // Use snake_case to match Swift CodingKeys
            confidence: 0,
            message: 'Could not extract form data from image. Please enter manually.',
            form_type: formType // Use snake_case to match Swift CodingKeys
          });
        }
      } else {
        // Use existing FormFieldExtractor for defect reports or when formType not specified
        const extractor = new FormFieldExtractor();
        const result = await extractor.extractFormFields(
          req.file.buffer,
          req.file.mimetype || 'image/jpeg'
        );
        
        logger.info('[MOBILE] Form field extraction completed', {
          projectId,
          fieldsExtracted: Object.keys(result.extractedFields).filter(
            key => result.extractedFields[key] !== null
          ).length,
          confidence: result.confidence
        });
        
        res.json({
          success: true,
          extractedFields: result.extractedFields,
          confidence: result.confidence,
          message: 'Form fields extracted successfully'
        });
      }
    } catch (extractionError) {
      logger.error('[MOBILE] Form field extraction error', {
        projectId,
        error: extractionError.message,
        stack: extractionError.stack
      });
      
      // Return partial success - allow manual entry
      res.status(200).json({
        success: false,
        extractedFields: {},
        confidence: 0,
        message: 'Could not extract form data from image. Please enter manually.',
        error: process.env.NODE_ENV === 'development' ? extractionError.message : undefined
      });
    }
  } catch (error) {
    logger.error('[MOBILE] Error in form field extraction endpoint', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

// POST /api/mobile/upload-defect/:projectId
// Upload defect photo and trigger browser automation
router.post('/upload-defect/:projectId', auth, upload.single('image'), async (req, res, next) => {
  const uploadId = uuidv4();
  
  try {
    const { projectId } = req.params;
    const { location, notes, defectType, latitude, longitude, formType, formData } = req.body;
    
    logger.info('[MOBILE] Defect upload started', {
      uploadId,
      projectId,
      userId: req.user.id,
      formType: formType || 'none'
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
    
    logger.info('[MOBILE] AI service configuration', {
      uploadId,
      aiServiceUrl: AI_SERVICE_URL,
      hasEnvVar: !!process.env.AI_SERVICE_URL
    });
    
    let defectResult;
    try {
      logger.debug('[MOBILE] Calling AI service for defect detection', {
        uploadId,
        url: `${AI_SERVICE_URL}/api/ai/detect-defects`,
        imageSize: imageBase64.length,
        projectId
      });
      
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
      
      logger.debug('[MOBILE] AI service response received', {
        uploadId,
        status: defectResponse.status,
        hasData: !!defectResponse.data
      });
      
      defectResult = defectResponse.data;
      
      // Validate response structure
      if (!defectResult) {
        throw new Error('AI service returned empty response');
      }
      
      // Ensure defects array exists
      if (!defectResult.defects) {
        defectResult.defects = [];
      }
      
      logger.info('[MOBILE] Defect detection completed', {
        uploadId,
        defectsFound: defectResult.defects?.length || 0,
        hasAssessment: !!defectResult.overall_assessment
      });
    } catch (aiError) {
      logger.error('[MOBILE] AI service error', {
        uploadId,
        error: aiError.message,
        code: aiError.code,
        responseStatus: aiError.response?.status,
        responseData: aiError.response?.data,
        stack: aiError.stack
      });
      
      // Handle connection errors
      if (aiError.code === 'ECONNREFUSED' || aiError.code === 'ETIMEDOUT' || aiError.code === 'ENOTFOUND') {
        return res.status(503).json({
          success: false,
          message: `AI service unavailable at ${AI_SERVICE_URL}. Please ensure the AI service is running and AI_SERVICE_URL is configured correctly.`,
          error: aiError.message,
          code: aiError.code
        });
      }
      
      // Handle HTTP errors from AI service
      if (aiError.response) {
        const errorData = aiError.response.data;
        const errorMessage = errorData?.error || errorData?.message || aiError.message;
        
        logger.error('[MOBILE] AI service HTTP error', {
          uploadId,
          status: aiError.response.status,
          statusText: aiError.response.statusText,
          data: errorData,
          errorMessage: errorMessage
        });
        
        // If AI service returns 500, it means there's an issue with the AI service itself
        // Return a more helpful error message
        return res.status(500).json({
          success: false,
          message: 'AI service encountered an error while processing the image',
          error: errorMessage,
          aiServiceStatus: aiError.response.status,
          suggestion: 'This may be due to: OpenAI API key issues, image processing errors, or AI service configuration problems. Check AI service logs for details.'
        });
      }
      
      // Handle other errors
      return res.status(500).json({
        success: false,
        message: 'Failed to detect defects in image',
        error: aiError.message,
        code: aiError.code
      });
    }
    
    // Create browser automation job in queue (non-blocking)
    let automationJobId = null;
    let automationStatus = 'queued';
    
    try {
      const jobQueue = require('../services/jobQueue');
      
      // Ensure queue is initialized
      if (!jobQueue.automationQueue) {
        await jobQueue.initialize();
      }
      
      // Create job in queue (will be processed by worker)
      const jobResult = await jobQueue.addAutomationJob({
        project_id: projectId,
        defect_data: defectResult,
        user_id: req.user.id,
        upload_id: uploadId,
        asbuilt_record_id: null // Will be updated after record creation
      });
      
      automationJobId = jobResult.jobId;
      automationStatus = 'queued';
      
      logger.info('[MOBILE] Browser automation job created', {
        uploadId,
        jobId: automationJobId,
        status: automationStatus
      });
    } catch (jobError) {
      logger.error('[MOBILE] Failed to create automation job', {
        uploadId,
        error: jobError.message
      });
      
      // Don't fail the upload if job creation fails - defects were still detected
      automationStatus = 'failed';
    }
    
    // Store form data in asbuilt_records if form type and data provided
    let asbuiltRecordId = null;
    if (formType && formData) {
      try {
        const AsbuiltService = require('../services/asbuiltService');
        const asbuiltService = new AsbuiltService();
        
        // Parse form data JSON string if needed
        let parsedFormData = formData;
        if (typeof formData === 'string') {
          try {
            parsedFormData = JSON.parse(formData);
          } catch (e) {
            logger.warn('[MOBILE] Failed to parse formData JSON', { error: e.message });
            parsedFormData = {};
          }
        }
        
        // Extract panel number from form data to find panel ID
        const panelNumber = parsedFormData.panelNumber || parsedFormData.panelNumbers;
        let panelId = null;
        
        if (panelNumber) {
          // Try to find panel in panel_layouts
          try {
            const panelLayoutsResult = await db
              .select()
              .from(panelLayouts)
              .where(eq(panelLayouts.projectId, projectId))
              .limit(1);
            
            if (panelLayoutsResult.length > 0) {
              const layout = panelLayoutsResult[0];
              if (layout.panels && Array.isArray(layout.panels)) {
                // Find panel by panelNumber in the panels array
                const panel = layout.panels.find((p) => 
                  p.panelNumber === panelNumber || 
                  p.panel_number === panelNumber ||
                  p.id === panelNumber
                );
                if (panel) {
                  panelId = panel.id || panel.panelId || uuidv4();
                }
              }
            }
          } catch (panelError) {
            logger.warn('[MOBILE] Could not find panel ID', { error: panelError.message });
          }
        }
        
        // Use a default panel ID if not found (required by schema)
        if (!panelId) {
          panelId = uuidv4();
          logger.info('[MOBILE] Using generated panel ID', { panelId });
        }
        
        // Create asbuilt record with source='mobile'
        const record = await asbuiltService.createRecord({
          projectId,
          panelId,
          domain: formType,
          sourceDocId: null,
          rawData: parsedFormData,
          mappedData: parsedFormData, // For mobile, raw and mapped are the same
          aiConfidence: 1.0, // User-entered data has 100% confidence
          requiresReview: false,
          createdBy: req.user.id,
          source: 'mobile' // Mark as mobile app submission
        });
        
        asbuiltRecordId = record.id;
        logger.info('[MOBILE] As-built record created', {
          recordId: asbuiltRecordId,
          domain: formType,
          panelId
        });
        
        // Update automation job with asbuilt_record_id if job was created
        if (automationJobId) {
          try {
            const { Pool } = require('pg');
            const pool = new Pool({
              connectionString: require('../config/env').databaseUrl,
              ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });
            
            await pool.query(
              'UPDATE automation_jobs SET asbuilt_record_id = $1, project_id = $2 WHERE job_id = $3',
              [asbuiltRecordId, projectId, automationJobId]
            );
            
            await pool.end();
            
            logger.info('[MOBILE] Updated automation job with asbuilt record ID', {
              jobId: automationJobId,
              recordId: asbuiltRecordId
            });
          } catch (updateError) {
            logger.warn('[MOBILE] Failed to update automation job with record ID', {
              error: updateError.message
            });
            // Don't fail - job will still process
          }
        }
      } catch (asbuiltError) {
        logger.error('[MOBILE] Failed to create as-built record', {
          error: asbuiltError.message,
          formType
        });
        // Don't fail the upload if as-built record creation fails
      }
    }
    
    // Return results
    const response = {
      success: true,
      defects: defectResult.defects || [],
      overall_assessment: defectResult.overall_assessment || 'Analysis complete',
      total_defects: defectResult.total_defects || 0,
      critical_defects: defectResult.critical_defects || 0,
      recommendations: defectResult.recommendations || [],
      automation_status: automationStatus,
      automation_job_id: automationJobId,
      form_type: formType || null,
      asbuilt_record_id: asbuiltRecordId,
      message: automationStatus === 'queued'
        ? 'Defect uploaded. Panel automation queued and will process in background.'
        : automationStatus === 'failed'
        ? 'Defect uploaded. Panel automation job creation failed.'
        : 'Defect uploaded. Panel layout update may be pending.',
      upload_id: uploadId
    };
    
    logger.info('[MOBILE] Upload completed successfully', {
      uploadId,
      defectsCount: response.defects.length,
      automationStatus
    });
    
    res.json(response);
    
  } catch (error) {
    logger.error('[MOBILE] Error processing defect upload', {
      uploadId,
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Return a proper error response instead of passing to error handler
    // This ensures the mobile app gets a consistent error format
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing the upload',
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      upload_id: uploadId
    });
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

