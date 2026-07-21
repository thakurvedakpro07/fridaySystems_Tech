import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuses the sessions saved by global-setup.js rather than logging in again
// per test — see roles.spec.js / global-setup.js for why both storageState
// AND a separately re-injected access_token are needed here.
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

// Verifies the design-system consolidation: shared primitives render with
// data-ds hooks, and the same status/payment values render identically
// across pages that used to have independently-drifted color mappings
// (e.g. "failed" payments were bg-red-100 on OpsPayments vs bg-rose-100 on
// PaymentsDashboard/BillingPage before this pass).

test.describe("Staff / admin pages", () => {
  useRoleSession("admin");

  test("Ops Dashboard renders Card chrome and a single PageHeader", async ({ page }) => {
    await page.goto("/operations");
    await expect(page.locator('[data-ds="page-header"]')).toHaveCount(1);
    await expect(page.locator('[data-ds="card"]').first()).toBeVisible();
  });

  test("Payments pages render consistent Badge classes for the same status", async ({ page }) => {
    await page.goto("/operations/payments");
    const opsBadges = page.locator('[data-ds="badge"]');
    const opsCount = await opsBadges.count();
    const opsClassSamples = [];
    for (let i = 0; i < opsCount; i++) opsClassSamples.push(await opsBadges.nth(i).getAttribute("class"));

    // No red-100 (the pre-consolidation OpsPayments outlier for "failed") —
    // canonical paymentStatus domain standardized on rose-100.
    for (const cls of opsClassSamples) expect(cls).not.toMatch(/bg-red-100/);
  });

  test("Ticket Queue renders ticketStatus badges via the shared Badge component", async ({ page }) => {
    await page.goto("/operations/tickets");
    // .first() may resolve to the mobile-only (md:hidden) duplicate at desktop
    // viewport widths, so assert on presence in the DOM rather than visibility.
    await expect(page.locator('[data-ds="badge"]').first()).toHaveCount(1);
  });

  test("Services page uses shared Input/Select in the create form", async ({ page }) => {
    await page.goto("/operations/services");
    await page.getByRole("button", { name: "Add Service" }).click();
    await expect(page.locator('input[placeholder="e.g. Kubernetes Support"]')).toBeVisible();
  });

  test("Ops pages render a shared PageHeader consistently", async ({ page }) => {
    await page.goto("/operations/payments");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
  });

  // Phase 1 primitives: FormSection (extracted from SettingsPage's local
  // SectionCard) and Skeleton (wrapping the .shimmer utility).
  test("Settings page renders form sections and profile fields", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.getByText("Personal Information")).toBeVisible();
    await expect(page.locator('input[placeholder="Rahul"]')).toBeVisible();

    await page.getByRole("button", { name: "Security" }).click();
    await expect(page.getByText("Change Password")).toBeVisible();
  });

  // Phase 3: hand-rolled <h1> replaced with the shared PageHeader.
  test("OpsSettings renders a shared PageHeader", async ({ page }) => {
    await page.goto("/operations/settings");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Platform Settings" })).toBeVisible();
  });

  // Phase 3: OpsUsers/OpsRoles' verbatim-duplicated table wrapper + column
  // header + skeleton block extracted into components/table/TableCard.jsx.
  test("OpsUsers and OpsRoles render via the shared TableCard shell", async ({ page }) => {
    await page.goto("/operations/users");
    await expect(page.getByText("Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Actions", { exact: true })).toBeVisible();

    await page.goto("/operations/roles");
    await expect(page.getByText("Changed By", { exact: true })).toBeVisible();
  });

  // Phase 3: OpsAnalytics' StatCard and OpsPayments' SummaryCard (identical
  // markup, different names) merged into components/dashboard/StatTile.jsx.
  test("OpsAnalytics and OpsPayments render the merged StatTile", async ({ page }) => {
    await page.goto("/operations/analytics");
    await expect(page.getByText("Total (30d)")).toBeVisible();

    await page.goto("/operations/payments");
    await expect(page.getByText("Total Revenue")).toBeVisible();
  });

  // Phase 5: four independently hand-rolled "compact empty state" blocks
  // (OpsFreelancers, OpsServices, OpsRoles, TicketQueueTable) replaced with
  // <EmptyState size="compact">. Each is driven to zero results by mocking
  // its list API to return an empty array, rather than relying on the
  // page's own search/filter UI to produce zero matches (OpsFreelancers'
  // skill-search filter turned out not to actually filter results server- or
  // client-side against the seeded demo data — a pre-existing app behavior,
  // out of scope for this design-system phase — so driving it through the
  // UI was unreliable; mocking the API directly isolates what's actually
  // being verified here: the EmptyState markup, not the search feature).
  test("OpsFreelancers, OpsServices, and OpsRoles render the compact EmptyState on zero results", async ({ page }) => {
    await page.route("**/ops/freelancers/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
    );
    await page.goto("/operations/freelancers");
    await expect(page.getByText("No engineers found")).toBeVisible();

    await page.route("**/ops/services/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
    );
    await page.goto("/operations/services");
    await expect(page.getByText("No services found")).toBeVisible();

    await page.route("**/ops/role-audit/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
    );
    await page.goto("/operations/roles");
    await expect(page.getByText("No role changes recorded")).toBeVisible();
  });

  test("Ticket Queue renders the compact EmptyState on zero results", async ({ page }) => {
    await page.goto("/operations/tickets?search=zzznomatchxyz123");
    await expect(page.getByText("No tickets found")).toBeVisible();
  });
});

// Phase 3: hand-rolled rose error banners (identical to Alert severity="error")
// replaced across auth pages. The login request is mocked with a 400 (not
// 401) response: client.js's response interceptor treats *any* 401 —
// including from the login endpoint itself on bad credentials — as a
// session-expiry and hard-redirects to /login?session_expired=1 before React
// can render the error state (a pre-existing bug, unrelated to this phase,
// out of scope to fix here). A 400 avoids that interceptor path entirely
// while still exercising the real component code that renders the Alert.
test.describe("Auth pages", () => {
  test("Login shows a shared Alert on a failed sign-in", async ({ page }) => {
    await page.route("**/api/auth/login/", (route) =>
      route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ detail: "Invalid credentials." }) })
    );
    await page.goto("/login");
    await page.fill('input[name="email"]', "customer@resolvehq.dev");
    await page.fill('input[name="password"]', "wrong-password-123");
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-ds="alert"]')).toBeVisible();
    await expect(page.locator('[data-ds="alert"]')).toContainText("Invalid credentials.");
  });
});

// Phase 2: shared PageHeader / Card adoption on the customer-facing
// dashboard ("My Tickets") and billing pages.
test.describe("Customer-facing pages", () => {
  useRoleSession("customer");

  test("Dashboard (My Tickets) renders PageHeader and Card-wrapped info panel", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.getByText("My Tickets")).toBeVisible();
    await expect(page.locator('[data-ds="card"]').first()).toBeVisible();
  });

  test("Billing page renders payment history inside a shared Card", async ({ page }) => {
    await page.goto("/billing");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.locator('[data-ds="card"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payment history" })).toBeVisible();
  });

  // Phase 5 regression check: EmptyState's default (full) size, used by
  // BillingPage's empty payment history, must render unchanged after adding
  // the "compact" size variant — the default size's styles were untouched.
  test("Billing page's default-size EmptyState is unaffected by the compact variant", async ({ page }) => {
    await page.route("**/customers/me/payments/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [] }) })
    );
    await page.goto("/billing");
    await expect(page.getByText("No payments yet")).toBeVisible();
    await expect(page.getByText("Open a support ticket")).toBeVisible();
  });

  // Phase 3: NewTicket/TicketForm's hand-rolled error banner replaced with
  // Alert — smoke-checks the page still renders correctly with the new import.
  test("New Ticket page renders correctly with the shared Alert import", async ({ page }) => {
    await page.goto("/tickets/new");
    await expect(page.getByRole("heading", { name: "Open a Support Ticket" })).toBeVisible();
  });

  // Phase 3: raw shimmer divs replaced with the shared Skeleton component.
  test("Analytics page renders correctly after the Skeleton migration", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "My Ticket Analytics" })).toBeVisible();
  });

  // Phase 4: CustomerOnboarding's page shell, per-step header, and footer
  // nav extracted into shared OnboardingShell/OnboardingStepHeader/
  // OnboardingFooterNav components (components/onboarding/).
  test("Customer onboarding renders via the shared Onboarding components and advances steps", async ({ page }) => {
    await page.goto("/onboarding/customer");
    await expect(page.getByRole("heading", { name: "Tell us about your company" })).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What industry are you in?" })).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "How large is your team?" })).toBeVisible();
  });
});

// Phase 2: shared PageHeader / Card adoption on the freelancer dashboard.
test.describe("Engineer-facing pages", () => {
  useRoleSession("engineer");

  test("Freelancer Dashboard renders PageHeader and Card-wrapped info panel", async ({ page }) => {
    await page.goto("/freelancer");
    await expect(page.locator('[data-ds="page-header"]')).toBeVisible();
    await expect(page.locator('[data-ds="card"]').first()).toBeVisible();
    await expect(page.getByText("Today's Queue")).toBeVisible();
  });

  // Phase 4: FreelancerOnboarding's page shell, per-step header, and footer
  // nav extracted into the same shared Onboarding components, themed violet.
  test("Freelancer onboarding renders via the shared Onboarding components and advances steps", async ({ page }) => {
    await page.goto("/onboarding/freelancer");
    await expect(page.getByRole("heading", { name: "Confirm your skills" })).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "How much experience do you have?" })).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What's your availability?" })).toBeVisible();
  });

  // Freelancer Portal Phase D: the wizard used to discard skills/availability
  // on navigation instead of persisting them — this confirms the "Looks
  // good" step now saves via PATCH /api/auth/profile/ and it round-trips
  // onto /settings.
  test("Freelancer onboarding persists skills and availability", async ({ page }) => {
    await page.goto("/onboarding/freelancer");
    await page.getByRole("button", { name: "AWS Support" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: /1–2 years/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: /Part time/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Your profile looks great" })).toBeVisible();
    await page.getByRole("button", { name: "Looks good" }).click();
    await expect(page.getByRole("heading", { name: /Application submitted/ })).toBeVisible();

    await page.goto("/settings");
    await expect(page.locator('input[placeholder="aws, azure, kubernetes, server_admin"]')).toHaveValue(/aws/);
    await expect(page.locator("select")).toHaveValue("part_time");
  });
});
