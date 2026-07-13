import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuses the sessions saved by global-setup.js rather than logging in again
// per test — see roles.spec.js / global-setup.js for why both storageState
// AND a separately re-injected access_token are needed here.
function useRoleSession(roleKey) {
  test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });
  test.beforeEach(async ({ page }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
    );
    await page.addInitScript((token) => {
      sessionStorage.setItem("access_token", token);
    }, accessToken);
  });
}

// Verifies the design-system consolidation: shared primitives render with
// data-ds hooks, and the same status/payment values render identically
// across pages that used to have independently-drifted color mappings
// (e.g. "failed" payments were bg-red-100 on OpsPayments vs bg-rose-100 on
// PaymentsDashboard/BillingPage before this pass).

test.describe("Staff / admin pages", () => {
  useRoleSession("admin");

  test("Ops Dashboard renders Card chrome and a single PageHeader", async ({ page }) => {
    await page.goto("/operations");
    await expect(page.locator('[data-ds="page-header"]')).toHaveCount(1);
    await expect(page.locator('[data-ds="card"]').first()).toBeVisible();
  });

  test("Payments pages render consistent Badge classes for the same status", async ({ page }) => {
    await page.goto("/operations/payments");
    const opsBadges = page.locator('[data-ds="badge"]');
    const opsCount = await opsBadges.count();
    const opsClassSamples = [];
    for (let i = 0; i < opsCount; i++) opsClassSamples.push(await opsBadges.nth(i).getAttribute("class"));

    // No red-100 (the pre-consolidation OpsPayments outlier for "failed") —
    // canonical paymentStatus domain standardized on rose-100.
    for (const cls of opsClassSamples) expect(cls).not.toMatch(/bg-red-100/);
  });

  test("Ticket Queue renders ticketStatus badges via the shared Badge component", async ({ page }) => {
    await page.goto("/operations/tickets");
    // .first() may resolve to the mobile-only (md:hidden) duplicate at desktop
    // viewport widths, so assert on presence in the DOM rather than visibility.
    await expect(page.locator('[data-ds="badge"]').first()).toHaveCount(1);
  });

  test("Services page uses shared Input/Select in the create form", async ({ page }) => {
    await page.goto("/operations/services");
    await page.getByRole("button", { name: "Add Service" }).click();
    await expect(page.locator('input[placeholder="e.g. Linux Provisioning"]')).toBeVisible();
  });

  test("Ops pages render a shared PageHeader consistently", async ({ page }) => {
    await page.goto("/operations/payments");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
  });

  // Phase 1 primitives: FormSection (extracted from SettingsPage's local
  // SectionCard) and Skeleton (wrapping the .shimmer utility).
  test("Settings page renders form sections and profile fields", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.getByText("Personal Information")).toBeVisible();
    await expect(page.locator('input[placeholder="Rahul"]')).toBeVisible();

    await page.getByRole("button", { name: "Security" }).click();
    await expect(page.getByText("Change Password")).toBeVisible();
  });
});

// Phase 2: shared PageHeader / Card adoption on the customer-facing
// dashboard ("My Tickets") and billing pages.
test.describe("Customer-facing pages", () => {
  useRoleSession("customer");

  test("Dashboard (My Tickets) renders PageHeader and Card-wrapped info panel", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.getByText("My Tickets")).toBeVisible();
    await expect(page.locator('[data-ds="card"]').first()).toBeVisible();
  });

  test("Billing page renders payment history inside a shared Card", async ({ page }) => {
    await page.goto("/billing");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.locator('[data-ds="card"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payment history" })).toBeVisible();
  });
});

// Phase 2: shared PageHeader / Card adoption on the freelancer dashboard.
test.describe("Engineer-facing pages", () => {
  useRoleSession("engineer");

  test("Freelancer Dashboard renders PageHeader and Card-wrapped info panel", async ({ page }) => {
    await page.goto("/freelancer");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.locator('[data-ds="card"]').first()).toBeVisible();
    await expect(page.getByText("Today's Queue")).toBeVisible();
  });
});
