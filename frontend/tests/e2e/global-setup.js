import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROLES } from "./fixtures/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, ".auth");

// Logs each seeded demo account in ONCE via the real login form and saves
// its session, so individual spec files can reuse it instead of re-submitting
// the login form (backend/supportmitra/settings.py enforces a
// 5-attempts/minute-per-IP throttle on /api/auth/login/ — a real security
// feature, not something to disable). A short delay between logins keeps
// this comfortably under that limit.
//
// Two things are saved, not just Playwright's standard storageState:
//   - storageState (cookies + localStorage) captures `refresh_token`, but
//     the backend rotates AND blacklists refresh tokens on every use
//     (SIMPLE_JWT ROTATE_REFRESH_TOKENS/BLACKLIST_AFTER_ROTATION) — so it's
//     single-use. A saved refresh_token can silently-refresh exactly once;
//     every later test reusing the same file gets a blacklisted-token 401.
//   - `access_token` (in sessionStorage — deliberately NOT part of
//     storageState, see authStore.js's header comment on why) doesn't
//     rotate and lives ~15 minutes, comfortably longer than this whole
//     suite. Saving it separately and re-injecting it via addInitScript
//     lets every test authenticate straight from a valid access token
//     without ever touching the single-use refresh flow.
export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  const roleKeys = Object.keys(ROLES);

  for (let i = 0; i < roleKeys.length; i++) {
    const roleKey = roleKeys[i];
    const role = ROLES[roleKey];
    const page = await browser.newPage({ baseURL: "http://localhost:5173" });

    await page.goto("/login");
    await page.fill('input[name="email"]', role.email);
    await page.fill('input[name="password"]', role.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });

    const accessToken = await page.evaluate(() => sessionStorage.getItem("access_token"));
    fs.writeFileSync(path.join(AUTH_DIR, `${roleKey}-session.json`), JSON.stringify({ accessToken }));
    await page.context().storageState({ path: path.join(AUTH_DIR, `${roleKey}.json`) });
    await page.close();

    if (i < roleKeys.length - 1) await new Promise((r) => setTimeout(r, 13_000));
  }

  await browser.close();
}
