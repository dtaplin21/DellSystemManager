import { Page } from '@playwright/test';
import { BACKEND_BASE_URL } from './service-urls';

/**
 * Project helper functions for E2E tests
 */
export class ProjectHelpers {
  /**
   * Get the first available project ID from the projects page
   * Returns null if no projects are found
   */
  static async getFirstProjectId(page: Page): Promise<string | null> {
    // Try API first - it's more reliable than waiting for UI
    // page.request automatically includes auth cookies from the browser context
    try {
      console.log('🔍 [ProjectHelpers] Attempting API call to:', `${BACKEND_BASE_URL}/api/projects`);
      
      const apiResponse = await page.request.get(`${BACKEND_BASE_URL}/api/projects`, {
        timeout: 15000
      });
      
      console.log('🔍 [ProjectHelpers] API Response Status:', apiResponse.status());
      console.log('🔍 [ProjectHelpers] API Response Headers:', Object.fromEntries(Object.entries(apiResponse.headers())));
      
      if (apiResponse.ok()) {
        const projects = await apiResponse.json();
        console.log('🔍 [ProjectHelpers] Projects received:', projects?.length || 0);
        
        if (Array.isArray(projects) && projects.length > 0) {
          const firstProjectId = projects[0].id;
          console.log(`✅ Found project ID via API: ${firstProjectId}`);
          return firstProjectId;
        } else {
          console.warn('⚠️ API returned empty projects array');
          console.warn('⚠️ This may mean: 1) User has no projects, 2) Auth failed silently, 3) Backend error');
        }
      } else {
        const errorText = await apiResponse.text().catch(() => 'Could not read error response');
        console.error(`❌ API returned status ${apiResponse.status()}`);
        console.error(`❌ Error response: ${errorText.substring(0, 200)}`);
        
        // Check for auth errors
        if (apiResponse.status() === 401) {
          console.error('❌ Authentication failed - check if login was successful');
        } else if (apiResponse.status() === 403) {
          console.error('❌ Authorization failed - user may not have access');
        } else if (apiResponse.status() >= 500) {
          console.error('❌ Server error - backend may be down or experiencing issues');
        }
      }
    } catch (apiError: any) {
      console.error('❌ API approach failed with exception:', apiError?.message || apiError);
      console.error('❌ Error type:', apiError?.name);
      console.error('❌ Error stack:', apiError?.stack?.substring(0, 500));
      console.log('⚠️ Falling back to UI approach...');
    }
    
    // Fallback to UI approach if API fails
    try {
      await page.goto('/dashboard/projects');
      await page.waitForSelector('[data-testid="projects-page"]', { timeout: 30000 });
      
      // Wait for loading state to finish - the "Loading projects..." text should disappear
      // This is more reliable than waiting for projects to appear
      await page.waitForFunction(() => {
        const loadingText = Array.from(document.querySelectorAll('*')).find(
          el => el.textContent?.includes('Loading projects')
        );
        return !loadingText; // Loading is done when the text is gone
      }, { timeout: 30000 }).catch(() => {
        // If loading text check fails, try alternative approach
        console.log('⚠️ Loading text check failed, trying alternative...');
      });
      
      // Wait for network to be idle (projects API call should be done)
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        console.log('⚠️ Network idle timeout, continuing...');
      });
      
      // Additional wait to ensure React has rendered
      await page.waitForTimeout(1000);
      
      // Wait for projects to load - check for either dropdown or cards
      // Use shorter timeout and fall back to API if UI is slow
      try {
        await page.waitForFunction(() => {
          const projectSelect = document.querySelector('#project-select') as HTMLSelectElement;
          const projectCards = document.querySelectorAll('[data-testid="project-card"], .project-card');
          const projectLinks = document.querySelectorAll('a[href*="/projects/"]');
          
          // Check if projects are loaded (either dropdown has options or cards/links exist)
          const hasProjects = (projectSelect && projectSelect.options.length > 1) || 
                            projectCards.length > 0 || 
                            projectLinks.length > 0;
          
          return hasProjects;
        }, { timeout: 15000 }); // Reduced timeout, will fall back to API
      } catch (waitError) {
        // If UI wait fails, try API fallback immediately
        console.log('⚠️ UI wait failed, trying API fallback...');
        const apiResponse = await page.request.get(`${BACKEND_BASE_URL}/api/projects`, {
          timeout: 10000
        }).catch(() => null);
        
        if (apiResponse?.ok()) {
          const projects = await apiResponse.json();
          if (Array.isArray(projects) && projects.length > 0) {
            const firstProjectId = projects[0].id;
            console.log(`✅ Found project ID via API (UI timeout): ${firstProjectId}`);
            return firstProjectId;
          }
        }
        // Re-throw if API also fails
        throw waitError;
      }
      
      // Get the first project ID
      const projectId = await page.evaluate(() => {
        // Try dropdown first (most reliable)
        const projectSelect = document.querySelector('#project-select') as HTMLSelectElement;
        if (projectSelect && projectSelect.options.length > 1) {
          return projectSelect.options[1].value; // Skip "Select a project" option
        }
        
        // Try project cards
        const projectCard = document.querySelector('[data-testid="project-card"], .project-card') as HTMLElement;
        if (projectCard) {
          // Try to find a link inside the card
          const link = projectCard.querySelector('a[href*="/projects/"]') as HTMLAnchorElement;
          if (link) {
            const match = link.href.match(/\/projects\/([^\/]+)/);
            if (match) return match[1];
          }
          // Or try to get project ID from data attribute
          const projectIdAttr = projectCard.getAttribute('data-project-id');
          if (projectIdAttr) return projectIdAttr;
        }
        
        // Try any project link on the page
        const projectLink = document.querySelector('a[href*="/projects/"]') as HTMLAnchorElement;
        if (projectLink) {
          const match = projectLink.href.match(/\/projects\/([^\/]+)/);
          if (match) return match[1];
        }
        
        return null;
      });
      
      if (projectId) {
        console.log(`✅ Found project ID: ${projectId}`);
        return projectId;
      }
      
      // Fallback: Try to fetch projects via API if UI approach failed
      console.log('⚠️ UI approach failed, trying API fallback...');
      try {
        const response = await page.request.get(`${BACKEND_BASE_URL}/api/projects`, {
          timeout: 10000
        });
        
        if (response.ok()) {
          const projects = await response.json();
          if (Array.isArray(projects) && projects.length > 0) {
            const firstProjectId = projects[0].id;
            console.log(`✅ Found project ID via API: ${firstProjectId}`);
            return firstProjectId;
          }
        }
      } catch (apiError) {
        console.warn('⚠️ API fallback also failed:', apiError);
      }
      
      console.warn('⚠️ No projects found - page may still be loading or no projects exist');
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to get project ID:', error);
      
      // Last resort: Try API fallback even if UI approach threw an error
      try {
        const response = await page.request.get(`${BACKEND_BASE_URL}/api/projects`, {
          timeout: 10000
        });
        
        if (response.ok()) {
          const projects = await response.json();
          if (Array.isArray(projects) && projects.length > 0) {
            const firstProjectId = projects[0].id;
            console.log(`✅ Found project ID via API fallback: ${firstProjectId}`);
            return firstProjectId;
          }
        }
      } catch (apiError) {
        // Ignore API errors in fallback
      }
      
      return null;
    }
  }
}

