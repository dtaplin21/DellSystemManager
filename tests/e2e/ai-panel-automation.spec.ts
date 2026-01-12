import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';

/**
 * AI Panel Population Automation E2E Tests
 * Tests automated panel creation from form data
 */
test.describe('AI Panel Population Automation', () => {
  // Skip if live AI tests are not enabled
  test.skip(
    process.env.RUN_LIVE_AI_TESTS !== 'true',
    'Live AI tests are disabled. Set RUN_LIVE_AI_TESTS=true to enable.'
  );

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should automate panel population from form', async ({ page }) => {
    const response = await page.request.post('/api/automate-from-form', {
      data: {
        form_id: 'test-form-id',
        project_id: 'test-project-id',
        automation_type: 'panel_placement'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('job_id');
    expect(result.job_id).toBeTruthy();
    
    // Check job status
    const statusResponse = await page.request.get(`/api/automation-jobs/${result.job_id}`);
    expect(statusResponse.ok()).toBeTruthy();
    
    const status = await statusResponse.json();
    expect(status).toHaveProperty('status');
    expect(['pending', 'processing', 'completed', 'failed']).toContain(status.status);
  });

  test('should track automation job progress', async ({ page }) => {
    // Create automation job
    const createResponse = await page.request.post('/api/automate-from-form', {
      data: {
        form_id: 'test-form-id',
        project_id: 'test-project-id'
      }
    });
    
    const { job_id } = await createResponse.json();
    
    // Poll for job completion
    let attempts = 0;
    let completed = false;
    
    while (attempts < 10 && !completed) {
      await page.waitForTimeout(2000); // Wait 2 seconds between checks
      
      const statusResponse = await page.request.get(`/api/automation-jobs/${job_id}`);
      const status = await statusResponse.json();
      
      if (status.status === 'completed' || status.status === 'failed') {
        completed = true;
        expect(status).toHaveProperty('result');
      }
      
      attempts++;
    }
    
    expect(completed).toBeTruthy();
  });
});

