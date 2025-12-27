const axios = require('axios');
const logger = require('../lib/logger');
const jobQueue = require('./jobQueue');

class FormAutomationService {
  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:5001';
  }

  /**
   * Determine if a form domain creates a visual item
   */
  createsVisualItem(domain) {
    const visualItemDomains = ['panel_placement', 'repairs', 'destructive'];
    return visualItemDomains.includes(domain);
  }

  /**
   * Determine item type based on form domain
   */
  getItemType(domain) {
    switch (domain) {
      case 'panel_placement':
        return 'panel';
      case 'repairs':
        return 'patch'; // May create patch if repair type indicates patch
      case 'destructive':
        return 'destructive_test';
      default:
        return null; // panel_seaming, non_destructive, trial_weld don't create visual items
    }
  }

  /**
   * Check if form has all required structured location data for patch creation
   * Required fields: placementType, locationDistance, locationDirection, panelNumbers
   */
  hasRequiredLocationData(formRecord) {
    const domain = formRecord.domain;
    
    // Only repair and destructive forms require structured location data for patches
    if (domain !== 'repairs' && domain !== 'destructive') {
      return true; // Not a patch-creating form, no validation needed
    }
    
    const mappedData = formRecord.mapped_data || {};
    
    // Check for all required structured location fields
    const hasPlacementType = mappedData.placementType || mappedData.placement_type;
    const hasDistance = mappedData.locationDistance !== undefined && mappedData.locationDistance !== null ||
                       mappedData.location_distance !== undefined && mappedData.location_distance !== null;
    const hasDirection = mappedData.locationDirection || mappedData.location_direction;
    const hasPanelNumbers = mappedData.panelNumbers || mappedData.panel_numbers;
    
    const isValid = !!(hasPlacementType && hasDistance && hasDirection && hasPanelNumbers);
    
    if (!isValid) {
      logger.info(`[FORM_AUTOMATION] Missing required location data for form ${formRecord.id}`, {
        formId: formRecord.id,
        domain,
        hasPlacementType: !!hasPlacementType,
        hasDistance,
        hasDirection: !!hasDirection,
        hasPanelNumbers: !!hasPanelNumbers
      });
    }
    
    return isValid;
  }

  /**
   * Extract positioning data from form (legacy method - kept for backward compatibility)
   * @deprecated Use analyzePlacement() instead for AI-powered placement
   */
  extractPositioningData(formRecord) {
    const mappedData = formRecord.mapped_data || {};
    const rawData = formRecord.raw_data || {};

    // Try to extract location/position data from form
    // This may vary by form type
    let x = null;
    let y = null;

    // Check for locationNote or location fields
    if (mappedData.locationNote) {
      // Try to parse location note for coordinates
      // This is a placeholder - actual parsing logic may be more complex
    }

    if (mappedData.location) {
      // Try to parse location field
    }

    // Default positioning if not found
    if (x === null || y === null) {
      // Use center of canvas or random positioning
      x = 100;
      y = 100;
    }

    return { x, y };
  }

  /**
   * Analyze placement using AI service
   * Calls the AI service to determine optimal placement coordinates
   */
  async analyzePlacement(formRecord, projectId, itemType, authToken = null) {
    try {
      logger.info(`[FORM_AUTOMATION] Analyzing placement for form ${formRecord.id}`, {
        formId: formRecord.id,
        projectId,
        itemType
      });

      const response = await axios.post(
        `${this.aiServiceUrl}/api/ai/analyze-placement`,
        {
          form_record: formRecord,
          project_id: projectId,
          item_type: itemType
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          },
          timeout: 30000 // 30 second timeout
        }
      );

      if (response.data && response.data.success) {
        const placement = response.data.placement || {};
        logger.info(`[FORM_AUTOMATION] Placement analysis completed`, {
          formId: formRecord.id,
          x: placement.x,
          y: placement.y,
          confidence: placement.confidence,
          strategy: placement.strategy
        });
        return {
          x: placement.x || 2000,
          y: placement.y || 2000,
          confidence: placement.confidence || 0.5,
          strategy: placement.strategy || 'ai_analysis',
          reasoning: placement.reasoning
        };
      } else {
        logger.warn(`[FORM_AUTOMATION] Placement analysis returned unsuccessful response`, {
          formId: formRecord.id,
          response: response.data
        });
        // Fallback to default positioning
        return this.extractPositioningData(formRecord);
      }
    } catch (error) {
      logger.error(`[FORM_AUTOMATION] Error analyzing placement`, {
        formId: formRecord.id,
        error: error.message,
        stack: error.stack
      });
      // Fallback to default positioning
      return this.extractPositioningData(formRecord);
    }
  }

  /**
   * Automate item creation from approved form
   * Called automatically after form approval
   */
  async automateFromForm(formRecord, projectId, userId) {
    try {
      const domain = formRecord.domain;
      
      // Check if this form domain creates a visual item
      if (!this.createsVisualItem(domain)) {
        logger.info(`[FORM_AUTOMATION] Form domain ${domain} does not create visual item, skipping automation`, {
          formId: formRecord.id,
          domain
        });
        return {
          success: true,
          skipped: true,
          reason: 'Domain does not create visual item'
        };
      }

      const itemType = this.getItemType(domain);
      if (!itemType) {
        logger.warn(`[FORM_AUTOMATION] Unknown item type for domain ${domain}`, {
          formId: formRecord.id,
          domain
        });
        return {
          success: false,
          error: `Unknown item type for domain: ${domain}`
        };
      }

      logger.info(`[FORM_AUTOMATION] Starting automation for form ${formRecord.id}`, {
        formId: formRecord.id,
        domain,
        itemType,
        projectId,
        userId
      });

      // Validate required location data for patch-creating forms
      if (!this.hasRequiredLocationData(formRecord)) {
        logger.warn(`[FORM_AUTOMATION] Skipping automation - missing required location data`, {
          formId: formRecord.id,
          domain,
          itemType,
          reason: 'Missing required structured location fields (placementType, locationDistance, locationDirection, panelNumbers)'
        });
        return {
          success: false,
          skipped: true,
          reason: 'Missing required structured location fields. Form must have placementType, locationDistance, locationDirection, and panelNumbers to automatically create patches.',
          itemType
        };
      }

      // Analyze placement using AI service (async, don't block)
      // The AI service will handle placement analysis as part of the workflow
      // For now, use default positioning - will be enhanced by multi-agent workflow
      const positioning = this.extractPositioningData(formRecord);

      // Queue browser automation job instead of direct HTTP call
      try {
        const jobResult = await jobQueue.addAutomationJob({
          type: 'form_automation',
          form_record: formRecord,
          project_id: projectId,
          user_id: userId,
          item_type: itemType,
          positioning: positioning,
          asbuilt_record_id: formRecord.id
        });

        logger.info(`[FORM_AUTOMATION] Automation job queued`, {
          formId: formRecord.id,
          jobId: jobResult.jobId,
          itemType
        });

        return {
          success: true,
          jobId: jobResult.jobId,
          status: 'queued',
          itemType
        };
      } catch (queueError) {
        logger.error(`[FORM_AUTOMATION] Failed to queue automation job`, {
          formId: formRecord.id,
          error: queueError.message,
          stack: queueError.stack
        });

        // Don't fail approval - log error and continue
        return {
          success: false,
          error: queueError.message,
          itemType
        };
      }
    } catch (error) {
      logger.error(`[FORM_AUTOMATION] Error in automateFromForm`, {
        formId: formRecord?.id,
        error: error.message,
        stack: error.stack
      });

      // Don't fail approval - log error and continue
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if user has auto-creation enabled
   */
  async isAutoCreateEnabled(userId, projectId) {
    try {
      const { db } = require('../db');
      const { userSettings } = require('../db/schema');
      const { eq } = require('drizzle-orm');

      const [settings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (!settings) {
        // No settings found - default to false
        return false;
      }

      // Check global setting
      if (settings.autoCreateFromForms) {
        return true;
      }

      // Check project-specific setting
      const projectIds = settings.autoCreateProjectIds || [];
      if (Array.isArray(projectIds) && projectIds.includes(projectId)) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[FORM_AUTOMATION] Error checking auto-create settings`, {
        userId,
        projectId,
        error: error.message
      });
      // Default to false on error
      return false;
    }
  }
}

module.exports = new FormAutomationService();

