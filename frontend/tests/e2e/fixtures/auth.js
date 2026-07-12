// Seeded demo accounts from backend/support_app/management/commands/seed_demo_users.py.
// Run `python manage.py seed_demo_users` against the backend before running this suite.
export const ROLES = {
  admin:     { email: "admin@resolvehq.dev",     password: "ResolveAdmin1!",     landing: "/operations" },
  ops:       { email: "ops@resolvehq.dev",       password: "ResolveOps1!",       landing: "/operations" },
  finance:   { email: "finance@resolvehq.dev",   password: "ResolveFinance1!",   landing: "/operations" },
  support:   { email: "support@resolvehq.dev",   password: "ResolveSupport1!",   landing: "/operations" },
  engineer:  { email: "engineer@resolvehq.dev",  password: "ResolveEngineer1!",  landing: "/freelancer" },
  customer:  { email: "customer@resolvehq.dev",  password: "ResolveCustomer1!",  landing: "/dashboard" },
};

export async function loginAs(page, roleKey) {
  const role = ROLES[roleKey];
  await page.goto("/login");
  await page.fill('input[name="email"]', role.email);
  await page.fill('input[name="password"]', role.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  return role;
}
