import { defineConfig, devices } from '@playwright/test';

// Las pruebas E2E se ejecutan contra la compilación de producción servida bajo /iconatlas/,
// igual que en GitHub Pages. PW_CHROMIUM permite usar un Chromium ya instalado.
const executablePath = process.env.PW_CHROMIUM || undefined;
const BASE = `http://localhost:4173${process.env.BASE_PATH ?? '/iconatlas/'}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
