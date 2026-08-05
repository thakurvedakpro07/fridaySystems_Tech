import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// /operations/staff-invitations is gated by SuperAdminOpsRoute on the
// frontend (matching /operations/roles, /operations/audit-log,
// /operations/settings) — Super Admin only, matching the backend's
// IsSuperAdmin permission (only a Super Admin may grant Engineer/Admin
// roles by invite). See App.jsx and Sidebar.jsx.
const STAFF_INVITATIONS_PATH = "/operations/staff-invitations";
const ALLOWED_ROLE_KEYS = ["admin"];
const DENIED_ROLE_KEYS = ["ops", "finance", "support", "engineer", "customer"];

for (const roleKey of ALLOWED_ROLE_KEYS) {
  test.describe(`${roleKey} — staff invitations`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("renders the Staff Invitations page without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(STAFF_INVITATIONS_PATH);
      await expect(page).toHaveURL(new RegExp(STAFF_INVITATIONS_PATH));
      await expect(page.getByRole("heading", { name: "Staff Invitations" })).toBeVisible();
      expect(consoleErrors, `console errors on ${STAFF_INVITATIONS_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("sidebar shows a Staff Invitations link", async ({ page }) => {
      await page.goto("/operations");
      await expect(page.getByRole("link", { name: "Staff Invitations" })).toBeVisible();
    });

    test("send, resend, and revoke a staff invitation round trip", async ({ page }) => {
      const uniqueEmail = `e2e-staff-invite-${Date.now()}@example.com`;

      await page.goto(STAFF_INVITATIONS_PATH);
      await page.getByRole("button", { name: "Send Invitation" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Send Staff Invitation" })).toBeVisible();
      await dialog.getByLabel("Email").fill(uniqueEmail);
      await dialog.getByLabel("Role").selectOption("freelancer");
      await dialog.getByRole("button", { name: "Send Invitation" }).click();

      await expect(page.getByText(`Invitation sent to ${uniqueEmail}`)).toBeVisible();
      const invitationRow = page.locator("div.grid", { hasText: uniqueEmail });
      await expect(invitationRow).toBeVisible();
      await expect(invitationRow.getByText("Engineer")).toBeVisible();
      await expect(invitationRow.getByText("Pending")).toBeVisible();

      // Resend keeps the row (still pending), just regenerates the token.
      await invitationRow.getByRole("button", { name: "Resend" }).click();
      await expect(page.getByText(`Invitation resent to ${uniqueEmail}`)).toBeVisible();
      await expect(invitationRow).toBeVisible();

      // Revoke removes it from the pending view (status flips to revoked).
      await invitationRow.getByRole("button", { name: "Revoke" }).click();
      await dialog.getByRole("button", { name: "Revoke", exact: true }).click();
      await expect(page.getByText("Invitation revoked")).toBeVisible();

      // Filter to Revoked to confirm it's still listed with the right status,
      // rather than disappearing entirely.
      await page.getByRole("combobox", { name: "Status" }).selectOption("revoked");
      await expect(invitationRow).toBeVisible();
      await expect(invitationRow.getByText("Revoked")).toBeVisible();
    });

    test("cannot send a duplicate pending invitation to the same email", async ({ page, request }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      const authHeaders = { Authorization: `Bearer ${accessToken}` };
      const uniqueEmail = `e2e-dup-invite-${Date.now()}@example.com`;

      const firstRes = await request.post("/api/ops/staff-invitations/", {
        headers: authHeaders, data: { email: uniqueEmail, role: "admin" },
      });
      expect(firstRes.ok()).toBeTruthy();

      try {
        await page.goto(STAFF_INVITATIONS_PATH);
        await page.getByRole("button", { name: "Send Invitation" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Email").fill(uniqueEmail);
        await dialog.getByRole("button", { name: "Send Invitation" }).click();
        await expect(dialog.getByText(/already a pending staff invitation/i)).toBeVisible();
      } finally {
        const invitation = (await firstRes.json());
        await request.post(`/api/ops/staff-invitations/${invitation.id}/revoke/`, { headers: authHeaders });
      }
    });
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — staff invitations denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("cannot reach Staff Invitations", async ({ page }) => {
      await page.goto(STAFF_INVITATIONS_PATH);
      await expect(page).not.toHaveURL(new RegExp(STAFF_INVITATIONS_PATH));
    });
  });
}

test.describe("Staff invitation accept page", () => {
  test("shows an error state for an invalid/unknown token", async ({ page }) => {
    await page.goto("/staff-invitations/not-a-real-token");
    await expect(page.getByRole("heading", { name: "Invalid invitation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to sign in →" })).toBeVisible();
  });
});
