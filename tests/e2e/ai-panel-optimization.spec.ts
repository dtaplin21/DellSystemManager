import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';

/**
 * AI Panel Optimization E2E Tests
 * Tests AI-powered panel layout optimization
 */
test.describe('AI Panel Optimization', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should optimize panel layout', async ({ page }) => {
    // Navigate to panel layout page
    await page.goto('/dashboard/projects/test-project-id/panel-layout');
    
    // Wait for panel layout to load
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Look for optimize button
    const optimizeButton = page.locator('[data-testid="optimize-panels-button"], button:has-text("Optimize")').first();
    
    if (await optimizeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await optimizeButton.click();
      
      // Wait for optimization to complete
      await page.waitForSelector('[data-testid="optimization-complete"], text=/optimization.*complete|layout.*optimized/i', { timeout: 30000 });
      
      // Verify panels were updated
      const successMessage = page.locator('[data-testid="optimization-success"], text=/optimized|improved|updated/i').first();
      await expect(successMessage).toBeVisible({ timeout: 10000 });
    }
  });

  test('should optimize panels with strategy', async ({ page }) => {
    await page.goto('/dashboard/projects/test-project-id/panel-layout');
    
    // Test API endpoint directly
    const response = await page.request.post('/api/ai/panels/optimize', {
      data: {
        panels: [
          { id: 'P001', width: 40, height: 100, x: 0, y: 0 }
        ],
        strategy: 'balanced',
        site_config: {
          area: 1000,
          constraints: []
        },
        user_id: 'test-user',
        user_tier: 'paid_user'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('optimized_panels');
    expect(result.optimized_panels).toBeInstanceOf(Array);
  });

  test('should handle optimization errors gracefully', async ({ page }) => {
    // Test with invalid panel data
    const response = await page.request.post('/api/ai/panels/optimize', {
      data: {
        panels: [],
        strategy: 'invalid_strategy',
        site_config: {}
      }
    });
    
    // Should return error response
    const result = await response.json();
    expect(result).toHaveProperty('error');
  });
});

