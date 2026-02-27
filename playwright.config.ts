import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',

  /* 60 seconds per test globally */
  timeout: 60000,

  /* Re-run failing tests once before marking them as failed */
  retries: 1,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],

  expect: { timeout: 10000 },

  /* Capture screenshot only when a test fails */
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },

  projects: [
    /* ---- Desktop ---- */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* ---- Mobile iOS ---- */
    {
      name: 'iPhone SE',
      use: {
        ...devices['iPhone SE'],
        navigationTimeout: 15000,
        actionTimeout: 10000,
      },
    },
    {
      name: 'iPhone 12',
      use: {
        ...devices['iPhone 12'],
        navigationTimeout: 15000,
        actionTimeout: 10000,
      },
    },
    {
      name: 'iPhone 14 Pro Max',
      use: {
        ...devices['iPhone 14 Pro Max'],
        navigationTimeout: 15000,
        actionTimeout: 10000,
      },
    },
  ],

  /* Start the Vite dev server before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
