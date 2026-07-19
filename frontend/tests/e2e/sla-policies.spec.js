import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// /operations/sla-policies is gated by OpsManagerRoute (Ops Manager + Super
// Admin only), matching /operations/services — see App.jsx.
const SLA_PATH = "/operations/sla-policies";
const ALLOWED_ROLE_KEYS = ["admin", "ops"];
const DENIED_ROLE_KEYS = ["finance", "support", "engineer", "customer"];

for (const roleKey of ALLOWED_ROLE_KEYS) {
  test.describe(`${roleKey} — SLA policies`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("renders the SLA Policies page with platform defaults, without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(SLA_PATH);
      await expect(page).toHaveURL(new RegExp(SLA_PATH));
      await expect(page.getByRole("heading", { name: "SLA Policies" })).toBeVisible();
      // Not just "Platform Defaults" — that substring (case-insensitively)
      // also matches the empty-state row's "...uses the platform defaults
      // shown above" copy when no override rows exist yet.
      await expect(page.getByText("apply when no override exists below")).toBeVisible();
      await expect(page.getByText("Critical", { exact: true }).first()).toBeVisible();
      expect(consoleErrors, `console errors on ${SLA_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("create, edit, and delete a policy round trip", async ({ page, request }) => {
      // Idempotent across retries/reruns: the dev DB isn't reset between
      // Playwright runs (unlike pytest's per-run test DB), so a prior
      // attempt's row for this exact combo could still exist and trip the
      // backend's unique_together validator on create. Clear it first.
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      const authHeaders = { Authorization: `Bearer ${accessToken}` };
      const existing = await request.get("/api/ops/sla-policies/", {
        headers: authHeaders, params: { service_type: "laptop_desktop", severity: "medium", plan: "default" },
      });
      const existingResults = (await existing.json()).results ?? [];
      for (const row of existingResults) {
        await request.delete(`/api/ops/sla-policies/${row.id}/`, { headers: authHeaders });
      }

      await page.goto(SLA_PATH);
      await page.getByRole("button", { name: "Add Policy" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "New SLA Policy" })).toBeVisible();
      // Service/severity/plan are left at their defaults (laptop_desktop/medium/default) —
      // scoping to the dialog avoids accidentally interacting with the page's own filter selects.
      await dialog.getByPlaceholder("e.g. 1").fill("2");
      await dialog.getByPlaceholder("e.g. 24").fill("48");
      await dialog.getByRole("button", { name: "Create Policy" }).click();

      await expect(dialog).not.toBeVisible();
      // exact: true — "2h"/"48h" would otherwise substring-match the
      // "Platform Defaults" reference panel's "2h response · 48h resolution" text too.
      await expect(page.getByText("2h", { exact: true })).toBeVisible();
      await expect(page.getByText("48h", { exact: true })).toBeVisible();

      // Edit
      await page.getByRole("button", { name: "Edit" }).first().click();
      await expect(dialog.getByRole("heading", { name: "Edit SLA Policy" })).toBeVisible();
      await dialog.getByRole("button", { name: "Save Changes" }).click();
      await expect(dialog).not.toBeVisible();

      // Delete (clean up so repeated runs don't accumulate rows)
      await page.getByRole("button", { name: "Delete" }).first().click();
      await expect(dialog.getByRole("heading", { name: "Delete SLA Policy" })).toBeVisible();
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(dialog).not.toBeVisible();
    });
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — SLA policies denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("cannot reach SLA Policies", async ({ page }) => {
      await page.goto(SLA_PATH);
      await expect(page).not.toHaveURL(new RegExp(SLA_PATH));
    });
  });
}
