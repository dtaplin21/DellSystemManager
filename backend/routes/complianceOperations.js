const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const complianceOperationsService = require('../services/complianceOperationsService');
const logger = require('../lib/logger');

/**
 * POST /api/compliance/extract-plan-geometry
 * Extract Plan Geometry Model from documents
 */
router.post('/extract-plan-geometry', auth, async (req, res) => {
  try {
    const { projectId, documentIds, options } = req.body;

    if (!projectId || !documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({
        success: false,
        error: 'projectId and documentIds array are required'
      });
    }

    const result = await complianceOperationsService.extractPlanGeometry(
      projectId,
      documentIds,
      options || {}
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Extract plan geometry failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/register-layout
 * Register layout to plan coordinate system
 */
router.post('/register-layout', auth, async (req, res) => {
  try {
    const { projectId, planGeometryModelId, method, anchors } = req.body;

    if (!projectId || !planGeometryModelId || !method) {
      return res.status(400).json({
        success: false,
        error: 'projectId, planGeometryModelId, and method are required'
      });
    }

    if (method === 'anchor_points' && (!anchors || anchors.length < 2)) {
      return res.status(400).json({
        success: false,
        error: 'anchor_points method requires at least 2 anchor points'
      });
    }

    const result = await complianceOperationsService.registerLayoutToPlan(
      projectId,
      planGeometryModelId,
      method,
      anchors
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Register layout failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/validate-scale
 * Validate layout scale matches plan scale
 */
router.post('/validate-scale', auth, async (req, res) => {
  try {
    const { projectId, planGeometryModelId, transformId } = req.body;

    if (!projectId || !planGeometryModelId || !transformId) {
      return res.status(400).json({
        success: false,
        error: 'projectId, planGeometryModelId, and transformId are required'
      });
    }

    const result = await complianceOperationsService.validateLayoutScale(
      projectId,
      planGeometryModelId,
      transformId
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Validate scale failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/apply-transform
 * Apply layout transform (creates pending operation requiring approval)
 */
router.post('/apply-transform', auth, async (req, res) => {
  try {
    const { projectId, transformId, scope } = req.body;

    if (!projectId || !transformId) {
      return res.status(400).json({
        success: false,
        error: 'projectId and transformId are required'
      });
    }

    const result = await complianceOperationsService.applyLayoutTransform(
      projectId,
      transformId,
      scope || 'ALL_ITEMS',
      req.user.id
    );

    res.json({
      success: true,
      ...result,
      message: result.requires_approval 
        ? 'Operation created and pending approval'
        : 'Operation applied successfully'
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Apply transform failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/validate-boundary
 * Validate boundary compliance
 */
router.post('/validate-boundary', auth, async (req, res) => {
  try {
    const { projectId, planGeometryModelId, transformId } = req.body;

    if (!projectId || !planGeometryModelId) {
      return res.status(400).json({
        success: false,
        error: 'projectId and planGeometryModelId are required'
      });
    }

    const result = await complianceOperationsService.validateBoundaryCompliance(
      projectId,
      planGeometryModelId,
      transformId || null
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Validate boundary failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/clamp-boundary
 * Clamp items to boundary (creates pending operation)
 */
router.post('/clamp-boundary', auth, async (req, res) => {
  try {
    const { projectId, itemIds, boundary, strategy } = req.body;

    if (!projectId || !itemIds || !Array.isArray(itemIds) || !boundary || !strategy) {
      return res.status(400).json({
        success: false,
        error: 'projectId, itemIds array, boundary, and strategy are required'
      });
    }

    const result = await complianceOperationsService.clampToBoundary(
      projectId,
      itemIds,
      boundary,
      strategy,
      req.user.id
    );

    res.json({
      success: true,
      ...result,
      message: result.requires_approval
        ? 'Operation created and pending approval'
        : 'Operation applied successfully'
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Clamp boundary failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/validate-shapes
 * Validate panel shapes match plan rules
 */
router.post('/validate-shapes', auth, async (req, res) => {
  try {
    const { projectId, planGeometryModelId } = req.body;

    if (!projectId || !planGeometryModelId) {
      return res.status(400).json({
        success: false,
        error: 'projectId and planGeometryModelId are required'
      });
    }

    const result = await complianceOperationsService.validatePanelShapes(
      projectId,
      planGeometryModelId
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Validate shapes failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/propose-shape-correction
 * Propose shape corrections (creates pending operation)
 */
router.post('/propose-shape-correction', auth, async (req, res) => {
  try {
    const { projectId, panelId, planRuleRef } = req.body;

    if (!projectId || !panelId || !planRuleRef) {
      return res.status(400).json({
        success: false,
        error: 'projectId, panelId, and planRuleRef are required'
      });
    }

    const result = await complianceOperationsService.proposeShapeCorrection(
      projectId,
      panelId,
      planRuleRef
    );

    res.json({
      success: true,
      ...result,
      message: 'Shape correction proposal created and pending approval'
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Propose shape correction failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/operations/:operationId/approve
 * Approve and execute a pending operation
 */
router.post('/operations/:operationId/approve', auth, async (req, res) => {
  try {
    const { operationId } = req.params;

    const result = await complianceOperationsService.approveOperation(
      operationId,
      req.user.id
    );

    res.json({
      success: true,
      ...result,
      message: 'Operation approved and executed'
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Approve operation failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/compliance/operations/:operationId/reject
 * Reject a pending operation
 */
router.post('/operations/:operationId/reject', auth, async (req, res) => {
  try {
    const { operationId } = req.params;
    const { reason } = req.body;

    const { db } = require('../db');
    const { complianceOperations } = require('../db/schema');
    const { eq } = require('drizzle-orm');

    await db.update(complianceOperations)
      .set({
        status: 'rejected',
        rejectedBy: req.user.id,
        rejectedAt: new Date(),
        rejectionReason: reason || 'Rejected by user',
        updatedAt: new Date()
      })
      .where(eq(complianceOperations.id, operationId));

    res.json({
      success: true,
      message: 'Operation rejected'
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Reject operation failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/compliance/operations/:projectId
 * Get all operations for a project
 */
router.get('/operations/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, riskLevel } = req.query;

    const { db } = require('../db');
    const { complianceOperations } = require('../db/schema');
    const { eq, and } = require('drizzle-orm');

    let query = db.select()
      .from(complianceOperations)
      .where(eq(complianceOperations.projectId, projectId));

    if (status) {
      query = query.where(and(
        eq(complianceOperations.projectId, projectId),
        eq(complianceOperations.status, status)
      ));
    }

    if (riskLevel) {
      query = query.where(and(
        eq(complianceOperations.projectId, projectId),
        eq(complianceOperations.riskLevel, riskLevel)
      ));
    }

    const operations = await query.orderBy(complianceOperations.createdAt);

    res.json({
      success: true,
      operations
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Get operations failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/compliance/validations/:projectId
 * Get validation results for a project
 */
router.get('/validations/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { validationType } = req.query;

    const { db } = require('../db');
    const { complianceValidations } = require('../db/schema');
    const { eq, and, desc } = require('drizzle-orm');

    let query = db.select()
      .from(complianceValidations)
      .where(eq(complianceValidations.projectId, projectId));

    if (validationType) {
      query = query.where(and(
        eq(complianceValidations.projectId, projectId),
        eq(complianceValidations.validationType, validationType)
      ));
    }

    const validations = await query.orderBy(desc(complianceValidations.validatedAt));

    res.json({
      success: true,
      validations
    });
  } catch (error) {
    logger.error('[COMPLIANCE API] Get validations failed', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

