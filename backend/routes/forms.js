const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const formReviewService = require('../services/formReviewService');

/**
 * @route GET /api/forms/:projectId
 * @desc Get forms for a project with pagination and filters
 * @access Private
 */
router.get('/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      status = 'all',
      source = 'mobile', // Default to mobile app forms
      domain = 'all',
      limit = 50,
      offset = 0,
      search
    } = req.query;

    console.log(`📋 [FORMS] Fetching forms for project ${projectId}`, {
      status,
      source,
      domain,
      limit,
      offset
    });

    const forms = await formReviewService.getForms(projectId, {
      status,
      source,
      domain,
      limit: parseInt(limit),
      offset: parseInt(offset),
      search
    });

    res.json({
      success: true,
      forms,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: forms.length
      }
    });
  } catch (error) {
    console.error('❌ [FORMS] Error fetching forms:', error);
    console.error('❌ [FORMS] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch forms',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route GET /api/forms/:projectId/stats
 * @desc Get form statistics for a project
 * @access Private
 */
router.get('/:projectId/stats', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { source = 'mobile' } = req.query;

    console.log(`📊 [FORMS] Fetching stats for project ${projectId}`);

    const stats = await formReviewService.getFormStats(projectId, source);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ [FORMS] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch form statistics',
      message: error.message
    });
  }
});

/**
 * @route GET /api/forms/:projectId/pending
 * @desc Get pending forms count
 * @access Private
 */
router.get('/:projectId/pending', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { source = 'mobile' } = req.query;

    const count = await formReviewService.getPendingCount(projectId, source);

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('❌ [FORMS] Error fetching pending count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending count',
      message: error.message
    });
  }
});

/**
 * @route POST /api/forms/:recordId/approve
 * @desc Approve a form
 * @access Private
 */
router.post('/:recordId/approve', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;

    console.log(`✅ [FORMS] Approving form ${recordId}`);

    const form = await formReviewService.approveForm(recordId, userId, notes);

    res.json({
      success: true,
      form,
      message: 'Form approved successfully'
    });
  } catch (error) {
    console.error('❌ [FORMS] Error approving form:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve form',
      message: error.message
    });
  }
});

/**
 * @route POST /api/forms/:recordId/reject
 * @desc Reject a form
 * @access Private
 */
router.post('/:recordId/reject', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { reason, notes } = req.body;
    const userId = req.user.id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    console.log(`❌ [FORMS] Rejecting form ${recordId}`);

    const form = await formReviewService.rejectForm(recordId, userId, reason, notes);

    res.json({
      success: true,
      form,
      message: 'Form rejected successfully'
    });
  } catch (error) {
    console.error('❌ [FORMS] Error rejecting form:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject form',
      message: error.message
    });
  }
});

/**
 * @route POST /api/forms/bulk-approve
 * @desc Bulk approve forms
 * @access Private
 */
router.post('/bulk-approve', auth, async (req, res) => {
  try {
    const { recordIds, notes } = req.body;
    const userId = req.user.id;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'recordIds array is required'
      });
    }

    console.log(`✅ [FORMS] Bulk approving ${recordIds.length} forms`);

    const result = await formReviewService.bulkApprove(recordIds, userId, notes);

    res.json({
      success: true,
      ...result,
      message: `${result.approved} forms approved successfully`
    });
  } catch (error) {
    console.error('❌ [FORMS] Error bulk approving forms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk approve forms',
      message: error.message
    });
  }
});

/**
 * @route POST /api/forms/bulk-reject
 * @desc Bulk reject forms
 * @access Private
 */
router.post('/bulk-reject', auth, async (req, res) => {
  try {
    const { recordIds, reason, notes } = req.body;
    const userId = req.user.id;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'recordIds array is required'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    console.log(`❌ [FORMS] Bulk rejecting ${recordIds.length} forms`);

    const result = await formReviewService.bulkReject(recordIds, userId, reason, notes);

    res.json({
      success: true,
      ...result,
      message: `${result.rejected} forms rejected successfully`
    });
  } catch (error) {
    console.error('❌ [FORMS] Error bulk rejecting forms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk reject forms',
      message: error.message
    });
  }
});

module.exports = router;

