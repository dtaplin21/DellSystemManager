const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const panelRequirementsService = require('../services/panelRequirementsService');

/**
 * GET /api/panel-requirements/:projectId/analysis
 * Get detailed analysis of panel requirements
 */
router.get('/:projectId/analysis', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const requirements = await panelRequirementsService.getRequirementsByProjectId(projectId);
    
    if (!requirements) {
      return res.json({
        success: true,
        analysis: {
          status: 'no_data',
          confidence: 0,
          missing: panelRequirementsService.getMissingRequirements({}),
          recommendations: [
            'Upload panel specifications document with panel numbers, dimensions, and roll numbers',
            'Upload material specifications document (optional) for material recognition',
            'Upload roll inventory document (optional) for roll tracking',
            'Upload installation notes document (optional) for installation procedures'
          ]
        }
      });
    } else {
      const confidence = panelRequirementsService.calculateConfidenceScore(requirements);
      const missing = panelRequirementsService.getMissingRequirements(requirements);

      // Generate recommendations based on missing data
      const recommendations = [];
      if (missing.panelSpecifications.length > 0) {
        recommendations.push('Upload panel specifications document with panel numbers, dimensions, and roll numbers');
      }
      if (missing.materialRequirements.length > 0) {
        recommendations.push('Upload material specifications document (optional) for material recognition');
      }
      if (missing.rollInventory.length > 0) {
        recommendations.push('Upload roll inventory document (optional) for roll tracking');
      }
      if (missing.installationNotes.length > 0) {
        recommendations.push('Upload installation notes document (optional) for installation procedures');
      }

      let status = 'complete';
      if (confidence < 20) {
        status = 'insufficient';
      } else if (confidence < 50) {
        status = 'partial';
      }

      res.json({
        success: true,
        analysis: {
          status,
          confidence,
          missing,
          recommendations,
          requirements
        }
      });
    }
  } catch (error) {
    console.error('Error analyzing panel requirements:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze panel requirements' });
  }
});

/**
 * GET /api/panel-requirements/:projectId
 * Get panel layout requirements for a project
 */
router.get('/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const requirements = await panelRequirementsService.getRequirementsByProjectId(projectId);
    
    if (!requirements) {
      return res.json({
        success: true,
        requirements: null,
        confidence: 0,
        missing: panelRequirementsService.getMissingRequirements({})
      });
    }

    const confidence = panelRequirementsService.calculateConfidenceScore(requirements);
    const missing = panelRequirementsService.getMissingRequirements(requirements);

    res.json({
      success: true,
      requirements,
      confidence,
      missing
    });
  } catch (error) {
    console.error('Error getting panel requirements:', error);
    res.status(500).json({ success: false, message: 'Failed to get panel requirements' });
  }
});

/**
 * POST /api/panel-requirements/:projectId
 * Create or update panel layout requirements
 */
router.post('/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const requirements = req.body;

    // Calculate confidence score
    const confidence = panelRequirementsService.calculateConfidenceScore(requirements);
    
    // Add confidence score to requirements
    const requirementsWithConfidence = {
      ...requirements,
      confidenceScore: confidence
    };

    const result = await panelRequirementsService.upsertRequirements(projectId, requirementsWithConfidence);
    
    const missing = panelRequirementsService.getMissingRequirements(requirements);

    res.json({
      success: true,
      requirements: result,
      confidence,
      missing
    });
  } catch (error) {
    console.error('Error upserting panel requirements:', error);
    res.status(500).json({ success: false, message: 'Failed to save panel requirements' });
  }
});

/**
 * PATCH /api/panel-requirements/:projectId
 * Update specific fields of panel requirements
 */
router.patch('/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const fields = req.body;

    // Get existing requirements to calculate new confidence
    const existing = await panelRequirementsService.getRequirementsByProjectId(projectId);
    const updatedRequirements = { ...existing, ...fields };
    
    // Calculate new confidence score
    const confidence = panelRequirementsService.calculateConfidenceScore(updatedRequirements);
    
    // Add confidence score to fields
    const fieldsWithConfidence = {
      ...fields,
      confidenceScore: confidence
    };

    const result = await panelRequirementsService.updateRequirementFields(projectId, fieldsWithConfidence);
    
    const missing = panelRequirementsService.getMissingRequirements(updatedRequirements);

    res.json({
      success: true,
      requirements: result,
      confidence,
      missing
    });
  } catch (error) {
    console.error('Error updating panel requirements:', error);
    res.status(500).json({ success: false, message: 'Failed to update panel requirements' });
  }
});

/**
 * DELETE /api/panel-requirements/:projectId
 * Delete panel requirements for a project
 */
router.delete('/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    await panelRequirementsService.deleteRequirements(projectId);
    
    res.json({
      success: true,
      message: 'Panel requirements deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting panel requirements:', error);
    res.status(500).json({ success: false, message: 'Failed to delete panel requirements' });
  }
});

module.exports = router; 