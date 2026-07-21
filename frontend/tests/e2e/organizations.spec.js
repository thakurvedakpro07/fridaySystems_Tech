import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The seeded customer@resolvehq.dev was backfilled by migration
// 0029_organizations_multi_tenant.py as the sole org_admin of an
// auto-created organization (named after their `company` field, "Demo
// Company Pvt Ltd" per seed_demo_users.py) — see organization_service.py's
// create_organization_for_customer() for the same logic new registrations use.
function useCustomerSession() {
  test.use({ storageState: path.join(__dirname, ".auth", "customer.json") });
  test.beforeEach(async ({ page }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", "customer-session.json"), "utf-8")
    );
    await page.addInitScript((token) => {
      sessionStorage.setItem("access_token", token);
    }, accessToken);
  });
}

test.describe("Organization page — customer (org_admin)", () => {
  useCustomerSession();

  test("sidebar shows an Organization link", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Organization" })).toBeVisible();
  });

  test("renders Profile/Members/Audit Log tabs without console errors", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Members" })).toBeVisible();
    // Only org_admin sees the Audit Log tab — the seeded customer is org_admin.
    await expect(page.getByRole("button", { name: "Audit Log" })).toBeVisible();

    expect(consoleErrors, `console errors on /organization: ${consoleErrors.join("; ")}`).toEqual([]);
  });

  test("Members tab shows self as Admin without a Remove button", async ({ page }) => {
    await page.goto("/organization");
    await page.getByRole("button", { name: "Members" }).click();
    const selfRow = page.locator("div.grid", { hasText: "(you)" });
    await expect(selfRow.getByText("Admin", { exact: true })).toBeVisible();
    await expect(selfRow.getByRole("button", { name: "Remove" })).toHaveCount(0);
  });

  test("org_admin can edit the organization name and it persists", async ({ page }) => {
    // Restores to this fixed, known-seeded value (see seed_demo_users.py's
    // Customer.company default) rather than round-tripping through whatever
    // name happens to be on screen — a prior failed run leaving the name
    // mutated would otherwise "successfully" restore to corrupted state
    // forever instead of ever healing back to the real baseline.
    const CANONICAL_NAME = "Demo Company Pvt Ltd";
    const updated = `${CANONICAL_NAME} (E2E)`;

    await page.goto("/organization");
    const nameInput = page.getByLabel("Organization name");

    await nameInput.fill(updated);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Organization updated successfully")).toBeVisible();
    await expect(page.getByRole("heading", { name: updated })).toBeVisible();

    await nameInput.fill(CANONICAL_NAME);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("heading", { name: CANONICAL_NAME, exact: true })).toBeVisible();
  });

  test("org_admin can invite a member, see it pending, then revoke it", async ({ page }) => {
    const uniqueEmail = `e2e-invite-${Date.now()}@example.com`;

    await page.goto("/organization");
    await page.getByRole("button", { name: "Members" }).click();
    await page.getByRole("button", { name: "Invite Member" }).click();

    await page.getByLabel("Email address").fill(uniqueEmail);
    await page.getByRole("button", { name: "Send Invitation" }).click();

    await expect(page.getByText(`Invitation sent to ${uniqueEmail}`)).toBeVisible();
    const invitationRow = page.locator("div.grid", { hasText: uniqueEmail });
    await expect(invitationRow).toBeVisible();

    await invitationRow.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText(`Invitation to ${uniqueEmail} revoked`)).toBeVisible();
    await expect(invitationRow).toHaveCount(0);
  });

  test("the invite + revoke actions above appear in the Audit Log", async ({ page }) => {
    await page.goto("/organization");
    await page.getByRole("button", { name: "Audit Log" }).click();
    await expect(page.getByText("Member Invited").first()).toBeVisible();
    await expect(page.getByText("Invitation Revoked").first()).toBeVisible();
  });
});

test.describe("Invitation accept page", () => {
  test("shows an error state for an invalid/unknown token", async ({ page }) => {
    await page.goto("/invitations/not-a-real-token");
    await expect(page.getByRole("heading", { name: "Invalid invitation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to sign in →" })).toBeVisible();
  });
});
