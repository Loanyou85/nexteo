import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout. Ils tournent contre le build de production
 * (`next start`), sur la base de développement de `.env` — jamais sur la
 * production. Les tests de paiement Stripe se sautent d'eux-mêmes sans clé
 * de test.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
  },
  projects: [
    { name: 'bureau', use: { ...devices['Desktop Chrome'] } },
    { name: 'telephone', use: { ...devices['Pixel 7'] }, testMatch: /tarifs\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/tarifs`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
