import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;
// CHROMIUM_PATH points at a Chromium you already have, for machines where
// `npx playwright install chromium` can't download. Normally leave it unset.
const executablePath = process.env.CHROMIUM_PATH || undefined;
const args = ['--autoplay-policy=no-user-gesture-required'];

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/artifacts',
  reporter: [['list']],
  workers: 2,
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    browserName: 'chromium',
    launchOptions: executablePath
      ? { executablePath, args: [...args, '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'] }
      : { args },
  },
  webServer: {
    command: 'node tools/serve.mjs',
    url: `${BASE_URL}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
