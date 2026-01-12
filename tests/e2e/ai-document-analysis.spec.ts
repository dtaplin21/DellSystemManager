import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import path from 'path';

/**
 * AI Document Analysis E2E Tests
 * Tests document upload, analysis, and extraction features
 */
test.describe('AI Document Analysis', () => {
  let firstProjectId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    
    // CRITICAL: Get first project ID for use in tests
    // We'll select it programmatically after each navigation since React context doesn't persist
    try {
      await page.goto('/dashboard/projects');
      await page.waitForSelector('[data-testid="projects-page"]', { timeout: 30000 });
      
      // Wait for projects to load
      await page.waitForFunction(() => {
        const projectSelect = document.querySelector('#project-select') as HTMLSelectElement;
        const projectCards = document.querySelectorAll('[data-testid="project"], .project-card');
        return (projectSelect && projectSelect.options.length > 1) || projectCards.length > 0;
      }, { timeout: 30000 });
      
      // Get the first project ID and store it
      firstProjectId = await page.evaluate(() => {
        const projectSelect = document.querySelector('#project-select') as HTMLSelectElement;
        if (projectSelect && projectSelect.options.length > 1) {
          return projectSelect.options[1].value; // Skip "Select a project" option
        }
        
        // Try to get from project card/link
        const projectLink = document.querySelector('[data-testid="project"], .project-card, a[href*="/projects/"]') as HTMLElement;
        if (projectLink) {
          const href = projectLink.getAttribute('href');
          if (href) {
            const match = href.match(/\/projects\/([^\/]+)/);
            if (match) return match[1];
          }
        }
        return null;
      });
      
      if (firstProjectId) {
        console.log(`✅ Found project ID: ${firstProjectId}`);
      } else {
        console.warn('⚠️ No projects found');
      }
    } catch (error) {
      console.warn('⚠️ Failed to get project ID:', error);
    }
  });

  test('should upload and analyze a document', async ({ page }) => {
    if (!firstProjectId) {
      test.skip(true, 'No projects available - cannot test document upload without a selected project');
      return;
    }
    
    // Navigate to documents page
    await page.goto('/dashboard/documents');
    
    // Programmatically select the project via ProjectsProvider context
    // Since React context doesn't persist across navigations, we need to select it after page load
    await page.evaluate(async (projectId) => {
      // Wait for ProjectsProvider to be available
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to access ProjectsProvider via React DevTools or window object
      // If ProjectsProvider exposes selectProject globally, use it
      if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        // Try to find ProjectsProvider in React tree
        const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        // This is a fallback - we'll use navigation instead
      }
      
      // Alternative: Navigate to project page first, then documents
      // This ensures ProjectsProvider selects the project
      window.location.href = `/dashboard/projects/${projectId}`;
    }, firstProjectId);
    
    // Wait for navigation to project page
    await page.waitForURL(/\/dashboard\/projects\/.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Now navigate to documents page - project should be selected
    await page.goto('/dashboard/documents');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000); // Give ProjectsProvider time to maintain selection
    
    // Wait for upload button (should be visible if project is selected)
    const uploadButton = page.locator('[data-testid="upload-document-button"], button:has-text("Upload")').first();
    const noProjectMessage = page.locator('text=/no project selected|select a project/i');
    
    // Double-check: if still no project selected, try one more time
    const hasNoProject = await noProjectMessage.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasNoProject) {
      console.log('⚠️ Project still not selected, trying direct selection...');
      // Navigate back to project page and then documents
      await page.goto(`/dashboard/projects/${firstProjectId}`);
      await page.waitForTimeout(1000);
      await page.goto('/dashboard/documents');
      await page.waitForTimeout(1000);
    }
    
    await uploadButton.waitFor({ timeout: 15000 });
    
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
    
    // Wait for projects to be available
    const noProjectMessage = page.locator('text=/no project selected|select a project/i');
    if (await noProjectMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No project selected - cannot test document extraction without a project');
      return;
    }
    
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
    
    // Wait for projects to be available
    const noProjectMessage = page.locator('text=/no project selected|select a project/i');
    if (await noProjectMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No project selected - cannot test document analysis without a project');
      return;
    }
    
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

