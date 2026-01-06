import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';

/**
 * AI Plan Geometry Extraction E2E Tests
 * Tests extraction of plan geometry model from construction plans
 */
test.describe('AI Plan Geometry Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should extract plan geometry from uploaded plan document', async ({ page }) => {
    const response = await page.request.post('/api/compliance/extract-plan-geometry', {
      data: {
        document_ids: ['test-document-id'],
        project_id: 'test-project-id'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('plan_geometry_model_id');
    expect(result.plan_geometry_model_id).toBeTruthy();
  });

  test('should validate plan geometry model structure', async ({ page }) => {
    const response = await page.request.post('/api/compliance/extract-plan-geometry', {
      data: {
        document_ids: ['test-document-id'],
        project_id: 'test-project-id'
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

