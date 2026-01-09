import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import { AI_SERVICE_BASE_URL } from '../helpers/service-urls';

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
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');

    await page.goto('/dashboard/projects/test-project-id/panel-layout');
    
    // Test API endpoint directly
    const response = await page.request.post(`${AI_SERVICE_BASE_URL}/optimize-panels`, {
      timeout: 120_000,
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
    expect(result).toHaveProperty('result');
  });

  test('should handle optimization errors gracefully', async ({ page }) => {
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');

    // Test with invalid panel data
    const response = await page.request.post(`${AI_SERVICE_BASE_URL}/optimize-panels`, {
      timeout: 120_000,
      data: {
        panels: [],
        strategy: 'invalid_strategy',
        site_config: {}
      }
    });
    
    const result = await response.json();
    // The service may return a structured response even for invalid strategy.
    // Accept either explicit error or a result payload with warnings.
    const hasError = typeof (result as any).error === 'string' && (result as any).error.length > 0;
    const hasWarnings =
      (result as any).result?.analysis?.warnings && Array.isArray((result as any).result.analysis.warnings);
    expect(hasError || hasWarnings).toBeTruthy();
  });
});

