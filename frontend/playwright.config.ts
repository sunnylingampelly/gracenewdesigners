import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys. They run against a live stack:
 *   backend:  php artisan migrate:fresh --seed  (local env seeds the demo catalogue + owner account)
 *             served on API_INTERNAL_URL (default http://127.0.0.1:8010)
 *   frontend: npm run dev  (or npm run build && npm start) on E2E_BASE_URL (default http://localhost:3000)
 * Journeys create uniquely-named records so they can be re-run against the same database.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
