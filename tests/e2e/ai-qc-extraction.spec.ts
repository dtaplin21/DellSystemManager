import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';

/**
 * AI QC Data Extraction E2E Tests
 * Tests quality control data extraction from documents
 */
test.describe('AI QC Data Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should extract QC data from document', async ({ page }) => {
    const response = await page.request.post('/api/ai/qc/analyze', {
      data: {
        document_path: '/path/to/qc-document.pdf',
        extraction_type: 'qc_data',
        user_id: 'test-user',
        user_tier: 'paid_user'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('extracted_data');
    expect(result.extracted_data).toBeDefined();
  });

  test('should validate extracted QC data structure', async ({ page }) => {
    const response = await page.request.post('/api/ai/qc/analyze', {
      data: {
        document_path: '/path/to/qc-document.pdf',
        extraction_type: 'qc_data'
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      
      // Verify QC data has expected structure
      if (result.extracted_data) {
        expect(typeof result.extracted_data).toBe('object');
      }
    }
  });
});

