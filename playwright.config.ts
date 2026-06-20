import { defineConfig } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Load .env.local so tests inherit CLERK_SECRET_KEY, SUPABASE_*, etc.
loadEnv({ path: '.env.local', quiet: true })

export default defineConfig({
  // Pick up both the existing E2E suite and the security regression suite.
  // Vitest unit tests live under tests/security/ but match `*.spec.ts`; we
  // disambiguate by routing browser-needing security tests to
  // `tests/security/browser/`.
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'security/browser/**/*.spec.ts'],
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { channel: 'chrome' },
    },
  ],
})
