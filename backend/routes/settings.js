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
  // #region agent log
  const fs = require('fs');
  const logPath = '/Users/dtaplin21/DellSystemManager/.cursor/debug.log';
  const logEntry = {location:'backend/routes/settings.js:13',message:'GET /api/settings entry',data:{userId:req.user?.id,hasUser:!!req.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
  try { fs.appendFileSync(logPath, JSON.stringify(logEntry)+'\n'); } catch(e){}
  logger.info('[DEBUG] GET /api/settings entry', logEntry.data);
  console.log('[DEBUG] GET /api/settings entry', logEntry.data);
  // #endregion
  
  try {
    const userId = req.user.id;
    
    // #region agent log
    const logEntry2 = {location:'backend/routes/settings.js:20',message:'Before database query',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
    try { fs.appendFileSync(logPath, JSON.stringify(logEntry2)+'\n'); } catch(e){}
    logger.info('[DEBUG] Before database query', logEntry2.data);
    console.log('[DEBUG] Before database query', logEntry2.data);
    // #endregion

    let [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    
    // #region agent log
    const logEntry3 = {location:'backend/routes/settings.js:28',message:'Database query result',data:{hasSettings:!!settings,settingsFound:!!settings},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
    try { fs.appendFileSync(logPath, JSON.stringify(logEntry3)+'\n'); } catch(e){}
    logger.info('[DEBUG] Database query result', logEntry3.data);
    console.log('[DEBUG] Database query result', logEntry3.data);
    // #endregion

    // If no settings exist, create default settings
    if (!settings) {
      // #region agent log
      const logEntry4 = {location:'backend/routes/settings.js:33',message:'Creating default settings',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
      try { fs.appendFileSync(logPath, JSON.stringify(logEntry4)+'\n'); } catch(e){}
      logger.info('[DEBUG] Creating default settings', logEntry4.data);
      console.log('[DEBUG] Creating default settings', logEntry4.data);
      // #endregion
      
      const [newSettings] = await db
        .insert(userSettings)
        .values({
          userId,
          autoCreateFromForms: false,
          autoCreateProjectIds: []
        })
        .returning();
      
      // #region agent log
      const logEntry5 = {location:'backend/routes/settings.js:45',message:'Default settings created',data:{hasNewSettings:!!newSettings,newSettingsId:newSettings?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
      try { fs.appendFileSync(logPath, JSON.stringify(logEntry5)+'\n'); } catch(e){}
      logger.info('[DEBUG] Default settings created', logEntry5.data);
      console.log('[DEBUG] Default settings created', logEntry5.data);
      // #endregion
      
      settings = newSettings;
    }

    // #region agent log
    const logEntry6 = {location:'backend/routes/settings.js:52',message:'Before response',data:{hasSettings:!!settings,autoCreateFromForms:settings?.autoCreateFromForms},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
    try { fs.appendFileSync(logPath, JSON.stringify(logEntry6)+'\n'); } catch(e){}
    logger.info('[DEBUG] Before response', logEntry6.data);
    console.log('[DEBUG] Before response', logEntry6.data);
    // #endregion

    res.json({
      success: true,
      settings: {
        autoCreateFromForms: settings.autoCreateFromForms,
        autoCreateProjectIds: settings.autoCreateProjectIds || []
      }
    });
  } catch (error) {
    // #region agent log
    const logEntry7 = {location:'backend/routes/settings.js:63',message:'Settings route error',data:{error:error.message,errorCode:error.code,errorName:error.name,errorStack:error.stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
    try { fs.appendFileSync(logPath, JSON.stringify(logEntry7)+'\n'); } catch(e){}
    logger.error('[DEBUG] Settings route error', logEntry7.data);
    console.error('[DEBUG] Settings route error', logEntry7.data);
    // #endregion
    
    logger.error('[SETTINGS] Error fetching user settings', { error: error.message, stack: error.stack });
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

