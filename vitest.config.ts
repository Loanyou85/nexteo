import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

// Les tests d'intégration lisent TEST_DATABASE_URL dans .env s'il existe.
if (existsSync('.env')) {
  for (const l of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^(TEST_DATABASE_URL)="?([^"]*)"?$/.exec(l.trim());
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
  }
}
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL_ORIGINE = process.env.DATABASE_URL ?? '';
  // Toute la suite pointe sur la base de test, jamais sur celle de développement.
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
}
process.env.MOCK_LATENCE = '0';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Les tests d'intégration partagent une base : pas de parallélisme entre fichiers.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
});
