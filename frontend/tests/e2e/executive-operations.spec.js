import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Executive Operations Dashboard: a new consolidated page built on top of
// the existing GET /api/ops/executive-analytics/ and
// GET /api/ops/command-center/live/ endpoints — no new backend surface, so
// role-gating matches Executive Analytics exactly (IsExecutiveAnalytics /
// PaymentRoute: Super Admin + Operations Manager + Finance Manager).
const EXEC_OPS_PATH = "/operations/executive-overview";
const ALLOWED_ROLE_KEYS = ["admin", "ops", "finance"];
const DENIED_ROLE_KEYS = ["support", "engineer", "customer"];

for (const roleKey of ALLOWED_ROLE_KEYS) {
  test.describe(`${roleKey} — executive operations`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("renders Platform Statistics, SLA Health, and Revenue Overview without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(EXEC_OPS_PATH);
      await expect(page).toHaveURL(new RegExp(EXEC_OPS_PATH));
      await expect(page.getByRole("heading", { name: "Executive Operations Dashboard" })).toBeVisible();
      await expect(page.getByText("Platform Statistics")).toBeVisible();
      await expect(page.getByText("Active Freelancers")).toBeVisible();
      await expect(page.getByText("SLA Health")).toBeVisible();
      await expect(page.getByText("Revenue Overview")).toBeVisible();
      expect(consoleErrors, `console errors on ${EXEC_OPS_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("renders ticket charts, resolution performance, and CSAT summary", async ({ page }) => {
      await page.goto(EXEC_OPS_PATH);
      await expect(page.getByText("Ticket Status")).toBeVisible();
      await expect(page.getByText("Priority Distribution")).toBeVisible();
      await expect(page.getByText("Resolution Performance")).toBeVisible();
      await expect(page.getByText("Customer Satisfaction")).toBeVisible();
      // exact: true — "CSAT Average" (the KPI label) would otherwise
      // case-insensitively substring-match the section's own description,
      // "CSAT average and trend for the selected period".
      await expect(page.getByText("CSAT Average", { exact: true })).toBeVisible();
    });

    test("renders Top Customers, Recently Breached Tickets, and Recent Platform Activity", async ({ page }) => {
      await page.goto(EXEC_OPS_PATH);
      await expect(page.getByRole("heading", { name: "Top Customers" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recently Breached Tickets" })).toBeVisible();
      await expect(page.getByText("Recent Platform Activity")).toBeVisible();
    });

    test("period filter reloads data with a different query param", async ({ page }) => {
      let lastPeriodParam = null;
      await page.route("**/ops/executive-analytics/**", (route) => {
        const url = new URL(route.request().url());
        lastPeriodParam = url.searchParams.get("period");
        route.continue();
      });

      await page.goto(EXEC_OPS_PATH);
      await expect(page.getByText("Platform Statistics")).toBeVisible();
      expect(lastPeriodParam).toBe("30d");

      // FilterBar's period select is the only <select> on this page (no
      // extraFilters are used here, unlike OpsTicketQueue.jsx).
      await page.locator("select").first().selectOption("7d");
      await expect.poll(() => lastPeriodParam).toBe("7d");
    });

    test("search box filters the Top Customers table client-side", async ({ page }) => {
      await page.goto(EXEC_OPS_PATH);
      await expect(page.getByRole("heading", { name: "Top Customers" })).toBeVisible();

      const searchBox = page.getByPlaceholder("Search customers, tickets, activity…");
      await searchBox.fill("zzz-no-such-customer-zzz");
      await expect(page.getByText("No matching customers")).toBeVisible();

      await searchBox.fill("");
      await expect(page.getByText("No matching customers")).not.toBeVisible();
    });

    test("Export Summary CSV button triggers a file download", async ({ page }) => {
      await page.goto(EXEC_OPS_PATH);
      await expect(page.getByText("Platform Statistics")).toBeVisible();

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Export Summary CSV" }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^executive-operations-summary-.*\.csv$/);
    });
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — executive operations denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("cannot reach Executive Operations Dashboard", async ({ page }) => {
      await page.goto(EXEC_OPS_PATH);
      await expect(page).not.toHaveURL(new RegExp(EXEC_OPS_PATH));
    });
  });
}
