import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import path from 'path';

/**
 * AI Form Field Extraction E2E Tests
 * Tests mobile form upload and AI-powered field extraction
 */
test.describe('AI Form Field Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should extract fields from as-built form image', async ({ page }) => {
    // Navigate to as-built data page
    await page.goto('/dashboard/documents/asbuilt');
    
    // Look for import or upload button
    const importButton = page.locator('[data-testid="import-data-button"], button:has-text("Import")').first();
    await importButton.waitFor({ timeout: 10000 });
    
    // This would typically be done via mobile app, but we can test the API endpoint
    const response = await page.request.post('/api/mobile/extract-form-data/test-project-id', {
      multipart: {
        image: path.resolve(__dirname, '../../backend/test-form-image.jpg'),
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
    // Test with invalid image or corrupted file
    const response = await page.request.post('/api/mobile/extract-form-data/test-project-id', {
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
    const formTypes = [
      'panel_placement',
      'panel_seaming',
      'non_destructive',
      'trial_weld',
      'repairs',
      'destructive'
    ];
    
    for (const formType of formTypes) {
      const response = await page.request.post('/api/mobile/extract-form-data/test-project-id', {
        multipart: {
          image: path.resolve(__dirname, '../../backend/test-form-image.jpg'),
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

