const axios = require('axios');
const logger = require('../lib/logger');

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
   * Extract positioning data from form
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

      // Extract positioning data
      const positioning = this.extractPositioningData(formRecord);

      // Call AI service to trigger browser tools automation
      try {
        const aiServiceResponse = await axios.post(
          `${this.aiServiceUrl}/api/automate-from-form`,
          {
            form_record: formRecord,
            project_id: projectId,
            user_id: userId,
            item_type: itemType,
            positioning: positioning
          },
          {
            timeout: 30000 // 30 second timeout
          }
        );

        logger.info(`[FORM_AUTOMATION] AI service automation completed`, {
          formId: formRecord.id,
          jobId: aiServiceResponse.data?.job_id,
          itemId: aiServiceResponse.data?.item_id
        });

        return {
          success: true,
          jobId: aiServiceResponse.data?.job_id,
          itemId: aiServiceResponse.data?.item_id,
          itemType
        };
      } catch (aiError) {
        logger.error(`[FORM_AUTOMATION] AI service automation failed`, {
          formId: formRecord.id,
          error: aiError.message,
          stack: aiError.stack
        });

        // Don't fail approval - log error and continue
        return {
          success: false,
          error: aiError.message,
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

