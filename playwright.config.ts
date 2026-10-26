import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests.
 *
 *  emulator (default, `npm run test:e2e`)
 *    The real app against the Firebase Emulator Suite. Start `npm run emulators` and
 *    `npm run seed` first; Playwright starts the dev server itself.
 *
 *  harness (`npm run test:e2e:harness`)
 *    The same UI built with the in-memory test harness (no Firebase). Useful where Java or the
 *    emulators are unavailable. It does not exercise Firebase or the Security Rules.
 *
 * PW_CHROMIUM_PATH / PW_CHROMIUM_ARGS optionally point at a custom Chromium binary.
 */
const executablePath = process.env.PW_CHROMIUM_PATH;
const extraArgs = process.env.PW_CHROMIUM_ARGS ? process.env.PW_CHROMIUM_ARGS.split(' ').filter(Boolean) : [];
const launchOptions = executablePath ? { executablePath, args: extraArgs } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1360, height: 900 } },
  projects: [
    {
      name: 'emulator',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173', launchOptions },
    },
    {
      name: 'harness',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4318', launchOptions },
    },
  ],
  webServer: process.env.PW_PROJECT === 'harness' || process.argv.includes('--project=harness')
    ? { command: 'npm run build:harness && npx vite preview --outDir dist-harness --port 4318 --strictPort', url: 'http://127.0.0.1:4318', reuseExistingServer: true, timeout: 180_000 }
    : { command: 'npm run dev:emu', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 120_000 },
});
