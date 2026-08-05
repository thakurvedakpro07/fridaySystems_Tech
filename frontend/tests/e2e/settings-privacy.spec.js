import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROLES } from "./fixtures/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DPDP Act 2023 self-service compliance — Settings → Privacy & Data tab.
// Covers data export (download triggers) and the full deletion
// request → wrong-password rejection → correct-password confirm →
// pending banner → cancel round trip, against the real backend
// (same storageState + access-token-injection pattern as settings-freelancer.spec.js).
test.describe("customer — settings privacy & data", () => {
  test.use({ storageState: path.join(__dirname, ".auth", "customer.json") });

  test.beforeEach(async ({ page }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", "customer-session.json"), "utf-8")
    );
    await page.addInitScript((token) => {
      sessionStorage.setItem("access_token", token);
    }, accessToken);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Privacy & Data" }).click();
  });

  test("downloads a personal-data export", async ({ page }) => {
    await expect(page.getByText("Your Data")).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download my data" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^resolvehq-data-export-.*\.json$/);
  });

  test("account deletion request round trip: wrong password, confirm, then cancel", async ({ page }) => {
    await expect(page.getByText("Delete Account")).toBeVisible();
    await page.getByRole("button", { name: "Delete my account" }).click();

    // Wrong password is rejected, no state change.
    await page.getByPlaceholder("Current password").fill("WrongPassword123!");
    await page.getByRole("button", { name: "Confirm deletion request" }).click();
    await expect(page.getByText(/incorrect/i)).toBeVisible();

    // Correct password confirms the request and shows the pending banner.
    await page.getByPlaceholder("Current password").fill(ROLES.customer.password);
    await page.getByRole("button", { name: "Confirm deletion request" }).click();
    await expect(page.getByText(/scheduled for deletion on/i)).toBeVisible();

    // A reload must still show the pending state (server-persisted, not local-only).
    await page.reload();
    await page.getByRole("button", { name: "Privacy & Data" }).click();
    await expect(page.getByText(/scheduled for deletion on/i)).toBeVisible();

    // Self-service cancel restores the normal "Delete my account" state.
    await page.getByRole("button", { name: "Cancel deletion request" }).click();
    await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();
  });
});
