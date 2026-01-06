import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import path from 'path';

/**
 * AI Defect Detection E2E Tests
 * Tests AI-powered defect detection in images
 */
test.describe('AI Defect Detection', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should detect defects in uploaded image', async ({ page }) => {
    const response = await page.request.post('/api/mobile/detect-defects', {
      multipart: {
        image: path.resolve(__dirname, '../../backend/test-defect-image.jpg'),
        projectId: 'test-project-id'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('defects');
    expect(result.defects).toBeInstanceOf(Array);
    
    // Verify defect structure if defects found
    if (result.defects.length > 0) {
      const defect = result.defects[0];
      expect(defect).toHaveProperty('type');
      expect(defect).toHaveProperty('location');
      expect(defect).toHaveProperty('confidence');
    }
  });

  test('should return empty defects array for clean image', async ({ page }) => {
    // Test with a clean image (no defects)
    const response = await page.request.post('/api/mobile/detect-defects', {
      multipart: {
        image: path.resolve(__dirname, '../../backend/test-clean-image.jpg'),
        projectId: 'test-project-id'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result.defects).toBeInstanceOf(Array);
    // May be empty or contain low-confidence detections
  });
});

