const express = require('express');
const router = express.Router();
const PanelLinkingService = require('../services/panelLinkingService');
const { auth } = require('../middlewares/auth');

// Initialize the panel linking service
const panelLinkingService = new PanelLinkingService();

/**
 * @route POST /api/document-processing/process-document
 * @desc Process a specific document and link data to panels
 * @access Private
 */
router.post('/process-document', auth, async (req, res) => {
  try {
    const { documentId, projectId } = req.body;
    const userId = req.user.id;

    if (!documentId || !projectId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'documentId and projectId are required'
      });
    }

    console.log(`🚀 [DOCUMENT_PROCESSING] Processing document ${documentId} for project ${projectId}`);

    const result = await panelLinkingService.processDocument({ id: documentId }, projectId, userId);

    res.json(result);
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({
      error: 'Document processing failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/document-processing/process-all
 * @desc Process all documents for a project and link data to panels
 * @access Private
 */
router.post('/process-all', auth, async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'projectId is required'
      });
    }

    console.log(`🚀 [DOCUMENT_PROCESSING] Processing all documents for project ${projectId}`);

    const result = await panelLinkingService.processDocumentsForProject(projectId, userId);

    res.json(result);
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({
      error: 'Document processing failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/document-processing/status/:projectId
 * @desc Get processing status for a project
 * @access Private
 */
router.get('/status/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await panelLinkingService.getProcessingStatus(projectId);
    res.json(result);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/document-processing/create-test-data
 * @desc Create test as-built data for demonstration
 * @access Private
 */
router.post('/create-test-data', auth, async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'projectId is required'
      });
    }

    console.log(`🧪 [DOCUMENT_PROCESSING] Creating test data for project ${projectId}`);

    const recordsCreated = await panelLinkingService.createTestAsbuiltData(projectId, userId);

    res.json({
      success: true,
      projectId,
      recordsCreated,
      message: `Created ${recordsCreated} test as-built records`
    });
  } catch (error) {
    console.error('Test data creation error:', error);
    res.status(500).json({
      error: 'Test data creation failed',
      message: error.message
    });
  }
});

module.exports = router;
