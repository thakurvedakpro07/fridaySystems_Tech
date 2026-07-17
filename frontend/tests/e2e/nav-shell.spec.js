import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuses the sessions saved by global-setup.js — see roles.spec.js /
// design-system.spec.js for why both storageState AND a separately
// re-injected access_token are needed here.
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

// Covers the navigation-shell unification: every authenticated page now
// renders via AppShell (persistent sidebar), replacing the old per-page mix
// of AppShell (Dashboard only) vs MainLayout (everywhere else, which pulled
// in the public marketing Header/Footer). Sidebar.jsx's nav-section
// visibility is role-based, not path-based (see showOpsNav fix) — these
// tests target exactly the bug class that fix addresses: a staff user
// landing on a shared page (Analytics/Notifications/Settings) via a route
// that doesn't start with /operations/ must still see their Operations nav,
// not an empty sidebar.
const SHARED_PAGES = [
  { path: "/admin/analytics", heading: "Analytics Overview" },
  { path: "/notifications",   heading: "Notifications" },
  { path: "/settings",        heading: null }, // heading is the user's name, not fixed text
];

test.describe("Shared pages — staff sidebar off /operations/*", () => {
  useRoleSession("admin");

  for (const { path: pagePath, heading } of SHARED_PAGES) {
    test(`admin visiting ${pagePath} sees Operations sidebar nav, no console errors`, async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(pagePath);
      await expect(page).toHaveURL(new RegExp(pagePath.replace(/\//g, "\\/")));

      // The specific regression this guards: Sidebar.jsx used to gate its
      // Operations NavSection on `pathname.startsWith("/operations")`, so a
      // staff user here would see zero nav links (just brand + sign-out).
      await expect(page.getByRole("link", { name: "Ticket Queue" })).toBeVisible();

      if (heading) {
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      }

      // No marketing chrome bleeding into the authenticated app shell.
      await expect(page.getByText("Beta")).not.toBeVisible();
      await expect(page.getByText("Enterprise IT Support Marketplace")).toHaveCount(0);

      expect(consoleErrors, `console errors on ${pagePath}: ${consoleErrors.join("; ")}`).toEqual([]);
    });
  }
});

test.describe("Customer navigation — Knowledge Base / Help Center reachable everywhere", () => {
  useRoleSession("customer");

  test("Knowledge Base and Help Center links are reachable from a non-Dashboard page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: "Knowledge Base" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Help Center" })).toBeVisible();
  });

  test("no marketing Beta badge/footer on customer authenticated pages", async ({ page }) => {
    await page.goto("/billing");
    await expect(page.getByText("Beta")).not.toBeVisible();
  });
});
