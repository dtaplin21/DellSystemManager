const express = require('express');
const router = express.Router();
const AsbuiltService = require('../services/asbuiltService');
const AsbuiltImportAI = require('../services/asbuiltImportAI');
const AsbuiltValidationService = require('../services/asbuiltValidationService');
const { auth } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize services
const asbuiltService = new AsbuiltService();
const asbuiltImportAI = new AsbuiltImportAI();
const asbuiltValidationService = new AsbuiltValidationService();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Use memory storage for Excel processing
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'));
    }
  }
});

// Test endpoint without authentication (for debugging only)
router.get('/_test/:projectId/:panelId', async (req, res) => {
  try {
    const { projectId, panelId } = req.params;
    
    console.log('🧪 [TEST] Testing data fetch without auth:', { projectId, panelId });
    
    // Directly fetch data without auth
    const records = await asbuiltService.getPanelRecords(projectId, panelId);
    
    // Group records by domain
    const groupedRecords = {
      panelPlacement: [],
      panelSeaming: [],
      nonDestructive: [],
      trialWeld: [],
      repairs: [],
      destructive: []
    };

    if (records && Array.isArray(records)) {
      records.forEach(record => {
        const domain = record.domain;
        // Map database domain values to frontend keys
        let mappedKey;
        switch (domain) {
          case 'panel_placement':
            mappedKey = 'panelPlacement';
            break;
          case 'panel_seaming':
            mappedKey = 'panelSeaming';
            break;
          case 'non_destructive':
            mappedKey = 'nonDestructive';
            break;
          case 'trial_weld':
            mappedKey = 'trialWeld';
            break;
          case 'repairs':
            mappedKey = 'repairs';
            break;
          case 'destructive':
            mappedKey = 'destructive';
            break;
          default:
            console.warn('Unknown domain:', domain);
            return;
        }
        if (groupedRecords[mappedKey]) {
          groupedRecords[mappedKey].push(record);
        }
      });
    }

    res.json({
      success: true,
      projectId,
      panelId,
      records: groupedRecords,
      totalRecords: records?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🔥 [TEST] Test endpoint failed:', error);
    res.status(500).json({ 
      error: 'Test endpoint failed', 
      detail: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Apply middleware
router.use(auth);

/**
 * @route POST /api/asbuilt/import
 * @desc Import Excel workbook and create asbuilt records
 * @access Private
 */
router.post('/import', upload.single('excelFile'), async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No Excel file provided',
        message: 'Please upload an Excel file for import'
      });
    }

    const excelFile = req.file;
    
    // Validate file type
    if (!excelFile.mimetype.includes('spreadsheet') && 
        !excelFile.mimetype.includes('excel') &&
        !excelFile.originalname.endsWith('.xlsx') &&
        !excelFile.originalname.endsWith('.xls')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Please upload a valid Excel file (.xlsx or .xls)'
      });
    }

    console.log(`📁 Processing Excel file: ${excelFile.originalname} (${excelFile.size} bytes)`);

    // Process the Excel file using AI import service (auto-detect domain and panels)
    const importResult = await asbuiltImportAI.importExcelData(
      excelFile.buffer, // multer stores file in buffer
      projectId,
      null, // Let AI auto-detect domain
      userId
    );

    // If records were successfully processed, insert them into the database
    if (importResult.records && importResult.records.length > 0) {
      try {
        const insertedRecords = await asbuiltService.bulkInsertRecords(importResult.records);
        console.log(`✅ Successfully inserted ${insertedRecords.length} records into database`);
        
        // Update the import result with actual database records
        importResult.importedRows = insertedRecords.length;
        importResult.databaseRecords = insertedRecords;
      } catch (dbError) {
        console.error('Database insertion failed:', dbError);
        importResult.databaseError = dbError.message;
        importResult.importedRows = 0;
      }
    }

    res.json(importResult);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Import failed', 
      message: error.message 
    });
  }
});

/**
 * @route GET /api/asbuilt/_debug/:projectId/:panelId
 * @desc Debug endpoint to check panel existence and database connectivity
 * @access Private
 */
router.get('/_debug/:projectId/:panelId', async (req, res) => {
  try {
    const { projectId, panelId } = req.params;
    
    console.log('🔍 [DEBUG] Checking panel existence:', { projectId, panelId });
    
    // Check if project exists in projects table
    const projectExists = await asbuiltService.checkProjectExists(projectId);
    
    // Check if panel exists in panel_layouts table
    const panelExists = await asbuiltService.checkPanelExists(projectId, panelId);
    
    // Check database connectivity
    const dbOk = await asbuiltService.checkDatabaseConnection();
    
    res.json({
      projectId,
      panelId,
      projectExists,
      panelExists,
      dbOk,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🔥 [DEBUG] Debug endpoint failed:', error);
    res.status(500).json({ 
      error: 'Debug endpoint failed', 
      detail: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});



/**
 * @route GET /api/asbuilt/:projectId/:panelId
 * @desc Get all asbuilt records for a specific panel
 * @access Private
 */
router.get('/:projectId/:panelId', async (req, res) => {
  try {
    const { projectId, panelId } = req.params;
    
    // Enhanced validation as suggested
    if (!projectId || !panelId) {
      console.error('❌ Missing parameters:', { projectId, panelId });
      return res.status(400).json({ 
        error: "Missing projectId or panelId",
        received: { projectId, panelId }
      });
    }
    
    // Optional: verify UUID format for projectId
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
      console.log('❌ Invalid projectId format:', projectId);
      return res.status(400).json({ 
        error: 'Invalid projectId format',
        projectId,
        expected: 'UUID format (e.g., 69fc302b-166d-4543-9990-89c4b1e0ed59)'
      });
    }
    
    console.log('🔍 [ASBUILT] Fetching records for:', { projectId, panelId });
    
    // Get all records for the panel
    const records = await asbuiltService.getPanelRecords(projectId, panelId);
    console.log('🔍 [ASBUILT] Records fetched:', { count: records?.length || 0 });
    
    // Group records by domain
    const groupedRecords = {
      panelPlacement: [],
      panelSeaming: [],
      nonDestructive: [],
      trialWeld: [],
      repairs: [],
      destructive: []
    };

    if (records && Array.isArray(records)) {
      records.forEach(record => {
        const domain = record.domain;
        // Map database domain values to frontend keys
        let mappedKey;
        switch (domain) {
          case 'panel_placement':
            mappedKey = 'panelPlacement';
            break;
          case 'panel_seaming':
            mappedKey = 'panelSeaming';
            break;
          case 'non_destructive':
            mappedKey = 'nonDestructive';
            break;
          case 'trial_weld':
            mappedKey = 'trialWeld';
            break;
          case 'repairs':
            mappedKey = 'repairs';
            break;
          case 'destructive':
            mappedKey = 'destructive';
            break;
          default:
            console.warn('Unknown domain:', domain);
            return;
        }
        if (groupedRecords[mappedKey]) {
          groupedRecords[mappedKey].push(record);
        }
      });
    }

    // Get right neighbor peek (placeholder for now) - with error handling
    let rightNeighborPeek = null;
    try {
      rightNeighborPeek = await asbuiltService.findRightNeighbor(projectId, panelId);
    } catch (neighborError) {
      console.warn('⚠️ [ASBUILT] Right neighbor lookup failed (non-critical):', neighborError.message);
      // Don't fail the entire request for this non-critical feature
      rightNeighborPeek = null;
    }

    const response = {
      ...groupedRecords,
      rightNeighborPeek
    };

    console.log('✅ [ASBUILT] Successfully returning response for panel:', panelId);
    res.json(response);
  } catch (error) {
    console.error('🔥 /api/asbuilt route failed:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      detail: error?.message || String(error),
      projectId: req.params.projectId,
      panelId: req.params.panelId
    });
  }
});

/**
 * @route GET /api/asbuilt/:projectId/:panelId/:domain
 * @desc Get records for a specific domain and panel
 * @access Private
 */
router.get('/:projectId/:panelId/:domain', async (req, res) => {
  try {
    const { projectId, panelId, domain } = req.params;
    
    const records = await asbuiltService.getDomainRecords(projectId, panelId, domain);
    res.json(records);
  } catch (error) {
    console.error('Error fetching domain records:', error);
    res.status(500).json({ 
      error: 'Failed to fetch domain records', 
      message: error.message 
    });
  }
});

/**
 * @route POST /api/asbuilt/manual
 * @desc Create a manual asbuilt record
 * @access Private
 */
router.post('/manual', async (req, res) => {
  try {
    const { projectId, panelId, domain, data } = req.body;
    const userId = req.user.id;

    const recordData = {
      projectId,
      panelId,
      domain,
      rawData: data, // Store original data as raw
      mappedData: data, // For manual entry, mapped = raw
      aiConfidence: 1.0, // Manual entry has 100% confidence
      requiresReview: false,
      createdBy: userId
    };

    const newRecord = await asbuiltService.createRecord(recordData);
    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error creating manual record:', error);
    res.status(500).json({ 
      error: 'Failed to create record', 
      message: error.message 
    });
  }
});

/**
 * @route PUT /api/asbuilt/:recordId
 * @desc Update an existing asbuilt record
 * @access Private
 */
router.put('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { mappedData, requiresReview } = req.body;

    const updatedRecord = await asbuiltService.updateRecord(recordId, {
      mappedData,
      requiresReview
    });

    res.json(updatedRecord);
  } catch (error) {
    console.error('Error updating record:', error);
    res.status(500).json({ 
      error: 'Failed to update record', 
      message: error.message 
    });
  }
});

/**
 * @route DELETE /api/asbuilt/:recordId
 * @desc Delete an asbuilt record
 * @access Private
 */
router.delete('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    
    const deletedRecord = await asbuiltService.deleteRecord(recordId);
    res.json({ message: 'Record deleted successfully', record: deletedRecord });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ 
      error: 'Failed to delete record', 
      message: error.message 
    });
  }
});

/**
 * @route POST /api/asbuilt/:recordId/approve
 * @desc Approve a record (remove review flag)
 * @access Private
 */
router.post('/:recordId/approve', async (req, res) => {
  try {
    const { recordId } = req.params;
    
    const approvedRecord = await asbuiltService.approveRecord(recordId);
    res.json(approvedRecord);
  } catch (error) {
    console.error('Error approving record:', error);
    res.status(500).json({ 
      error: 'Failed to approve record', 
      message: error.message 
    });
  }
});

/**
 * @route GET /api/asbuilt/:projectId/review-required
 * @desc Get all records requiring review for a project
 * @access Private
 */
router.get('/:projectId/review-required', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const records = await asbuiltService.getRecordsRequiringReview(projectId);
    res.json(records);
  } catch (error) {
    console.error('Error fetching records requiring review:', error);
    res.status(500).json({ 
      error: 'Failed to fetch records requiring review', 
      message: error.message 
    });
  }
});

/**
 * @route GET /api/asbuilt/:projectId/panel-summary/:panelId
 * @desc Get summary statistics for a panel
 * @access Private
 */
router.get('/:projectId/panel-summary/:panelId', async (req, res) => {
  try {
    const { projectId, panelId } = req.params;
    
    const summary = await asbuiltService.getPanelSummary(projectId, panelId);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching panel summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch panel summary', 
      message: error.message 
    });
  }
});

/**
 * @route POST /api/asbuilt/validate
 * @desc Validate asbuilt data without importing
 * @access Private
 */
router.post('/validate', async (req, res) => {
  try {
    const { projectId, domain, data } = req.body;
    const userId = req.user.id;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        error: 'Invalid data format',
        message: 'Data must be an array of records'
      });
    }

    console.log(`🔍 Validating ${data.length} records for domain: ${domain}`);

    // Use enhanced validation service
    const validationResults = asbuiltValidationService.validateRecords(data, domain);
    
    // Perform cross-reference validation
    const crossRefResults = await asbuiltValidationService.crossReferenceValidation(
      data, domain, projectId
    );

    // Combine validation results
    const response = {
      totalRecords: validationResults.totalRecords,
      validRecords: validationResults.validRecords,
      invalidRecords: validationResults.invalidRecords,
      validationScore: validationResults.validationScore,
      requiresReview: validationResults.requiresReview,
      validationResults: validationResults.results,
      crossReferenceResults: crossRefResults,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      error: 'Validation failed', 
      message: error.message 
    });
  }
});

/**
 * @route GET /api/asbuilt/:projectId/summary
 * @desc Get as-built data summary for a project
 * @access Private
 */
router.get('/:projectId/summary', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get summary data for all domains
    const summaryData = await asbuiltService.getProjectSummary(projectId);
    
    res.json(summaryData);
  } catch (error) {
    console.error('Error fetching as-built summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch as-built summary', 
      message: error.message 
    });
  }
});

/**
 * @route GET /api/asbuilt/domains
 * @desc Get available domains and their field mappings
 * @access Private
 */
router.get('/domains', async (req, res) => {
  try {
    const domains = {
      panel_placement: {
        name: 'Panel Placement',
        description: 'Panel placement and location information',
        fields: asbuiltImportAI.canonicalFields.panel_placement,
        required: ['dateTime', 'panelNumber']
      },
      panel_seaming: {
        name: 'Panel Seaming',
        description: 'Panel seaming and welding data',
        fields: asbuiltImportAI.canonicalFields.panel_seaming,
        required: ['dateTime', 'panelNumbers', 'seamerInitials']
      },
      non_destructive: {
        name: 'Non-Destructive Testing',
        description: 'Non-destructive testing results',
        fields: asbuiltImportAI.canonicalFields.non_destructive,
        required: ['dateTime', 'panelNumbers', 'operatorInitials']
      },
      trial_weld: {
        name: 'Trial Weld',
        description: 'Trial welding test data',
        fields: asbuiltImportAI.canonicalFields.trial_weld,
        required: ['dateTime', 'seamerInitials', 'passFail']
      },
      repairs: {
        name: 'Repairs',
        description: 'Panel repair information',
        fields: asbuiltImportAI.canonicalFields.repairs,
        required: ['date', 'repairId', 'panelNumbers']
      },
      destructive: {
        name: 'Destructive Testing',
        description: 'Destructive testing results',
        fields: asbuiltImportAI.canonicalFields.destructive,
        required: ['date', 'panelNumbers', 'sampleId', 'passFail']
      }
    };

    res.json(domains);
  } catch (error) {
    console.error('Error fetching domains:', error);
    res.status(500).json({ 
      error: 'Failed to fetch domains', 
      message: error.message 
    });
  }
});

/**
 * @route GET /api/asbuilt/:projectId/validation-summary
 * @desc Get validation summary for a project
 * @access Private
 */
router.get('/:projectId/validation-summary', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const validationSummary = await asbuiltValidationService.getProjectValidationSummary(projectId);
    res.json(validationSummary);
  } catch (error) {
    console.error('Error fetching validation summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch validation summary', 
      message: error.message 
    });
  }
});

module.exports = router;
