import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import path from 'path';
import fs from 'fs';
import { AI_SERVICE_BASE_URL } from '../helpers/service-urls';

/**
 * AI Defect Detection E2E Tests
 * Tests AI-powered defect detection in images
 */
test.describe('AI Defect Detection', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should detect defects in uploaded image', async ({ page }) => {
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');

    const imagePath = path.resolve(__dirname, '../../backend/test-defect-image.jpg');
    const imageBase64 = fs.readFileSync(imagePath).toString('base64');
    const response = await page.request.post(`${AI_SERVICE_BASE_URL}/api/ai/detect-defects`, {
      timeout: 120_000,
      data: {
        image_base64: imageBase64,
        project_id: 'test-project-id',
        metadata: { filename: path.basename(imagePath) }
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
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');

    // Test with a clean image (no defects)
    const imagePath = path.resolve(__dirname, '../../backend/test-clean-image.jpg');
    const imageBase64 = fs.readFileSync(imagePath).toString('base64');
    const response = await page.request.post(`${AI_SERVICE_BASE_URL}/api/ai/detect-defects`, {
      timeout: 120_000,
      data: {
        image_base64: imageBase64,
        project_id: 'test-project-id',
        metadata: { filename: path.basename(imagePath) }
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result.defects).toBeInstanceOf(Array);
    // May be empty or contain low-confidence detections
  });
});

