const { db } = require('../db');
const { 
  planGeometryModels, 
  layoutTransforms, 
  complianceOperations, 
  complianceValidations,
  panelLayouts,
  documents
} = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');
const axios = require('axios');

class ComplianceOperationsService {
  /**
   * OP_EXTRACT_PLAN_GEOMETRY
   * Extract plan geometry from documents and create PlanGeometryModel
   * 
   * @param {string} projectId - Project ID
   * @param {string[]} documentIds - Array of document IDs to analyze
   * @param {object} options - Extraction options
   * @returns {Promise<object>} - { plan_geometry_model_id, confidence_score }
   */
  async extractPlanGeometry(projectId, documentIds, options = {}) {
    try {
      logger.info('[COMPLIANCE] Extracting plan geometry', { projectId, documentIds });

      // Check if PGM already exists for this project/document combination
      if (documentIds.length === 1) {
        const existing = await db.select()
          .from(planGeometryModels)
          .where(and(
            eq(planGeometryModels.projectId, projectId),
            eq(planGeometryModels.documentId, documentIds[0])
          ))
          .limit(1);

        if (existing.length > 0) {
          logger.info('[COMPLIANCE] Plan geometry model already exists', { 
            id: existing[0].id 
          });
          return {
            plan_geometry_model_id: existing[0].id,
            confidence_score: existing[0].confidenceScore,
            existing: true
          };
        }
      }

      // Fetch documents
      const docs = await db.select()
        .from(documents)
        .where(eq(documents.projectId, projectId));

      const relevantDocs = docs.filter(doc => documentIds.includes(doc.id));

      if (relevantDocs.length === 0) {
        throw new Error('No documents found for extraction');
      }

      // Use AI service to extract geometry (if available)
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
      let extractedGeometry = null;
      let confidenceScore = 0.5; // Default confidence

      try {
        // Prepare document data for AI analysis
        const docData = relevantDocs.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          textContent: doc.textContent || ''
        }));

        const aiResponse = await axios.post(
          `${AI_SERVICE_URL}/api/ai/extract-plan-geometry`,
          {
            project_id: projectId,
            documents: docData
          },
          {
            timeout: 120000, // 2 minutes
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (aiResponse.data && aiResponse.data.success) {
          extractedGeometry = aiResponse.data.geometry;
          confidenceScore = aiResponse.data.confidence_score || 0.7;
        }
      } catch (aiError) {
        logger.warn('[COMPLIANCE] AI extraction failed, using fallback', {
          error: aiError.message
        });
        // Fallback: create basic geometry from document text
        extractedGeometry = this._extractBasicGeometry(relevantDocs);
      }

      // Create PlanGeometryModel
      const pgmId = uuidv4();
      const pgmData = {
        id: pgmId,
        projectId,
        documentId: documentIds[0] || null,
        siteBoundary: extractedGeometry.siteBoundary || [],
        referencePoints: extractedGeometry.referencePoints || [],
        siteWidth: extractedGeometry.siteWidth || 4000,
        siteHeight: extractedGeometry.siteHeight || 4000,
        units: extractedGeometry.units || 'feet',
        scaleFactor: extractedGeometry.scaleFactor || null,
        noGoZones: extractedGeometry.noGoZones || [],
        keyFeatures: extractedGeometry.keyFeatures || [],
        panelMapRequirements: extractedGeometry.panelMapRequirements || {},
        confidenceScore,
        extractionMethod: extractedGeometry.extractionMethod || 'text_parsing',
        extractedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(planGeometryModels).values(pgmData);

      logger.info('[COMPLIANCE] Plan geometry model created', { 
        id: pgmId,
        confidenceScore 
      });

      return {
        plan_geometry_model_id: pgmId,
        confidence_score: confidenceScore,
        existing: false
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to extract plan geometry', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Fallback geometry extraction from document text
   */
  _extractBasicGeometry(documents) {
    // Basic extraction logic - can be enhanced
    return {
      siteBoundary: [],
      referencePoints: [],
      siteWidth: 4000,
      siteHeight: 4000,
      units: 'feet',
      scaleFactor: null,
      noGoZones: [],
      keyFeatures: [],
      panelMapRequirements: {},
      extractionMethod: 'text_parsing'
    };
  }

  /**
   * OP_REGISTER_LAYOUT_TO_PLAN
   * Compute transform between layout and plan coordinate systems
   * 
   * @param {string} projectId - Project ID
   * @param {string} planGeometryModelId - Plan Geometry Model ID
   * @param {string} method - Registration method ('anchor_points', 'boundary_fit', 'manual')
   * @param {array} anchors - Anchor points [{plan_point: {x,y}, layout_point: {x,y}}, ...]
   * @returns {Promise<object>} - { transform_id, confidence_score, residual_error }
   */
  async registerLayoutToPlan(projectId, planGeometryModelId, method, anchors = null) {
    try {
      logger.info('[COMPLIANCE] Registering layout to plan', {
        projectId,
        planGeometryModelId,
        method
      });

      // Get Plan Geometry Model
      const [pgm] = await db.select()
        .from(planGeometryModels)
        .where(eq(planGeometryModels.id, planGeometryModelId));

      if (!pgm) {
        throw new Error('Plan Geometry Model not found');
      }

      // Get current layout
      const [layout] = await db.select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId))
        .limit(1);

      if (!layout) {
        throw new Error('Panel layout not found');
      }

      let transform = null;
      let confidenceScore = 0.5;
      let residualError = null;
      let maxError = null;

      if (method === 'anchor_points' && anchors && anchors.length >= 2) {
        // Compute transform from anchor points
        transform = this._computeTransformFromAnchors(anchors);
        confidenceScore = 0.9; // High confidence with anchors
        residualError = this._calculateResidualError(anchors, transform);
        maxError = this._calculateMaxError(anchors, transform);
      } else if (method === 'boundary_fit') {
        // Fit layout bounding box to plan boundary
        transform = this._computeBoundaryFitTransform(layout, pgm);
        confidenceScore = 0.6; // Lower confidence
        residualError = null; // Can't calculate without anchors
      } else {
        throw new Error('Invalid registration method or insufficient anchors');
      }

      // Deactivate existing active transforms
      await db.update(layoutTransforms)
        .set({ isActive: false })
        .where(and(
          eq(layoutTransforms.projectId, projectId),
          eq(layoutTransforms.isActive, true)
        ));

      // Create new transform
      const transformId = uuidv4();
      await db.insert(layoutTransforms).values({
        id: transformId,
        projectId,
        planGeometryModelId,
        translationX: transform.translationX || 0,
        translationY: transform.translationY || 0,
        rotationDegrees: transform.rotationDegrees || 0,
        scaleX: transform.scaleX || 1,
        scaleY: transform.scaleY || 1,
        skewX: transform.skewX || 0,
        skewY: transform.skewY || 0,
        method,
        anchorPoints: anchors || [],
        confidenceScore,
        residualError,
        maxError,
        isUniformScale: transform.scaleX === transform.scaleY,
        isActive: true,
        createdAt: new Date()
      });

      logger.info('[COMPLIANCE] Layout registered to plan', {
        transformId,
        confidenceScore,
        residualError
      });

      return {
        transform_id: transformId,
        confidence_score: confidenceScore,
        residual_error: residualError,
        max_error: maxError
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to register layout', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Compute affine transform from anchor points
   */
  _computeTransformFromAnchors(anchors) {
    // Simplified transform computation
    // In production, use proper least-squares fitting
    if (anchors.length < 2) {
      throw new Error('Need at least 2 anchor points');
    }

    // For now, compute simple translation and scale
    const firstAnchor = anchors[0];
    const translationX = firstAnchor.layout_point.x - firstAnchor.plan_point.x;
    const translationY = firstAnchor.layout_point.y - firstAnchor.plan_point.y;

    // Compute scale from distance between first two anchors
    if (anchors.length >= 2) {
      const planDist = Math.sqrt(
        Math.pow(anchors[1].plan_point.x - anchors[0].plan_point.x, 2) +
        Math.pow(anchors[1].plan_point.y - anchors[0].plan_point.y, 2)
      );
      const layoutDist = Math.sqrt(
        Math.pow(anchors[1].layout_point.x - anchors[0].layout_point.x, 2) +
        Math.pow(anchors[1].layout_point.y - anchors[0].layout_point.y, 2)
      );
      const scale = planDist > 0 ? layoutDist / planDist : 1;

      return {
        translationX,
        translationY,
        rotationDegrees: 0, // Simplified - would compute from anchors
        scaleX: scale,
        scaleY: scale,
        skewX: 0,
        skewY: 0
      };
    }

    return {
      translationX,
      translationY,
      rotationDegrees: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0
    };
  }

  /**
   * Compute transform by fitting layout bounding box to plan boundary
   */
  _computeBoundaryFitTransform(layout, pgm) {
    // Get layout bounding box from panels
    const panels = layout.panels || [];
    if (panels.length === 0) {
      return {
        translationX: 0,
        translationY: 0,
        rotationDegrees: 0,
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        skewY: 0
      };
    }

    // Calculate layout bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    panels.forEach(panel => {
      minX = Math.min(minX, panel.x);
      minY = Math.min(minY, panel.y);
      maxX = Math.max(maxX, panel.x + (panel.width || 0));
      maxY = Math.max(maxY, panel.y + (panel.height || 0));
    });

    const layoutWidth = maxX - minX;
    const layoutHeight = maxY - minY;

    // Calculate scale to fit plan dimensions
    const scaleX = pgm.siteWidth / layoutWidth;
    const scaleY = pgm.siteHeight / layoutHeight;

    // Translation to center
    const translationX = -minX * scaleX;
    const translationY = -minY * scaleY;

    return {
      translationX,
      translationY,
      rotationDegrees: 0,
      scaleX,
      scaleY,
      skewX: 0,
      skewY: 0
    };
  }

  /**
   * Calculate residual error (RMS) from anchor points
   */
  _calculateResidualError(anchors, transform) {
    let sumSquaredError = 0;
    anchors.forEach(anchor => {
      const transformedX = anchor.plan_point.x * transform.scaleX + transform.translationX;
      const transformedY = anchor.plan_point.y * transform.scaleY + transform.translationY;
      const errorX = transformedX - anchor.layout_point.x;
      const errorY = transformedY - anchor.layout_point.y;
      sumSquaredError += errorX * errorX + errorY * errorY;
    });
    return Math.sqrt(sumSquaredError / anchors.length);
  }

  /**
   * Calculate maximum error from anchor points
   */
  _calculateMaxError(anchors, transform) {
    let maxError = 0;
    anchors.forEach(anchor => {
      const transformedX = anchor.plan_point.x * transform.scaleX + transform.translationX;
      const transformedY = anchor.plan_point.y * transform.scaleY + transform.translationY;
      const errorX = transformedX - anchor.layout_point.x;
      const errorY = transformedY - anchor.layout_point.y;
      const error = Math.sqrt(errorX * errorX + errorY * errorY);
      maxError = Math.max(maxError, error);
    });
    return maxError;
  }

  /**
   * OP_VALIDATE_LAYOUT_SCALE
   * Validate layout scale matches plan scale
   * 
   * @param {string} projectId - Project ID
   * @param {string} planGeometryModelId - Plan Geometry Model ID
   * @param {string} transformId - Layout Transform ID
   * @returns {Promise<object>} - Validation results
   */
  async validateLayoutScale(projectId, planGeometryModelId, transformId) {
    try {
      const [pgm] = await db.select()
        .from(planGeometryModels)
        .where(eq(planGeometryModels.id, planGeometryModelId));

      const [transform] = await db.select()
        .from(layoutTransforms)
        .where(eq(layoutTransforms.id, transformId));

      if (!pgm || !transform) {
        throw new Error('PGM or Transform not found');
      }

      // Calculate scale delta
      const expectedScale = pgm.scaleFactor || 1;
      const actualScaleX = transform.scaleX;
      const actualScaleY = transform.scaleY;
      const avgScale = (actualScaleX + actualScaleY) / 2;
      const scaleDeltaPercent = ((avgScale - expectedScale) / expectedScale) * 100;

      // Check for non-uniform scaling
      const isUniformScale = Math.abs(actualScaleX - actualScaleY) < 0.001;
      const scaleDifference = Math.abs(actualScaleX - actualScaleY);

      // Tolerance check (within 5% is acceptable)
      const tolerancePass = Math.abs(scaleDeltaPercent) < 5 && isUniformScale;

      // Store validation result
      const validationId = uuidv4();
      await db.insert(complianceValidations).values({
        id: validationId,
        projectId,
        planGeometryModelId,
        layoutTransformId: transformId,
        validationType: 'scale',
        passed: tolerancePass,
        complianceScore: tolerancePass ? 0.9 : 0.5,
        scaleDeltaPercent,
        validatedAt: new Date()
      });

      return {
        scale_delta_percent: scaleDeltaPercent,
        is_uniform_scale: isUniformScale,
        scale_difference: scaleDifference,
        tolerance_pass: tolerancePass,
        recommended_correction: tolerancePass ? null : {
          action: 'apply_transform',
          description: `Scale mismatch: ${scaleDeltaPercent.toFixed(2)}% difference. ${!isUniformScale ? 'Non-uniform scaling detected.' : ''}`
        }
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to validate scale', { error: error.message });
      throw error;
    }
  }

  /**
   * OP_APPLY_LAYOUT_TRANSFORM (HIGH RISK - requires approval)
   * Apply transform to layout items
   * 
   * @param {string} projectId - Project ID
   * @param {string} transformId - Transform ID
   * @param {string} scope - Scope: 'ALL_ITEMS' or 'PANELS_ONLY'
   * @param {string} userId - User ID (for approval tracking)
   * @returns {Promise<object>} - Operation ID (pending approval)
   */
  async applyLayoutTransform(projectId, transformId, scope = 'ALL_ITEMS', userId = null) {
    try {
      const [transform] = await db.select()
        .from(layoutTransforms)
        .where(eq(layoutTransforms.id, transformId));

      if (!transform) {
        throw new Error('Transform not found');
      }

      // Get current layout state (before snapshot)
      const [layout] = await db.select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId))
        .limit(1);

      const beforeSnapshot = JSON.parse(JSON.stringify(layout));

      // Create operation (pending approval)
      const operationId = uuidv4();
      await db.insert(complianceOperations).values({
        id: operationId,
        projectId,
        operationType: 'APPLY_LAYOUT_TRANSFORM',
        operationData: {
          transformId,
          scope,
          transform: {
            translationX: transform.translationX,
            translationY: transform.translationY,
            rotationDegrees: transform.rotationDegrees,
            scaleX: transform.scaleX,
            scaleY: transform.scaleY
          }
        },
        riskLevel: 'high', // HIGH RISK
        status: 'pending',
        requiresApproval: true,
        changePlan: {
          description: `Apply layout transform: scale(${transform.scaleX}, ${transform.scaleY}), translate(${transform.translationX}, ${transform.translationY}), rotate(${transform.rotationDegrees}°)`,
          affected_items: scope === 'ALL_ITEMS' ? 'all panels, patches, and destructive tests' : 'panels only',
          scope
        },
        beforeSnapshot,
        proposedBy: userId,
        proposedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info('[COMPLIANCE] Transform operation created (pending approval)', {
        operationId,
        transformId
      });

      return {
        operation_id: operationId,
        status: 'pending',
        requires_approval: true
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to create transform operation', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * OP_VALIDATE_BOUNDARY_COMPLIANCE
   * Check items are within plan boundaries
   * 
   * @param {string} projectId - Project ID
   * @param {string} planGeometryModelId - Plan Geometry Model ID
   * @param {string} transformId - Layout Transform ID (optional)
   * @returns {Promise<object>} - Validation results
   */
  async validateBoundaryCompliance(projectId, planGeometryModelId, transformId = null) {
    try {
      const [pgm] = await db.select()
        .from(planGeometryModels)
        .where(eq(planGeometryModels.id, planGeometryModelId));

      const [layout] = await db.select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId))
        .limit(1);

      if (!pgm || !layout) {
        throw new Error('PGM or Layout not found');
      }

      const violations = [];
      const allItems = [
        ...(layout.panels || []).map(p => ({ ...p, type: 'panel' })),
        ...(layout.patches || []).map(p => ({ ...p, type: 'patch' })),
        ...(layout.destructiveTests || []).map(d => ({ ...d, type: 'destructive_test' }))
      ];

      // Check each item against boundary
      allItems.forEach(item => {
        const itemBounds = this._getItemBounds(item);
        const isInside = this._isInsideBoundary(itemBounds, pgm.siteBoundary);
        
        if (!isInside) {
          violations.push({
            item_id: item.id,
            item_type: item.type,
            location: { x: item.x, y: item.y },
            bounds: itemBounds,
            issue: 'Item outside site boundary'
          });
        }

        // Check no-go zones
        pgm.noGoZones.forEach(zone => {
          if (this._intersectsNoGoZone(itemBounds, zone)) {
            violations.push({
              item_id: item.id,
              item_type: item.type,
              location: { x: item.x, y: item.y },
              zone: zone.label || 'Unknown',
              issue: 'Item intersects no-go zone'
            });
          }
        });
      });

      const complianceScore = violations.length === 0 ? 1.0 : Math.max(0, 1 - (violations.length / allItems.length));

      // Store validation
      const validationId = uuidv4();
      await db.insert(complianceValidations).values({
        id: validationId,
        projectId,
        planGeometryModelId,
        layoutTransformId: transformId,
        validationType: 'boundary',
        passed: violations.length === 0,
        complianceScore,
        issues: violations,
        boundaryViolationsCount: violations.length,
        validatedAt: new Date()
      });

      return {
        violations,
        compliance_score: complianceScore,
        affected_items: violations.length,
        passed: violations.length === 0
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to validate boundary', { error: error.message });
      throw error;
    }
  }

  /**
   * Get item bounding box
   */
  _getItemBounds(item) {
    if (item.type === 'patch' && item.radius) {
      return {
        minX: item.x - item.radius,
        minY: item.y - item.radius,
        maxX: item.x + item.radius,
        maxY: item.y + item.radius
      };
    }
    return {
      minX: item.x,
      minY: item.y,
      maxX: item.x + (item.width || 0),
      maxY: item.y + (item.height || 0)
    };
  }

  /**
   * Check if bounds are inside boundary polygon
   */
  _isInsideBoundary(bounds, boundaryPolygon) {
    // Simplified check - in production use proper polygon containment
    if (!boundaryPolygon || boundaryPolygon.length === 0) {
      return true; // No boundary defined
    }

    // Check if any corner is outside
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY }
    ];

    // Simple bounding box check
    const boundaryBounds = this._getPolygonBounds(boundaryPolygon);
    return corners.every(corner =>
      corner.x >= boundaryBounds.minX &&
      corner.x <= boundaryBounds.maxX &&
      corner.y >= boundaryBounds.minY &&
      corner.y <= boundaryBounds.maxY
    );
  }

  /**
   * Get polygon bounding box
   */
  _getPolygonBounds(polygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygon.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    return { minX, minY, maxX, maxY };
  }

  /**
   * Check if item intersects no-go zone
   */
  _intersectsNoGoZone(itemBounds, zone) {
    // Simplified intersection check
    const zoneBounds = this._getPolygonBounds(zone.polygon || []);
    return !(
      itemBounds.maxX < zoneBounds.minX ||
      itemBounds.minX > zoneBounds.maxX ||
      itemBounds.maxY < zoneBounds.minY ||
      itemBounds.minY > zoneBounds.maxY
    );
  }

  /**
   * OP_CLAMP_TO_BOUNDARY
   * Move items inside boundary (MEDIUM/HIGH risk)
   * 
   * @param {string} projectId - Project ID
   * @param {string[]} itemIds - Item IDs to clamp
   * @param {object} boundary - Boundary definition
   * @param {string} strategy - Strategy: 'NEAREST_POINT', 'SLIDE_ALONG_EDGE', 'REJECT_AND_FLAG'
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Operation ID
   */
  async clampToBoundary(projectId, itemIds, boundary, strategy, userId = null) {
    try {
      const [layout] = await db.select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId))
        .limit(1);

      const beforeSnapshot = JSON.parse(JSON.stringify(layout));

      // Determine risk level based on displacement
      const riskLevel = strategy === 'REJECT_AND_FLAG' ? 'high' : 'medium';

      const operationId = uuidv4();
      await db.insert(complianceOperations).values({
        id: operationId,
        projectId,
        operationType: 'CLAMP_TO_BOUNDARY',
        operationData: {
          itemIds,
          boundary,
          strategy
        },
        riskLevel,
        status: 'pending',
        requiresApproval: riskLevel === 'high',
        changePlan: {
          description: `Clamp ${itemIds.length} items to boundary using ${strategy} strategy`,
          affected_items: itemIds,
          strategy
        },
        beforeSnapshot,
        proposedBy: userId,
        proposedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        operation_id: operationId,
        status: 'pending',
        requires_approval: riskLevel === 'high'
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to create clamp operation', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * OP_VALIDATE_PANEL_SHAPES
   * Validate panel shapes match plan rules
   * 
   * @param {string} projectId - Project ID
   * @param {string} planGeometryModelId - Plan Geometry Model ID
   * @returns {Promise<object>} - Validation results
   */
  async validatePanelShapes(projectId, planGeometryModelId) {
    try {
      const [pgm] = await db.select()
        .from(planGeometryModels)
        .where(eq(planGeometryModels.id, planGeometryModelId));

      const [layout] = await db.select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId))
        .limit(1);

      if (!pgm || !layout) {
        throw new Error('PGM or Layout not found');
      }

      const requirements = pgm.panelMapRequirements || {};
      const mismatches = [];
      const panels = layout.panels || [];

      panels.forEach(panel => {
        // Check shape
        const allowedShapes = requirements.expected_panel_types || ['rectangle', 'right-triangle'];
        if (panel.shape && !allowedShapes.includes(panel.shape)) {
          mismatches.push({
            panel_id: panel.id,
            issue: 'Invalid shape',
            actual: panel.shape,
            expected: allowedShapes
          });
        }

        // Check rotation (if rules exist)
        if (requirements.orientation_rules) {
          const allowedRotations = requirements.orientation_rules.allowed_rotations || [0, 90, 180, 270];
          const rotation = panel.rotation || 0;
          if (!allowedRotations.includes(rotation)) {
            mismatches.push({
              panel_id: panel.id,
              issue: 'Invalid rotation',
              actual: rotation,
              expected: allowedRotations
            });
          }
        }
      });

      const complianceScore = mismatches.length === 0 ? 1.0 : Math.max(0, 1 - (mismatches.length / panels.length));

      // Store validation
      const validationId = uuidv4();
      await db.insert(complianceValidations).values({
        id: validationId,
        projectId,
        planGeometryModelId,
        validationType: 'shape',
        passed: mismatches.length === 0,
        complianceScore,
        issues: mismatches,
        shapeMismatchesCount: mismatches.length,
        validatedAt: new Date()
      });

      return {
        mismatches,
        compliance_score: complianceScore,
        affected_panels: mismatches.length,
        passed: mismatches.length === 0
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to validate shapes', { error: error.message });
      throw error;
    }
  }

  /**
   * OP_PROPOSE_SHAPE_CORRECTION
   * Propose shape corrections (manual approval required)
   * 
   * @param {string} projectId - Project ID
   * @param {string} panelId - Panel ID
   * @param {string} planRuleRef - Reference to plan rule
   * @returns {Promise<object>} - Proposal ID
   */
  async proposeShapeCorrection(projectId, panelId, planRuleRef) {
    try {
      const operationId = uuidv4();
      await db.insert(complianceOperations).values({
        id: operationId,
        projectId,
        operationType: 'PROPOSE_SHAPE_CORRECTION',
        operationData: {
          panelId,
          planRuleRef
        },
        riskLevel: 'critical', // CRITICAL - shape changes
        status: 'pending',
        requiresApproval: true,
        changePlan: {
          description: `Propose shape correction for panel ${panelId} based on plan rule ${planRuleRef}`,
          panel_id: panelId,
          plan_rule_ref: planRuleRef
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        proposal_id: operationId,
        status: 'pending',
        requires_approval: true
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to create shape correction proposal', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Approve operation
   * 
   * @param {string} operationId - Operation ID
   * @param {string} userId - User ID approving
   * @returns {Promise<object>} - Execution result
   */
  async approveOperation(operationId, userId) {
    try {
      const [operation] = await db.select()
        .from(complianceOperations)
        .where(eq(complianceOperations.id, operationId))
        .limit(1);

      if (!operation) {
        throw new Error('Operation not found');
      }

      if (operation.status !== 'pending') {
        throw new Error(`Operation already ${operation.status}`);
      }

      // Update operation status
      await db.update(complianceOperations)
        .set({
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(complianceOperations.id, operationId));

      // Execute the operation
      return await this.executeOperation(operationId);
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to approve operation', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute operation (after approval)
   * 
   * @param {string} operationId - Operation ID
   * @returns {Promise<object>} - Execution result
   */
  async executeOperation(operationId) {
    try {
      const [operation] = await db.select()
        .from(complianceOperations)
        .where(eq(complianceOperations.id, operationId))
        .limit(1);

      if (!operation) {
        throw new Error('Operation not found');
      }

      const { operationType, operationData, projectId } = operation;
      let executionResult = { success: false };

      switch (operationType) {
        case 'APPLY_LAYOUT_TRANSFORM':
          executionResult = await this._executeApplyTransform(projectId, operationData);
          break;
        case 'CLAMP_TO_BOUNDARY':
          executionResult = await this._executeClampBoundary(projectId, operationData);
          break;
        case 'PROPOSE_SHAPE_CORRECTION':
          // Shape corrections require manual intervention
          executionResult = {
            success: false,
            message: 'Shape corrections require manual intervention',
            manual_steps: operation.changePlan
          };
          break;
        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }

      // Get after snapshot
      const [layout] = await db.select()
        .from(panelLayouts)
        .where(eq(panelLayouts.projectId, projectId))
        .limit(1);

      const afterSnapshot = JSON.parse(JSON.stringify(layout));

      // Update operation
      await db.update(complianceOperations)
        .set({
          status: executionResult.success ? 'applied' : 'pending',
          executionResult,
          afterSnapshot,
          updatedAt: new Date()
        })
        .where(eq(complianceOperations.id, operationId));

      return executionResult;
    } catch (error) {
      logger.error('[COMPLIANCE] Failed to execute operation', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute apply transform operation
   */
  async _executeApplyTransform(projectId, operationData) {
    const { transformId, scope, transform } = operationData;
    const [layout] = await db.select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId))
      .limit(1);

    // Apply transform to items
    const itemsToTransform = scope === 'ALL_ITEMS' 
      ? ['panels', 'patches', 'destructiveTests']
      : ['panels'];

    itemsToTransform.forEach(itemType => {
      const items = layout[itemType] || [];
      items.forEach(item => {
        // Apply transform: scale, rotate, translate
        const x = item.x * transform.scaleX;
        const y = item.y * transform.scaleY;
        item.x = x + transform.translationX;
        item.y = y + transform.translationY;
        if (transform.rotationDegrees) {
          item.rotation = (item.rotation || 0) + transform.rotationDegrees;
        }
      });
    });

    // Update layout
    await db.update(panelLayouts)
      .set({
        panels: layout.panels,
        patches: layout.patches,
        destructiveTests: layout.destructiveTests,
        lastUpdated: new Date()
      })
      .where(eq(panelLayouts.projectId, projectId));

    return {
      success: true,
      affected_count: itemsToTransform.reduce((sum, type) => sum + (layout[type]?.length || 0), 0)
    };
  }

  /**
   * Execute clamp boundary operation
   */
  async _executeClampBoundary(projectId, operationData) {
    const { itemIds, boundary, strategy } = operationData;
    const [layout] = await db.select()
      .from(panelLayouts)
      .where(eq(panelLayouts.projectId, projectId))
      .limit(1);

    // Find and move items
    let movedCount = 0;
    const allItems = [
      ...(layout.panels || []).map(p => ({ ...p, type: 'panel', array: 'panels' })),
      ...(layout.patches || []).map(p => ({ ...p, type: 'patch', array: 'patches' })),
      ...(layout.destructiveTests || []).map(d => ({ ...d, type: 'destructive_test', array: 'destructiveTests' }))
    ];

    allItems.forEach(item => {
      if (itemIds.includes(item.id)) {
        // Move item inside boundary (simplified)
        const boundaryBounds = this._getPolygonBounds(boundary);
        if (item.x < boundaryBounds.minX) item.x = boundaryBounds.minX;
        if (item.y < boundaryBounds.minY) item.y = boundaryBounds.minY;
        movedCount++;
      }
    });

    // Update layout
    await db.update(panelLayouts)
      .set({
        panels: layout.panels,
        patches: layout.patches,
        destructiveTests: layout.destructiveTests,
        lastUpdated: new Date()
      })
      .where(eq(panelLayouts.projectId, projectId));

    return {
      success: true,
      moved_count: movedCount
    };
  }

  /**
   * Validate form compliance (triggered after form approval)
   * 
   * @param {string} projectId - Project ID
   * @param {string} formRecordId - As-built record ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Validation result
   */
  async validateFormCompliance(projectId, formRecordId, userId) {
    try {
      logger.info('[COMPLIANCE] Validating form compliance', { projectId, formRecordId });

      // Get active Plan Geometry Model for project (get most recent)
      const pgmResults = await db.select()
        .from(planGeometryModels)
        .where(eq(planGeometryModels.projectId, projectId));
      
      // Sort by createdAt descending and get first
      const pgm = pgmResults.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )[0];

      if (!pgm) {
        logger.info('[COMPLIANCE] No Plan Geometry Model found, skipping validation');
        return { skipped: true, reason: 'No PGM found' };
      }

      // Get active transform
      const [transform] = await db.select()
        .from(layoutTransforms)
        .where(and(
          eq(layoutTransforms.projectId, projectId),
          eq(layoutTransforms.isActive, true)
        ))
        .limit(1);

      const validations = [];

      if (transform) {
        // Validate scale
        const scaleValidation = await this.validateLayoutScale(
          projectId,
          pgm.id,
          transform.id
        );
        validations.push({ type: 'scale', ...scaleValidation });

        // Validate boundary
        const boundaryValidation = await this.validateBoundaryCompliance(
          projectId,
          pgm.id,
          transform.id
        );
        validations.push({ type: 'boundary', ...boundaryValidation });
      }

      // Validate shapes
      const shapeValidation = await this.validatePanelShapes(
        projectId,
        pgm.id
      );
      validations.push({ type: 'shape', ...shapeValidation });

      logger.info('[COMPLIANCE] Form compliance validation completed', {
        projectId,
        formRecordId,
        validationsCount: validations.length
      });

      return {
        success: true,
        validations
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Form compliance validation failed', {
        error: error.message
      });
      // Don't throw - this is non-blocking
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate layout compliance (triggered after layout save)
   * 
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Validation result
   */
  async validateLayoutCompliance(projectId, userId) {
    try {
      logger.info('[COMPLIANCE] Validating layout compliance', { projectId });

      // Get active Plan Geometry Model for project (get most recent)
      const pgmResults = await db.select()
        .from(planGeometryModels)
        .where(eq(planGeometryModels.projectId, projectId));
      
      // Sort by createdAt descending and get first
      const pgm = pgmResults.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )[0];

      if (!pgm) {
        logger.info('[COMPLIANCE] No Plan Geometry Model found, skipping validation');
        return { skipped: true, reason: 'No PGM found' };
      }

      // Get active transform
      const [transform] = await db.select()
        .from(layoutTransforms)
        .where(and(
          eq(layoutTransforms.projectId, projectId),
          eq(layoutTransforms.isActive, true)
        ))
        .limit(1);

      const validations = [];

      if (transform) {
        // Validate scale
        const scaleValidation = await this.validateLayoutScale(
          projectId,
          pgm.id,
          transform.id
        );
        validations.push({ type: 'scale', ...scaleValidation });

        // Validate boundary
        const boundaryValidation = await this.validateBoundaryCompliance(
          projectId,
          pgm.id,
          transform.id
        );
        validations.push({ type: 'boundary', ...boundaryValidation });
      } else {
        // Try to register layout if no transform exists
        try {
          const registrationResult = await this.registerLayoutToPlan(
            projectId,
            pgm.id,
            'boundary_fit'
          );
          logger.info('[COMPLIANCE] Auto-registered layout to plan', {
            transformId: registrationResult.transform_id
          });
          
          // Re-run validations with new transform
          const scaleValidation = await this.validateLayoutScale(
            projectId,
            pgm.id,
            registrationResult.transform_id
          );
          validations.push({ type: 'scale', ...scaleValidation });

          const boundaryValidation = await this.validateBoundaryCompliance(
            projectId,
            pgm.id,
            registrationResult.transform_id
          );
          validations.push({ type: 'boundary', ...boundaryValidation });
        } catch (regError) {
          logger.warn('[COMPLIANCE] Auto-registration failed', {
            error: regError.message
          });
        }
      }

      // Validate shapes
      const shapeValidation = await this.validatePanelShapes(
        projectId,
        pgm.id
      );
      validations.push({ type: 'shape', ...shapeValidation });

      logger.info('[COMPLIANCE] Layout compliance validation completed', {
        projectId,
        validationsCount: validations.length
      });

      return {
        success: true,
        validations
      };
    } catch (error) {
      logger.error('[COMPLIANCE] Layout compliance validation failed', {
        error: error.message
      });
      // Don't throw - this is non-blocking
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ComplianceOperationsService();

