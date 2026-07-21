import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// First freelancer-specific e2e spec in this suite — the seeded `engineer`
// role session (fixtures/auth.js) existed before this but was unused by any
// spec until now.
const PAYOUTS_PATH = "/freelancer/payouts";
const ALLOWED_ROLE_KEYS = ["engineer"];
const DENIED_ROLE_KEYS = ["admin", "ops", "finance", "support", "customer"];

function loadSession(roleKey) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
  );
}

for (const roleKey of ALLOWED_ROLE_KEYS) {
  test.describe(`${roleKey} — freelancer payouts`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = loadSession(roleKey);
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("renders the Payouts page without console errors", async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(PAYOUTS_PATH);
      await expect(page).toHaveURL(new RegExp(PAYOUTS_PATH));
      await expect(page.getByRole("heading", { name: "Payouts" })).toBeVisible();
      await expect(page.getByText("Payout history")).toBeVisible();
      expect(consoleErrors, `console errors on ${PAYOUTS_PATH}: ${consoleErrors.join("; ")}`).toEqual([]);
    });

    test("sidebar shows a Payouts link", async ({ page }) => {
      await page.goto("/freelancer");
      await expect(page.getByRole("link", { name: "Payouts" })).toBeVisible();
    });

    test("API response never leaks platform_share, payment, or freelancer fields", async ({ request }) => {
      const { accessToken } = loadSession(roleKey);
      const res = await request.get("/api/freelancer/payouts/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const results = body.results ?? body;
      for (const payout of results) {
        expect(payout).not.toHaveProperty("platform_share");
        expect(payout).not.toHaveProperty("payment");
        expect(payout).not.toHaveProperty("freelancer");
      }
    });
  });
}

for (const roleKey of DENIED_ROLE_KEYS) {
  test.describe(`${roleKey} — freelancer payouts denied`, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = loadSession(roleKey);
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test("cannot reach the freelancer Payouts page", async ({ page }) => {
      await page.goto(PAYOUTS_PATH);
      await expect(page).not.toHaveURL(new RegExp(PAYOUTS_PATH));
    });

    test("API denies freelancer payouts access", async ({ request }) => {
      const { accessToken } = loadSession(roleKey);
      const res = await request.get("/api/freelancer/payouts/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status()).toBe(403);
    });
  });
}
