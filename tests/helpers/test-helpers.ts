import { Page, expect } from '@playwright/test';

/**
 * General test helper functions
 */
export class TestHelpers {
  /**
   * Wait for API response
   */
  static async waitForAPIResponse(page: Page, urlPattern: RegExp | string, timeout = 30000) {
    const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
    return page.waitForResponse(
      (response) => pattern.test(response.url()) && response.status() === 200,
      { timeout }
    );
  }

  /**
   * Wait for element to be visible and stable
   */
  static async waitForStable(page: Page, selector: string, timeout = 10000) {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    
    // Wait for any animations/transitions to complete
    await page.waitForTimeout(300);
    
    return element;
  }

  /**
   * Fill form field by label or name
   */
  static async fillField(page: Page, labelOrName: string, value: string) {
    // Try by label first
    const label = page.locator(`label:has-text("${labelOrName}")`);
    if (await label.count() > 0) {
      const input = page.locator(`input[name="${labelOrName}"], textarea[name="${labelOrName}"]`);
      await input.fill(value);
      return;
    }

    // Try by name attribute
    const input = page.locator(`input[name="${labelOrName}"], textarea[name="${labelOrName}"]`);
    if (await input.count() > 0) {
      await input.fill(value);
      return;
    }

    // Try by placeholder
    const placeholderInput = page.locator(`input[placeholder*="${labelOrName}"], textarea[placeholder*="${labelOrName}"]`);
    if (await placeholderInput.count() > 0) {
      await placeholderInput.fill(value);
      return;
    }

    throw new Error(`Could not find field: ${labelOrName}`);
  }

  /**
   * Click button by text or testid
   */
  static async clickButton(page: Page, textOrTestId: string) {
    // Try by testid first
    const testIdButton = page.locator(`[data-testid="${textOrTestId}"]`);
    if (await testIdButton.count() > 0 && await testIdButton.isVisible()) {
      await testIdButton.click();
      return;
    }

    // Try by text
    const textButton = page.locator(`button:has-text("${textOrTestId}")`);
    if (await textButton.count() > 0) {
      await textButton.first().click();
      return;
    }

    throw new Error(`Could not find button: ${textOrTestId}`);
  }

  /**
   * Wait for toast notification
   */
  static async waitForToast(page: Page, message?: string, timeout = 5000) {
    const toastSelector = '[role="status"], .toast, [data-testid="toast"]';
    await page.waitForSelector(toastSelector, { timeout });
    
    if (message) {
      await expect(page.locator(toastSelector)).toContainText(message);
    }
  }

  /**
   * Take screenshot with timestamp
   */
  static async takeScreenshot(page: Page, name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ path: `tests/screenshots/${name}-${timestamp}.png`, fullPage: true });
  }
}

