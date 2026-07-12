import { defineConfig, devices } from "@playwright/test";

// Design-system consistency + role-smoke suite. Requires the Django backend
// (see ../backend) to already be running on :8000 with the demo users
// seeded via `python manage.py seed_demo_users` — these tests log in as
// real seeded accounts (see fixtures/auth.js) rather than mocking auth.
export default defineConfig({
  testDir: "./tests/e2e",
  // Authenticates each of the 6 seeded roles ONCE (see global-setup.js) so
  // spec files reuse a saved session instead of resubmitting the login form
  // per test — the backend throttles /api/auth/login/ to 5/minute/IP
  // (supportmitra/settings.py), which repeated per-test UI logins would trip.
  globalSetup: "./tests/e2e/global-setup.js",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
