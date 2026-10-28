/** Run real browser journeys against one configured Vite server. */
import { defineConfig } from '@playwright/test';
const port = process.env.E2E_PORT || '5173';
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000,
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 0.0.0.0 --port ${port} --strictPort`,
    url: baseURL, reuseExistingServer: true, timeout: 30000
  }
});
