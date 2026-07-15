import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Operations Command Center rebuild (Phase F1): GET /api/ops/command-center/
// and /api/ops/command-center/live/ are gated to all 4 internal staff roles
// (IsAnyStaffRole on the backend, OpsRoute on the frontend) — same role set
// already used for /operations/tickets and /operations/freelancers, unlike
// Executive Analytics' narrower 3-role gate. Reuses the seeded sessions
// saved once in global-setup.js, same as executive-analytics.spec.js.
const OPS_PATH = "/operations";
const STAFF_ROLE_KEYS = ["admin", "ops", "finance", "support"];
const DENIED_ROLE_KEYS = ["engineer", "customer"];

for (const roleKey of STAFF_ROLE_KEYS) {
  test.describe(`${roleKey} — operations command center`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("renders all 10 Command Center widgets without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(OPS_PATH);
      await expect(page).toHaveURL(new RegExp(`${OPS_PATH}$`));
      await expect(page.getByRole("heading", { name: "Operations Command Center" })).toBeVisible();

      // Operations Health Banner (no DashboardSection title — asserted by its
      // own status copy instead) + AI Operations Summary (DAILY BRIEF card).
      await expect(page.getByText(/All systems nominal|Attention needed|Critical — immediate action needed/)).toBeVisible();
      await expect(page.getByText("DAILY BRIEF")).toBeVisible();

      // The 8 remaining DashboardSection-titled widgets.
      await expect(page.getByText("Live Incident Queue")).toBeVisible();
      await expect(page.getByText("SLA Risk Board")).toBeVisible();
      await expect(page.getByText("Escalation Queue")).toBeVisible();
      await expect(page.getByText("Engineer Capacity")).toBeVisible();
      await expect(page.getByText("Service Health")).toBeVisible();
      await expect(page.getByText("Ticket Flow")).toBeVisible();
      await expect(page.getByText("Critical Customers")).toBeVisible();
      await expect(page.getByText("Activity Timeline")).toBeVisible();

      // Wait for both the core and live payloads to finish loading (shimmer
      // placeholders gone) before asserting on network/console cleanliness.
      await page.waitForLoadState("networkidle");

      expect(consoleErrors, `console errors on ${OPS_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("removed widgets from the old dashboard are gone", async ({ page }) => {
      await page.goto(OPS_PATH);
      await expect(page.getByText("Business Overview")).toHaveCount(0);
      await expect(page.getByText("Revenue Trend")).toHaveCount(0);
      await expect(page.getByText("Payment Type Split")).toHaveCount(0);
      await expect(page.getByText("Quick Actions")).toHaveCount(0);
    });

    // Phase F2: the `live` payload (Live Incident Queue / SLA Risk Board /
    // Activity Timeline) polls every 45s; `core` loads once. Role-agnostic
    // behavior — only tested once here (admin) rather than duplicated
    // across all 4 staff describe blocks. Uses Playwright's fake clock so
    // this doesn't require actually waiting 90+ real seconds.
    if (roleKey === "admin") {
      test("live endpoint polls every 45s while core loads only once", async ({ page }) => {
        let liveCallCount = 0;
        let coreCallCount = 0;
        await page.route("**/api/ops/command-center/**", (route) => {
          const url = route.request().url();
          if (url.includes("/command-center/live/")) liveCallCount++;
          else coreCallCount++;
          route.continue();
        });

        await page.clock.install();
        await page.goto(OPS_PATH);
        await expect(page.getByRole("heading", { name: "Operations Command Center" })).toBeVisible();

        // React 18 StrictMode double-invokes effects in dev (mount → cleanup
        // → remount), so the settled initial call count here may be 1 or 2
        // depending on environment — that's a dev-only framework quirk, not
        // this code's behavior (the `cancelled` guard in OpsDashboard.jsx
        // exists precisely to make the cleaned-up first mount's response a
        // no-op). What actually matters, and is asserted below: `live`
        // increments by exactly 1 per 45s tick and `core` never polls again.
        await expect.poll(() => liveCallCount).toBeGreaterThanOrEqual(1);
        // Real-time (not fake-clock) settle window so StrictMode's second
        // dispatch, if any, lands before the baseline is captured below.
        await page.waitForTimeout(300);
        const initialLiveCount = liveCallCount;
        const settledCoreCount = coreCallCount;
        expect(settledCoreCount).toBeGreaterThanOrEqual(1);

        await page.clock.fastForward(45_000);
        await expect.poll(() => liveCallCount).toBe(initialLiveCount + 1);

        await page.clock.fastForward(45_000);
        await expect.poll(() => liveCallCount).toBe(initialLiveCount + 2);

        // `core` never polls, regardless of how many times `live` has.
        expect(coreCallCount).toBe(settledCoreCount);
      });
    }
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — operations command center denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("cannot reach the Operations Command Center", async ({ page }) => {
      await page.goto(OPS_PATH);
      await expect(page).not.toHaveURL(new RegExp(`${OPS_PATH}$`));
    });
  });
}
