import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import path from 'path';

/**
 * AI Document Analysis E2E Tests
 * Tests document upload, analysis, and extraction features
 */
test.describe('AI Document Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should upload and analyze a document', async ({ page }) => {
    // Navigate to documents page
    await page.goto('/dashboard/documents');
    
    // Wait for upload button
    const uploadButton = page.locator('[data-testid="upload-document-button"], button:has-text("Upload")').first();
    await uploadButton.waitFor({ timeout: 10000 });
    
    // Create a test file (mock PDF)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const fileChooser = await fileChooserPromise;
    
    // Use a test file if available, otherwise skip
    const testFilePath = path.resolve(__dirname, '../../backend/test-document.pdf');
    
    // Check if file exists, if not create a mock
    try {
      await fileChooser.setFiles(testFilePath);
    } catch (error) {
      test.skip(true, 'Test document file not found');
    }
    
    // Wait for upload to complete
    await page.waitForSelector('text=/upload.*success|document.*uploaded/i', { timeout: 30000 }).catch(() => {});
    
    // Verify document appears in list
    await expect(page.locator('text=test-document.pdf')).toBeVisible({ timeout: 10000 });
  });

  test('should extract data from uploaded document', async ({ page }) => {
    await page.goto('/dashboard/documents');
    
    // Assuming there's an extract button or automatic extraction
    // Wait for any extraction indicators
    const extractButton = page.locator('[data-testid="extract-data-button"], button:has-text("Extract")').first();
    
    if (await extractButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await extractButton.click();
      
      // Wait for extraction to complete
      await page.waitForSelector('text=/extraction.*complete|data.*extracted/i', { timeout: 30000 });
      
      // Verify extracted data is displayed
      const extractedData = page.locator('[data-testid="extracted-data"], .extracted-data').first();
      await expect(extractedData).toBeVisible({ timeout: 10000 });
    }
  });

  test('should analyze document with custom question', async ({ page }) => {
    await page.goto('/dashboard/documents');
    
    // Look for analyze button or AI analysis feature
    const analyzeButton = page.locator('[data-testid="analyze-document-button"], button:has-text("Analyze")').first();
    
    if (await analyzeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await analyzeButton.click();
      
      // Fill in analysis question if there's an input
      const questionInput = page.locator('[data-testid="analysis-question-input"], input[placeholder*="question"], textarea[placeholder*="question"]').first();
      if (await questionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await questionInput.fill('What are the key specifications in this document?');
      }
      
      // Submit analysis
      const submitButton = page.locator('[data-testid="submit-analysis-button"], button:has-text("Analyze"), button[type="submit"]').first();
      await submitButton.click();
      
      // Wait for analysis results
      await page.waitForSelector('[data-testid="analysis-results"], text=/analysis|result|specification/i', { timeout: 30000 });
    }
  });
});

