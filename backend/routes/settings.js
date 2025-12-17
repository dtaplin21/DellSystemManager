const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { userSettings } = require('../db/schema');
const { eq } = require('drizzle-orm');
const logger = require('../lib/logger');

/**
 * GET /api/settings
 * Get user settings
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    let [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // If no settings exist, create default settings
    if (!settings) {
      const [newSettings] = await db
        .insert(userSettings)
        .values({
          userId,
          autoCreateFromForms: false,
          autoCreateProjectIds: []
        })
        .returning();
      
      settings = newSettings;
    }

    res.json({
      success: true,
      settings: {
        autoCreateFromForms: settings.autoCreateFromForms,
        autoCreateProjectIds: settings.autoCreateProjectIds || []
      }
    });
  } catch (error) {
    logger.error('[SETTINGS] Error fetching user settings', { error: error.message });
    next(error);
  }
});

/**
 * PUT /api/settings
 * Update user settings
 */
router.put('/', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { autoCreateFromForms, autoCreateProjectIds } = req.body;

    // Check if settings exist
    let [existingSettings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    let updatedSettings;
    if (existingSettings) {
      // Update existing settings
      [updatedSettings] = await db
        .update(userSettings)
        .set({
          autoCreateFromForms: autoCreateFromForms !== undefined ? autoCreateFromForms : existingSettings.autoCreateFromForms,
          autoCreateProjectIds: autoCreateProjectIds !== undefined ? autoCreateProjectIds : existingSettings.autoCreateProjectIds,
          updatedAt: new Date()
        })
        .where(eq(userSettings.userId, userId))
        .returning();
    } else {
      // Create new settings
      [updatedSettings] = await db
        .insert(userSettings)
        .values({
          userId,
          autoCreateFromForms: autoCreateFromForms !== undefined ? autoCreateFromForms : false,
          autoCreateProjectIds: autoCreateProjectIds !== undefined ? autoCreateProjectIds : []
        })
        .returning();
    }

    res.json({
      success: true,
      settings: {
        autoCreateFromForms: updatedSettings.autoCreateFromForms,
        autoCreateProjectIds: updatedSettings.autoCreateProjectIds || []
      }
    });
  } catch (error) {
    logger.error('[SETTINGS] Error updating user settings', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/settings/auto-create
 * Get auto-create setting for specific project
 */
router.get('/auto-create', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId query parameter is required'
      });
    }

    let [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!settings) {
      return res.json({
        success: true,
        enabled: false,
        source: 'default'
      });
    }

    // Check global setting first
    if (settings.autoCreateFromForms) {
      return res.json({
        success: true,
        enabled: true,
        source: 'global'
      });
    }

    // Check project-specific setting
    const projectIds = settings.autoCreateProjectIds || [];
    const isProjectEnabled = Array.isArray(projectIds) && projectIds.includes(projectId);

    res.json({
      success: true,
      enabled: isProjectEnabled,
      source: isProjectEnabled ? 'project' : 'disabled'
    });
  } catch (error) {
    logger.error('[SETTINGS] Error fetching auto-create setting', { error: error.message });
    next(error);
  }
});

/**
 * PUT /api/settings/auto-create/:projectId
 * Enable/disable auto-create for specific project
 */
router.put('/auto-create/:projectId', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean'
      });
    }

    // Get or create settings
    let [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!settings) {
      [settings] = await db
        .insert(userSettings)
        .values({
          userId,
          autoCreateFromForms: false,
          autoCreateProjectIds: enabled ? [projectId] : []
        })
        .returning();
    } else {
      // Update project-specific list
      const projectIds = settings.autoCreateProjectIds || [];
      let updatedProjectIds;

      if (enabled) {
        // Add project ID if not already present
        updatedProjectIds = projectIds.includes(projectId) 
          ? projectIds 
          : [...projectIds, projectId];
      } else {
        // Remove project ID
        updatedProjectIds = projectIds.filter(id => id !== projectId);
      }

      [settings] = await db
        .update(userSettings)
        .set({
          autoCreateProjectIds: updatedProjectIds,
          updatedAt: new Date()
        })
        .where(eq(userSettings.userId, userId))
        .returning();
    }

    res.json({
      success: true,
      enabled,
      projectId,
      autoCreateProjectIds: settings.autoCreateProjectIds || []
    });
  } catch (error) {
    logger.error('[SETTINGS] Error updating auto-create setting', { error: error.message });
    next(error);
  }
});

module.exports = router;

