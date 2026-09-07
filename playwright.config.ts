import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.E2E_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('E2E_PORT must be an integer between 1 and 65535');
}
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run start --workspace @family/web -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
