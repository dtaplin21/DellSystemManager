import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import { BACKEND_BASE_URL } from '../helpers/service-urls';
import { ProjectHelpers } from '../helpers/project-helpers';

/**
 * AI Workflow Orchestration E2E Tests
 * Tests multi-agent workflow orchestration
 */
test.describe('AI Workflow Orchestration', () => {
  // Skip if live AI tests are not enabled
  test.skip(
    process.env.RUN_LIVE_AI_TESTS !== 'true',
    'Live AI tests are disabled. Set RUN_LIVE_AI_TESTS=true to enable.'
  );

  let firstProjectId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    
    // Get first project ID for use in tests
    firstProjectId = await ProjectHelpers.getFirstProjectId(page);
  });

  test('should get available workflows', async ({ page }) => {
    const response = await page.request.get(`${BACKEND_BASE_URL}/api/ai/orchestration/workflows`);
    
    expect(response.ok()).toBeTruthy();
    
    const workflows = await response.json();
    expect(workflows).toBeInstanceOf(Array);
    
    // Verify workflow structure
    if (workflows.length > 0) {
      const workflow = workflows[0];
      expect(workflow).toHaveProperty('id');
      expect(workflow).toHaveProperty('name');
      expect(workflow).toHaveProperty('description');
    }
  });

  test('should start workflow orchestration', async ({ page }) => {
    if (!firstProjectId) {
      test.skip(true, 'No projects available - cannot test workflow orchestration without a project');
      return;
    }

    const response = await page.request.post(`${BACKEND_BASE_URL}/api/ai/orchestration/start/${firstProjectId}`, {
      data: {
        workflow_type: 'comprehensive',
        options: {}
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('orchestration_id');
    expect(result.orchestration_id).toBeTruthy();
  });

  test('should get orchestration status', async ({ page }) => {
    if (!firstProjectId) {
      test.skip(true, 'No projects available - cannot test workflow orchestration without a project');
      return;
    }

    // Start orchestration first
    const startResponse = await page.request.post(`${BACKEND_BASE_URL}/api/ai/orchestration/start/${firstProjectId}`, {
      data: { workflow_type: 'comprehensive' }
    });
    
    const { orchestration_id } = await startResponse.json();
    
    // Check status
    const statusResponse = await page.request.get(`${BACKEND_BASE_URL}/api/ai/orchestration/status/${orchestration_id}`);
    expect(statusResponse.ok()).toBeTruthy();
    
    const status = await statusResponse.json();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('progress');
  });

  test('should get orchestrator manifest', async ({ page }) => {
    const response = await page.request.get(`${BACKEND_BASE_URL}/api/ai/orchestration/manifest`);
    
    expect(response.ok()).toBeTruthy();
    
    const manifest = await response.json();
    expect(manifest).toHaveProperty('capabilities');
    expect(manifest).toHaveProperty('workflows');
  });
});

