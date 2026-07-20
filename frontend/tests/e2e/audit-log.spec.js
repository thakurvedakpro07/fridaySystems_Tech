import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// /operations/audit-log is gated by SuperAdminOpsRoute on the frontend
// (matching the existing /operations/roles and /operations/settings
// precedent) — Super Admin only, even though the backend permission
// (IsOpsManagerOrSuperAdmin) is broader. See App.jsx and Sidebar.jsx.
const AUDIT_LOG_PATH = "/operations/audit-log";
const ALLOWED_ROLE_KEYS = ["admin"];
const DENIED_ROLE_KEYS = ["ops", "finance", "support", "engineer", "customer"];

for (const roleKey of ALLOWED_ROLE_KEYS) {
  test.describe(`${roleKey} — audit log`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("renders the Audit Log page without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(AUDIT_LOG_PATH);
      await expect(page).toHaveURL(new RegExp(AUDIT_LOG_PATH));
      await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
      expect(consoleErrors, `console errors on ${AUDIT_LOG_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("recording a real admin action makes it appear in the Audit Log", async ({ page, request }) => {
      // Create + mark-unavailable a service via the API using the same
      // session (a real audited action, self-contained — doesn't depend on
      // pre-seeded data), then confirm the new page surfaces it after a
      // refresh. Deletes the service afterward (Phase 3 added a real DELETE
      // endpoint) so this doesn't leave an orphan row that becomes some
      // other test's default "first service" — see Service Catalog
      // Management's Playwright specs for why that matters.
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      const authHeaders = { Authorization: `Bearer ${accessToken}` };
      const uniqueName = `E2E Audit Test Service ${Date.now()}`;

      const createRes = await request.post("/api/ops/services/", {
        headers: authHeaders,
        data: { name: uniqueName, description: "Created by audit-log.spec.js" },
      });
      expect(createRes.ok()).toBeTruthy();
      const service = await createRes.json();

      try {
        const unavailableRes = await request.post(`/api/ops/services/${service.id}/mark-unavailable/`, { headers: authHeaders });
        expect(unavailableRes.ok()).toBeTruthy();

        // Default sort is -created_at, so both new rows (service_created,
        // service_marked_unavailable) land on page 1. The "Details" column
        // renders the service name for service_* actions (see
        // formatDetails() in OpsAuditLog.jsx).
        await page.goto(AUDIT_LOG_PATH);
        await expect(page.getByText(uniqueName).first()).toBeVisible();
      } finally {
        await request.delete(`/api/ops/services/${service.id}/`, { headers: authHeaders });
      }
    });

    test("sidebar shows an Audit Log link", async ({ page }) => {
      await page.goto("/operations");
      await expect(page.getByRole("link", { name: "Audit Log" })).toBeVisible();
    });
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — audit log denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("cannot reach the Audit Log", async ({ page }) => {
      await page.goto(AUDIT_LOG_PATH);
      await expect(page).not.toHaveURL(new RegExp(AUDIT_LOG_PATH));
    });
  });
}
