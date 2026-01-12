import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import { BACKEND_BASE_URL } from '../helpers/service-urls';
import path from 'path';
import fs from 'fs';

/**
 * AI Form Field Extraction E2E Tests
 * Tests mobile form upload and AI-powered field extraction
 */
test.describe('AI Form Field Extraction', () => {
  // Skip if live AI tests are not enabled
  test.skip(
    process.env.RUN_LIVE_AI_TESTS !== 'true',
    'Live AI tests are disabled. Set RUN_LIVE_AI_TESTS=true to enable.'
  );

  let firstProjectId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    
    // Get first project ID for use in tests
    try {
      await page.goto('/dashboard/projects');
      await page.waitForSelector('[data-testid="projects-page"]', { timeout: 30000 });
      
      // Wait for projects to load
      await page.waitForFunction(() => {
        const projectSelect = document.querySelector('#project-select') as HTMLSelectElement;
        const projectCards = document.querySelectorAll('[data-testid="project"], .project-card');
        return (projectSelect && projectSelect.options.length > 1) || projectCards.length > 0;
      }, { timeout: 30000 });
      
      // Get the first project ID
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

  test('should extract fields from as-built form image', async ({ page }) => {
    if (!firstProjectId) {
      test.skip(true, 'No projects available - cannot test form extraction without a project');
      return;
    }
    
    // Check if test image exists, otherwise use minimal base64 JPEG
    const imagePath = path.resolve(__dirname, '../../backend/test-form-image.jpg');
    let imageData: string | Buffer;
    
    if (fs.existsSync(imagePath)) {
      imageData = imagePath;
    } else {
      // Use minimal valid JPEG base64 (1x1 pixel) for testing
      const MINIMAL_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';
      imageData = Buffer.from(MINIMAL_JPEG_BASE64, 'base64');
      console.log('⚠️ Test image not found, using minimal JPEG for testing');
    }
    
    // Navigate to as-built data page
    await page.goto('/dashboard/documents/asbuilt');
    
    // Look for import or upload button
    const importButton = page.locator('[data-testid="import-data-button"], button:has-text("Import")').first();
    await importButton.waitFor({ timeout: 10000 }).catch(() => {});
    
    // This would typically be done via mobile app, but we can test the API endpoint
    const response = await page.request.post(`${BACKEND_BASE_URL}/api/mobile/extract-form-data/${firstProjectId}`, {
      multipart: {
        image: imageData,
        formType: 'panel_placement'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('extracted_fields');
    
    // Verify extracted fields structure
    if (result.success) {
      expect(result.extracted_fields).toBeDefined();
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('should handle extraction failure gracefully', async ({ page }) => {
    if (!firstProjectId) {
      test.skip(true, 'No projects available - cannot test form extraction without a project');
      return;
    }
    
    // Test with invalid image or corrupted file
    const response = await page.request.post(`${BACKEND_BASE_URL}/api/mobile/extract-form-data/${firstProjectId}`, {
      multipart: {
        image: Buffer.from('invalid-image-data'),
        formType: 'panel_placement'
      }
    });
    
    // Should return 200 with success: false (graceful failure)
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.extracted_fields).toEqual({});
  });

  test('should extract different form types correctly', async ({ page }) => {
    if (!firstProjectId) {
      test.skip(true, 'No projects available - cannot test form extraction without a project');
      return;
    }
    
    const formTypes = [
      'panel_placement',
      'panel_seaming',
      'non_destructive',
      'trial_weld',
      'repairs',
      'destructive'
    ];
    
    // Check if test image exists, otherwise use minimal base64 JPEG
    const imagePath = path.resolve(__dirname, '../../backend/test-form-image.jpg');
    let imageData: string | Buffer;
    
    if (fs.existsSync(imagePath)) {
      imageData = imagePath;
    } else {
      // Use minimal valid JPEG base64 (1x1 pixel) for testing
      const MINIMAL_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';
      imageData = Buffer.from(MINIMAL_JPEG_BASE64, 'base64');
      console.log('⚠️ Test image not found, using minimal JPEG for testing');
    }
    
    for (const formType of formTypes) {
      const response = await page.request.post(`${BACKEND_BASE_URL}/api/mobile/extract-form-data/${firstProjectId}`, {
        multipart: {
          image: imageData,
          formType: formType
        }
      });
      
      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('form_type');
      expect(result.form_type).toBe(formType);
    }
  });
});

