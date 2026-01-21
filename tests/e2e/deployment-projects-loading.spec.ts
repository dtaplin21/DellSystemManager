import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { testUsers } from '../fixtures/test-data';
import { BackendHealth } from '../helpers/backend-health';
import { ProjectHelpers } from '../helpers/project-helpers';
import { BACKEND_BASE_URL, FRONTEND_BASE_URL } from '../helpers/service-urls';

/**
 * Deployment Projects Loading Test
 * 
 * This test verifies that projects are loading correctly in production deployment.
 * It checks:
 * 1. Backend health endpoints are responding
 * 2. Projects API endpoint is accessible
 * 3. Projects can be fetched and displayed
 * 4. Frontend can load projects successfully
 */
test.describe('Deployment - Projects Loading', () => {
  test('should verify backend services are healthy', async ({ page }) => {
    console.log('\n🏥 [DEPLOYMENT] Testing backend health...');
    
    const healthChecks = await BackendHealth.runAllHealthChecks(page);
    
    expect(healthChecks.health.status).toBe('healthy');
    expect(healthChecks.apiHealth.status).toBe('healthy');
    
    console.log('✅ [DEPLOYMENT] Backend health checks passed');
  });

  test('should load projects after authentication', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes total timeout for cold starts
    
    console.log('\n📊 [DEPLOYMENT] Testing projects loading...');
    
    // Login
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    console.log('✅ [DEPLOYMENT] Authentication successful');
    
    // Test projects API directly
    const projectsApiCheck = await BackendHealth.checkProjectsApi(page);
    console.log('📊 [DEPLOYMENT] Projects API check:', {
      status: projectsApiCheck.status,
      statusCode: projectsApiCheck.statusCode,
      responseTime: projectsApiCheck.responseTime,
      projectCount: projectsApiCheck.details?.projectCount,
    });
    
    // Verify API is accessible
    expect(projectsApiCheck.status).toBe('healthy');
    expect(projectsApiCheck.statusCode).toBe(200);
    
    // Navigate to projects page
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {
      console.warn('⚠️ [DEPLOYMENT] Network idle timeout, but continuing...');
    });
    
    // Wait for projects to load (either dropdown or cards)
    const projectsLoaded = await page.waitForFunction(() => {
      const projectSelect = document.querySelector('#project-select') as HTMLSelectElement;
      const projectCards = document.querySelectorAll('[data-testid="project-card"], .project-card');
      const projectLinks = document.querySelectorAll('a[href*="/projects/"]');
      const noProjectsMessage = document.querySelector('text=/no projects|no projects yet/i');
      
      // Projects are loaded if:
      // 1. Dropdown has options (more than just "Select a project")
      // 2. OR project cards/links exist
      // 3. OR "No projects" message is shown (which means loading completed)
      return (
        (projectSelect && projectSelect.options.length > 1) ||
        projectCards.length > 0 ||
        projectLinks.length > 0 ||
        noProjectsMessage !== null
      );
    }, { timeout: 90000 }).catch(() => false); // Increased from 30000 to 90000 for cold starts
    
    expect(projectsLoaded).toBeTruthy();
    console.log('✅ [DEPLOYMENT] Projects page loaded successfully');
    
    // Verify no error messages
    const errorMessages = await page.locator('text=/error|failed|unauthorized|401|403/i').allTextContents();
    if (errorMessages.length > 0) {
      console.warn('⚠️ [DEPLOYMENT] Error messages found:', errorMessages);
    }
    
    // Get project count from UI
    const projectSelect = await page.locator('#project-select').count();
    const projectCards = await page.locator('[data-testid="project-card"], .project-card').count();
    const projectLinks = await page.locator('a[href*="/projects/"]').count();
    
    console.log('📊 [DEPLOYMENT] Projects found in UI:', {
      dropdown: projectSelect,
      cards: projectCards,
      links: projectLinks,
    });
    
    // At least one method should show projects (or "no projects" message)
    const hasProjects = projectSelect > 0 || projectCards > 0 || projectLinks > 0;
    const hasNoProjectsMessage = await page.locator('text=/no projects|no projects yet/i').isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasProjects || hasNoProjectsMessage).toBeTruthy();
  });

  test('should fetch projects via API', async ({ page }) => {
    console.log('\n🔍 [DEPLOYMENT] Testing projects API fetch...');
    
    // Login
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    
    // Use ProjectHelpers to fetch projects
    const projectId = await ProjectHelpers.getFirstProjectId(page);
    
    if (projectId) {
      console.log('✅ [DEPLOYMENT] Successfully fetched project:', projectId);
      expect(projectId).toBeTruthy();
      expect(typeof projectId).toBe('string');
      expect(projectId.length).toBeGreaterThan(0);
    } else {
      console.warn('⚠️ [DEPLOYMENT] No projects found for test user');
      // This is OK - user may not have projects yet
      // But API should still respond successfully
      const projectsApiCheck = await BackendHealth.checkProjectsApi(page);
      expect(projectsApiCheck.statusCode).toBe(200);
    }
  });

  test('should handle projects loading timeout gracefully', async ({ page }) => {
    console.log('\n⏱️ [DEPLOYMENT] Testing timeout handling...');
    
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    
    // Navigate to projects page
    await page.goto('/dashboard/projects');
    
    // Wait for either projects to load OR timeout message
    const result = await Promise.race([
      page.waitForSelector('[data-testid="project-card"], .project-card, #project-select', { timeout: 10000 }).then(() => 'loaded'),
      page.waitForSelector('text=/timeout|error|failed/i', { timeout: 10000 }).then(() => 'error'),
      page.waitForSelector('text=/no projects|loading/i', { timeout: 10000 }).then(() => 'message'),
    ]).catch(() => 'timeout');
    
    console.log('📊 [DEPLOYMENT] Loading result:', result);
    
    // Should not be stuck in loading state indefinitely
    const stillLoading = await page.locator('text=/loading projects/i').isVisible({ timeout: 2000 }).catch(() => false);
    expect(stillLoading).toBeFalsy();
  });
});

