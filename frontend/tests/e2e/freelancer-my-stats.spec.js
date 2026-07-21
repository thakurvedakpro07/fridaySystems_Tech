import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Regression trap for the CSAT bug fix in views.py::analytics_view
// (freelancers previously always saw csat_avg=None) — checks the new
// "My Stats" card on the Engineer Workspace renders cleanly and links
// through to the Phase A Payouts page.
test.describe("engineer — my stats card", () => {
  test.use({ storageState: path.join(__dirname, ".auth", "engineer.json") });

  test.beforeEach(async ({ page }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", "engineer-session.json"), "utf-8")
    );
    await page.addInitScript((token) => {
      sessionStorage.setItem("access_token", token);
    }, accessToken);
  });

  test("renders My Stats card with utilization, earnings, and a Payouts link", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/freelancer");
    await expect(page.getByText("My Stats")).toBeVisible();
    await expect(page.getByText("Utilization")).toBeVisible();
    await expect(page.getByText("Lifetime earned")).toBeVisible();

    const payoutsLink = page.getByRole("link", { name: /view all payouts/i });
    await expect(payoutsLink).toBeVisible();
    await payoutsLink.click();
    await expect(page).toHaveURL(/\/freelancer\/payouts/);

    expect(consoleErrors, `console errors: ${consoleErrors.join("; ")}`).toEqual([]);
  });

  test("API /api/freelancer/stats/ returns a well-formed payload", async ({ request }) => {
    const { accessToken } = JSON.parse(
      fs.readFileSync(path.join(__dirname, ".auth", "engineer-session.json"), "utf-8")
    );
    const res = await request.get("/api/freelancer/stats/", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    for (const key of [
      "active_ticket_count", "resolved_count", "avg_resolution_hours",
      "utilization_pct", "csat_avg", "csat_count",
      "earnings_processed", "earnings_pending",
    ]) {
      expect(body).toHaveProperty(key);
    }
  });
});
