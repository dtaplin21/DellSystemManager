const express = require('express');
const multer = require('multer');
const router = express.Router();
const AsbuiltService = require('../services/asbuiltService');
const AsbuiltImportAI = require('../services/asbuiltImportAI');
const FileService = require('../services/fileService');
const { auth } = require('../middlewares/auth');

// Initialize the as-built service
const asbuiltService = new AsbuiltService();
const asbuiltImportAI = new AsbuiltImportAI();

// Configure multer for Excel file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || 
        file.mimetype.includes('excel') ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

/**
 * @route GET /api/asbuilt/:projectId/summary
 * @desc Get project summary statistics
 * @access Private
 */
router.get('/:projectId/summary', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`📊 [ASBUILT] Fetching summary for project ${projectId}`);
    
    const summary = await asbuiltService.getProjectSummary(projectId);
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary',
      message: error.message
    });
  }
});

/**
 * @route GET /api/asbuilt/:projectId/:panelId
 * @desc Get all as-built records for a specific panel
 * @access Private
 */
router.get('/:projectId/:panelId', auth, async (req, res) => {
  try {
    const { projectId, panelId } = req.params;
    
    console.log(`🔍 [ASBUILT] Fetching records for project ${projectId}, panel ${panelId}`);
    
    const records = await asbuiltService.getPanelRecords(projectId, panelId);
    
    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error fetching panel records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch panel records',
      message: error.message
    });
  }
});

/**
 * @route GET /api/asbuilt/:projectId
 * @desc Get all as-built records for a project
 * @access Private
 */
router.get('/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 100, offset = 0, domain } = req.query;
    
    console.log(`🔍 [ASBUILT] Fetching records for project ${projectId}`);
    
    let records;
    if (domain) {
      records = await asbuiltService.getRecordsByDomain(projectId, domain);
    } else {
      records = await asbuiltService.getProjectRecords(projectId, parseInt(limit), parseInt(offset));
    }
    
    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error fetching project records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project records',
      message: error.message
    });
  }
});

/**
 * @route POST /api/asbuilt/:projectId/:panelId
 * @desc Create a new as-built record
 * @access Private
 */
router.post('/:projectId/:panelId', auth, async (req, res) => {
  try {
    const { projectId, panelId } = req.params;
    const recordData = {
      ...req.body,
      projectId,
      panelId,
      createdBy: req.user?.id
    };
    
    console.log(`📝 [ASBUILT] Creating record for project ${projectId}, panel ${panelId}`);
    
    const record = await asbuiltService.createRecord(recordData);
    
    res.status(201).json({
      success: true,
      record
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error creating record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create record',
      message: error.message
    });
  }
});

/**
 * @route PUT /api/asbuilt/:recordId
 * @desc Update an as-built record
 * @access Private
 */
router.put('/:recordId', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const updateData = req.body;
    
    console.log(`✏️ [ASBUILT] Updating record ${recordId}`);
    
    const record = await asbuiltService.updateRecord(recordId, updateData);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }
    
    res.json({
      success: true,
      record
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error updating record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update record',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/asbuilt/:recordId
 * @desc Delete an as-built record
 * @access Private
 */
router.delete('/:recordId', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    
    console.log(`🗑️ [ASBUILT] Deleting record ${recordId}`);
    
    const record = await asbuiltService.deleteRecord(recordId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Record deleted successfully'
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error deleting record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete record',
      message: error.message
    });
  }
});


/**
 * @route POST /api/asbuilt/import
 * @desc Import Excel file and create as-built records
 * @access Private
 */
router.post('/import', auth, upload.single('excelFile'), async (req, res) => {
  try {
    const { projectId, importScope } = req.body;
    const userId = req.user?.id;
    
    console.log(`📥 [ASBUILT] Import request for project ${projectId}, scope: ${importScope}`);
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No Excel file provided',
        message: 'Please upload an Excel file for import'
      });
    }
    
    const excelFile = req.file;
    console.log(`📁 [ASBUILT] Processing Excel file: ${excelFile.originalname} (${excelFile.size} bytes)`);
    
    // For project-wide imports, we'll process all domains
    const domains = importScope === 'project-wide' 
      ? ['panel_specs', 'seaming', 'testing', 'trial_weld', 'repairs', 'destructive']
      : ['panel_specs']; // Default domain
    
    const allCreatedRecords = [];
    const detectedPanels = new Set();
    const processedDomains = [];
    
    for (const domain of domains) {
      try {
        console.log(`🤖 [ASBUILT] Processing domain: ${domain}`);
        
        // Process the Excel file using AI import service
        const importResult = await asbuiltImportAI.importExcelData(
          excelFile.buffer,
          projectId,
          domain,
          userId
        );
        
        if (importResult.records && importResult.records.length > 0) {
          console.log(`📊 [ASBUILT] AI processed ${importResult.records.length} records for ${domain}`);
          
          // Insert records into database
          for (const recordData of importResult.records) {
            try {
              const record = await asbuiltService.createRecord({
                ...recordData,
                projectId,
                createdBy: userId
              });
              allCreatedRecords.push(record);
              
              // Track detected panels
              if (recordData.mappedData?.panelNumber) {
                detectedPanels.add(recordData.mappedData.panelNumber);
              }
            } catch (recordError) {
              console.warn(`⚠️ [ASBUILT] Failed to create record for ${domain}:`, recordError.message);
            }
          }
          
          if (importResult.detectedPanels) {
            importResult.detectedPanels.forEach(panel => detectedPanels.add(panel));
          }
          
          processedDomains.push(domain);
        }
      } catch (domainError) {
        console.warn(`⚠️ [ASBUILT] Error processing domain ${domain}:`, domainError.message);
      }
    }
    
    console.log(`✅ [ASBUILT] Import completed: ${allCreatedRecords.length} records created`);
    console.log(`🎯 [ASBUILT] Detected panels:`, Array.from(detectedPanels));
    
    res.json({
      success: true,
      records: allCreatedRecords,
      count: allCreatedRecords.length,
      detectedPanels: Array.from(detectedPanels),
      processedDomains,
      message: `Successfully imported ${allCreatedRecords.length} records across ${processedDomains.length} domains`
    });
    
  } catch (error) {
    console.error('❌ [ASBUILT] Error importing Excel file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import Excel file',
      message: error.message
    });
  }
});

module.exports = router;
