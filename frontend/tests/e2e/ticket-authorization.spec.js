import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Requires `python manage.py seed_e2e_org_mates` to have been run against
// the backend, on top of the standard `seed_demo_users` (see
// fixtures/auth.js) — two real Customers sharing one Organization, needed
// because the normal self-service flows can't produce that today (see the
// management command's docstring).
const ORG_MATE_A = { email: "org-mate-a@resolvehq.dev", password: "ResolveOrgMate1!" };
const ORG_MATE_B = { email: "org-mate-b@resolvehq.dev", password: "ResolveOrgMate1!" };

function customerSession() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "customer-session.json"), "utf-8"));
}
function engineerSession() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "engineer-session.json"), "utf-8"));
}

// global-setup.js's own 6 staggered logins can leave the shared 5/minute
// /api/auth/login/ throttle (per-IP, supportmitra/settings.py) with little
// or no headroom by the time this file's beforeAll runs immediately after.
// Rather than guess a fixed delay, honor the server's own
// "Expected available in N seconds" hint on a 429 and retry.
async function apiLogin(request, email, password) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await request.post("/api/auth/login/", { data: { email, password } });
    if (resp.ok()) {
      const data = await resp.json();
      return data.access;
    }
    if (resp.status() === 429) {
      const body = await resp.json().catch(() => ({}));
      const match = /(\d+) seconds/.exec(body.detail || "");
      const waitSec = match ? parseInt(match[1], 10) + 2 : 15;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }
    throw new Error(`login failed for ${email}: ${resp.status()} ${await resp.text()}`);
  }
  throw new Error(`login failed for ${email} after retries (throttled)`);
}

async function useSession(page, accessToken) {
  await page.addInitScript((token) => {
    sessionStorage.setItem("access_token", token);
  }, accessToken);
}

// One-time setup shared by every test below: log in as both org-mates
// (throttle-conscious — only 2 extra logins, staggered, on top of whatever
// global-setup.js already used for the 6 standard seeded roles) and create
// one real ticket owned by org-mate-a for every test to probe.
let mateAToken, mateBToken, sharedTicketId, sharedTicketNumber;

test.beforeAll(async ({ request }) => {
  mateAToken = await apiLogin(request, ORG_MATE_A.email, ORG_MATE_A.password);
  await new Promise((r) => setTimeout(r, 3000));
  mateBToken = await apiLogin(request, ORG_MATE_B.email, ORG_MATE_B.password);

  const resp = await request.post("/api/tickets/", {
    headers: { Authorization: `Bearer ${mateAToken}` },
    data: { title: "Org-mate visibility ticket", service_type: "server_admin", severity: "medium" },
  });
  expect(resp.ok()).toBeTruthy();
  const created = await resp.json();
  sharedTicketId = created.id;
  sharedTicketNumber = created.ticket_number;
});

test.describe("Organization-wide ticket read access", () => {
  test("org-mate sees a colleague's ticket in their list, with a Requested-by indicator", async ({ page }) => {
    await useSession(page, mateBToken);
    await page.goto("/dashboard");
    // Search forces the flat (unbucketed) ticket list so a brand-new
    // pending_payment ticket is guaranteed visible regardless of which
    // "Needs Attention"-style section it would otherwise sort into.
    await page.getByPlaceholder("Search tickets…").fill(sharedTicketNumber);
    // The ticket number can legitimately appear more than once on the
    // dashboard (e.g. the separate "Recent Tickets" widget alongside the
    // filtered search-results list) — .first() confirms visibility without
    // asserting an exact count, which isn't this test's concern.
    await expect(page.getByText(sharedTicketNumber).first()).toBeVisible();
    await expect(page.getByText(/Requested by Org Mate A/i).first()).toBeVisible();
  });

  test("org-mate can open a colleague's ticket detail page directly by URL", async ({ page }) => {
    await useSession(page, mateBToken);
    await page.goto(`/tickets/${sharedTicketId}`);
    await expect(page.getByText("Org-mate visibility ticket")).toBeVisible();
    await expect(page.getByText(/read-only/i)).toBeVisible();
  });

  test("org-mate does not see reply/attach/pay controls on a colleague's ticket", async ({ page }) => {
    await useSession(page, mateBToken);
    await page.goto(`/tickets/${sharedTicketId}`);
    await expect(page.getByText("Org-mate visibility ticket")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Write a message" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add File" })).toHaveCount(0);
  });
});

test.describe("Organization-wide read does not grant write", () => {
  test("org-mate cannot comment, attach, or patch a colleague's ticket via direct API calls", async ({ request }) => {
    const headers = { Authorization: `Bearer ${mateBToken}` };

    const patchResp = await request.patch(`/api/tickets/${sharedTicketId}/`, {
      headers, data: { title: "Hijacked" },
    });
    expect(patchResp.status()).toBe(403);

    const commentResp = await request.post(`/api/tickets/${sharedTicketId}/comments/`, {
      headers, data: { body: "not my ticket" },
    });
    expect(commentResp.status()).toBe(404);
  });

  test("org-mate cannot see or download a colleague's ticket's payment/invoice", async ({ request }) => {
    const headers = { Authorization: `Bearer ${mateBToken}` };
    const listResp = await request.get("/api/customers/me/payments/", { headers });
    expect(listResp.ok()).toBeTruthy();
    const list = await listResp.json();
    for (const p of list.results ?? []) {
      expect(p.ticket).not.toBe(sharedTicketId);
    }
  });
});

test.describe("Cross-organization isolation", () => {
  test("a customer in a different organization cannot see the ticket via API", async ({ request }) => {
    const { accessToken } = customerSession();
    const resp = await request.get(`/api/tickets/${sharedTicketId}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.status()).toBe(404);
  });

  test("a customer in a different organization gets a not-found page, not ticket content, via direct URL", async ({ page }) => {
    const { accessToken } = customerSession();
    await useSession(page, accessToken);
    await page.goto(`/tickets/${sharedTicketId}`);
    await expect(page.getByText("Ticket not found.")).toBeVisible();
    await expect(page.getByText("Org-mate visibility ticket")).toHaveCount(0);
  });

  test("the different-org customer's own ticket list never includes the org-mate ticket", async ({ request }) => {
    const { accessToken } = customerSession();
    const resp = await request.get("/api/tickets/", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    const ids = data.results.map((t) => t.id);
    expect(ids).not.toContain(sharedTicketId);
  });
});

test.describe("Freelancer isolation unaffected by organization visibility", () => {
  test("an unassigned freelancer cannot reach the ticket via API or direct URL", async ({ page, request }) => {
    const { accessToken } = engineerSession();

    const resp = await request.get(`/api/tickets/${sharedTicketId}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.status()).toBe(404);

    await useSession(page, accessToken);
    await page.goto(`/tickets/${sharedTicketId}`);
    await expect(page.getByText("Ticket not found.")).toBeVisible();
  });
});

test.describe("Attachment downloads require authorization", () => {
  let attachmentDownloadPath;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`/api/tickets/${sharedTicketId}/attachments/`, {
      headers: { Authorization: `Bearer ${mateAToken}` },
      multipart: { file: { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("hello e2e") } },
    });
    expect(resp.ok()).toBeTruthy();
    const attachment = await resp.json();
    attachmentDownloadPath = new URL(attachment.file_url).pathname;
  });

  test("an unauthenticated request cannot download the attachment", async ({ request }) => {
    const resp = await request.get(attachmentDownloadPath);
    expect(resp.status()).toBe(401);
  });

  test("a different-organization customer cannot download the attachment", async ({ request }) => {
    const { accessToken } = customerSession();
    const resp = await request.get(attachmentDownloadPath, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.status()).toBe(404);
  });

  test("the org-mate (read access) can download the attachment", async ({ request }) => {
    const resp = await request.get(attachmentDownloadPath, {
      headers: { Authorization: `Bearer ${mateBToken}` },
    });
    expect(resp.ok()).toBeTruthy();
    expect(await resp.text()).toBe("hello e2e");
  });
});
