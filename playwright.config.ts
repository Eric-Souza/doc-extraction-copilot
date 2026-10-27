import { defineConfig, devices } from '@playwright/test'

// The production build against a scripted model (AI_PROVIDER=mock): no API key or network needed
const PORT = 3110

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    timeout: 240_000,
    reuseExistingServer: false,
    // Set here, this wins over .env.local
    env: { AI_PROVIDER: 'mock' },
  },
})
