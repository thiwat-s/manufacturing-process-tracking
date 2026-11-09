import { defineConfig } from '@playwright/test';
const databaseUrl = process.env.DATABASE_URL || '';
if (!/(manufacturing_test|_test)(\?|$)/i.test(databaseUrl))
  throw new Error(
    'E2E tests require a dedicated test database. Set DATABASE_URL to a database named manufacturing_test.',
  );
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3000', headless: true },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
