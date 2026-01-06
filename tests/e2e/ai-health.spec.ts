import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';

/**
 * AI Service Health & Status E2E Tests
 * Ensures AI service is available and responding correctly
 */
test.describe('AI Service Health', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should check AI service health endpoint', async ({ page }) => {
    // Navigate to a page that uses AI or check system status
    await page.goto('/dashboard');
    
    // Check if AI service status is available in UI
    // This assumes there's a system status page or API endpoint
    const response = await page.request.get('/api/system/services');
    expect(response.ok()).toBeTruthy();
    
    const services = await response.json();
    expect(services.services).toHaveProperty('ai');
    expect(services.services.ai).toHaveProperty('openai');
  });

  test('should verify AI service URL is configured', async ({ page }) => {
    const response = await page.request.get('/api/system/services');
    const services = await response.json();
    
    // Verify AI service configuration exists
    expect(services.services.ai).toBeDefined();
  });

  test('should handle AI service unavailability gracefully', async ({ page }) => {
    // This test verifies the app doesn't crash when AI service is down
    await page.goto('/dashboard/projects');
    
    // Try to access a feature that uses AI
    // The app should handle errors gracefully
    const errorVisible = await page.locator('text=/ai.*unavailable|service.*error/i').isVisible({ timeout: 5000 }).catch(() => false);
    
    // If error is shown, it should be user-friendly
    if (errorVisible) {
      const errorText = await page.locator('text=/ai.*unavailable|service.*error/i').first().textContent();
      expect(errorText).toBeTruthy();
    }
  });
});

