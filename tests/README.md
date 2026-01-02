# E2E Testing with Playwright

## Overview

This directory contains end-to-end tests for GeoSynth QC Pro using Playwright. These tests ensure Water Board-grade compliance and data integrity.

## Test Structure

```
tests/
├── e2e/              # End-to-end test files
│   ├── auth.spec.ts          # Authentication tests
│   ├── projects.spec.ts      # Project management tests
│   ├── documents.spec.ts      # Document upload/management tests
│   ├── asbuilt.spec.ts       # As-built data tests
│   └── panel-layout.spec.ts  # Panel layout tests
├── helpers/          # Test helper functions
│   ├── auth-helpers.ts       # Authentication utilities
│   └── test-helpers.ts       # General test utilities
└── fixtures/         # Test data fixtures
    └── test-data.ts          # Test data constants
```

## Running Tests

### Prerequisites

1. Install Playwright:
```bash
npm install -D @playwright/test
npx playwright install
```

2. Start your development servers:
```bash
npm run dev:all
```

### Run All Tests

```bash
npm run test:e2e
```

### Run Tests in UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

### Run Tests in Debug Mode

```bash
npm run test:e2e:debug
```

### Run Tests in Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/auth.spec.ts
```

### View Test Report

```bash
npm run test:e2e:report
```

## Environment Variables

Create a `.env.test` file or set these environment variables:

```env
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.login(page, 'test@example.com', 'password');
  });

  test('should do something', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### Using Helpers

```typescript
import { AuthHelpers } from '../helpers/auth-helpers';
import { TestHelpers } from '../helpers/test-helpers';

// Login
await AuthHelpers.login(page, email, password);

// Wait for API response
await TestHelpers.waitForAPIResponse(page, /\/api\/projects/);

// Fill form field
await TestHelpers.fillField(page, 'name', 'Project Name');

// Click button
await TestHelpers.clickButton(page, 'Create Project');
```

### Using Test Data

```typescript
import { testUsers, testProjects } from '../fixtures/test-data';

await AuthHelpers.login(page, testUsers.admin.email, testUsers.admin.password);
```

## Best Practices

1. **Use data-testid attributes** in your components for reliable selectors
2. **Group related tests** using `test.describe()`
3. **Use beforeEach** for common setup (like login)
4. **Wait for elements** before interacting with them
5. **Use helper functions** to avoid code duplication
6. **Keep tests independent** - each test should be able to run alone
7. **Clean up test data** if needed (or use test-specific data)

## Test Coverage

### Critical Paths (Water Board Compliance)

- ✅ Authentication & Authorization
- ✅ Project Creation & Deletion
- ✅ Document Upload & Validation
- ✅ As-Built Data Entry & Export
- ✅ Panel Layout Save & Load

## Troubleshooting

### Tests Fail with Timeout

- Ensure dev servers are running (`npm run dev:all`)
- Check that base URL is correct
- Increase timeout in `playwright.config.ts` if needed

### Element Not Found

- Use `data-testid` attributes for reliable selectors
- Check if element is visible before interacting
- Use `page.waitForSelector()` if element loads asynchronously

### Authentication Issues

- Verify test user credentials in `.env.test`
- Check that login flow hasn't changed
- Ensure Supabase/auth is properly configured

## CI/CD Integration

For Phase 2, tests will run automatically on:
- Pull requests
- Pushes to main branch

See `.github/workflows/e2e-tests.yml` (to be created in Phase 2)

