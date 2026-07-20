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

// Covers the Phase 3 Create Ticket redesign: TicketForm's single-page form
// was replaced by TicketWizard's 5-step flow (Service → Priority →
// Description → Attachments → Review). Exercises step gating, Back
// navigation preserving state, and the full create flow end to end.
test.describe("Create Ticket wizard", () => {
  useRoleSession("customer");

  test("walks through all 5 steps and creates a ticket", async ({ page }) => {
    await page.goto("/tickets/new");
    await expect(page.getByRole("heading", { name: "Open a Support Ticket" })).toBeVisible();
    await expect(page.getByText("Step 1 of 5")).toBeVisible();

    // ── Step 1: Service — Continue disabled until a service is chosen ──
    const continueBtn = page.getByRole("button", { name: "Continue →" });
    await expect(continueBtn).toBeDisabled();
    await page.getByRole("button", { name: /Server Admin|AWS|Laptop/ }).first().click();
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // ── Step 2: Priority — has a default, so Continue is already enabled ──
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await expect(continueBtn).toBeEnabled();
    await page.getByRole("button", { name: /Critical/ }).click();
    await continueBtn.click();

    // ── Step 3: Description — Continue disabled until both fields filled ──
    await expect(page.getByText("Step 3 of 5")).toBeVisible();
    await expect(continueBtn).toBeDisabled();
    const ticketTitle = `E2E wizard test ${Date.now()}`;
    await page.locator("#wizard-title").fill(ticketTitle);
    await page.locator("#wizard-description").fill("Created by the ticket-wizard Playwright spec.");
    await expect(continueBtn).toBeEnabled();

    // Back should preserve step 1/2 selections
    await page.getByRole("button", { name: "← Back" }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await continueBtn.click();
    await expect(page.locator("#wizard-title")).toHaveValue(ticketTitle);
    await continueBtn.click();

    // ── Step 4: Attachments — optional, Continue enabled with none added ──
    await expect(page.getByText("Step 4 of 5")).toBeVisible();
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // ── Step 5: Review — shows entered data + fee breakdown, then submit ──
    await expect(page.getByText("Step 5 of 5")).toBeVisible();
    await expect(page.getByText(ticketTitle)).toBeVisible();
    await expect(page.getByText("Fee Breakdown")).toBeVisible();

    await page.getByRole("button", { name: "Create Ticket →" }).click();
    await page.waitForURL(/\/tickets\/[a-f0-9-]+$/, { timeout: 15_000 });
    // Scoped to the hero header specifically — a freshly-created ticket is
    // "pending_payment", so PaymentGateway's own ticket-context display also
    // renders the same title on this page (correct, expected UI), which
    // would make an unscoped text match ambiguous.
    await expect(page.getByRole("heading", { name: ticketTitle })).toBeVisible();
  });
});
