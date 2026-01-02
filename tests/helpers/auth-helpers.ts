import { Page } from '@playwright/test';

/**
 * Authentication helper functions for E2E tests
 */
export class AuthHelpers {
  /**
   * Login with email and password
   */
  static async login(page: Page, email: string, password: string) {
    await page.goto('/login');
    
    // Wait for login form to be visible
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
    
    // Fill in credentials
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    
    await emailInput.fill(email);
    await passwordInput.fill(password);
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first();
    await submitButton.click();
    
    // Wait for navigation to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  }

  /**
   * Logout from the application
   */
  static async logout(page: Page) {
    // Look for logout button in various locations
    const logoutSelectors = [
      'button:has-text("Logout")',
      'button:has-text("Sign out")',
      '[data-testid="logout-button"]',
      'a:has-text("Logout")',
    ];

    for (const selector of logoutSelectors) {
      const logoutButton = page.locator(selector).first();
      if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await logoutButton.click();
        await page.waitForURL(/\/login/, { timeout: 10000 });
        return;
      }
    }

    // If no logout button found, try navigating directly
    await page.goto('/logout');
    await page.waitForURL(/\/login/, { timeout: 10000 });
  }

  /**
   * Check if user is logged in
   */
  static async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for authentication to complete
   */
  static async waitForAuth(page: Page) {
    // Wait for any auth-related loading indicators to disappear
    await page.waitForLoadState('networkidle');
    
    // Check if we're on dashboard (logged in) or login page (not logged in)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      return false;
    }
    return true;
  }
}

