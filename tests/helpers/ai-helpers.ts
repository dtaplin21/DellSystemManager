import { Page, APIRequestContext } from '@playwright/test';

/**
 * AI service helper functions for E2E tests
 */
export class AIHelpers {
  /**
   * Wait for AI service to be available
   */
  static async waitForAIService(page: Page, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await page.request.get('/api/system/services');
        if (response.ok()) {
          const services = await response.json();
          if (services.services?.ai?.openai) {
            return true;
          }
        }
      } catch (error) {
        // Continue waiting
      }
      
      await page.waitForTimeout(1000);
    }
    
    return false;
  }

  /**
   * Extract form fields using AI
   */
  static async extractFormFields(
    request: APIRequestContext,
    projectId: string,
    imagePath: string,
    formType: string = 'panel_placement'
  ) {
    const response = await request.post(`/api/mobile/extract-form-data/${projectId}`, {
      multipart: {
        image: imagePath,
        formType: formType
      }
    });
    
    return response.json();
  }

  /**
   * Analyze document with AI
   */
  static async analyzeDocument(
    request: APIRequestContext,
    documentPath: string,
    question: string = 'Provide a comprehensive analysis'
  ) {
    const response = await request.post('/api/ai/documents/analyze', {
      data: {
        documents: [{ path: documentPath }],
        question: question,
        user_id: 'test-user',
        user_tier: 'paid_user'
      }
    });
    
    return response.json();
  }

  /**
   * Optimize panel layout
   */
  static async optimizePanels(
    request: APIRequestContext,
    panels: any[],
    strategy: string = 'balanced'
  ) {
    const response = await request.post('/api/ai/panels/optimize', {
      data: {
        panels: panels,
        strategy: strategy,
        site_config: {
          area: 1000,
          constraints: []
        },
        user_id: 'test-user',
        user_tier: 'paid_user'
      }
    });
    
    return response.json();
  }

  /**
   * Send chat message to AI
   */
  static async sendChatMessage(
    request: APIRequestContext,
    message: string,
    context: Record<string, any> = {}
  ) {
    const response = await request.post('/api/ai/chat', {
      data: {
        message: message,
        context: context,
        user_id: 'test-user',
        user_tier: 'paid_user'
      }
    });
    
    return response.json();
  }

  /**
   * Wait for automation job to complete
   */
  static async waitForAutomationJob(
    request: APIRequestContext,
    jobId: string,
    timeout = 60000
  ) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await request.get(`/api/automation-jobs/${jobId}`);
      const status = await response.json();
      
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Automation job ${jobId} did not complete within timeout`);
  }
}

