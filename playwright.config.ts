import { defineConfig } from '@playwright/test';

const development = process.env['GUITAR_PRACTICE_TEST_DEV'] === '1';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: development ? 'http://127.0.0.1:4200' : 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: development ? 'pnpm dev'
      : 'python3 -u -m http.server 4173 --bind 127.0.0.1 --directory apps/web/dist/web/browser',
    wait: { stdout: development ? /Local:/ : /Serving HTTP on/ },
    reuseExistingServer: false,
  },
});
