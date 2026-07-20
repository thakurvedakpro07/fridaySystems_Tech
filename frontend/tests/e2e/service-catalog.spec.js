import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Phase 3 of the Admin Portal audit: full Service Catalog Management.
// /operations/services is gated by OpsManagerRoute (Ops Manager + Super
// Admin only) — unchanged from earlier phases. What's new here: full CRUD
// including Delete/Archive/Mark Unavailable/Reactivate, and the
// customer-facing ticket wizard automatically respecting availability
// with zero further frontend changes needed per admin action.
const SERVICES_PATH = "/operations/services";
const NEW_TICKET_PATH = "/tickets/new";
const ALLOWED_ROLE_KEYS = ["admin", "ops"];
const DENIED_ROLE_KEYS = ["finance", "support", "engineer", "customer"];

function authedContext(page, roleKey) {
  const { accessToken } = JSON.parse(
    fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
  );
  return page.addInitScript((token) => {
    sessionStorage.setItem("access_token", token);
  }, accessToken);
}

for (const roleKey of ALLOWED_ROLE_KEYS) {
  test.describe(`${roleKey} — service catalog management`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });
    test.beforeEach(({ page }) => authedContext(page, roleKey));

    test("renders the Services page without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

      await page.goto(SERVICES_PATH);
      await expect(page).toHaveURL(new RegExp(SERVICES_PATH));
      await expect(page.getByRole("heading", { name: "Services", exact: true })).toBeVisible();
      expect(consoleErrors, `console errors: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("full lifecycle: create, edit, mark unavailable, reactivate, archive, delete", async ({ page }) => {
      const uniqueName = `E2E Catalog Service ${Date.now()}`;
      await page.goto(SERVICES_PATH);

      // Create
      await page.getByRole("button", { name: "Add Service" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByPlaceholder("e.g. Kubernetes Support").fill(uniqueName);
      await dialog.getByPlaceholder("e.g. Cloud, Infrastructure, Data…").fill("E2E Testing");
      // Resolution Fee input — first spinbutton in the dialog (Icon field is text, not number)
      await dialog.locator('input[type="number"]').first().fill("777");
      await dialog.getByRole("button", { name: "Create Service" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByText(uniqueName)).toBeVisible();

      // Scope to the card's own distinguishing class (not a generic <div>,
      // which also matches ancestor wrappers via Playwright's hasText) —
      // only one card carries this run's unique name, so no .last() needed.
      const card = page.locator(".rounded-2xl", { hasText: uniqueName });

      // Mark Unavailable
      await card.getByRole("button", { name: "Mark Unavailable" }).click();
      await expect(card.getByText("Unavailable")).toBeVisible();

      // Reactivate
      await card.getByRole("button", { name: "Reactivate" }).click();
      await expect(card.getByText("Active", { exact: true })).toBeVisible();

      // Archive
      await card.getByRole("button", { name: "Archive" }).click();
      await expect(card.getByText("Archived")).toBeVisible();

      // Delete (cleanup — never referenced by a ticket, so this must succeed)
      await card.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("heading", { name: "Delete Service" })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
      // Scoped to the card, not the whole page — this run's earlier
      // mark-unavailable/reactivate/archive toasts also contain uniqueName
      // and may still be fading out in the DOM.
      await expect(page.locator(".rounded-2xl", { hasText: uniqueName })).toHaveCount(0);
    });
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — service catalog denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });
    test.beforeEach(({ page }) => authedContext(page, roleKey));

    test("cannot reach Services management", async ({ page }) => {
      await page.goto(SERVICES_PATH);
      await expect(page).not.toHaveURL(new RegExp(SERVICES_PATH));
    });
  });
}

// ── Customer-facing: availability is automatically respected ────────
test.describe("customer — service availability in the ticket wizard", () => {
  test.use({ storageState: path.join(__dirname, ".auth", "customer.json") });
  test.beforeEach(({ page }) => authedContext(page, "customer"));

  test("an unavailable service is greyed out, labeled, and cannot be selected; reactivating restores it; archiving removes it — with no frontend changes for any of these admin actions", async ({ page, request }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", "admin-session.json"), "utf-8")
    );
    const adminHeaders = { Authorization: `Bearer ${accessToken}` };
    const uniqueName = `E2E Availability Service ${Date.now()}`;

    const createRes = await request.post("/api/ops/services/", {
      headers: adminHeaders,
      data: { name: uniqueName, resolution_fee: 555 },
    });
    expect(createRes.ok()).toBeTruthy();
    const service = await createRes.json();

    try {
      // 1. Freshly created: active + available — selectable.
      await page.goto(NEW_TICKET_PATH);
      await expect(page.getByText(uniqueName)).toBeVisible();
      let card = page.getByRole("button", { name: new RegExp(uniqueName) });
      await expect(card).toBeEnabled();

      // 2. Admin marks it unavailable via the API (simulating the Ops action) —
      // reload the customer's page with ZERO frontend code changes and confirm
      // it's now greyed out, labeled, and blocked.
      await request.post(`/api/ops/services/${service.id}/mark-unavailable/`, { headers: adminHeaders });
      await page.goto(NEW_TICKET_PATH);
      await expect(page.getByText("Temporarily unavailable")).toBeVisible();
      card = page.getByRole("button", { name: new RegExp(uniqueName) });
      await expect(card).toBeDisabled();

      // Confirm the backend also blocks ticket creation directly (defense in depth).
      const blockedRes = await request.post("/api/tickets/", {
        headers: { ...adminHeaders, Authorization: `Bearer ${JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "customer-session.json"), "utf-8")).accessToken}` },
        data: { title: "x", description: "y", service_type: service.key, severity: "low" },
      });
      expect(blockedRes.status()).toBe(400);

      // 3. Admin reactivates — selectable again, no frontend change needed.
      await request.post(`/api/ops/services/${service.id}/reactivate/`, { headers: adminHeaders });
      await page.goto(NEW_TICKET_PATH);
      await expect(page.getByText("Temporarily unavailable")).not.toBeVisible();
      card = page.getByRole("button", { name: new RegExp(uniqueName) });
      await expect(card).toBeEnabled();

      // 4. Admin archives — disappears from the customer catalog entirely.
      await request.post(`/api/ops/services/${service.id}/archive/`, { headers: adminHeaders });
      await page.goto(NEW_TICKET_PATH);
      await expect(page.getByText(uniqueName)).not.toBeVisible();
    } finally {
      await request.delete(`/api/ops/services/${service.id}/`, { headers: adminHeaders });
    }
  });
});
