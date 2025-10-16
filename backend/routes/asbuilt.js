const express = require('express');
const multer = require('multer');
const router = express.Router();
const AsbuiltService = require('../services/asbuiltService');
const AsbuiltImportAI = require('../services/asbuiltImportAI');
const { supabase } = require('../lib/supabase-server');
const { auth } = require('../middlewares/auth');

// Initialize the services
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
 * @route GET /api/asbuilt/records/:recordId
 * @desc Get a single as-built record by ID
 * @access Private
 */
router.get('/records/:recordId', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    
    console.log(`👁️ [ASBUILT] Fetching record ${recordId}`);
    
    const record = await asbuiltService.getRecordById(recordId);
    
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
    console.error('❌ [ASBUILT] Error fetching record:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch record'
    });
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
 * @route GET /api/asbuilt/:projectId/files
 * @desc Get all file metadata for a project
 * @access Private
 */
router.get('/:projectId/files', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`📁 [ASBUILT] Fetching file metadata for project ${projectId}`);
    
    const { data: files, error } = await supabase
      .from('file_metadata')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      files: files || [],
      count: files?.length || 0
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error fetching file metadata:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch file metadata',
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
    
    // For project-wide imports, process the file once and let AI detect the domain
    const domains = importScope === 'project-wide' 
      ? ['auto-detect'] // Let AI detect the domain from content
      : ['panel_specs']; // Default domain for single imports
    
    const allCreatedRecords = [];
    const detectedPanels = new Set();
    const processedDomains = [];
    let fileMetadata = null;
    let latestImportResult = null;
    
    for (const domain of domains) {
      try {
        console.log(`🤖 [ASBUILT] Processing domain: ${domain}`);
        
        // Process the Excel file using enhanced AI import service
        const importResult = await asbuiltImportAI.importExcelData(
          excelFile.buffer,
          projectId,
          domain === 'auto-detect' ? null : domain, // Let AI auto-detect the domain
          userId,
          {
            fileName: excelFile.originalname,
            fileSize: excelFile.size,
            fileType: excelFile.mimetype
          }
        );
        
        // Store the latest import result for response
        latestImportResult = importResult;
        
        if (importResult.records && importResult.records.length > 0) {
          console.log(`📊 [ASBUILT] AI processed ${importResult.records.length} records for ${domain}`);
          
          // Insert records into database
          for (const recordData of importResult.records) {
            try {
              // Validate required fields before database insertion
              if (!recordData.panelId) {
                console.error(`❌ [ASBUILT] Record missing panelId:`, recordData);
                continue;
              }
              
              if (!recordData.projectId) {
                console.error(`❌ [ASBUILT] Record missing projectId:`, recordData);
                continue;
              }
              
              console.log(`💾 [ASBUILT] Creating record with panelId: ${recordData.panelId}`);
              
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
              
              console.log(`✅ [ASBUILT] Successfully created record: ${record.id}`);
            } catch (recordError) {
              console.error(`❌ [ASBUILT] Failed to create record for ${domain}:`, recordError.message);
              console.error(`❌ [ASBUILT] Record data:`, JSON.stringify(recordData, null, 2));
            }
          }
          
          if (importResult.detectedPanels) {
            importResult.detectedPanels.forEach(panel => detectedPanels.add(panel));
          }
          
          // Use the detected domain from AI instead of the requested domain
          if (importResult.detectedDomains && importResult.detectedDomains.length > 0) {
            processedDomains.push(...importResult.detectedDomains);
          } else {
            processedDomains.push(domain);
          }
        }
      } catch (domainError) {
        console.warn(`⚠️ [ASBUILT] Error processing domain ${domain}:`, domainError.message);
      }
    }
    
    // Create file metadata entry for the imported Excel file
    if (allCreatedRecords.length > 0 || processedDomains.length > 0) {
      try {
        console.log(`📁 [ASBUILT] Creating file metadata for imported Excel file`);
        
        // Create file metadata directly in database
        const { data: fileData, error: fileError } = await supabase
          .from('file_metadata')
          .insert({
            file_name: excelFile.originalname,
            file_type: 'excel',
            file_size: excelFile.size,
            project_id: projectId,
            uploaded_by: userId,
            domain: processedDomains[0] || 'general',
            panel_id: null, // Project-wide file
            metadata: {
              importedRecords: allCreatedRecords.length,
              processedDomains: processedDomains,
              detectedPanels: Array.from(detectedPanels),
              importScope: importScope,
              importDate: new Date().toISOString()
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (fileError) {
          throw fileError;
        }
        
        fileMetadata = fileData;
        
        console.log(`✅ [ASBUILT] Created file metadata:`, fileMetadata.id);
      } catch (fileError) {
        console.error(`❌ [ASBUILT] Error creating file metadata:`, fileError.message);
      }
    }
    
    console.log(`✅ [ASBUILT] Import completed: ${allCreatedRecords.length} records created`);
    console.log(`🎯 [ASBUILT] Detected panels:`, Array.from(detectedPanels));
    
    // Use the stored latest import result for AI analysis
    
    res.json({
      success: true,
      records: allCreatedRecords,
      count: allCreatedRecords.length,
      detectedPanels: Array.from(detectedPanels),
      processedDomains,
      fileMetadata: fileMetadata,
      
      // NEW: Enhanced AI Analysis Response
      aiAnalysis: latestImportResult.aiAnalysis || null,
      breakdown: latestImportResult.breakdown || null,
      duplicates: latestImportResult.duplicates || [],
      conflicts: latestImportResult.conflicts || [],
      
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

/**
 * @route DELETE /api/asbuilt/files/:fileId
 * @desc Delete a file and its associated records
 * @access Private
 */
router.delete('/files/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;
    
    console.log(`🗑️ [ASBUILT] Deleting file ${fileId}`);
    
    // Get file metadata first
    const { data: fileData, error: fileError } = await supabase
      .from('file_metadata')
      .select('*')
      .eq('id', fileId)
      .single();
    
    if (fileError || !fileData) {
      return res.status(404).json({ 
        success: false,
        error: 'File not found'
      });
    }
    
    // Check if user has permission to delete this file
    if (fileData.uploaded_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this file'
      });
    }
    
    // Delete associated records first
    const { error: recordsError } = await supabase
      .from('asbuilt_records')
      .delete()
      .eq('source_doc_id', fileId);
    
    if (recordsError) {
      console.error('❌ [ASBUILT] Error deleting associated records:', recordsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete associated records'
      });
    }
    
    // Delete file metadata
    const { error: deleteError } = await supabase
      .from('file_metadata')
      .delete()
      .eq('id', fileId);
    
    if (deleteError) {
      console.error('❌ [ASBUILT] Error deleting file metadata:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete file'
      });
    }
    
    console.log(`✅ [ASBUILT] File ${fileId} and associated records deleted successfully`);
    
    res.json({
      success: true,
      message: 'File and associated records deleted successfully'
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error deleting file:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete file',
      message: error.message 
    });
  }
});

module.exports = router;
