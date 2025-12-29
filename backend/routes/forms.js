const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const formReviewService = require('../services/formReviewService');
const axios = require('axios');
const logger = require('../lib/logger');

/**
 * @route GET /api/forms/:projectId
 * @desc Get forms for a project with pagination and filters
 * @access Private
 */
router.get('/:projectId', auth, async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🔵 [FORMS] === REQUEST RECEIVED ===`, {
    requestId,
    method: req.method,
    path: req.path,
    projectId: req.params.projectId,
    query: req.query,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      'x-dev-bypass': req.headers['x-dev-bypass'] || 'Not set'
    }
  });
  
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
      requestId,
      status,
      source,
      domain,
      limit,
      offset,
      search
    });

    const forms = await formReviewService.getForms(projectId, {
      status,
      source,
      domain,
      limit: parseInt(limit),
      offset: parseInt(offset),
      search
    });

    console.log(`📋 [FORMS] Forms returned:`, {
      requestId,
      count: forms.length,
      projectId,
      status,
      source,
      domain,
      firstFormId: forms[0]?.id,
      firstFormStatus: forms[0]?.status,
      firstFormSource: forms[0]?.source
    });

    console.log(`✅ [FORMS] === REQUEST COMPLETE ===`, {
      requestId,
      statusCode: 200,
      formsCount: forms.length
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
    console.error(`❌ [FORMS] === REQUEST ERROR ===`, {
      requestId,
      error: error.message,
      stack: error.stack,
      projectId: req.params.projectId
    });
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

/**
 * @route POST /api/forms/:recordId/ai-review
 * @desc Trigger AI review workflow for a form
 * @access Private
 */
router.post('/:recordId/ai-review', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const userId = req.user.id;
    
    logger.info(`[FORMS] Triggering AI review for form ${recordId}`);
    
    // Get form record
    const forms = await formReviewService.getForms(null, {});
    const form = forms.find(f => f.id === recordId);
    
    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'Form not found'
      });
    }
    
    // Call AI service to trigger review workflow
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:5001';
    
    try {
      const aiResponse = await axios.post(
        `${aiServiceUrl}/api/automate-from-form`,
        {
          form_record: form,
          project_id: form.project_id,
          user_id: userId,
          item_type: form.domain === 'panel_placement' ? 'panel' : 
                     form.domain === 'repairs' ? 'patch' : 
                     form.domain === 'destructive' ? 'destructive_test' : null
        },
        {
          timeout: 300000, // 5 minute timeout for workflow
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info(`[FORMS] AI review completed for form ${recordId}`, {
        success: aiResponse.data.success,
        workflow_result: aiResponse.data
      });
      
      res.json({
        success: true,
        ai_review: aiResponse.data,
        message: 'AI review workflow completed'
      });
    } catch (aiError) {
      logger.error(`[FORMS] AI review failed for form ${recordId}`, {
        error: aiError.message,
        response: aiError.response?.data
      });
      
      res.status(500).json({
        success: false,
        error: 'AI review workflow failed',
        message: aiError.message
      });
    }
  } catch (error) {
    logger.error(`[FORMS] Error triggering AI review:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger AI review',
      message: error.message
    });
  }
});

/**
 * @route POST /api/forms/:recordId/auto-approve
 * @desc Auto-approve form after AI review (if confidence threshold met)
 * @access Private
 */
router.post('/:recordId/auto-approve', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { confidence_threshold = 0.8 } = req.body; // Default 80% confidence
    const userId = req.user.id;
    
    logger.info(`[FORMS] Auto-approving form ${recordId} with threshold ${confidence_threshold}`);
    
    // First trigger AI review
    const reviewResponse = await axios.post(
      `${req.protocol}://${req.get('host')}/api/forms/${recordId}/ai-review`,
      {},
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!reviewResponse.data.success) {
      return res.status(400).json({
        success: false,
        error: 'AI review failed, cannot auto-approve'
      });
    }
    
    const aiReview = reviewResponse.data.ai_review;
    const placement = aiReview.placement || {};
    const confidence = placement.confidence || 0;
    
    if (confidence < confidence_threshold) {
      return res.json({
        success: false,
        auto_approved: false,
        reason: `Confidence score ${confidence} below threshold ${confidence_threshold}`,
        ai_review: aiReview
      });
    }
    
    // Auto-approve the form
    const approvedForm = await formReviewService.approveForm(recordId, userId, 
      `Auto-approved by AI review (confidence: ${confidence})`);
    
    res.json({
      success: true,
      auto_approved: true,
      form: approvedForm,
      ai_review: aiReview,
      message: `Form auto-approved with ${(confidence * 100).toFixed(1)}% confidence`
    });
  } catch (error) {
    logger.error(`[FORMS] Error in auto-approve:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-approve form',
      message: error.message
    });
  }
});

module.exports = router;

