import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';

/**
 * Authentication E2E Tests
 * Critical for Water Board compliance - ensures proper access control
 */
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start from login page
    await page.goto('/login');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Verify dashboard content is visible
    await expect(page.locator('text=Dashboard, text=/project/i')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await AuthHelpers.login(page, 'invalid@example.com', 'wrongpassword');
    
    // Should still be on login page or show error
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Check for error message
      const errorSelectors = [
        'text=/invalid/i',
        'text=/error/i',
        'text=/incorrect/i',
        '[role="alert"]',
        '.error',
      ];
      
      let errorFound = false;
      for (const selector of errorSelectors) {
        const errorElement = page.locator(selector).first();
        if (await errorElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          errorFound = true;
          break;
        }
      }
      
      expect(errorFound).toBeTruthy();
    } else {
      // If redirected, should not be dashboard
      expect(currentUrl).not.toContain('/dashboard');
    }
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login first
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Reload page
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=/dashboard|project/i')).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Logout
    await AuthHelpers.logout(page);
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard/projects');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });
});

