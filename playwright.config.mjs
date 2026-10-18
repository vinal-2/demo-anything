import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.mjs$/,
  use: { baseURL: BASE_URL, viewport: { width: 1600, height: 900 } },
  webServer: {
    command: 'node tools/serve.mjs',
    url: `${BASE_URL}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
