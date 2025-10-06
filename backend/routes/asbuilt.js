const express = require('express');
const router = express.Router();
const AsbuiltService = require('../services/asbuiltService');
const { auth } = require('../middlewares/auth');

// Initialize the as-built service
const asbuiltService = new AsbuiltService();

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
 * @desc Import Excel data for as-built records
 * @access Private
 */
router.post('/import', auth, async (req, res) => {
  try {
    const { projectId, panelId, domain, records } = req.body;
    
    console.log(`📥 [ASBUILT] Importing ${records?.length || 0} records for project ${projectId}`);
    
    const createdRecords = [];
    
    for (const recordData of records || []) {
      try {
        const record = await asbuiltService.createRecord({
          ...recordData,
          projectId,
          panelId,
          createdBy: req.user?.id
        });
        createdRecords.push(record);
      } catch (recordError) {
        console.warn(`⚠️ [ASBUILT] Failed to create record:`, recordError.message);
      }
    }
    
    res.json({
      success: true,
      records: createdRecords,
      count: createdRecords.length,
      message: `Successfully imported ${createdRecords.length} records`
    });
  } catch (error) {
    console.error('❌ [ASBUILT] Error importing records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import records',
      message: error.message
    });
  }
});

module.exports = router;
