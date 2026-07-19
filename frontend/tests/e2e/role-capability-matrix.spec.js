import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Phase 2 of the Admin Portal audit: /operations/roles previously only
// showed the Role Change Audit log despite being labeled "Roles" in the
// sidebar. This spec covers the new read-only Role Capability Matrix
// section added above that (unchanged) audit log content.
const ROLES_PATH = "/operations/roles";

test.describe("admin — role capability matrix", () => {
  test.use({ storageState: path.join(__dirname, ".auth", "admin.json") });

  test.beforeEach(async ({ page }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", "admin-session.json"), "utf-8")
    );
    await page.addInitScript((token) => {
      sessionStorage.setItem("access_token", token);
    }, accessToken);
  });

  test("renders both the capability matrix and the existing audit log without console errors", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(ROLES_PATH);
    await expect(page).toHaveURL(new RegExp(ROLES_PATH));
    await expect(page.getByRole("heading", { name: "Roles", exact: true })).toBeVisible();

    // New section
    await expect(page.getByRole("heading", { name: "What Each Role Can Do" })).toBeVisible();
    await expect(page.getByText("Confirm and refund payments")).toBeVisible();
    await expect(page.getByText("Manage Engineers, Services, and SLA Policies")).toBeVisible();

    // Existing section (must still work — "do not redesign completed features")
    await expect(page.getByRole("heading", { name: "Role Change Audit" })).toBeVisible();
    await expect(page.getByPlaceholder("Search by user email…")).toBeVisible();

    expect(consoleErrors, `console errors on ${ROLES_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
  });

  test("shows all six role cards", async ({ page }) => {
    await page.goto(ROLES_PATH);
    for (const label of ["Customer", "Engineer", "Support Agent", "Finance Manager", "Operations Manager", "Super Admin"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });
});
