import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Covers the Phase 3 Dashboard improvements: hand-rolled search/status
// inputs replaced by the shared FilterBar (+ a Sort dropdown via
// extraFilters), and new user-defined saved filters (QuickViews +
// hooks/useSavedFilters, localStorage-backed).
test.describe("Dashboard filtering, sorting, saved filters", () => {
  useRoleSession("customer");

  test("FilterBar renders with search, status, and sort controls", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByPlaceholder("Search tickets…")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort tickets" })).toBeVisible();
  });

  test("saving and removing a filter round-trips through the saved-views pill", async ({ page }) => {
    await page.goto("/dashboard");

    // Apply a status filter so there's something meaningful to save.
    await page.locator("select").first().selectOption("resolved");
    await expect(page.getByRole("button", { name: "+ Save this filter" })).toBeVisible();

    await page.getByRole("button", { name: "+ Save this filter" }).click();
    const filterName = `E2E saved filter ${Date.now()}`;
    await page.getByLabel("Name").fill(filterName);
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const selectPill = page.getByRole("button", { name: filterName, exact: true });
    const removePill = page.getByRole("button", { name: `Remove ${filterName}` });
    await expect(selectPill).toBeVisible();

    // Clear filters, then re-apply via the saved pill and confirm status
    // reverts to the saved value.
    await page.getByRole("button", { name: /Clear/ }).click();
    await expect(page.locator("select").first()).toHaveValue("");
    await selectPill.click();
    await expect(page.locator("select").first()).toHaveValue("resolved");

    // Clean up — remove the saved filter this test created.
    await removePill.click();
    await expect(selectPill).not.toBeVisible();
  });
});
