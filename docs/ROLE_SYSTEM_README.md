# ResolveHQ Role System

> Last updated: 2026-06-23  
> Applies to: all code on `master` branch (Phase 36 + SaaS role architecture)

---

## Table of Contents

1. [Role Hierarchy](#role-hierarchy)
2. [Role Definitions](#role-definitions)
3. [Development Login Accounts](#development-login-accounts)
4. [Permission Matrix](#permission-matrix)
5. [Frontend Route Access Matrix](#frontend-route-access-matrix)
6. [API Permission Matrix](#api-permission-matrix)
7. [Sidebar Visibility Matrix](#sidebar-visibility-matrix)
8. [Troubleshooting](#troubleshooting)

---

## Role Hierarchy

```
Super Admin          ← Full system control. is_staff=True, role="admin".
    │
    ├── Operations Manager   ← Ticket ops, engineer management, services.
    │                          is_staff=False, role="operations_manager".
    │
    ├── Finance Manager      ← Payments, invoices, revenue analytics.
    │                          is_staff=False, role="finance_manager".
    │
    └── Support Agent        ← View tickets, comment, escalate.
                               is_staff=False, role="support_agent".

Freelancer (Engineer)        ← Own assigned tickets only.
                               is_staff=False, role="freelancer".

Customer                     ← Own tickets and invoices only.
                               is_staff=False, role="customer".
```

Super Admin is the only role with `is_staff=True`. All permission checks that gate
privileged actions require **both** `is_staff=True` AND `role="admin"` — setting
`is_staff=True` on a non-admin role does not grant elevated access.

---

## Role Definitions

### Super Admin

**Purpose:** Full platform ownership. Can do everything every other role can do, plus
system configuration, role management, and irreversible operations (refunds, user
deactivation).

**Accessible pages:**
- All `/operations/*` pages
- Django admin panel at `/django-admin/`

**Restricted pages:** None.

**Ticket actions:**
- Read, assign, unassign, update status, comment (public + internal), escalate, attach files, view history

**Payment actions:**
- Read all payments, confirm payments, issue refunds (only role that can refund)

**User management:**
- Read, promote, demote, deactivate, reactivate any user
- View immutable role-change audit log

---

### Operations Manager

**Purpose:** Day-to-day ticket operations. Manages engineers, services, and monitors
the support queue. Cannot touch payments or user roles.

**Accessible pages:**
- `/operations` — Overview
- `/operations/tickets` — Ticket Queue (full assign/unassign)
- `/operations/assignments` — Assignment management
- `/operations/freelancers` — Engineer roster
- `/operations/services` — Service catalogue
- `/operations/payments` — Payments (read-only; no confirm or refund)
- `/operations/analytics` — Operational analytics
- `/operations/users` — User list (read-only; cannot change roles)
- `/operations/notifications`

**Restricted pages:**
- `/operations/roles` — Role audit log (Super Admin only)
- `/operations/settings` — Platform settings (Super Admin only)

**Ticket actions:**
- Read any ticket, assign, unassign, update status, comment (public + internal), escalate, attach files, view history

**Payment actions:**
- Read only — no confirm, no refund

**User management:**
- Read only — cannot promote, demote, deactivate, or reactivate

---

### Finance Manager

**Purpose:** Financial operations. Reviews payment status, approves manual
confirmations, downloads invoices. Cannot manage engineers, tickets, or users.

**Accessible pages:**
- `/operations` — Overview (financial KPIs only)
- `/operations/tickets` — Ticket Queue (read only; cannot assign)
- `/operations/payments` — Full payment management (confirm, read summary)
- `/operations/analytics` — Financial analytics (revenue, payment types, refund rate)
- `/operations/notifications`

**Restricted pages:**
- `/operations/assignments`, `/operations/freelancers`, `/operations/services`
- `/operations/users`, `/operations/roles`, `/operations/settings`

**Ticket actions:**
- Read any ticket and its history, view/add comments, view attachments
- **Cannot** assign, unassign, update status, or escalate tickets

**Payment actions:**
- Read all payments, confirm payments, download any invoice, view revenue summary
- **Cannot** issue refunds (Super Admin only)

**User management:** None.

---

### Support Agent

**Purpose:** First-line ticket support. Views the queue, communicates with
customers via comments, and escalates complex issues.

**Accessible pages:**
- `/operations` — Overview (ticket KPIs only; no revenue)
- `/operations/tickets` — Ticket Queue (view + comment + escalate)
- `/operations/notifications`

**Restricted pages:**
- `/operations/payments`, `/operations/analytics`
- `/operations/assignments`, `/operations/freelancers`, `/operations/services`
- `/operations/users`, `/operations/roles`, `/operations/settings`

**Ticket actions:**
- Read any ticket and its history, add comments (public + internal), escalate, view attachments
- **Cannot** assign, unassign, or update status

**Payment actions:** None (Support Agents cannot see any payment data).

**User management:** None.

---

### Freelancer (Engineer)

**Purpose:** Resolves assigned tickets. Only sees their own workload.

**Accessible pages:**
- `/freelancer` — My Assignments dashboard

**Restricted pages:** All `/operations/*` pages.

**Ticket actions:**
- Read own assigned tickets, update status of assigned tickets, comment (public + internal), view history

**Payment actions:** None.

**User management:** None.

---

### Customer

**Purpose:** Submits and tracks support tickets. Pays per ticket.

**Accessible pages:**
- `/dashboard`
- `/tickets/new`, `/tickets/:id`
- `/billing` — own invoices
- `/analytics` — own ticket stats
- `/notifications`, `/settings`, `/help-center`

**Restricted pages:** All `/operations/*` pages, `/freelancer`.

**Ticket actions:**
- Create new tickets, read own tickets, add public comments on own tickets, submit CSAT

**Payment actions:**
- Initiate and verify payment for own tickets, download own invoices

**User management:** None.

---

## Development Login Accounts

### Quick start — full demo environment

Run both commands in order after setting up the database:

```bash
cd backend
python manage.py seed_demo_users    # 6 staff/role accounts
python manage.py seed_demo_data     # 10 customers, 8 engineers, 15 tickets
```

Both commands are idempotent — safe to run multiple times.

To wipe all demo data and start fresh:

```bash
python manage.py seed_demo_data --flush  # deletes .demo users + DEMO_xx tickets, then re-seeds
python manage.py seed_demo_users --reset-passwords  # restores default passwords
```

---

### Staff login credentials

| Role | Email | Password | Portal |
|---|---|---|---|
| Super Admin | admin@resolvehq.dev | ResolveAdmin1! | `/operations` or `/django-admin` |
| Operations Manager | ops@resolvehq.dev | ResolveOps1! | `/operations` |
| Finance Manager | finance@resolvehq.dev | ResolveFinance1! | `/operations` |
| Support Agent | support@resolvehq.dev | ResolveSupport1! | `/operations` |
| Engineer | engineer@resolvehq.dev | ResolveEngineer1! | `/freelancer` |
| Customer | customer@resolvehq.dev | ResolveCustomer1! | `/dashboard` |

---

### Demo customer credentials (`seed_demo_data`)

All demo customers use password: `DemoCustomer1!`

| Customer | Email | Company |
|---|---|---|
| Priya Sharma | priya.sharma@techforge.demo | TechForge Solutions |
| Rohan Mehta | rohan.mehta@nexusretail.demo | Nexus Retail Pvt Ltd |
| Sunita Patel | sunita.patel@cloudbridge.demo | CloudBridge Technologies |
| Amir Khan | amir.khan@pinnacle.demo | Pinnacle Logistics |
| Deepa Nair | deepa.nair@kratos.demo | Kratos Fintech |
| Vikram Singh | vikram.singh@meridian.demo | Meridian Healthcare |
| Anjali Gupta | anjali.gupta@starlink.demo | Starlink Exports |
| Suresh Reddy | suresh.reddy@vertex.demo | Vertex Manufacturing |
| Meena Iyer | meena.iyer@horizon.demo | Horizon Education |
| Raj Khanna | raj.khanna@sapphire.demo | Sapphire Hospitality |

### Demo engineer credentials (`seed_demo_data`)

All demo engineers use password: `DemoEngineer1!`

| Engineer | Email | Skills |
|---|---|---|
| Arjun Verma | arjun.verma@engineers.demo | Microsoft 365, Email, DNS |
| Kavita Rao | kavita.rao@engineers.demo | Linux, Server Admin |
| Nitin Chawla | nitin.chawla@engineers.demo | VPN, Cybersecurity, Firewall |
| Pooja Desai | pooja.desai@engineers.demo | Cloud, AWS, Azure, VMware |
| Sanjay Kumar | sanjay.kumar@engineers.demo | SAP Basis, ERP |
| Ritika Sharma | ritika.sharma@engineers.demo | Microsoft 365, SharePoint |
| Dev Malhotra | dev.malhotra@engineers.demo | Cybersecurity, SIEM, SOC |
| Anita Pillai | anita.pillai@engineers.demo | Email, DNS, VPN, Networking |

### Demo tickets

| ID | Title | Status | Engineer |
|---|---|---|---|
| DEMO_01 | Emails bouncing for company domain after DNS migration | Open | — |
| DEMO_02 | VPN connection dropping for all remote staff | Open | — |
| DEMO_03 | Microsoft 365 MFA login failure blocking 15 users | Open | — |
| DEMO_04 | Windows Server 2019 CPU pegged at 100% | Assigned | Pooja Desai |
| DEMO_05 | SSL certificate expired on customer portal | Assigned | Nitin Chawla |
| DEMO_06 | SAP system log full — users getting login errors | Assigned | Sanjay Kumar |
| DEMO_07 | Linux server disk at 97% — cron alerts firing | In Progress | Kavita Rao |
| DEMO_08 | VMware ESXi PSOD after patch update | In Progress | Pooja Desai |
| DEMO_09 | SharePoint permissions broken after restructure | In Progress | Ritika Sharma |
| DEMO_10 | RDP access lost after firewall rule change | Waiting on Customer | Dev Malhotra |
| DEMO_11 | DNS records pointing to wrong IP after migration | Waiting on Customer | Anita Pillai |
| DEMO_12 | Ransomware indicators on 3 workstations | Resolved | Nitin Chawla |
| DEMO_13 | Company domain blacklisted — outbound emails spam | Resolved | Arjun Verma |
| DEMO_14 | Network drives lost after Windows Update KB5034441 | Resolved | Kavita Rao |
| DEMO_15 | Cloud backup silently failing for 3 days | Resolved | Pooja Desai |

> All demo accounts are for **development and staging only**. Never run these
> seeders in production. Demo emails use `.demo` TLD and are never real addresses.

---

## Permission Matrix

`R` = Read · `W` = Write/Create · `A` = Approve · `D` = Delete · `—` = No access

| Resource | Super Admin | Ops Manager | Finance Manager | Support Agent | Engineer | Customer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Tickets — Read** | All | All | All | All | Own | Own |
| **Tickets — Create** | R+W | R+W | R | R | — | W |
| **Tickets — Assign** | R+W | R+W | — | — | — | — |
| **Tickets — Status Update** | R+W | R+W | — | — | Own | — |
| **Tickets — Comment (public)** | R+W | R+W | R+W | R+W | R+W | R+W |
| **Tickets — Comment (internal)** | R+W | R+W | R+W | R+W | R+W | — |
| **Tickets — Escalate** | W | W | — | W | — | — |
| **Tickets — Attachments** | R+W | R+W | R+W | R+W | R+W | R+W |
| **Payments — Read** | All | All | All | — | — | Own |
| **Payments — Confirm** | A | — | A | — | — | — |
| **Payments — Refund** | A | — | — | — | — | — |
| **Payments — Invoice Download** | Any | Any | Any | — | — | Own |
| **Analytics — Ticket KPIs** | R | R | — | R | Own | Own |
| **Analytics — Operational** | R | R | — | — | — | — |
| **Analytics — Financial** | R | — | R | — | — | — |
| **Users — Read** | R | R | — | — | — | — |
| **Users — Role Change** | W | — | — | — | — | — |
| **Users — Deactivate/Reactivate** | W | — | — | — | — | — |
| **Role Audit Log** | R | — | — | — | — | — |
| **Engineers — Read** | R | R | — | — | — | — |
| **Services — Read** | R | R | — | — | R (public) | R (public) |
| **Services — Write** | W | W | — | — | — | — |
| **Platform Settings** | W | — | — | — | — | Own account |
| **Django Admin** | Full | — | — | — | — | — |

---

## Frontend Route Access Matrix

`✓` = allowed · `→` = redirected to (not blocked, redirect destination) · `403` = blocked

| Route | Super Admin | Ops Manager | Finance Manager | Support Agent | Engineer | Customer | Anon |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/login` | `/operations` | `/operations` | `/operations` | `/operations` | `/dashboard` | `/dashboard` | ✓ |
| `/register` | `/operations` | `/operations` | `/operations` | `/operations` | `/dashboard` | `/dashboard` | ✓ |
| `/dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/freelancer` | `/operations` | `/operations` | `/operations` | `/operations` | ✓ | `/dashboard` | `/login` |
| `/tickets/new` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/tickets/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/billing` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/analytics` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/settings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/notifications` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/help-center` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| `/admin` | ✓ | `403` | `403` | `403` | `403` | `403` | `/login` |
| `/operations` | ✓ | ✓ | ✓ | ✓ | `/dashboard` | `/dashboard` | `/login` |
| `/operations/tickets` | ✓ | ✓ | ✓ | ✓ | `/dashboard` | `/dashboard` | `/login` |
| `/operations/assignments` | ✓ | ✓ | `403` | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/freelancers` | ✓ | ✓ | `403` | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/services` | ✓ | ✓ | `403` | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/payments` | ✓ | ✓ (read) | ✓ (write) | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/analytics` | ✓ | ✓ | ✓ | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/users` | ✓ | ✓ (read) | `403` | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/roles` | ✓ | `403` | `403` | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/settings` | ✓ | `403` | `403` | `403` | `/dashboard` | `/dashboard` | `/login` |
| `/operations/notifications` | ✓ | ✓ | ✓ | ✓ | `/dashboard` | `/dashboard` | `/login` |

**Route guard components (App.jsx):**

| Guard | Allows |
|---|---|
| `PrivateRoute` | Any authenticated user |
| `OpsRoute` | All 4 internal staff roles |
| `OpsManagerRoute` | Operations Manager + Super Admin |
| `PaymentRoute` | Operations Manager + Finance Manager + Super Admin |
| `FinanceRoute` | Finance Manager + Super Admin |
| `SuperAdminOpsRoute` | Super Admin only |
| `AdminRoute` | Super Admin only (legacy `/admin` pages) |
| `FreelancerRoute` | Freelancer only (staff redirected to `/operations`) |
| `PublicOnlyRoute` | Unauthenticated only (authenticated users redirected) |

---

## API Permission Matrix

Base URL prefix: `/api/`

### Authentication

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `auth/register/` | POST | Public | |
| `auth/login/` | POST | Public | |
| `auth/logout/` | POST | Authenticated | |
| `auth/me/` | GET | Authenticated | Returns current user |
| `auth/refresh/` | POST | Public | JWT refresh |
| `auth/profile/` | GET/PATCH | Authenticated | Own profile |
| `auth/change-password/` | POST | Authenticated | |
| `auth/verify-email/` | POST | Public | |
| `auth/password/reset/` | POST | Public | |

### Customer

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `customers/me/` | GET/PATCH | Customer only | Own profile |
| `customers/me/payments/` | GET | Customer only | Own payments |
| `services/` | GET | Public | Service catalogue |

### Tickets

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `tickets/` | GET/POST | Customer only | Own tickets |
| `tickets/:id/` | GET/PATCH | Owner or Super Admin | Object-level |
| `tickets/:id/comments/` | GET/POST | Authenticated + scoped | Staff see all; customers see public only |
| `tickets/:id/activity/` | GET | Authenticated + scoped | Staff see any; others see own |
| `tickets/:id/attachments/` | GET/POST | Authenticated + scoped | All staff; own for customers/engineers |
| `tickets/:id/csat/` | POST | Customer only | |
| `tickets/:id/initiate-payment/` | POST | Customer only | |
| `tickets/:id/verify-payment/` | POST | Customer only | |

### Freelancer

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `freelancer/tickets/` | GET | Approved freelancer | Own assigned only |
| `freelancer/tickets/:id/` | GET | Approved freelancer | Own assigned only |
| `freelancer/tickets/:id/status/` | POST | Approved freelancer | Own assigned only |

### Payments

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `payments/webhook/` | POST | Public | Razorpay signature verified inside |
| `payments/:id/` | GET | Customer only | Own payment |
| `payments/:id/invoice/` | GET | Customer (own) or any internal staff | |

### Operations — Tickets

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `ops/dashboard/` | GET | All 4 staff roles | Revenue omitted for Support Agent |
| `ops/tickets/` | GET | All 4 staff roles | |
| `ops/tickets/:id/assign/` | POST | Ops Manager + Super Admin | |
| `ops/tickets/:id/unassign/` | POST | Ops Manager + Super Admin | |
| `ops/tickets/:id/history/` | GET | All 4 staff roles | |
| `ops/tickets/:id/escalate/` | POST | Support Agent + Ops Manager + Super Admin | Finance Manager blocked by inner check |

### Operations — Payments

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `ops/payments/` | GET | Ops Manager + Finance Manager + Super Admin | |
| `ops/payments/summary/` | GET | Finance Manager + Super Admin | Revenue aggregates |
| `ops/payments/:id/confirm/` | POST | Finance Manager + Super Admin | |
| `ops/payments/:id/refund/` | POST | Super Admin only | Irreversible |

### Operations — Users & Roles

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `ops/users/` | GET | Ops Manager + Super Admin | |
| `ops/users/:id/` | GET | Ops Manager + Super Admin | |
| `ops/users/:id/role/` | POST | Super Admin only | Writes RoleChangeAudit |
| `ops/users/:id/deactivate/` | POST | Super Admin only | |
| `ops/users/:id/reactivate/` | POST | Super Admin only | |
| `ops/role-audit/` | GET | Ops Manager + Super Admin | Immutable log |

### Operations — Platform

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `ops/freelancers/` | GET | Ops Manager + Super Admin | |
| `ops/services/` | GET/POST | Ops Manager + Super Admin | |
| `ops/services/:id/` | GET/PATCH | Ops Manager + Super Admin | |
| `ops/services/:id/toggle/` | POST | Ops Manager + Super Admin | Active/inactive |
| `ops/analytics/` | GET | All 4 staff roles | Sections scoped per role |

### Notifications

| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `notifications/` | GET | Authenticated | Own only |
| `notifications/unread-count/` | GET | Authenticated | |
| `notifications/mark-all-read/` | POST | Authenticated | |
| `notifications/:id/read/` | POST | Authenticated | |

---

## Sidebar Visibility Matrix

The sidebar renders different navigation blocks based on the current user's role and the
active URL path. Staff roles see the ops nav when on `/operations/*`.

| Nav Item | Path | Super Admin | Ops Manager | Finance Manager | Support Agent |
|---|---|:---:|:---:|:---:|:---:|
| Overview | `/operations` | ✓ | ✓ | ✓ | ✓ |
| Ticket Queue | `/operations/tickets` | ✓ | ✓ | ✓ | ✓ |
| Assignments | `/operations/assignments` | ✓ | ✓ | — | — |
| Payments | `/operations/payments` | ✓ | ✓ | ✓ | — |
| Analytics | `/operations/analytics` | ✓ | ✓ | ✓ | — |
| Users | `/operations/users` | ✓ | ✓ | — | — |
| Roles | `/operations/roles` | ✓ | — | — | — |
| Engineers | `/operations/freelancers` | ✓ | ✓ | — | — |
| Services | `/operations/services` | ✓ | ✓ | — | — |
| Settings | `/operations/settings` | ✓ | — | — | — |
| Notifications | `/operations/notifications` | ✓ | ✓ | ✓ | ✓ |
| Help Center | `/help-center` | ✓ | ✓ | ✓ | ✓ |

---

## Troubleshooting

### Create a Super Admin (from scratch)

```bash
cd backend
python manage.py createsuperuser --email admin@yourcompany.com
# Follow prompts to set password
# Then in the shell, set role:
python manage.py shell -c "
from django.contrib.auth import get_user_model
u = get_user_model().objects.get(email='admin@yourcompany.com')
u.role = 'admin'
u.save()
print('Done:', u.email, u.is_staff, u.role)
"
```

---

### Reset a User's Password

```bash
cd backend
python manage.py shell -c "
from django.contrib.auth import get_user_model
u = get_user_model().objects.get(email='user@example.com')
u.set_password('NewPassword1!')
u.save()
print('Password reset for', u.email)
"
```

---

### Promote a User to a Staff Role

Via the `/operations/users` page (Super Admin only) — click the user, select new role
from the dropdown, confirm.

Via the shell:

```bash
cd backend
python manage.py shell -c "
from django.contrib.auth import get_user_model
from support_app.models import RoleChangeAudit
u = get_user_model().objects.get(email='user@example.com')
old = u.role
u.role = 'operations_manager'   # or finance_manager / support_agent
u.save()
print(f'Promoted {u.email}: {old} → {u.role}')
"
```

Allowed transitions enforced by the backend (`_ALLOWED_TRANSITIONS` in `views.py`):

| From | Can become |
|---|---|
| `customer` | freelancer, operations_manager, finance_manager, support_agent |
| `freelancer` | customer, operations_manager, finance_manager, support_agent |
| `operations_manager` | customer, freelancer, finance_manager, support_agent, admin |
| `finance_manager` | customer, operations_manager, support_agent |
| `support_agent` | customer, operations_manager, finance_manager |
| `admin` | (no demotions — must be done via Django shell) |

---

### Demote a User

Via the `/operations/users` page (Super Admin) — same dropdown. Only allowed transitions
are shown (mirrors `_ALLOWED_TRANSITIONS`).

Via the shell (same as promote, just set `role` to the target value).

---

### Create All Demo Users

```bash
cd backend
python manage.py seed_demo_users
```

This is idempotent. Safe to run multiple times. To restore default passwords:

```bash
python manage.py seed_demo_users --reset-passwords
```

---

### Verify Permissions for a User

```bash
cd backend
python manage.py shell -c "
from django.contrib.auth import get_user_model
from support_app.permissions import (
    is_super_admin, is_operations_manager, is_finance_manager,
    is_support_agent, is_internal_staff
)
u = get_user_model().objects.get(email='ops@resolvehq.dev')
print('Email         :', u.email)
print('Role          :', u.role)
print('is_staff      :', u.is_staff)
print('is_active     :', u.is_active)
print('super_admin   :', is_super_admin(u))
print('ops_manager   :', is_operations_manager(u))
print('finance_mgr   :', is_finance_manager(u))
print('support_agent :', is_support_agent(u))
print('internal_staff:', is_internal_staff(u))
"
```

---

### Common Mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Staff user can log in but sees customer dashboard | `role` not set, defaults to `customer` | Set `user.role` in shell |
| Super Admin redirected to `/dashboard` after login | `is_staff=False` or `role != "admin"` | Ensure both fields are set |
| Ops Manager gets 403 on `/operations/users` | Old code used `SuperAdminOpsRoute` | Ensure App.jsx uses `OpsManagerRoute` for that route |
| Finance Manager gets 403 on `/operations/payments` | Old code used `FinanceRoute` | Ensure App.jsx uses `PaymentRoute` for that route |
| Support Agent can't comment on tickets | Old `_get_ticket()` didn't check `is_internal_staff` | Ensure views.py fix FIX-2 is applied |
| Finance Manager can't download invoices | `payment_invoice` checked `is_staff` only | Ensure views.py fix FIX-5 is applied |
| Operations Overview (404 / 403) for Finance or Support Agent | `ops_dashboard` used wrong permission class | Ensure views.py fix FIX-1 is applied |
| New role not available in role-change dropdown | `ROLE_CHOICES` not updated | Add to `CustomUser.ROLE_CHOICES` and run `makemigrations` |

---

### Migrations Pending (as of 2026-06-23)

| Migration | Description | Status |
|---|---|---|
| `0011_add_new_roles` | Adds `finance_manager`, `support_agent` to role choices | Generated, run `migrate` on live DB |
| `0012_add_escalated_action` | Adds `escalated` to `TicketActivityLog.ACTION_CHOICES` | Generated, run `migrate` on live DB |

```bash
cd backend
python manage.py migrate
```

Both migrations are `AlterField` only — no SQL `ALTER TABLE`, zero downtime.
