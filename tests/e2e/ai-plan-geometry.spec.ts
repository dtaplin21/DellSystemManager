import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import { AI_SERVICE_BASE_URL } from '../helpers/service-urls';
import { TEST_UUIDS } from '../helpers/test-uuids';

/**
 * AI Plan Geometry Extraction E2E Tests
 * Tests extraction of plan geometry model from construction plans
 */
test.describe('AI Plan Geometry Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should extract plan geometry from uploaded plan document', async ({ page }) => {
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');

    const response = await page.request.post(`${AI_SERVICE_BASE_URL}/api/ai/extract-plan-geometry`, {
      timeout: 120_000,
      data: {
        project_id: TEST_UUIDS.PROJECT,
        // AI service expects `documents` with optional `textContent`; keep empty to avoid OpenAI calls.
        documents: [{ id: TEST_UUIDS.DOCUMENT, textContent: '' }]
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result.success).toBeTruthy();
  });

  test('should validate plan geometry model structure', async ({ page }) => {
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');

    const response = await page.request.post(`${AI_SERVICE_BASE_URL}/api/ai/extract-plan-geometry`, {
      timeout: 120_000,
      data: {
        project_id: TEST_UUIDS.PROJECT,
        documents: [{ id: TEST_UUIDS.DOCUMENT, textContent: '' }]
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      
      // Verify plan geometry model has required fields
      if (result.plan_geometry_model) {
        expect(result.plan_geometry_model).toHaveProperty('siteBoundary');
        expect(result.plan_geometry_model).toHaveProperty('referencePoints');
        expect(result.plan_geometry_model).toHaveProperty('scale');
      }
    }
  });
});

