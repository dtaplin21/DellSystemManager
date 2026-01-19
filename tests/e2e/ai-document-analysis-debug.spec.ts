import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import { ProjectHelpers } from '../helpers/project-helpers';
import { BackendHealth } from '../helpers/backend-health';
import { BACKEND_BASE_URL, FRONTEND_BASE_URL } from '../helpers/service-urls';

/**
 * Debug version of AI Document Analysis test
 * Adds extensive logging to diagnose authentication issues
 * 
 * This test runs against PRODUCTION by default
 * To override: PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
 */
test.describe('AI Document Analysis - Debug (Production)', () => {
  let firstProjectId: string | null = null;

  test('Debug: Test authentication and project fetching', async ({ page }) => {
    console.log('\n🔍 ========================================');
    console.log('🔍 DEBUG TEST - PRODUCTION ENVIRONMENT');
    console.log('🔍 ========================================');
    console.log('🔍 [DEBUG] Frontend URL:', FRONTEND_BASE_URL);
    console.log('🔍 [DEBUG] Backend URL:', BACKEND_BASE_URL);
    console.log('🔍 [DEBUG] Test user:', testUsers.admin.email);
    console.log('🔍 [DEBUG] Current page.baseURL:', page.url().split('/').slice(0, 3).join('/'));
    console.log('🔍 ========================================\n');
    
    // Verify we're targeting production
    const isProduction = FRONTEND_BASE_URL.includes('dellsystemmanager.vercel.app') || 
                         FRONTEND_BASE_URL.includes('vercel.app');
    if (!isProduction && !FRONTEND_BASE_URL.includes('localhost')) {
      console.warn('⚠️ [DEBUG] WARNING: Not targeting production or localhost!');
      console.warn('⚠️ [DEBUG] Frontend URL:', FRONTEND_BASE_URL);
    } else if (isProduction) {
      console.log('✅ [DEBUG] Confirmed: Targeting PRODUCTION');
    } else {
      console.log('ℹ️ [DEBUG] Targeting LOCALHOST (development)');
    }
    
    // Step 1: Test login
    console.log('\n🔍 [DEBUG] Step 1: Attempting login...');
    console.log('🔍 [DEBUG] Login URL:', `${FRONTEND_BASE_URL}/login`);
    try {
      await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
      console.log('✅ [DEBUG] Login completed');
      
      // Check current URL
      const currentUrl = page.url();
      console.log('🔍 [DEBUG] Current URL after login:', currentUrl);
      
      // Check if we're actually logged in
      const isOnDashboard = currentUrl.includes('/dashboard');
      console.log('🔍 [DEBUG] Is on dashboard?', isOnDashboard);
      
      if (!isOnDashboard) {
        console.error('❌ [DEBUG] Login failed - not on dashboard');
        const pageTitle = await page.title();
        const pageText = await page.locator('body').textContent().catch(() => 'Could not get text');
        console.log('🔍 [DEBUG] Page title:', pageTitle);
        console.log('🔍 [DEBUG] Page text (first 500 chars):', pageText?.substring(0, 500));
        return;
      }
    } catch (error: any) {
      console.error('❌ [DEBUG] Login error:', error.message);
      console.error('❌ [DEBUG] Error stack:', error.stack);
      throw error;
    }
    
            // Step 2: Run backend health checks
            console.log('\n🔍 [DEBUG] Step 2: Running backend health checks...');
            const healthChecks = await BackendHealth.runAllHealthChecks(page);
            
            // Step 3: Test API call directly with auth token
            console.log('\n🔍 [DEBUG] Step 3: Testing API call directly with auth token...');
            console.log('🔍 [DEBUG] API Endpoint:', `${BACKEND_BASE_URL}/api/projects`);
            
            // Extract auth token from localStorage
            const authToken = await page.evaluate(async () => {
              try {
                // @ts-ignore
                const supabaseClient = (window as any).__SUPABASE_CLIENT__;
                if (supabaseClient) {
                  const { data: { session } } = await supabaseClient.auth.getSession();
                  if (session?.access_token) {
                    return session.access_token;
                  }
                }
                
                // Fallback: Check localStorage
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && (key.includes('supabase') || key.includes('auth') || key.includes('session'))) {
                    const value = localStorage.getItem(key);
                    if (value) {
                      try {
                        const parsed = JSON.parse(value);
                        if (parsed.access_token) {
                          return parsed.access_token;
                        }
                      } catch {
                        // Not JSON, continue
                      }
                    }
                  }
                }
                return null;
              } catch {
                return null;
              }
            });
            
            console.log('🔍 [DEBUG] Auth token extracted:', authToken ? `${authToken.substring(0, 20)}...` : 'None');
            
            try {
              const headers: Record<string, string> = {};
              if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
                console.log('🔍 [DEBUG] Added Authorization header');
              } else {
                console.warn('⚠️ [DEBUG] No auth token found, request may fail');
              }
              
              const apiResponse = await page.request.get(`${BACKEND_BASE_URL}/api/projects`, {
                timeout: 30000, // Increased timeout
                headers
              });
      
      console.log('🔍 [DEBUG] API Response Status:', apiResponse.status());
      console.log('🔍 [DEBUG] API Response Headers:', Object.fromEntries(Object.entries(apiResponse.headers())));
      
      if (apiResponse.ok()) {
        const projects = await apiResponse.json();
        console.log('✅ [DEBUG] API call successful');
        console.log('🔍 [DEBUG] Projects returned:', projects?.length || 0);
        if (projects?.length > 0) {
          console.log('🔍 [DEBUG] First project:', JSON.stringify(projects[0], null, 2));
          firstProjectId = projects[0].id;
          console.log('✅ [DEBUG] Found project ID via API:', firstProjectId);
        } else {
          console.warn('⚠️ [DEBUG] No projects returned from API');
          console.warn('⚠️ [DEBUG] This could mean:');
          console.warn('   1. User has no projects in database');
          console.warn('   2. Authentication token not being sent');
          console.warn('   3. Backend query returning empty');
        }
      } else {
        const errorText = await apiResponse.text().catch(() => 'Could not read error');
        console.error('❌ [DEBUG] API call failed');
        console.error('❌ [DEBUG] Status:', apiResponse.status());
        console.error('❌ [DEBUG] Error response:', errorText.substring(0, 500));
        
        if (apiResponse.status() === 401) {
          console.error('❌ [DEBUG] AUTHENTICATION FAILED - Token not valid or not sent');
        } else if (apiResponse.status() === 403) {
          console.error('❌ [DEBUG] AUTHORIZATION FAILED - User may not have access');
        } else if (apiResponse.status() >= 500) {
          console.error('❌ [DEBUG] SERVER ERROR - Backend may be down');
        }
      }
    } catch (apiError: any) {
      console.error('❌ [DEBUG] API call exception:', apiError.message);
      console.error('❌ [DEBUG] Error type:', apiError.name);
      if (apiError.message.includes('timeout')) {
        console.error('❌ [DEBUG] TIMEOUT - Backend may be slow or unreachable');
      } else if (apiError.message.includes('ECONNREFUSED')) {
        console.error('❌ [DEBUG] CONNECTION REFUSED - Backend may be down');
      }
      console.error('❌ [DEBUG] Error stack:', apiError.stack?.substring(0, 500));
    }
    
            // Step 4: Test cookies/session
            console.log('\n🔍 [DEBUG] Step 4: Checking cookies and session...');
    const cookies = await page.context().cookies();
    console.log('🔍 [DEBUG] Total cookies:', cookies.length);
    
    // Check for auth-related cookies
    const authCookies = cookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('session') || 
      c.name.includes('token') ||
      c.name.includes('supabase')
    );
    console.log('🔍 [DEBUG] Auth-related cookies:', authCookies.length);
    if (authCookies.length === 0) {
      console.warn('⚠️ [DEBUG] NO AUTH COOKIES FOUND - This may be the problem!');
    }
    authCookies.forEach(c => {
      console.log(`  - ${c.name}: ${c.value.substring(0, 30)}... (domain: ${c.domain}, httpOnly: ${c.httpOnly})`);
    });
    
            // Step 5: Test localStorage
            console.log('\n🔍 [DEBUG] Step 5: Checking localStorage...');
    const localStorageData = await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value && (key.includes('auth') || key.includes('session') || key.includes('supabase'))) {
            data[key] = value.substring(0, 100) + '...';
          }
        }
      }
      return data;
    });
    console.log('🔍 [DEBUG] localStorage auth keys:', Object.keys(localStorageData).length);
    if (Object.keys(localStorageData).length === 0) {
      console.warn('⚠️ [DEBUG] NO AUTH DATA IN LOCALSTORAGE - Session may not be stored');
    }
    Object.entries(localStorageData).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value}`);
    });
    
            // Step 6: Test ProjectHelpers
            console.log('\n🔍 [DEBUG] Step 6: Testing ProjectHelpers.getFirstProjectId...');
    try {
      const projectId = await ProjectHelpers.getFirstProjectId(page);
      console.log('🔍 [DEBUG] ProjectHelpers returned:', projectId);
      
      if (projectId) {
        console.log('✅ [DEBUG] Project ID found:', projectId);
        firstProjectId = projectId;
      } else {
        console.warn('⚠️ [DEBUG] ProjectHelpers returned null');
      }
    } catch (error: any) {
      console.error('❌ [DEBUG] ProjectHelpers error:', error.message);
      console.error('❌ [DEBUG] Error stack:', error.stack?.substring(0, 500));
    }
    
            // Step 7: Test navigating to projects page
            console.log('\n🔍 [DEBUG] Step 7: Testing navigation to projects page...');
    try {
      const projectsUrl = `${FRONTEND_BASE_URL}/dashboard/projects`;
      console.log('🔍 [DEBUG] Navigating to:', projectsUrl);
      await page.goto('/dashboard/projects');
      console.log('✅ [DEBUG] Navigated to /dashboard/projects');
      console.log('🔍 [DEBUG] Final URL:', page.url());
      
      // Wait a bit for page to load
      await page.waitForTimeout(3000);
      
      // Try to find project elements
      const projectSelect = await page.locator('#project-select').count();
      const projectCards = await page.locator('[data-testid="project-card"], .project-card').count();
      const projectLinks = await page.locator('a[href*="/projects/"]').count();
      
      console.log('🔍 [DEBUG] project-select count:', projectSelect);
      console.log('🔍 [DEBUG] project-card count:', projectCards);
      console.log('🔍 [DEBUG] project links count:', projectLinks);
      
      // Check for error messages
      const errorMessages = await page.locator('text=/error|failed|unauthorized|401|403/i').allTextContents();
      if (errorMessages.length > 0) {
        console.error('❌ [DEBUG] Error messages on page:', errorMessages);
      }
      
      // Check for loading indicators
      const loadingIndicators = await page.locator('text=/loading|Loading/i').allTextContents();
      if (loadingIndicators.length > 0) {
        console.log('🔍 [DEBUG] Loading indicators still present:', loadingIndicators);
      }
      
      // Get page title and key text
      const pageTitle = await page.title();
      const bodyText = await page.locator('body').textContent().catch(() => 'Could not get text');
      console.log('🔍 [DEBUG] Page title:', pageTitle);
      console.log('🔍 [DEBUG] Body text (first 300 chars):', bodyText?.substring(0, 300));
      
    } catch (error: any) {
      console.error('❌ [DEBUG] Navigation error:', error.message);
    }
    
            // Summary
            console.log('\n📊 ========================================');
            console.log('📊 [DEBUG] FINAL SUMMARY');
            console.log('📊 ========================================');
            console.log(`  - Frontend URL: ${FRONTEND_BASE_URL}`);
            console.log(`  - Backend URL: ${BACKEND_BASE_URL}`);
            console.log(`  - Login: ${firstProjectId ? '✅ Success' : '❌ Failed/No Projects'}`);
            console.log(`  - Project ID found: ${firstProjectId || 'None'}`);
            console.log(`  - Total cookies: ${cookies.length}`);
            console.log(`  - Auth cookies: ${authCookies.length}`);
            console.log(`  - localStorage auth keys: ${Object.keys(localStorageData).length}`);
            console.log(`  - Auth token extracted: ${authToken ? '✅ Yes' : '❌ No'}`);
            console.log('\n  Backend Health Checks:');
            console.log(`    - /health: ${healthChecks.health.status} (${healthChecks.health.responseTime}ms)`);
            console.log(`    - /api/health: ${healthChecks.apiHealth.status} (${healthChecks.apiHealth.responseTime}ms)`);
            console.log(`    - /api/projects: ${healthChecks.projectsApi.status} (${healthChecks.projectsApi.responseTime}ms)`);
            console.log('📊 ========================================\n');
    
    // Don't fail the test - this is just for debugging
    // But log a warning if no project was found
    if (!firstProjectId) {
      console.warn('⚠️ [DEBUG] No project ID found - this will cause test failures');
    }
    
    expect(firstProjectId).toBeTruthy();
  });
});

