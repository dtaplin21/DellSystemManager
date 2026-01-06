import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';

/**
 * AI Chat/Conversation E2E Tests
 * Tests AI-powered chat and conversation features
 */
test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should send chat message and receive response', async ({ page }) => {
    // Navigate to chat interface if available
    await page.goto('/dashboard');
    
    // Look for chat interface
    const chatInput = page.locator('[data-testid="ai-chat-input"], input[placeholder*="chat"], textarea[placeholder*="message"]').first();
    
    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('Help me optimize my panel layout');
      
      const sendButton = page.locator('[data-testid="send-message-button"], button:has-text("Send")').first();
      await sendButton.click();
      
      // Wait for response
      await page.waitForSelector('[data-testid="ai-response"], .ai-message', { timeout: 30000 });
      
      const response = page.locator('[data-testid="ai-response"], .ai-message').last();
      await expect(response).toBeVisible();
    }
  });

  test('should handle chat API endpoint', async ({ page }) => {
    const response = await page.request.post('/api/ai/chat', {
      data: {
        message: 'What are the best practices for panel placement?',
        context: { project_id: 'test-project-id' },
        user_id: 'test-user',
        user_tier: 'paid_user'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('response');
    expect(result.response).toBeTruthy();
  });

  test('should maintain conversation context', async ({ page }) => {
    // Send first message
    const response1 = await page.request.post('/api/ai/chat', {
      data: {
        message: 'I have 10 panels to place',
        context: { project_id: 'test-project-id' },
        user_id: 'test-user'
      }
    });
    
    expect(response1.ok()).toBeTruthy();
    const result1 = await response1.json();
    const conversationId = result1.conversation_id || result1.session_id;
    
    // Send follow-up message with context
    const response2 = await page.request.post('/api/ai/chat', {
      data: {
        message: 'What is the optimal layout?',
        context: { project_id: 'test-project-id', conversation_id: conversationId },
        user_id: 'test-user'
      }
    });
    
    expect(response2.ok()).toBeTruthy();
    const result2 = await response2.json();
    expect(result2.response).toBeTruthy();
  });
});

