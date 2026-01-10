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
    
    // CRITICAL: Wait for session to be established and stored
    // Wait for network to be idle (all auth requests complete)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.warn('⚠️ Network idle timeout, but continuing...');
    });
    
    // Additional wait to ensure localStorage/sessionStorage is updated
    await page.waitForTimeout(2000);
    
    // Verify session exists and is accessible via Supabase client
    const sessionReady = await page.evaluate(async () => {
      try {
        // Try to get session via Supabase client if available
        // @ts-ignore - checking if window has supabase client
        const supabaseClient = (window as any).__SUPABASE_CLIENT__;
        if (supabaseClient) {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session?.access_token) {
            return { ready: true, hasToken: true, method: 'supabaseClient' };
          }
        }
        
        // Fallback: Check localStorage for Supabase session
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('auth') || key.includes('session'))) {
            const value = localStorage.getItem(key);
            if (value && (value.includes('access_token') || value.includes('token'))) {
              return { ready: true, hasToken: true, method: 'localStorage' };
            }
          }
        }
        
        return { ready: false, hasToken: false, method: 'none' };
      } catch (error) {
        return { ready: false, hasToken: false, method: 'error', error: String(error) };
      }
    });
    
    console.log('🔐 [AUTH HELPER] Session readiness check:', sessionReady);
    
    // If session isn't ready, wait and retry
    if (!sessionReady.ready) {
      console.warn('⚠️ Session not immediately ready, waiting and retrying...');
      for (let attempt = 1; attempt <= 5; attempt++) {
        await page.waitForTimeout(1000);
        const retryCheck = await page.evaluate(async () => {
          try {
            // @ts-ignore
            const supabaseClient = (window as any).__SUPABASE_CLIENT__;
            if (supabaseClient) {
              const { data: { session } } = await supabaseClient.auth.getSession();
              return session?.access_token ? true : false;
            }
            return false;
          } catch {
            return false;
          }
        });
        
        if (retryCheck) {
          console.log(`✅ [AUTH HELPER] Session ready after ${attempt} retries`);
          break;
        } else if (attempt === 5) {
          console.warn('⚠️ [AUTH HELPER] Session still not ready after 5 retries, but continuing...');
        }
      }
    }
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

