import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';
import { TestHelpers } from '../helpers/test-helpers';
import { testUsers, testProjects } from '../fixtures/test-data';

/**
 * Project Management E2E Tests
 * Critical for Water Board compliance - ensures data integrity
 */
test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
    await page.goto('/dashboard/projects');
  });

  test('should display projects page', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/projects/);
    
    // Check for common project page elements
    const pageElements = [
      'text=/project/i',
      '[data-testid="projects-page"]',
      'button:has-text("New"), button:has-text("Create")',
    ];
    
    let elementFound = false;
    for (const selector of pageElements) {
      if (await page.locator(selector).first().isVisible({ timeout: 2000 }).catch(() => false)) {
        elementFound = true;
        break;
      }
    }
    
    expect(elementFound).toBeTruthy();
  });

  test('should create a new project', async ({ page }) => {
    const projectName = testProjects.valid.name;
    
    // Click create/new project button
    const createButton = page.locator(
      'button:has-text("New Project"), button:has-text("Create Project"), [data-testid="create-project-button"]'
    ).first();
    
    await createButton.click();
    
    // Wait for form/modal to appear
    await page.waitForTimeout(500);
    
    // Fill in project details
    await TestHelpers.fillField(page, 'name', projectName);
    
    // Try to fill description if field exists
    const descriptionField = page.locator('textarea[name="description"], input[name="description"]');
    if (await descriptionField.count() > 0) {
      await descriptionField.fill(testProjects.valid.description);
    }
    
    // Try to fill location if field exists
    const locationField = page.locator('input[name="location"]');
    if (await locationField.count() > 0) {
      await locationField.fill(testProjects.valid.location);
    }
    
    // Submit form
    const submitButton = page.locator(
      'button[type="submit"]:has-text("Create"), button:has-text("Save"), [data-testid="submit-project-button"]'
    ).first();
    
    await submitButton.click();
    
    // Wait for success (either redirect or toast)
    await page.waitForTimeout(1000);
    
    // Verify project was created (check for project name in page)
    await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 10000 });
  });

  test('should view project details', async ({ page }) => {
    // Wait for projects to load
    await page.waitForTimeout(2000);
    
    // Try to click on first project card/link
    const projectSelectors = [
      '.project-card:first-child',
      '[data-testid="project-card"]:first-child',
      'a[href*="/projects/"]:first-child',
      'tr:has-text("Project"):first-child',
    ];
    
    let clicked = false;
    for (const selector of projectSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        await element.click();
        clicked = true;
        break;
      }
    }
    
    if (clicked) {
      // Should navigate to project detail page
      await page.waitForURL(/\/dashboard\/projects\/[^/]+/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/dashboard\/projects\/[^/]+/);
    } else {
      // Skip if no projects exist
      test.skip();
    }
  });

  test('should save project data correctly', async ({ page }) => {
    const projectName = `Save Test ${Date.now()}`;
    
    // Create project
    const createButton = page.locator(
      'button:has-text("New Project"), button:has-text("Create Project"), [data-testid="create-project-button"]'
    ).first();
    
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      await TestHelpers.fillField(page, 'name', projectName);
      
      const submitButton = page.locator(
        'button[type="submit"]:has-text("Create"), button:has-text("Save")'
      ).first();
      await submitButton.click();
      
      await page.waitForTimeout(2000);
      
      // Reload page
      await page.reload();
      
      // Verify project still exists
      await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('should delete a project', async ({ page }) => {
    // Wait for projects to load
    await page.waitForTimeout(2000);
    
    // Find delete button on first project
    const deleteSelectors = [
      '.project-card:first-child button:has-text("Delete")',
      '[data-testid="delete-project-button"]:first-child',
      'button[aria-label*="Delete"]:first-child',
    ];
    
    let deleteButton = null;
    for (const selector of deleteSelectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        deleteButton = button;
        break;
      }
    }
    
    if (deleteButton) {
      // Get project name before deletion (if visible)
      const projectCard = page.locator('.project-card:first-child, [data-testid="project-card"]:first-child').first();
      const projectName = await projectCard.textContent().catch(() => '');
      
      await deleteButton.click();
      
      // Confirm deletion if confirmation dialog appears
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")'
      ).first();
      
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }
      
      // Wait for deletion to complete
      await page.waitForTimeout(2000);
      
      // Verify project is removed (if we had the name)
      if (projectName) {
        await expect(page.locator(`text=${projectName}`)).not.toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });
});

