import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Phase 2 of the Executive Analytics Dashboard: GET /api/ops/executive-analytics/
// is gated to Super Admin + Operations Manager + Finance Manager (IsExecutiveAnalytics
// on the backend, PaymentRoute on the frontend) — same role set already used for
// /operations/payments and /operations/analytics. Reuses the seeded sessions saved
// once in global-setup.js, same as roles.spec.js.
const EXEC_ANALYTICS_PATH = "/operations/executive-analytics";
const ALLOWED_ROLE_KEYS = ["admin", "ops", "finance"];
const DENIED_ROLE_KEYS = ["support", "engineer", "customer"];

for (const roleKey of ALLOWED_ROLE_KEYS) {
  test.describe(`${roleKey} — executive analytics`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("renders Executive Summary and Operational Health KPI rows without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(EXEC_ANALYTICS_PATH);
      await expect(page).toHaveURL(new RegExp(EXEC_ANALYTICS_PATH));
      await expect(page.getByRole("heading", { name: "Executive Analytics" })).toBeVisible();
      await expect(page.getByText("Executive Summary")).toBeVisible();
      await expect(page.getByText("Operational Health")).toBeVisible();
      await expect(page.getByText("Active Customers")).toBeVisible();
      await expect(page.getByText("Avg Resolution Time")).toBeVisible();
      expect(consoleErrors, `console errors on ${EXEC_ANALYTICS_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("renders Operational Health charts and Executive Insights without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(EXEC_ANALYTICS_PATH);
      await expect(page.getByText("Ticket Status Distribution")).toBeVisible();
      await expect(page.getByText("Priority Distribution")).toBeVisible();
      await expect(page.getByText("SLA Trend")).toBeVisible();
      await expect(page.getByText("Weekly Ticket Volume")).toBeVisible();
      await expect(page.getByText("Executive Insights")).toBeVisible();
      expect(consoleErrors, `console errors on ${EXEC_ANALYTICS_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — executive analytics denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("cannot reach Executive Analytics", async ({ page }) => {
      await page.goto(EXEC_ANALYTICS_PATH);
      await expect(page).not.toHaveURL(new RegExp(EXEC_ANALYTICS_PATH));
    });
  });
}
