import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for GeoSynth QC Pro
 * Water Board-grade compliance testing
 */
// Default to the deployed frontend domain (override via PLAYWRIGHT_TEST_BASE_URL when needed)
const DEPLOYED_BASE_URL = 'https://dellsystemmanager.vercel.app';
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || DEPLOYED_BASE_URL;
const useLocalWebServer = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');

export default defineConfig({
  testDir: './tests/e2e',
  
  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporting
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  
  // Test timeout
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  
  use: {
    // Base URL for all tests
    baseURL,
    
    // Trace and debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // Action timeout
    actionTimeout: 10000,
  },

  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment when needed for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Web server configuration
  ...(useLocalWebServer
    ? {
        webServer: {
          command: 'npm run dev:all',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      }
    : {}),
});

