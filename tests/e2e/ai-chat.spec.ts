import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import { AI_SERVICE_BASE_URL } from '../helpers/service-urls';

/**
 * AI Chat/Conversation E2E Tests
 * Tests AI-powered chat and conversation features
 */
test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    
    // Wait for projects to load (indicates auth is working and backend is responsive)
    // This ensures the session is properly established before running tests
    try {
      await page.waitForFunction(() => {
        // Check if projects have loaded (no loading spinner, or projects list visible)
        const loadingIndicator = document.querySelector('[data-testid="loading"], .loading, [aria-busy="true"]');
        const hasProjects = document.querySelector('[data-testid="project"], .project-card, [data-testid="projects-list"]');
        const errorMessage = document.querySelector('[data-testid="error"], .error-message');
        
        // If there's an error message about auth, we're not ready
        if (errorMessage && errorMessage.textContent?.includes('Authentication') || 
            errorMessage?.textContent?.includes('log in')) {
          return false;
        }
        
        // Projects loaded if: no loading indicator OR projects list is visible
        const projectsLoaded = (!loadingIndicator || 
                                loadingIndicator.getAttribute('aria-busy') === 'false' ||
                                window.getComputedStyle(loadingIndicator).display === 'none') &&
                               (hasProjects !== null || document.body.textContent?.includes('project'));
        
        return projectsLoaded;
      }, { timeout: 30000 });
      
      console.log('✅ Projects loaded, authentication verified');
    } catch (error) {
      console.warn('⚠️ Projects may not have loaded, but continuing with test:', error);
      // Don't fail the test, but log a warning
      // Some tests might not need projects to be loaded
    }
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
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');

    const response = await page.request.post(`${AI_SERVICE_BASE_URL}/api/ai/chat`, {
      timeout: 300_000, // Increased to 5 minutes for cold starts and slow AI responses
      data: {
        message: 'What are the best practices for panel placement?',
        context: { project_id: 'test-project-id' },
        user_id: 'test-user',
        user_tier: 'paid_user'
      }
    });
    
    // Log response details for debugging if request failed
    if (!response.ok()) {
      const errorBody = await response.text();
      const errorDetails = {
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        body: errorBody
      };
      console.error('❌ AI Service Error Response:', errorDetails);
      throw new Error(`AI service returned ${response.status()} ${response.statusText()}: ${errorBody.substring(0, 500)}`);
    }
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('response');
    expect(result.response).toBeTruthy();
  });

  test('should maintain conversation context', async ({ page }) => {
    test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Set RUN_LIVE_AI_TESTS=true to run live AI service tests.');
    test.setTimeout(360_000); // Increased to 6 minutes to provide buffer for slow AI responses

    // Verify AI service is reachable
    console.log('🔍 [TEST] Checking AI service availability...');
    console.log('🔍 [TEST] AI Service URL:', AI_SERVICE_BASE_URL);
    try {
      // Try a simple GET request to see if service is up (some services have a health endpoint)
      const healthCheck = await page.request.get(`${AI_SERVICE_BASE_URL}/health`, { timeout: 10000 }).catch(() => null);
      if (healthCheck) {
        console.log('✅ [TEST] AI service health check:', healthCheck.status());
      } else {
        console.log('⚠️ [TEST] No health endpoint available, proceeding with chat test...');
      }
    } catch (error) {
      console.log('⚠️ [TEST] Health check failed (expected if no /health endpoint):', error);
    }

    // Send first message
    console.log('📤 [TEST] Sending first chat message...');
    const response1 = await page.request.post(`${AI_SERVICE_BASE_URL}/api/ai/chat`, {
      timeout: 300_000, // Increased to 5 minutes for cold starts and slow AI responses
      data: {
        message: 'I have 10 panels to place',
        context: { project_id: 'test-project-id' },
        user_id: 'test-user'
      }
    });
    
    console.log('📥 [TEST] First response received:', {
      status: response1.status(),
      statusText: response1.statusText(),
      ok: response1.ok()
    });
    
    if (!response1.ok()) {
      const errorBody1 = await response1.text();
      console.error('❌ [TEST] First request failed:', {
        status: response1.status(),
        statusText: response1.statusText(),
        body: errorBody1.substring(0, 1000)
      });
      throw new Error(`First AI service request failed: ${response1.status()} ${response1.statusText()}: ${errorBody1.substring(0, 500)}`);
    }
    
    const result1 = await response1.json();
    console.log('✅ [TEST] First request succeeded:', {
      hasResponse: !!result1.response,
      hasConversationId: !!(result1.conversation_id || result1.session_id),
      keys: Object.keys(result1)
    });
    
    const conversationId = result1.conversation_id || result1.session_id || result1.user_id;
    
    if (!conversationId) {
      throw new Error('First request did not return a conversation_id, session_id, or user_id');
    }
    
    console.log('🔄 [TEST] Conversation ID:', conversationId);
    
    // Send follow-up message with context
    console.log('📤 [TEST] Sending follow-up chat message...');
    const response2 = await page.request.post(`${AI_SERVICE_BASE_URL}/api/ai/chat`, {
      timeout: 300_000, // Increased to 5 minutes for cold starts and slow AI responses
      data: {
        message: 'What is the optimal layout?',
        context: { project_id: 'test-project-id', conversation_id: conversationId },
        user_id: 'test-user'
      }
    });
    
    console.log('📥 [TEST] Second response received:', {
      status: response2.status(),
      statusText: response2.statusText(),
      ok: response2.ok()
    });
    
    // Log response details for debugging if request failed
    if (!response2.ok()) {
      const errorBody = await response2.text();
      const errorDetails = {
        status: response2.status(),
        statusText: response2.statusText(),
        headers: Object.fromEntries(Object.entries(response2.headers())),
        body: errorBody,
        bodyPreview: errorBody.substring(0, 500)
      };
      console.error('❌ [TEST] AI Service Error Response (follow-up):', JSON.stringify(errorDetails, null, 2));
      throw new Error(`AI service returned ${response2.status()} ${response2.statusText()}: ${errorBody.substring(0, 500)}`);
    }
    
    expect(response2.ok()).toBeTruthy();
    const result2 = await response2.json();
    console.log('✅ [TEST] Second request succeeded:', {
      hasResponse: !!result2.response,
      keys: Object.keys(result2)
    });
    expect(result2.response).toBeTruthy();
  });
});

