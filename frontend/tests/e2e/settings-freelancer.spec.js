import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// First e2e coverage of /settings for any role. Verifies the freelancer
// "Engineer Profile" section (skills/availability edit + read-only
// rating/onboarding_status) round-trips against the real backend.
test.describe("engineer — settings profile", () => {
  test.use({ storageState: path.join(__dirname, ".auth", "engineer.json") });

  test.beforeEach(async ({ page }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", "engineer-session.json"), "utf-8")
    );
    await page.addInitScript((token) => {
      sessionStorage.setItem("access_token", token);
    }, accessToken);
  });

  test("shows Engineer Profile section with approval status and skills round-trip", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Engineer Profile")).toBeVisible();
    await expect(page.getByText("Approval status")).toBeVisible();
    await expect(page.getByText("Rating", { exact: true })).toBeVisible();

    const skillsInput = page.locator('input[placeholder="aws, azure, kubernetes, server_admin"]');
    await expect(skillsInput).toBeVisible();

    const uniqueSkill = `e2e-skill-${Date.now()}`;
    await skillsInput.fill(uniqueSkill);
    await page.getByRole("button", { name: /save/i }).first().click();
    await expect(page.getByText(/profile updated/i)).toBeVisible();

    await page.reload();
    await expect(page.locator('input[placeholder="aws, azure, kubernetes, server_admin"]')).toHaveValue(uniqueSkill);
  });
});
