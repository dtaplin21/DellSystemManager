import { Page } from '@playwright/test';

/**
 * Project helper functions for E2E tests
 */
export class ProjectHelpers {
  /**
   * Get the first available project ID from the projects page
   * Returns null if no projects are found
   */
  static async getFirstProjectId(page: Page): Promise<string | null> {
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
      const projectId = await page.evaluate(() => {
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
      
      if (projectId) {
        console.log(`✅ Found project ID: ${projectId}`);
      } else {
        console.warn('⚠️ No projects found');
      }
      
      return projectId;
    } catch (error) {
      console.warn('⚠️ Failed to get project ID:', error);
      return null;
    }
  }
}

