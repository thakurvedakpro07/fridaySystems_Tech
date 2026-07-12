import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROLES } from "./fixtures/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Each role's session was authenticated once in global-setup.js (a real UI
// login) and saved — this suite reuses those sessions instead of
// resubmitting the login form, since the backend throttles
// /api/auth/login/ to 5 attempts/minute/IP. See global-setup.js's header
// comment for why both storageState AND a separately-saved access_token
// are needed (refresh tokens are single-use here; access tokens aren't).
for (const roleKey of Object.keys(ROLES)) {
  test.describe(roleKey, () => {
    test.use({ storageState: path.join(__dirname, ".auth", `${roleKey}.json`) });

    test.beforeEach(async ({ page }) => {
      const { accessToken } = JSON.parse(
        fs.readFileSync(path.join(__dirname, ".auth", `${roleKey}-session.json`), "utf-8")
      );
      await page.addInitScript((token) => {
        sessionStorage.setItem("access_token", token);
      }, accessToken);
    });

    test(`lands on ${ROLES[roleKey].landing} and renders without console errors`, async ({ page }) => {
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(ROLES[roleKey].landing);
      await expect(page).toHaveURL(new RegExp(ROLES[roleKey].landing));
      await expect(page.locator("body")).not.toContainText("Forbidden");
      expect(consoleErrors, `console errors on ${ROLES[roleKey].landing}: ${consoleErrors.join("; ")}`).toEqual([]);
    });
  });
}
