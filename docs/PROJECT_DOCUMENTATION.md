# SupportMitra — Complete Project Documentation

> IT Infrastructure Support Portal for Indian SMBs and SAP Shops
> Version: 1.0 | Last Updated: 2026-05-03

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Model](#2-business-model)
3. [Target Market & User Personas](#3-target-market--user-personas)
4. [Service Catalog](#4-service-catalog)
5. [System Architecture](#5-system-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Project Structure](#7-project-structure)
8. [Database Schema](#8-database-schema)
9. [API Reference](#9-api-reference)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Ticket Lifecycle](#11-ticket-lifecycle)
12. [Payment Flow](#12-payment-flow)
13. [SLA Framework](#13-sla-framework)
14. [Freelancer Operations](#14-freelancer-operations)
15. [Notification System](#15-notification-system)
16. [Remote Support Process](#16-remote-support-process)
17. [DevOps & Infrastructure](#17-devops--infrastructure)
18. [Environment Configuration](#18-environment-configuration)
19. [Local Development Setup](#19-local-development-setup)
20. [Deployment Guide](#20-deployment-guide)
21. [Monitoring & Alerting](#21-monitoring--alerting)
22. [Security Model](#22-security-model)
23. [Legal & Compliance](#23-legal--compliance)
24. [Development Roadmap](#24-development-roadmap)
25. [Glossary](#25-glossary)

---

## 1. Project Overview

### What is SupportMitra?

SupportMitra is a ticket-based IT infrastructure support portal built for Indian small and medium businesses (SMBs) and small SAP shops. Customers pay a transparent flat fee to open a support case, and a vetted freelance support engineer resolves the issue remotely. The model is inspired by managed support services like Bobcares.com but optimized for the Indian market — lower price points, GST-compliant billing, and WhatsApp-native communication.

### Vision

To become the most trusted low-cost IT support desk for Indian SMBs that cannot afford a full-time system administrator.

### Mission

Deliver fast, expert, and affordable IT support through a lean freelancer model — no long-term contracts, no hidden fees, no surprises.

### Core Value Proposition

| For Customers | For Freelancers |
|---|---|
| Pay only when you have a problem | Work on flexible engagements |
| Expert support in under 2 hours | Transparent payout per resolved ticket |
| Transparent pricing, no surprise invoices | Build a rated profile and grow earnings |
| GST invoice on every transaction | NDA-protected, contract-backed work |

---

## 2. Business Model

### Revenue Streams

#### 2.1 Pay-Per-Ticket (Primary)
Every support case has two fee components:

| Component | Trigger | Default Amount |
|---|---|---|
| Consulting Fee | Paid at ticket open — covers initial diagnosis | ₹299 |
| Resolution Fee | Collected after successful resolution | Varies by service type (see §4) |

If the ticket is not accepted within 2 hours, the consulting fee is fully refunded.

#### 2.2 Subscription / Retainer Packages (Phase 2)

| Plan | Monthly Price | Included Tickets | Response SLA | Resolution SLA |
|---|---|---|---|---|
| Silver | ₹1,499/mo | 3 tickets | 4 hours | 24 hours |
| Gold | ₹3,499/mo | 8 tickets | 2 hours | 8 hours |
| Platinum | ₹7,999/mo | Unlimited | 1 hour | 4 hours |

Additional tickets beyond the bundle are billed at a discounted per-ticket rate.

### Cost Structure

- **Freelancer Payout:** 60–70% of the resolution fee per ticket
- **Payment Gateway Fee:** ~2% (Razorpay / PayU)
- **GST on Services:** 18% collected from customer, deposited with tax authority
- **Infrastructure:** ~₹2,000–5,000/month (DigitalOcean VPS + object storage)
- **Communication APIs:** WhatsApp per-message fees, email per-send fees (low volume)

### Unit Economics (Pay-Per-Ticket)

```
Revenue per ticket:  ₹299 (consulting) + ₹800 avg resolution = ₹1,099
Freelancer payout:   ₹560 (65%)
Gateway fee:         ₹22
Net margin:          ₹517 (~47%)
```

---

## 3. Target Market & User Personas

### Primary Target Market

- Indian SMBs with 10–200 employees, no dedicated IT staff
- Small SAP shops running SAP Business One or SAP ECC on-premise
- Startups and growing companies outgrowing ad-hoc IT support

### User Personas

#### Persona 1: Rajesh — SMB Owner
- **Company:** 40-person manufacturing firm in Pune
- **Pain:** Server goes down on Friday evening, no one to call
- **Goal:** Fast resolution at a predictable price, no long-term contract
- **Behaviour:** Uses WhatsApp primarily; needs simple ticket creation flow

#### Persona 2: Priya — IT Coordinator
- **Company:** 80-person retail chain with Windows domain and file servers
- **Pain:** Patch management and AD issues eat up her time
- **Goal:** Outsource routine patching and Linux server tasks
- **Behaviour:** Comfortable with email; wants a dashboard to track all open tickets

#### Persona 3: Arjun — SAP Basis Consultant (Freelancer)
- **Skills:** SAP Basis, Linux, VMware
- **Goal:** Supplement consulting income with steady small tickets
- **Behaviour:** Available evenings and weekends; wants clear task scope before accepting

#### Persona 4: Neha — Admin (Internal)
- **Role:** SupportMitra operations manager
- **Goal:** Assign tickets to available freelancers, monitor SLA breaches, approve payouts
- **Behaviour:** Power user of admin dashboard; needs real-time visibility

---

## 4. Service Catalog

### Service Types and Pricing

| Service Key | Service Name | Resolution Fee | Typical Scope |
|---|---|---|---|
| `desktop` | Desktop / Laptop Support | ₹499 | Remote troubleshooting, driver issues, antivirus, connectivity |
| `linux` | Linux Provisioning | ₹999 | Server setup, package management, systemd, automation |
| `windows` | Windows Provisioning | ₹999 | Windows Server, Active Directory, DNS, DHCP, GPO |
| `patching` | OS Patching | ₹799 | Managed patching for Windows and Linux nodes |
| `security` | Security Hardening | ₹1,499 | Baseline CIS hardening, access control, vulnerability remediation |
| `vmware` | VMware / Hypervisor | ₹1,299 | ESXi host management, VM provisioning, storage troubleshooting |
| `sap` | SAP Basis Lite | ₹1,999 | Transport management, system health checks, user admin, basis tasks |

### SLA by Severity

| Severity | First Response | Resolution | Use Case |
|---|---|---|---|
| Low | 8 hours | 48 hours | Minor config change, documentation request |
| Medium | 4 hours | 24 hours | Non-critical service degradation |
| High | 2 hours | 8 hours | Service down, access blocked |
| Critical | 1 hour | 4 hours | Production outage, data loss risk |

---

## 5. System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────┐
│              CUSTOMER BROWSER                   │
│         React 18 + Vite + Tailwind CSS          │
└──────────────────────┬─────────────────────────┘
                       │ HTTPS (REST/JSON)
                       ▼
┌────────────────────────────────────────────────┐
│            API BACKEND (Django DRF)             │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │   Auth   │ │ Ticketing│ │    Payments    │  │
│  │ JWT+MFA  │ │  Engine  │ │ Razorpay/PayU  │  │
│  └──────────┘ └──────────┘ └────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │   SLA    │ │ Freelance│ │  Integrations  │  │
│  │  Engine  │ │   Ops    │ │ osTicket/Zammad│  │
│  └──────────┘ └──────────┘ └────────────────┘  │
└────┬──────────────┬──────────────┬─────────────┘
     │              │              │
     ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌────────────────┐
│PostgreSQL│  │  Redis   │  │ Object Storage │
│  (data) │  │(sessions,│  │ (attachments,  │
│         │  │  queue)  │  │   backups)     │
└─────────┘  └────┬─────┘  └────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │  Celery Workers  │
        │ ┌──────────────┐ │
        │ │ Notifications│ │
        │ │ SLA Beat     │ │
        │ │ Payout Batch │ │
        │ │ Integrations │ │
        │ └──────────────┘ │
        └──────────────────┘
```

### Component Responsibilities

| Component | Technology | Responsibility |
|---|---|---|
| Customer Portal | React + Tailwind | UI for customers and freelancers |
| API Backend | Django + DRF | Business logic, REST APIs |
| Auth Service | SimpleJWT + allauth | Token issuance, OAuth2, MFA |
| SLA Engine | Celery Beat | Periodic breach detection every 5 min |
| Payment Service | Razorpay / PayU SDK | Checkout, webhook processing, refunds |
| Notification Worker | Celery + SendGrid/Gupshup | Async email and WhatsApp delivery |
| Database | PostgreSQL 15 | Transactional data |
| Cache / Broker | Redis | Session cache, Celery task queue |
| Object Storage | DigitalOcean Spaces | Ticket attachments, DB backups |
| Ticketing Adapter | Custom connector | Sync to osTicket / Zammad |
| Monitoring | Sentry + Prometheus | Error tracking, metrics |

---

## 6. Technology Stack

| Layer | Technology | Version | Reason |
|---|---|---|---|
| Frontend framework | React | 18.x | Component model, ecosystem |
| Frontend build tool | Vite | 5.x | Fast HMR, ES module native |
| CSS framework | Tailwind CSS | 3.x | Utility-first, no design system needed at MVP |
| Backend framework | Django | 4.2 LTS | Batteries included, admin, ORM |
| REST API layer | Django REST Framework | 3.15+ | Serializers, viewsets, throttling |
| Authentication | djangorestframework-simplejwt | latest | JWT access + refresh tokens |
| OAuth2 / social auth | django-allauth | latest | Google/GitHub OAuth2 |
| Async tasks | Celery | 5.x | Task queue, scheduled jobs |
| Message broker | Redis | 7.x | Celery broker + session cache |
| Database | PostgreSQL | 15 | Reliable, JSONB support, UUID primary keys |
| Database adapter | psycopg2-binary | latest | Django ↔ PostgreSQL |
| DB URL parsing | dj-database-url | latest | 12-factor config |
| CORS | django-cors-headers | latest | API accessible from React dev server |
| Config management | python-dotenv | latest | `.env` file loading |
| Payment gateway | Razorpay Python SDK | latest | Primary India payment gateway |
| Email service | SendGrid / boto3+SES | latest | Transactional email |
| WhatsApp API | Gupshup / Twilio SDK | latest | Customer and freelancer notifications |
| File storage | boto3 + django-storages | latest | S3-compatible object storage |
| PDF generation | WeasyPrint or reportlab | latest | GST invoice PDFs |
| TOTP / MFA | django-otp | latest | TOTP-based MFA |
| Containerization | Docker + Docker Compose | latest | Local dev and deployment |
| CI/CD | GitHub Actions | — | Lint, test, build, deploy pipeline |
| Monitoring | Sentry (errors) + Prometheus | — | Application observability |
| Logging | structlog | latest | JSON structured logging |
| Web server | Gunicorn + Nginx | latest | Production WSGI server |
| SSL | Let's Encrypt / Certbot | — | Free TLS certificates |
| CDN | Cloudflare (free tier) | — | Frontend asset caching |

---

## 7. Project Structure

```
SupportMitra/
├── .env.example                    # Environment variable template (committed)
├── .env                            # Actual secrets (never committed)
├── .gitignore
├── docker-compose.yml              # Local development orchestration
├── docker-compose.prod.yml         # Production overrides
├── Dockerfile.backend
├── Dockerfile.frontend
├── DEVELOPMENT_PLAN.md
├── PROJECT_DOCUMENTATION.md
├── README.md
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt        # Dev-only: pytest, black, flake8, etc.
│   ├── .env                        # Backend secrets
│   │
│   ├── supportmitra/               # Django project config
│   │   ├── __init__.py
│   │   ├── settings.py             # Base settings (reads from .env)
│   │   ├── settings_prod.py        # Production overrides
│   │   ├── urls.py                 # Root URL router
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   ├── support_app/                # Core application
│   │   ├── models.py               # All ORM models
│   │   ├── serializers.py          # DRF serializers
│   │   ├── views.py                # API views
│   │   ├── urls.py                 # App URL patterns
│   │   ├── admin.py                # Django admin registration
│   │   ├── permissions.py          # Custom DRF permission classes
│   │   ├── tasks.py                # Celery async tasks
│   │   ├── signals.py              # Django model signals
│   │   ├── services/               # Business logic layer
│   │   │   ├── ticket_service.py
│   │   │   ├── payment_service.py
│   │   │   ├── sla_service.py
│   │   │   ├── notification_service.py
│   │   │   └── payout_service.py
│   │   ├── integrations/           # External system connectors
│   │   │   ├── osticket.py
│   │   │   ├── zammad.py
│   │   │   └── razorpay_client.py
│   │   └── migrations/
│   │
│   └── tests/
│       ├── test_auth.py
│       ├── test_tickets.py
│       ├── test_payments.py
│       └── test_sla.py
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   │
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/                    # Axios API client + endpoint functions
│       │   ├── client.js           # Axios instance with JWT interceptor
│       │   ├── auth.js
│       │   ├── tickets.js
│       │   └── payments.js
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.jsx
│       │   │   └── Footer.jsx
│       │   ├── tickets/
│       │   │   ├── TicketCard.jsx
│       │   │   ├── TicketForm.jsx
│       │   │   └── TicketDetail.jsx
│       │   └── ui/                 # Reusable primitives (Button, Badge, Modal)
│       ├── pages/
│       │   ├── Landing.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── NewTicket.jsx
│       │   └── admin/
│       │       ├── AdminDashboard.jsx
│       │       └── FreelancerList.jsx
│       ├── hooks/                  # Custom React hooks
│       │   ├── useAuth.js
│       │   └── useTickets.js
│       └── store/                  # State management (Zustand or Context)
│           └── authStore.js
│
└── .github/
    └── workflows/
        ├── ci.yml                  # Lint + test on every PR
        └── deploy.yml              # Deploy to production on main merge
```

---

## 8. Database Schema

### Entity Relationship Overview

```
customers ─────────────< tickets >──────────── freelancers
    │                      │
    │                      ├──< ticket_comments
    │                      ├──< ticket_attachments
    │                      ├──< sla_logs
    │                      └──< freelancer_logs
    │
    ├──< payments
    └──< subscriptions

audit_logs (references any entity by entity_type + entity_id)
csat_surveys ──── tickets + customers
sla_policies (reference table, not per-ticket)
```

### Table Definitions

#### `customers`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         INT UNIQUE FK → auth_user(id)   -- Django built-in user
company         VARCHAR(255)
phone           VARCHAR(32)
address         TEXT
plan            VARCHAR(32) DEFAULT 'free'       -- free | silver | gold | platinum
gstin           VARCHAR(15)                      -- GST registration number (B2B)
oauth_provider  VARCHAR(64)                      -- google | github | null
oauth_id        VARCHAR(255)
mfa_enabled     BOOLEAN DEFAULT FALSE
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `freelancers`
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id           INT UNIQUE FK → auth_user(id)
skills            TEXT                             -- comma-separated tags
availability      VARCHAR(32)                      -- full_time | part_time | ad_hoc
rating            NUMERIC(3,2) DEFAULT 0.0         -- 0.00–5.00
active            BOOLEAN DEFAULT TRUE
payout_mode       VARCHAR(32)                      -- bank_transfer | upi
payout_details    JSONB                            -- encrypted at application layer
contract_signed   BOOLEAN DEFAULT FALSE
onboarding_status VARCHAR(32) DEFAULT 'pending'    -- pending | approved | suspended
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
```

#### `tickets`
```sql
id                 UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id        UUID FK → customers(id)
ticket_number      VARCHAR(16) UNIQUE              -- TKT-00001, auto-generated
title              VARCHAR(255) NOT NULL
description        TEXT
service_type       VARCHAR(32)                     -- desktop | linux | windows | patching | security | vmware | sap
severity           VARCHAR(16) DEFAULT 'medium'    -- low | medium | high | critical
status             VARCHAR(32) DEFAULT 'open'      -- open | assigned | in_progress | resolved | closed
assigned_to        UUID FK → freelancers(id) NULL
remote_session_url VARCHAR(512)                    -- AnyDesk / Zoho Assist link
external_ticket_id VARCHAR(255)                    -- osTicket / Zammad ID
notes              TEXT
created_at         TIMESTAMPTZ DEFAULT now()
updated_at         TIMESTAMPTZ DEFAULT now()
resolved_at        TIMESTAMPTZ NULL
```

#### `ticket_comments`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
ticket_id    UUID FK → tickets(id)
author_id    UUID NOT NULL
author_type  VARCHAR(16)    -- customer | freelancer | admin
body         TEXT NOT NULL
created_at   TIMESTAMPTZ DEFAULT now()
```

#### `ticket_attachments`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
ticket_id    UUID FK → tickets(id)
file_name    VARCHAR(255)
storage_url  VARCHAR(1024)   -- pre-signed or permanent URL in object storage
file_size    INT             -- bytes
mime_type    VARCHAR(128)
uploaded_by  UUID
uploaded_at  TIMESTAMPTZ DEFAULT now()
```

#### `payments`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id         UUID FK → customers(id)
ticket_id           UUID FK → tickets(id) NULL
subscription_id     UUID FK → subscriptions(id) NULL
amount              NUMERIC(10,2) NOT NULL
gst_amount          NUMERIC(10,2) DEFAULT 0
currency            VARCHAR(3) DEFAULT 'INR'
invoice_number      VARCHAR(64) UNIQUE
payment_type        VARCHAR(32)    -- consulting_fee | resolution_fee | subscription | refund
gateway             VARCHAR(32)    -- razorpay | payu
gateway_payment_id  VARCHAR(255)
gateway_order_id    VARCHAR(255)
status              VARCHAR(32)    -- pending | completed | failed | refunded
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `subscriptions`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id   UUID FK → customers(id)
plan          VARCHAR(32)    -- silver | gold | platinum
billing_cycle VARCHAR(16)    -- monthly | annual
status        VARCHAR(16)    -- active | cancelled | expired
tickets_used  INT DEFAULT 0
started_at    TIMESTAMPTZ
expires_at    TIMESTAMPTZ
created_at    TIMESTAMPTZ DEFAULT now()
```

#### `sla_policies`
```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
service_type            VARCHAR(32)
severity                VARCHAR(16)
plan                    VARCHAR(32) DEFAULT 'default'
first_response_seconds  INT NOT NULL
resolution_seconds      INT NOT NULL
```

#### `sla_logs`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
ticket_id       UUID FK → tickets(id)
event           VARCHAR(32)    -- created | assigned | first_response | resolved | breach
timestamp       TIMESTAMPTZ DEFAULT now()
target_seconds  INT
actual_seconds  INT
status          VARCHAR(16)    -- met | missed | pending
notes           TEXT
```

#### `freelancer_logs`
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
freelancer_id  UUID FK → freelancers(id)
ticket_id      UUID FK → tickets(id)
action         VARCHAR(128)
details        TEXT
timestamp      TIMESTAMPTZ DEFAULT now()
```

#### `csat_surveys`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
ticket_id    UUID UNIQUE FK → tickets(id)
customer_id  UUID FK → customers(id)
score        INT CHECK (score BETWEEN 1 AND 5)
comment      TEXT
submitted_at TIMESTAMPTZ DEFAULT now()
```

#### `audit_logs`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL
user_type   VARCHAR(16)   -- customer | freelancer | admin
entity      VARCHAR(64)   -- table name, e.g. "tickets"
entity_id   UUID
action      VARCHAR(64)   -- created | updated | deleted | assigned | payment_made
metadata    JSONB
ip_address  INET
created_at  TIMESTAMPTZ DEFAULT now()
```

---

## 9. API Reference

Base URL: `https://api.supportmitra.in/api/`

All authenticated endpoints require: `Authorization: Bearer <access_token>`

### 9.1 System

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health/` | None | Health check — returns `{"status": "ok"}` |

### 9.2 Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register/` | None | Register new customer account |
| POST | `/auth/login/` | None | Obtain JWT access + refresh tokens |
| POST | `/auth/logout/` | Bearer | Blacklist refresh token |
| POST | `/auth/token/refresh/` | None | Exchange refresh token for new access token |
| POST | `/auth/password-reset/` | None | Send password reset email |
| POST | `/auth/password-reset/confirm/` | None | Confirm reset with token + new password |
| GET | `/auth/oauth/google/` | None | Initiate Google OAuth2 flow |
| POST | `/auth/oauth/callback/` | None | Handle OAuth2 callback |
| POST | `/auth/mfa/setup/` | Bearer | Generate TOTP secret and QR code |
| POST | `/auth/mfa/verify/` | Bearer | Verify TOTP code, enable MFA |

**Register request:**
```json
{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "company": "Acme Pvt Ltd",
  "phone": "+91 98765 43210"
}
```

**Login response:**
```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>",
  "user": {
    "id": 1,
    "email": "user@company.com",
    "username": "user@company.com"
  }
}
```

### 9.3 Customer Profile

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/customers/me/` | Bearer | Get own profile |
| PATCH | `/customers/me/` | Bearer | Update profile (company, phone, address, gstin) |
| GET | `/customers/me/subscriptions/` | Bearer | List active subscriptions |

### 9.4 Services

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/services/` | None | List all service categories with keys and names |

### 9.5 Tickets

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tickets/` | Bearer | List own tickets (paginated, filterable) |
| POST | `/tickets/` | Bearer | Create new ticket (triggers consulting fee checkout) |
| GET | `/tickets/{id}/` | Bearer | Get ticket detail |
| PATCH | `/tickets/{id}/` | Bearer | Update ticket (customer can only update description/notes before assignment) |
| GET | `/tickets/{id}/comments/` | Bearer | List comments on a ticket |
| POST | `/tickets/{id}/comments/` | Bearer | Add a comment |
| GET | `/tickets/{id}/attachments/` | Bearer | List attachments |
| POST | `/tickets/{id}/attachments/` | Bearer | Upload a file attachment |
| POST | `/tickets/{id}/csat/` | Bearer | Submit CSAT survey (only after resolved/closed) |

**Create ticket request:**
```json
{
  "title": "Cannot SSH into production server after reboot",
  "description": "Server at 10.0.0.5 is not accepting SSH connections after kernel update last night.",
  "service_type": "linux",
  "severity": "high"
}
```

**Create ticket response:**
```json
{
  "id": "a1b2c3d4-...",
  "ticket_number": "TKT-00042",
  "title": "Cannot SSH into production server after reboot",
  "service_type": "linux",
  "severity": "high",
  "status": "open",
  "created_at": "2026-05-03T10:30:00+05:30",
  "checkout_url": "https://razorpay.com/checkout/..."
}
```

**Ticket list query parameters:**
- `status` — filter by status (open, assigned, in_progress, resolved, closed)
- `service_type` — filter by service
- `severity` — filter by severity
- `page` — pagination page number

### 9.6 Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/checkout/` | Bearer | Initiate payment order with gateway |
| POST | `/payments/webhook/` | None (HMAC-signed) | Gateway payment event webhook |
| GET | `/payments/{id}/` | Bearer | Get payment detail |
| GET | `/payments/{id}/invoice/` | Bearer | Download GST invoice PDF |
| GET | `/customers/{id}/payments/` | Bearer | List payments for a customer |

### 9.7 Subscriptions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/subscriptions/plans/` | None | List available subscription plans with pricing |
| POST | `/subscriptions/` | Bearer | Subscribe to a plan |
| PATCH | `/subscriptions/{id}/` | Bearer | Upgrade or downgrade plan |
| DELETE | `/subscriptions/{id}/` | Bearer | Cancel subscription |

### 9.8 Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications/` | Bearer | List in-app notifications (unread first) |
| PATCH | `/notifications/{id}/read/` | Bearer | Mark notification as read |
| POST | `/notifications/preferences/` | Bearer | Set email/WhatsApp toggle preferences |

### 9.9 Admin — Ticket Management

All `/admin/` endpoints require `is_staff=True` or admin role.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/tickets/` | Admin | List all tickets with filters |
| POST | `/admin/tickets/{id}/assign/` | Admin | Assign ticket to a freelancer |
| PATCH | `/admin/tickets/{id}/status/` | Admin | Force-update ticket status |
| GET | `/admin/sla/` | Admin | SLA compliance report |
| GET | `/admin/csat/` | Admin | CSAT scores and comments |

### 9.10 Admin — Freelancer Management

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/freelancers/` | Admin | List all freelancers |
| POST | `/admin/freelancers/` | Admin | Register a new freelancer |
| PATCH | `/admin/freelancers/{id}/` | Admin | Update profile, approve, or suspend |
| GET | `/admin/payouts/` | Admin | List pending payout records |
| POST | `/admin/payouts/{id}/` | Admin | Mark payout as processed |

### 9.11 Integrations

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/integrations/osticket/sync/` | Admin | Push ticket to osTicket |
| POST | `/integrations/zammad/sync/` | Admin | Push ticket to Zammad |

### 9.12 Dashboard / Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/summary/` | Admin | Total tickets, open, SLA breach count, revenue |
| GET | `/dashboard/sla/` | Admin | SLA met vs. missed breakdown by service |
| GET | `/dashboard/revenue/` | Admin | Revenue by period and service type |
| GET | `/dashboard/csat/` | Admin | CSAT average and distribution |
| GET | `/dashboard/freelancer-utilization/` | Admin | Tickets per freelancer, avg resolution time |

---

## 10. Authentication & Authorization

### Token Flow

```
1. Customer calls POST /auth/login/ with email + password
2. Server returns: access_token (15 min TTL) + refresh_token (7 day TTL)
3. Frontend stores tokens (memory for access, httpOnly cookie for refresh)
4. Every API request sends: Authorization: Bearer <access_token>
5. On 401, frontend calls POST /auth/token/refresh/ to get new access token
6. On refresh expiry (7 days), user is logged out
```

### OAuth2 Flow (Google)

```
1. Customer clicks "Sign in with Google"
2. Frontend redirects to GET /auth/oauth/google/ → redirects to Google
3. Google returns to POST /auth/oauth/callback/ with authorization code
4. Backend exchanges code for profile; creates user if new
5. Returns same JWT tokens as regular login
```

### MFA Flow (TOTP)

```
1. Authenticated user calls POST /auth/mfa/setup/
2. Server returns TOTP secret + QR code image URL
3. User scans QR in Google Authenticator / Authy
4. User calls POST /auth/mfa/verify/ with 6-digit code to activate
5. On subsequent logins: after password, server returns { mfa_required: true }
6. User submits TOTP code; server validates and returns full JWT pair
```

### Role-Based Access Control

| Role | Who | Permissions |
|---|---|---|
| `customer` | Registered portal users | Own tickets, own payments, own profile |
| `freelancer` | Vetted support staff | Assigned tickets, own freelancer profile, comment on assigned tickets |
| `admin` | SupportMitra operators | All tickets, all freelancers, payouts, analytics, system config |

Permission enforcement is done via custom DRF permission classes in `support_app/permissions.py`.

---

## 11. Ticket Lifecycle

### State Machine

```
            ┌─────────────────────────────────┐
            │        Ticket Created            │
            │    Status: OPEN                  │
            │    SLA clock starts              │
            └────────────────┬────────────────┘
                             │ Admin assigns freelancer
                             ▼
            ┌─────────────────────────────────┐
            │    Status: ASSIGNED              │
            │    Freelancer notified           │
            │    First response SLA starts     │
            └────────────────┬────────────────┘
                             │ Freelancer begins work
                             ▼
            ┌─────────────────────────────────┐
            │    Status: IN_PROGRESS           │
            │    Customer updated via notif    │
            └────────────────┬────────────────┘
                             │ Freelancer marks resolved
                             ▼
            ┌─────────────────────────────────┐
            │    Status: RESOLVED              │
            │    Resolution fee captured       │
            │    CSAT survey sent              │
            └────────────────┬────────────────┘
                             │ Customer confirms OR 48hr auto-close
                             ▼
            ┌─────────────────────────────────┐
            │    Status: CLOSED                │
            │    Freelancer payout queued      │
            │    Freelancer rating updated     │
            └─────────────────────────────────┘

At any stage: SLA breach detected → admin alerted → escalation triggered
```

### Ticket Number Generation

Ticket numbers follow the format `TKT-NNNNN` where NNNNN is a zero-padded sequential integer. Generated by a database sequence on insert, never reused.

### Ticket Creation Triggers

When a ticket is created:
1. Consulting fee payment order is created with Razorpay/PayU
2. Customer is redirected to payment checkout
3. On successful payment webhook: ticket status set to `open`, SLA clock starts
4. Admin receives a new-ticket notification
5. Ticket sync to osTicket / Zammad queued as Celery task

---

## 12. Payment Flow

### Consulting Fee Flow (Pay-Per-Ticket)

```
Customer → POST /tickets/           → Backend creates ticket (status: pending_payment)
         ← checkout_url             ← Backend creates Razorpay order
Customer → Razorpay hosted checkout → Customer pays ₹299
Razorpay → POST /payments/webhook/  → Backend validates HMAC signature
                                    → Payment record updated to 'completed'
                                    → Ticket status set to 'open'
                                    → GST invoice PDF generated
                                    → Invoice email sent to customer
```

### Resolution Fee Flow

```
Freelancer marks ticket RESOLVED in admin dashboard
  → Backend creates resolution fee payment order
  → Customer receives WhatsApp/email notification with payment link
  → Customer pays resolution fee
  → On webhook: payment completed, resolution confirmed
  → Freelancer payout queued in payout_batch table
  → Ticket auto-closes in 48h if no customer dispute raised
```

### Refund Flow

```
Customer raises dispute within 7 days of ticket closure
  → Admin reviews dispute
  → If refund approved: POST /payments/{id}/refund/ (admin only)
  → Razorpay/PayU refund API called
  → Payment record status → 'refunded'
  → Freelancer payout for that ticket cancelled
  → Customer notified via email
```

### GST Invoice Structure

| Field | Value |
|---|---|
| Seller GSTIN | SupportMitra GSTIN (registered) |
| Buyer GSTIN | Customer's GSTIN (if B2B, optional) |
| Invoice Number | INV-YYYY-NNNNNN (sequential) |
| Taxable Amount | Payment amount ÷ 1.18 |
| CGST (9%) | Taxable × 0.09 |
| SGST (9%) | Taxable × 0.09 (intrastate) |
| IGST (18%) | Taxable × 0.18 (interstate, replaces CGST+SGST) |
| Total | Full amount paid by customer |

---

## 13. SLA Framework

### Default SLA Policy Matrix

| Service Type | Severity | First Response | Resolution |
|---|---|---|---|
| All | Critical | 1 hour | 4 hours |
| All | High | 2 hours | 8 hours |
| All | Medium | 4 hours | 24 hours |
| All | Low | 8 hours | 48 hours |

Subscription plan customers (Gold, Platinum) get tighter SLAs applied from `sla_policies` table.

### SLA Monitoring (Celery Beat)

A Celery Beat task runs every 5 minutes:

```
FOR EACH ticket WHERE status IN ('open', 'assigned', 'in_progress'):
    policy = lookup_sla_policy(service_type, severity, customer.plan)
    
    IF first_response not logged AND age > policy.first_response_seconds:
        log sla_event(event='breach', type='first_response')
        alert admin via email
        alert customer via WhatsApp

    IF status != 'resolved' AND age > policy.resolution_seconds:
        log sla_event(event='breach', type='resolution')
        alert admin + escalation_contact
        flag ticket as SLA_BREACHED
```

### Escalation Matrix

| Breach Level | Action | Contact |
|---|---|---|
| First response missed | Alert admin | Admin email + Slack |
| Resolution breach (< 50% overtime) | Alert admin + freelancer | Admin + freelancer WhatsApp |
| Resolution breach (> 50% overtime) | Escalate + reassign | Admin + backup freelancer |
| Resolution breach (> 100% overtime) | Trigger refund consideration | Senior admin |

---

## 14. Freelancer Operations

### Onboarding Process

```
Step 1: Admin invites freelancer via email (generates invite link)
Step 2: Freelancer completes profile (skills, availability, payout details)
Step 3: Admin reviews profile and verifies identity
Step 4: Freelancer signs NDA + Service Agreement (DocuSign or PDF upload)
Step 5: Admin sets status → 'approved'; freelancer gains platform access
Step 6: Freelancer completes orientation checklist (platform walkthrough)
```

### Freelancer Portal Features

- View assigned tickets
- Accept or decline a ticket assignment (with reason)
- Update ticket status (assigned → in_progress → resolved)
- Add work notes and comments visible to customer
- Attach session screenshots or evidence files
- Paste remote session URL (AnyDesk/Zoho Assist link)
- View own payout history and pending amounts

### Auto-Assignment Engine (Phase 2)

When a ticket is created, the engine ranks active freelancers by:
1. **Skill match** — freelancer.skills contains ticket.service_type tag
2. **Availability** — availability ≠ 'unavailable' and no active ticket in same severity
3. **Load** — fewest open assigned tickets
4. **Rating** — higher rated freelancer preferred on tie

If no auto-assignment match is found, admin is notified to assign manually.

### Payout Processing

- Payout calculated on ticket close: `resolution_fee × payout_percentage`
- Payouts are batched weekly (every Monday)
- Admin reviews payout batch in dashboard before disbursing
- Disbursement via bank transfer (NEFT/IMPS) or UPI
- Payout record updated with UTR number after transfer
- TDS deduction applied if freelancer's annual payout exceeds ₹30,000 (Section 194C)

### Freelancer Rating

After each CSAT survey submission:
```
new_rating = (current_rating × total_surveys + new_score) / (total_surveys + 1)
```
Rating displayed on freelancer profile; admin can view rating history.

---

## 15. Notification System

### Notification Events and Channels

| Event | Customer | Freelancer | Admin |
|---|---|---|---|
| Ticket opened (payment received) | Email + WhatsApp | — | Email |
| Ticket assigned | Email + WhatsApp | Email + WhatsApp | — |
| Freelancer first response | In-app | — | — |
| Ticket resolved | Email + WhatsApp | — | — |
| SLA first response breach | — | WhatsApp | Email + Slack |
| SLA resolution breach | Email | WhatsApp | Email + Slack |
| Payment completed | Email (invoice) | — | — |
| Refund processed | Email + WhatsApp | WhatsApp | — |
| CSAT survey request | Email + WhatsApp | — | — |
| Payout processed | — | WhatsApp + Email | — |
| Subscription renewal reminder | Email | — | — |

### Notification Architecture

```
API Event Occurs (e.g., ticket assigned)
  → Django signal fires / service call
  → Celery task enqueued: send_notification(event_type, recipients, context)
  → Celery worker picks up task
    → Renders email template with context
    → Sends via SendGrid/SES API
    → Renders WhatsApp template message
    → Sends via Gupshup/Twilio Business API
    → Creates in-app Notification record in DB
  → Delivery status logged in notification_log table
```

### Email Template Library

Templates stored as Django HTML templates with Tailwind inlined:

- `ticket_opened.html` — ticket details + payment receipt
- `ticket_assigned.html` — freelancer name, expected response time
- `ticket_resolved.html` — resolution summary + CSAT survey link
- `sla_breach.html` — breach details + apology + ETA
- `payment_receipt.html` — GST invoice summary
- `refund_processed.html` — refund amount + timeline
- `payout_processed.html` — payout amount + UTR number (freelancer)
- `welcome.html` — onboarding guide for new customers

---

## 16. Remote Support Process

### Remote Session Workflow

```
1. Freelancer confirms remote session is needed with customer via comments
2. Freelancer creates AnyDesk / Zoho Assist session
3. Freelancer pastes session URL into ticket's remote_session_url field
4. Customer receives WhatsApp notification with session link
5. Customer joins session; freelancer performs work
6. Session details (duration, actions) noted in ticket work_notes
7. Session URL stored in ticket record for audit trail
```

### Approved Remote Support Tools

| Tool | Use Case | Cost |
|---|---|---|
| AnyDesk | Windows/Linux remote desktop | Free for personal; ~$100/year business |
| Zoho Assist | Browser-based sessions, unattended access | Free tier available; ₹840/agent/month paid |
| TeamViewer | Alternative for clients already using it | Per-session or subscription |

### Security Rules for Remote Sessions

- Sessions must be customer-initiated (customer clicks link, not reverse connection)
- Session URL must be logged in the ticket before session starts
- Freelancers must not store customer credentials; use temporary sudo / admin grants
- Session recording recommended when customer approves (Zoho Assist supports this)
- Post-session: freelancer must document all changes made in ticket notes

---

## 17. DevOps & Infrastructure

### Infrastructure Overview

```
Internet → Cloudflare (CDN + DDoS) → Nginx (reverse proxy) → Gunicorn (Django)
                                   → Static files served from CDN
                                   → Media/attachments served from Object Storage
```

### VPS Specification (Initial)

| Resource | Spec | Provider |
|---|---|---|
| CPU | 2 vCPU | DigitalOcean Droplet / Linode |
| RAM | 4 GB | — |
| Storage | 80 GB SSD | — |
| Bandwidth | 4 TB/month | — |
| Estimated cost | ~$24/month | — |

Services co-located on one VPS at launch: Django + Celery + Redis + PostgreSQL + Nginx.
As load grows, split DB and Celery workers to separate droplets.

### Docker Compose Services

```yaml
services:
  db:          PostgreSQL 15
  redis:       Redis 7
  backend:     Django (Gunicorn)
  celery:      Celery worker
  celerybeat:  Celery Beat scheduler
  frontend:    Vite dev server (dev only; production serves static files via Nginx)
```

### CI/CD Pipeline (GitHub Actions)

#### On Pull Request (`ci.yml`):
```
1. Checkout code
2. Run Python lint: flake8 + black --check
3. Run JS lint: eslint
4. Run backend tests: pytest with coverage
5. Run frontend build: npm run build (catch build errors)
6. Run security scan: bandit (Python) + npm audit
```

#### On merge to `main` (`deploy.yml`):
```
1. Build backend Docker image → push to registry
2. Build frontend → npm run build → sync dist/ to object storage
3. SSH to VPS
4. Pull new backend image
5. Run: docker compose up -d --no-deps backend celery celerybeat
6. Run: python manage.py migrate
7. Run: python manage.py collectstatic --noinput
8. Health check: GET /health/ → assert 200
9. Notify Slack on success / failure
```

### Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production — auto-deploys on merge |
| `develop` | Integration — merged from feature branches |
| `feature/<name>` | Individual features or bug fixes |
| `hotfix/<name>` | Emergency production fixes, merged to main + develop |

---

## 18. Environment Configuration

### `.env.example`

```bash
# Django
SECRET_KEY=replace-with-50-char-random-string
DEBUG=0
ALLOWED_HOSTS=supportmitra.in,www.supportmitra.in
TIME_ZONE=Asia/Kolkata

# Database
DATABASE_URL=postgres://user:password@db:5432/supportmitra

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# PayU (alternative gateway)
PAYU_MERCHANT_KEY=xxxxxxxx
PAYU_MERCHANT_SALT=xxxxxxxxxxxxxxxxxxxxxxxx

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEFAULT_FROM_EMAIL=support@supportmitra.in

# WhatsApp (Gupshup)
GUPSHUP_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
GUPSHUP_PHONE_NUMBER=+918XXXXXXXXX

# Object Storage (DigitalOcean Spaces)
AWS_ACCESS_KEY_ID=xxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_STORAGE_BUCKET_NAME=supportmitra-assets
AWS_S3_ENDPOINT_URL=https://blr1.digitaloceanspaces.com
AWS_S3_REGION_NAME=blr1

# GST
GST_RATE=0.18
BUSINESS_GSTIN=29XXXXXXXXX1Z5
BUSINESS_NAME=SupportMitra Technologies

# Sentry
SENTRY_DSN=https://xxxx@sentry.io/xxxx

# Feature flags
ENABLE_WHATSAPP_NOTIFICATIONS=true
ENABLE_AUTO_ASSIGNMENT=false
```

### Production vs Development Differences

| Setting | Development | Production |
|---|---|---|
| `DEBUG` | `1` | `0` |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | `False` (specific origins only) |
| `DEFAULT_PERMISSION_CLASSES` | `AllowAny` | `IsAuthenticated` |
| Database | SQLite fallback | PostgreSQL (required) |
| Email backend | Console backend | SendGrid / SES |
| Static files | Vite dev server | Nginx + CDN |
| HTTPS | Not required | Required (enforced) |

---

## 19. Local Development Setup

### Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- Node.js 20+ (for frontend without Docker)
- Python 3.11+ (for backend without Docker)
- Git

### Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/your-org/SupportMitra.git
cd SupportMitra

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env: set SECRET_KEY, gateway credentials, etc.

# 3. Start all services
docker compose up --build

# 4. Run database migrations (first time)
docker compose exec backend python manage.py migrate

# 5. Create a superuser (admin)
docker compose exec backend python manage.py createsuperuser

# 6. Load seed data (optional)
docker compose exec backend python manage.py loaddata fixtures/seed.json
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/
- Django Admin: http://localhost:8000/admin/
- PostgreSQL: localhost:5432

### Frontend Development (without Docker)

```bash
cd frontend
npm install
npm run dev
```

### Backend Development (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=support_app

# Frontend lint
cd frontend
npm run lint

# Frontend build check
npm run build
```

---

## 20. Deployment Guide

### First-Time Server Setup

```bash
# 1. Provision DigitalOcean Droplet (Ubuntu 22.04 LTS, 4GB RAM)
# 2. SSH in as root, create deploy user
adduser deploy
usermod -aG sudo deploy
# Copy SSH public key to /home/deploy/.ssh/authorized_keys

# 3. Harden SSH
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# 4. Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 5. Install Docker
curl -fsSL https://get.docker.com | bash
usermod -aG docker deploy

# 6. Install Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx

# 7. Clone repository
su - deploy
git clone https://github.com/your-org/SupportMitra.git /opt/supportmitra
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name supportmitra.in www.supportmitra.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name supportmitra.in www.supportmitra.in;

    ssl_certificate /etc/letsencrypt/live/supportmitra.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/supportmitra.in/privkey.pem;

    # Frontend (served from CDN/object storage or local dist/)
    location / {
        root /opt/supportmitra/frontend/dist;
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    # Static files (Django)
    location /static/ {
        alias /opt/supportmitra/backend/staticfiles/;
    }
}
```

### SSL Certificate

```bash
certbot --nginx -d supportmitra.in -d www.supportmitra.in
# Auto-renewal is configured by Certbot. Verify:
systemctl status certbot.timer
```

### Production Start

```bash
cd /opt/supportmitra
cp .env.example .env   # fill in production values
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py collectstatic --noinput
```

---

## 21. Monitoring & Alerting

### Health Endpoints

| Endpoint | Checks |
|---|---|
| `GET /health/` | App running, DB reachable |
| `GET /readiness/` | All dependencies ready (DB, Redis, Celery) |
| `GET /liveness/` | Process alive (no deadlock) |

### Sentry Integration

Configure in `settings.py`:
```python
import sentry_sdk
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    traces_sample_rate=0.2,
    environment="production" if not DEBUG else "development",
)
```

Sentry captures:
- Unhandled exceptions and 5xx responses
- Celery task failures
- Slow database queries (> 500ms)
- Payment webhook failures

### Prometheus Metrics (via django-prometheus)

Key metrics exposed at `/metrics/`:
- `django_http_requests_total` — by method, status, view
- `django_http_request_duration_seconds` — latency histogram
- `celery_tasks_total` — by task name, state
- `db_connections_active` — PostgreSQL pool usage

### Alert Rules

| Alert | Condition | Notification |
|---|---|---|
| API error rate | > 5 errors/min for 3 min | Email + Slack |
| SLA breach | Any ticket breaches | Email admin + WhatsApp |
| Payment webhook failure | Any webhook 4xx/5xx | Immediate email alert |
| Celery worker down | No heartbeat for 2 min | Slack |
| Disk usage high | > 80% of VPS disk | Email |
| DB connection pool exhausted | > 90% pool used | Slack |
| SSL cert expiry | < 14 days to expiry | Email |

---

## 22. Security Model

### Authentication Security

- Access tokens: 15-minute TTL, signed with HS256
- Refresh tokens: 7-day TTL, stored in httpOnly cookie (not localStorage)
- Refresh token rotation: each use invalidates old refresh token
- MFA (TOTP): mandatory for admin and freelancer roles; optional for customers
- Failed login attempts: rate-limited to 5 per 15 minutes per IP (Redis-backed)
- Password policy: minimum 10 characters, cannot be common or similar to email

### API Security

- All endpoints use `IsAuthenticated` in production (except `/health/`, `/auth/login/`, `/auth/register/`)
- Admin endpoints require `IsAdminUser` permission class
- CORS: only allow `https://supportmitra.in` in production
- CSRF: enabled for session-based requests; exempt for Bearer token requests
- Rate limiting: 100 req/min for authenticated users, 20 req/min for public endpoints
- Payment webhook validation: Razorpay HMAC-SHA256 signature verified before processing

### Data Security

- All traffic encrypted via TLS 1.2+
- Sensitive fields (payout bank details) encrypted at application level using Fernet before storing in `payout_details` JSONB column
- Database backups encrypted with GPG before upload to object storage
- PII access logged in `audit_logs`
- Object storage bucket: private by default; attachments served via pre-signed URLs (1-hour expiry)

### Infrastructure Security

- UFW firewall: only ports 22, 80, 443 exposed
- Root SSH login disabled; key-based authentication only
- Docker containers run as non-root user
- No secrets in environment variables of Dockerfiles; injected at runtime via `.env`
- OS and dependency patching: monthly scheduled maintenance window
- Dependency scanning: Dependabot (GitHub) for automated PR alerts on vulnerabilities

### OWASP Top 10 Mitigations

| Risk | Mitigation |
|---|---|
| Injection | Django ORM (parameterized queries); DRF serializer validation |
| Broken Access Control | RBAC permission classes on every view |
| Cryptographic Failures | TLS everywhere; encrypted sensitive fields at rest |
| Insecure Design | Threat modeling before each major feature |
| Security Misconfiguration | Settings audit pre-deploy; `DEBUG=False` enforced |
| Vulnerable Components | Dependabot + `npm audit` + `bandit` in CI |
| Auth Failures | JWT rotation; MFA; rate limiting |
| SSRF | No user-controlled URL fetch; proxy not exposed |
| XSS | React DOM escaping; CSP header on frontend |
| CSRF | Django CSRF middleware; SameSite cookie |

---

## 23. Legal & Compliance

### Required Legal Documents

| Document | Audience | Owner | Review Cadence |
|---|---|---|---|
| Terms of Service | Customers | SupportMitra Legal | Annual |
| Privacy Policy (DPDP 2023) | Customers | SupportMitra Legal | On law change |
| Refund Policy | Customers | Product team | On pricing change |
| Acceptable Use Policy | Customers | Product team | Annual |
| Freelancer NDA | Freelancers | SupportMitra Legal | On engagement start |
| Freelancer Service Agreement | Freelancers | SupportMitra Legal | Annual |

### India DPDP Act 2023 Compliance

The Digital Personal Data Protection Act 2023 governs how SupportMitra handles personal data of Indian residents.

**Obligations:**
- Collect only data necessary for the stated purpose (data minimisation)
- Obtain explicit, informed consent at registration before collecting personal data
- Allow data principals (users) to:
  - Access their data: `GET /customers/me/`
  - Correct their data: `PATCH /customers/me/`
  - Request erasure: `DELETE /customers/me/` (30-day grace period)
- Notify the Data Protection Board of India (DPBI) within 72 hours of a data breach
- Appoint a Data Protection Officer (DPO) — required when processing large-scale personal data
- Do not transfer personal data outside India without adequate safeguards

**Implementation Checklist:**
- [ ] Consent checkbox at registration (non-pre-checked, links to Privacy Policy)
- [ ] Consent record stored with timestamp and IP address
- [ ] Data deletion workflow implemented and tested
- [ ] Breach notification runbook documented
- [ ] DPO contact published in Privacy Policy

### GST Compliance

- Register for GST if annual turnover exceeds ₹20 lakh (₹10 lakh for special category states)
- Charge 18% GST on all services
- Issue GST-compliant invoice on each payment (mandatory fields: seller GSTIN, invoice date, SAC code, tax breakup)
- File GST returns monthly (GSTR-1 for outward supplies, GSTR-3B for tax payment)
- SAC Code for IT support services: **998314** (Information technology (IT) consulting and support services)

### Freelancer Agreements

**NDA covers:**
- Customer identity and business information encountered during support
- Ticket contents and system architecture details
- Internal SupportMitra processes, pricing, and business data
- Validity: 2 years post-engagement

**Service Agreement covers:**
- Scope of permissible work (remote support only, no physical access)
- IP assignment: all deliverables belong to the customer (not freelancer)
- Non-solicitation: cannot approach SupportMitra customers directly for 1 year
- Payment terms: payout within 7 business days of ticket close
- Termination: either party with 7 days notice; immediate for policy violation
- Governing law: Indian law; jurisdiction: Pune courts

---

## 24. Development Roadmap

### Current Status (Month 1 Baseline)

| Component | Status |
|---|---|
| Landing page (React) | Done |
| Service catalog UI | Done |
| Docker Compose setup | Done |
| Django project skeleton | Done |
| Customer + Freelancer + Ticket models (basic) | Done |
| JWT auth (register, login, token refresh) | Done |
| Ticket CRUD API | Done |
| Payments model | Not started |
| SLA logs model | Not started |
| Audit logs model | Not started |
| Celery + Redis | Not started |
| Payment gateway integration | Not started |
| GST invoice generation | Not started |
| Email notifications | Not started |
| WhatsApp notifications | Not started |
| Admin dashboard | Not started |
| Freelancer portal | Not started |

### Month-by-Month Milestones

| Month | Theme | Key Deliverable |
|---|---|---|
| 1 | Foundation | VPS live, full schema implemented, legal docs drafted, secrets secured |
| 2 | Core MVP | Payment integration, ticket flow end-to-end, GST invoices, email notifications |
| 3 | Pilot Launch | Freelancer portal, SLA monitoring, Celery workers, WhatsApp notifications |
| 4 | Operations | osTicket/Zammad sync, CSAT surveys, payout dashboard, AnyDesk integration |
| 5 | Scale & UX | MFA, Redis caching, knowledge base, subscription billing, mobile polish |
| 6 | Enterprise | Analytics dashboard, ServiceNow/Jira roadmap, RMM evaluation, NPS tracking |

### Backlog (Post-Month 6)

- Mobile app (React Native)
- Automated diagnostics — pre-ticket self-service checks
- AI-assisted ticket classification and freelancer routing
- RMM integration for proactive monitoring and auto-ticket creation
- Multi-language support (Hindi, Marathi)
- White-label offering for MSPs

---

## 25. Glossary

| Term | Definition |
|---|---|
| **SLA** | Service Level Agreement — the committed response and resolution time for a ticket |
| **SLA Breach** | When the actual response or resolution time exceeds the SLA target |
| **CSAT** | Customer Satisfaction Score — a 1–5 rating submitted after ticket closure |
| **NPS** | Net Promoter Score — likelihood to recommend, collected 30 days after first ticket |
| **Consulting Fee** | Non-refundable (if accepted) fee paid at ticket creation to cover diagnosis |
| **Resolution Fee** | Fee paid after successful resolution, the main revenue component |
| **Payout** | Payment to a freelancer for resolving a ticket |
| **TDS** | Tax Deducted at Source — Indian tax withheld on freelancer payouts above ₹30K/year |
| **GST** | Goods and Services Tax — 18% Indian tax on services |
| **GSTIN** | GST Identification Number — business's tax registration number |
| **DPDP Act** | Digital Personal Data Protection Act 2023 — India's data protection law |
| **DPO** | Data Protection Officer — person responsible for DPDP compliance |
| **SAC Code** | Services Accounting Code — India's tax code for classifying services |
| **Ticket Number** | Human-readable identifier (TKT-NNNNN) for a support case |
| **osTicket** | Open-source helpdesk ticketing system |
| **Zammad** | Open-source omnichannel support platform |
| **Celery Beat** | Celery's periodic task scheduler, used for SLA checks |
| **UPI** | Unified Payments Interface — India's real-time payment system |
| **NEFT/IMPS** | Bank transfer methods in India for freelancer payouts |
| **SMB** | Small and Medium Business |
| **RMM** | Remote Monitoring and Management — tools for proactive IT infrastructure monitoring |
| **MFA / TOTP** | Multi-Factor Authentication / Time-based One-Time Password |
| **RBAC** | Role-Based Access Control |
| **JWT** | JSON Web Token — stateless authentication token |

---

*SupportMitra — Built for Indian SMBs, powered by a trusted freelancer network.*
