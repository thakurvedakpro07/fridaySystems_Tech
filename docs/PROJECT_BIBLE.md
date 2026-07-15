# The ResolveHQ Project Bible

### The complete, beginner-friendly engineering reference for the ResolveHQ (SupportMitra) platform

---

## How to read this document

This document is written so that a 15-year-old who has never written a line of code, never seen a database, and never heard the word "API" can read it start to finish and come out the other side understanding **exactly** how ResolveHQ works — every screen, every button, every database table, every background job, every deployment step.

It is also written so that an experienced engineer joining the project can use it as a precise, accurate technical reference — every file path, every function name, every URL, and every field name in this document was read directly from the real source code in this repository. Nothing in this document is invented. Where something is uncertain, or where the code contradicts an older planning document, this document says so explicitly.

A few rules this document follows:

- **Every technical term is explained the first time it is used**, with a plain-English definition, a real-world analogy, a concrete example from this codebase, and — where useful — what would break if it were removed.
- **Every file path is real.** You can open your code editor, navigate to the exact path written here, and see the exact code described.
- **Every diagram is a picture of what actually exists**, not what is planned or hoped for. Planned-but-not-yet-built features (like real-time WebSocket push) are clearly labeled "NOT YET BUILT."
- **Nothing is hidden.** Known bugs, known gaps, and known rough edges are documented as honestly as the finished features.

### A note on scope and honesty

You asked for a document long enough to exceed 500 printed pages. This repository is a real, working, actively-developed product: roughly 10,400 lines of Python across the Django backend and roughly 24,000 lines of JavaScript/JSX across the React frontend, spread over more than 150 source files, 27 database migrations, 8 Docker containers, and dozens of API endpoints. Writing a literal, word-for-word walkthrough of every single line of every single one of the roughly 230 source files in this repository — while technically what "explain every important file, never skip, explain line by line when necessary" could be read to mean — would produce a document so repetitive (the same component patterns, the same CRUD view patterns, repeated dozens of times) that it would stop being useful as a *reference* and would just become noise.

Instead, this document is organized to give you **complete, accurate coverage** of the system: every major architectural layer is explained in full depth with real code, every database table and every API endpoint is documented, every page and every reusable component in the frontend is described with its real purpose and real behavior, and the handful of files that are the true "engine room" of the product (the ticket state machine, the payment flow, the SLA engine, the permission system) are walked through in very close to line-by-line detail. Repetitive patterns (for example, the 14 nearly-identical Operations pages, or the 23 small UI components) are documented as a *pattern* once, in full, and then every individual instance is still listed and described — just without re-explaining the same mechanism 23 times.

This is the honest, most useful interpretation of "make this the single most comprehensive document about ResolveHQ."

---

## Table of Contents

0. [How to read this document](#how-to-read-this-document) *(above)*
1. [What is ResolveHQ?](#1-what-is-resolvehq)
2. [Complete Technology Stack](#2-complete-technology-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Folder Structure](#4-folder-structure)
5. [Every Important File](#5-every-important-file)
6. [Backend Deep Dive](#6-backend-deep-dive)
7. [Frontend Deep Dive](#7-frontend-deep-dive)
8. [Database Deep Dive](#8-database-deep-dive)
9. [API Deep Dive](#9-api-deep-dive)
10. [Authentication System](#10-authentication-system)
11. [Executive Analytics](#11-executive-analytics)
12. [Operations Command Center](#12-operations-command-center)
13. [Notifications](#13-notifications)
14. [Docker Infrastructure](#14-docker-infrastructure)
15. [Celery & Redis](#15-celery--redis)
16. [Testing](#16-testing)
17. [Deployment](#17-deployment)
18. [Feature Walkthroughs](#18-feature-walkthroughs)
19. [Code Flow — What Happens When...](#19-code-flow--what-happens-when)
20. [How to Modify the Project](#20-how-to-modify-the-project)
21. [Common Mistakes](#21-common-mistakes)
22. [Glossary](#22-glossary)
23. [Complete End-to-End Story: The Life of One Ticket](#23-complete-end-to-end-story-the-life-of-one-ticket)

---

# 1. What is ResolveHQ?

## 1.1 The problem it solves

Imagine you run a small business in Pune, India. You have 15 employees, three laptops that keep crashing, a small AWS account that hosts your website, and a Windows Server in the back office that handles your billing software. None of this is your job — your job is running the business. But when the Windows Server won't boot on a Monday morning, suddenly it *is* your job, and you have no idea who to call.

You could hire a full-time IT person. That costs a salary — in India, realistically ₹30,000–₹60,000 a month (roughly $360–$720) — for someone who might be busy for two hours a day and idle the rest. You could call a random local computer repair shop, but they might not know AWS or Kubernetes, and you have no way to verify their skill before they touch your production server. You could try to fix it yourself by watching YouTube videos, at the risk of making it worse.

**ResolveHQ exists to solve exactly this problem.** It is a website (and the backend system behind that website) where:

1. A business — the **customer** — describes their IT problem, picks how urgent it is, and pays a small upfront fee.
2. A **freelance engineer** (a vetted, independent IT professional, called a "Freelancer" in the database and "Engineer" in the product's user interface) who has proven they know that specific technology picks up the ticket and fixes it remotely.
3. Once the fix is confirmed working, the customer pays a second, larger fee, and the engineer gets paid their share.

Think of it like a cross between **Uber** (you request help, a vetted nearby professional accepts the job, you both rate the experience) and a **help desk ticketing system** (like the ones large companies use internally) — except the "help desk agents" are independent freelancers, not employees, and the whole relationship — problem, urgency, price, and resolution — is tracked through one ticket record from start to finish.

## 1.2 Why this business exists (the money story)

Every ticket in ResolveHQ has *two* payments attached to it, and understanding why explains the whole business model:

| Payment | Amount | When it's charged | Why it exists |
|---|---|---|---|
| **Consulting fee** | A flat ₹299 for every ticket, regardless of what's wrong | The moment the customer opens the ticket, before anyone even looks at it | This filters out people who aren't serious, and it funds the triage/assignment process even if the ticket turns out to be trivial or unresolvable |
| **Resolution fee** | Varies by *which service* (₹499 for basic Laptop/Desktop support up to ₹1,799 for Kubernetes or Infrastructure Automation) plus a *severity surcharge* (₹0 for Low severity up to ₹1,000 for Critical) | Only once the engineer has actually fixed the problem and the customer has confirmed it | This is "pay for outcomes" — the customer is not charged a large amount until they've actually gotten what they paid for |

Every resolution fee is then split: **65% goes to the engineer who did the work, and 35% stays with the ResolveHQ platform.** That 35% is how the business makes money — it pays for the platform itself (the servers, the payment processing, the person who vets engineers) and is the company's profit margin. This exact math — `ENGINEER_SHARE = 0.65`, `PLATFORM_SHARE = 0.35` — is written directly into the code (`backend/support_app/services/service_catalog.py`), and it is the single most important number in the entire business, because every other financial calculation in the system (payouts, executive revenue reports, invoices) is built on top of it.

**Real-world analogy:** this is exactly how Upwork or Fiverr take a cut of every freelance job, or how a taxi-hailing app takes a cut of every fare. The platform's value is *matching* the right expert to the right problem quickly, safely, and with money already handled — and it charges a percentage for providing that matching + trust + payment infrastructure.

## 1.3 A real-world scenario, start to finish

**The customer:** Priya runs a 12-person marketing agency in Bengaluru. Her office WiFi router is fine, but the shared Windows Server that stores all her client project files has started throwing a "disk full" error, and nobody in her office knows how to safely free up space without deleting something important.

**The company:** ResolveHQ Technologies (in the code, `BUSINESS_NAME = "SupportMitra Technologies"` — SupportMitra is the internal/original name, ResolveHQ is the customer-facing brand) — a small SaaS company that runs the platform, employs no engineers directly, but vets and onboards freelance engineers.

**The typical workflow:**

1. Priya visits the ResolveHQ website, creates an account, and clicks "New Ticket."
2. She selects **Server Administration Support** (one of eight service categories) and describes the disk-full error. She marks it **High** severity, because her team can't access files but the business isn't fully down.
3. The system shows her the price: ₹299 to open the ticket now, and — once fixed — a resolution fee of ₹999 (base fee for Server Administration Support) + ₹500 (High severity surcharge) + 18% GST on top = a clearly-itemized total.
4. She pays the ₹299 via Razorpay (India's equivalent of Stripe). The ticket moves from **pending_payment** to **open**.
5. Behind the scenes, an Operations Manager (a ResolveHQ staff member) or, in a future version, an automatic assignment system, assigns the ticket to Rahul, a freelance Windows Server engineer with a 4.8-star rating.
6. Rahul gets a notification, opens a remote session (AnyDesk/TeamViewer link), diagnoses that old log files are eating disk space, clears them safely, and marks the ticket **resolved**.
7. Priya gets notified, reviews Rahul's resolution summary, and clicks "Accept & Pay." She pays the resolution fee.
8. The ticket moves to **closed**. Priya rates the experience 5 stars (CSAT — Customer Satisfaction score). Rahul receives ₹974.35 (65% of the ₹1,499 pre-GST resolution fee) as a pending payout, which ResolveHQ's finance team later transfers to his bank account.
9. ResolveHQ generates a GST-compliant tax invoice PDF for Priya's accounting records.

Every single step above corresponds to real, working code in this repository, and Section 23 of this document walks through this exact scenario file-by-file.

## 1.4 Who uses the system (the six roles)

ResolveHQ has exactly six types of user accounts, called **roles** in the code. Every account has exactly one role, stored directly on the user record (`CustomUser.role`).

| Role (database value) | Displayed as | What they do | Can they access `/django-admin/`? |
|---|---|---|---|
| `customer` | Customer | Opens tickets, pays, chats with engineers, rates resolutions | No |
| `freelancer` | Engineer | Gets assigned tickets, fixes them, talks to customers, gets paid | No |
| `support_agent` | Support Agent | Internal staff — manages tickets, escalates issues, cannot see money | No |
| `operations_manager` | Operations Manager | Internal staff — manages tickets, engineers, and services; broader visibility than Support Agent | No |
| `finance_manager` | Finance Manager | Internal staff — manages payments, refunds, financial reports; cannot manage tickets | No |
| `admin` | Super Admin | Full control — everything above, plus user/role management and the Django admin panel | Yes |

Section 10 (Authentication System) explains exactly how the code tells these roles apart and enforces what each one can and cannot do — this table is the map you'll come back to throughout this document.

## 1.5 How ResolveHQ differs from ServiceNow, Jira, Zendesk, Freshdesk, and Salesforce

This comparison matters because on the surface, "a ticket goes through stages, someone gets assigned, there's a dashboard" sounds like every help-desk tool ever built. The differences are real and specific:

| | ServiceNow / Jira Service Management | Zendesk / Freshdesk | Salesforce Service Cloud | **ResolveHQ** |
|---|---|---|---|---|
| **Who resolves tickets** | Your own employees, already on payroll | Your own employees, already on payroll | Your own employees, already on payroll | **Independent freelance engineers**, not employed by the customer or (usually) by ResolveHQ |
| **Pricing model** | Per-seat license (you pay per employee who uses the tool), often thousands of dollars/month | Per-agent subscription | Per-user subscription, expensive | **Pay-per-ticket** — no subscription required, ₹299 to open + a resolution fee only when fixed |
| **Who is the customer** | Large enterprises with existing IT staff who need a *tool* to organize their own team's work | Mid-size companies with a support team | Large enterprises | **Small/medium businesses with *no* IT staff at all** — they're not buying a tool, they're buying the *people* too |
| **Payments built in** | No — it's a workflow tool, not a marketplace | No | No | **Yes** — Razorpay integration, invoicing, payouts to engineers are core, not an add-on |
| **Freelancer marketplace / vetting** | Not applicable | Not applicable | Not applicable | **Yes** — onboarding status (`pending` → `approved`), skills tags, ratings |
| **Primary market** | Large global enterprises | Global, all sizes | Large global enterprises | **Indian SMBs specifically** — GST-compliant invoicing, INR currency, Razorpay (not Stripe), `Asia/Kolkata` timezone, Hindi/Marathi language options baked into the ticket form |

In short: ServiceNow, Jira Service Management, Zendesk, Freshdesk, and Salesforce Service Cloud are all **tools that a company with its own support staff buys to organize that staff's work.** ResolveHQ is a **marketplace that supplies the staff too**, charges per outcome instead of per seat, and is purpose-built for a customer (a small Indian business) who has no IT department to begin with.

---

# 2. Complete Technology Stack

This section explains every major technology used in this repository. For each one: what it is, a real-world analogy, why *this specific project* uses it, what the alternatives were, and — where it matters — what would break if it were removed.

## 2.1 Python (backend language)

**What it is:** Python is a general-purpose programming language known for readable syntax (it looks almost like structured English) and a huge ecosystem of libraries. The backend of ResolveHQ — everything that runs on the server, handles data, and talks to the database — is written in Python.

**Real-world analogy:** if a website were a restaurant, Python is the kitchen's set of recipes and cooking techniques — the customer never sees it directly, but every dish (API response) depends on it.

**Why this project chose it:** Python paired with the Django framework (below) is one of the fastest ways to build a secure, database-backed web application, with a huge amount of "batteries included" — user authentication, an admin panel, database migrations, and form validation all come essentially for free. For a project that needs to move fast and stay maintainable (ticket systems, payments, permissions — all "boring but must be correct" business logic), Python's readability is a real asset: a new engineer can open `backend/support_app/services/payment_service.py` and understand the payment flow without knowing arcane syntax tricks.

**Version used:** Python 3.11 (see `Dockerfile.backend`: `FROM python:3.11-slim`).

**Alternatives:** Node.js/TypeScript (would let the same language run frontend and backend — this project didn't choose that), Ruby on Rails (similar productivity profile to Django), Java/Spring Boot (more verbose, often chosen for very large enterprise teams), Go (faster, but far less "batteries included" for this kind of CRUD-and-business-logic app).

**Disadvantage of Python here:** it is slower at raw computation than compiled languages like Go or Java, but for a ticketing/CRUD platform where the bottleneck is almost always the database, not the CPU, this doesn't matter in practice.

## 2.2 Django 4.2 (backend web framework)

**What it is:** Django is a "batteries-included" web framework written in Python. A **framework** is a large, pre-written skeleton of a web application — instead of writing "how does a web server receive a request and turn it into a response" from scratch, you fill in the blanks (models, views, URLs) and Django handles the plumbing.

**Real-world analogy:** if you were building a house, a framework is like buying a house that already has plumbing, electrical wiring, and a foundation installed — you just need to build the rooms (your specific business logic) on top.

**Why this project chose it:** Django gives ResolveHQ, for free: a database ORM (Section 2.6 explains this), a full admin panel (`/django-admin/` — used by staff to inspect/fix data directly, see `backend/support_app/admin.py`), a battle-tested user authentication system (which this project *extends* rather than replaces — see `CustomUser` in `backend/support_app/models.py`), and a migrations system that tracks every database schema change over time as a numbered, replayable script (see the 27 files in `backend/support_app/migrations/`).

**Version used:** Django 4.2.13 (`backend/requirements.txt`) — an LTS (Long-Term Support) release, meaning it receives security patches for years, which matters for a production system handling payments.

**What would break if removed:** everything. Django is the entire foundation of the backend — URL routing, the database layer, and the built-in admin panel all depend on it.

**Alternatives:** Flask or FastAPI (both "micro-frameworks" — much less built in, more manual wiring required, but more flexible), Ruby on Rails (a very similar philosophy to Django, different language).

## 2.3 Django REST Framework (DRF)

**What it is:** Django by itself is built to render full HTML pages. But ResolveHQ's frontend is a separate React application that needs to talk to the backend using **JSON** (a simple text format for structured data — explained in the Glossary) over HTTP, not HTML pages. Django REST Framework is an add-on to Django that makes it easy to build a **REST API** — a set of URLs that accept and return JSON instead of HTML.

**Real-world analogy:** DRF is like a translator standing between the Django "kitchen" (the database and business logic) and the React "dining room" (what the customer sees) — every dish (piece of data) has to be translated into a universal language (JSON) before it can be served.

**Why this project chose it:** it is the de facto standard way to build APIs with Django, and it provides two components ResolveHQ uses constantly: **Serializers** (`backend/support_app/serializers.py` — convert Python/database objects to and from JSON — see Section 6.3) and **Views** (`backend/support_app/views.py` — the functions/classes that actually run when a URL is requested — see Section 6.4).

**Version used:** djangorestframework 3.15.2.

**A specific, deliberate architectural choice:** this project's `views.py` docstring states the rule explicitly — "Views are `generics.*APIView` or `@api_view` function views, never DRF routers/viewsets." Most Django REST Framework tutorials teach `ViewSet` + `Router`, which auto-generates a full set of CRUD URLs from one class. This project deliberately avoids that pattern in favor of writing every URL by hand in `urls.py` and using DRF's lower-level `generics.ListAPIView`, `generics.RetrieveUpdateAPIView`, etc., or plain `@api_view` functions. **Why:** it keeps the URL list fully explicit and readable in one file (`urls.py`) rather than "magically" generated, and it makes each endpoint's specific permission rules easy to see and reason about individually — important in a system with six different user roles and very fine-grained permission rules (Section 10).

## 2.4 PostgreSQL 15

**What it is:** PostgreSQL (often called "Postgres") is a **relational database** — a system for storing structured data in **tables** (think: a very powerful, multi-user spreadsheet) with rows and columns, where tables can be linked to each other by shared IDs (called **foreign keys** — explained fully in Section 8).

**Real-world analogy:** if the application is a library, PostgreSQL is the actual shelving system and card catalog — the physical (well, digital) place where every book (piece of data) is stored, in order, cross-referenced, and retrievable.

**Why this project chose it:** PostgreSQL is free, open-source, extremely reliable, and supports advanced features this project actually uses — for example, `SELECT ... FOR UPDATE` row locking (used in `payment_service.py`'s `_generate_invoice_number()` to guarantee two simultaneous payments never get the same invoice number — see Section 6.6), JSON columns (`Freelancer.payout_details` and `AuditLog.metadata` are stored as `JSONField`), and composite database indexes for fast queries at scale (see the `idx_ticket_status_customer` style indexes throughout `models.py`).

**Version used:** `postgres:15-alpine` (a small, Alpine-Linux-based Docker image — see `docker-compose.yml`).

**A documented gotcha in this exact codebase:** `backend/supportmitra/settings.py` contains a large, deliberate warning comment about a real incident (dated 2026-05-20): if the `DATABASE_URL` environment variable is missing, Django's `dj_database_url.config()` silently falls back to a local SQLite file (`backend/db.sqlite3`) instead of failing loudly. Because this is a *different* database than the one running in the Postgres Docker container, any user created or data changed while accidentally running against SQLite is invisible to the real application. The settings file's rule, written directly into the code comments, is: **"NEVER run `python manage.py ...` directly in your terminal. ALWAYS use: `docker compose exec backend python manage.py ...`"**

**Alternatives:** MySQL/MariaDB (also relational, slightly different feature set), SQLite (used only as an accidental/CI fallback here, never for real data — too limited for concurrent multi-user production use), MongoDB (a NoSQL/document database — a poor fit here because ResolveHQ's data is deeply relational: tickets belong to customers, have many comments, many attachments, one payout, etc., and relational integrity — e.g. "you cannot delete a Customer who has tickets" via `on_delete=PROTECT` — is a core safety feature this project relies on).

## 2.5 Redis

**What it is:** Redis is an extremely fast, in-memory **key-value store** — think of it as a giant, temporary dictionary/hash-map that lives in RAM instead of on disk, so reading and writing to it is close to instantaneous.

**Real-world analogy:** if PostgreSQL is the library's permanent card catalog, Redis is a librarian's short-term memory / sticky-note pad — fast to check, but not meant to be the permanent record of anything important.

**Why this project chose it, and its three separate jobs in this codebase** (all documented directly in `settings.py`):
1. **Celery message broker** — the "to-do list" that background workers read from (Section 15).
2. **Celery result backend** — where the outcome of a background task is stored temporarily.
3. **Django's cache backend** (`CACHES["default"]`) — and, critically, the storage for **API rate-limiting counters** ("throttles" — e.g., "no more than 5 login attempts per minute per IP"). This is why a memory note in this project's history observed that rate-limit counters *persist across separate `pytest` process runs* — because Redis, unlike an in-process Python dictionary, keeps its state even after the Python process that used it exits.

**Version used:** `redis:7-alpine` Docker image; Python client `redis==5.0.4`.

**What would break if removed:** background email sending, the SLA-breach-checking scheduled task, and all API rate-limiting would stop working — the website's core ticket/payment flow would technically still function since Django can also serve simple requests without Redis, but retries, scheduling, and abuse-protection would be gone.

## 2.6 Django's ORM (Object-Relational Mapper) — a concept, not a separate technology

**What it is:** An ORM is the layer inside Django that lets you write Python code like `Ticket.objects.filter(status="open")` instead of writing raw SQL (`SELECT * FROM support_app_ticket WHERE status = 'open';`). Django translates your Python into the correct SQL for whatever database you're using (in this project, always PostgreSQL in real use).

**Real-world analogy:** an ORM is like a universal translator between two people who speak different languages (Python and SQL) — you speak your native language (Python), and it handles translating your intent into the other party's language (SQL) correctly.

**Why it matters here:** every single model in `backend/support_app/models.py` (Section 8) is a Python class, and every database query in `views.py` and `services/*.py` is written as Python method calls on those classes, never as raw SQL strings. This makes the code both safer (the ORM automatically escapes values, which prevents SQL injection attacks — a very common security vulnerability) and easier to read for someone who doesn't know SQL.

## 2.7 Django REST Framework SimpleJWT

**What it is:** an add-on package that implements **JWT (JSON Web Token)** authentication for DRF. JWTs are explained fully in Section 10, but in short: a JWT is a small, cryptographically-signed piece of text that proves "this request comes from a specific logged-in user" without the server needing to look anything up in a database on every single request.

**Why this project chose it:** because the frontend (React) and backend (Django) are two completely separate applications talking over HTTP, rather than one server rendering HTML pages with built-in browser sessions/cookies, JWTs are the standard, simple way to authenticate API requests from a JavaScript app.

**Version used:** djangorestframework-simplejwt 5.3.1, plus `rest_framework_simplejwt.token_blacklist` (an add-on used so that a "logged out" refresh token can be permanently invalidated — see `backend/supportmitra/settings.py`'s `INSTALLED_APPS` and `views.py`'s `logout_view`).

## 2.8 django-allauth

**What it is:** a Django add-on for handling authentication flows, including third-party ("social") login — in this project, specifically **Google Sign-In**.

**Why this project chose it:** rather than hand-writing OAuth2 (the protocol behind "Sign in with Google/Facebook/etc.") from scratch — a notoriously easy thing to get subtly wrong in a security-sensitive way — this project uses the well-tested `django-allauth` library's Google provider (`allauth.socialaccount.providers.google` in `INSTALLED_APPS`). Interestingly, the actual Google login *endpoint* in this codebase (`google_auth_view` in `views.py`) is hand-written on top of allauth's configuration rather than using allauth's own views directly — it manually verifies the Google access token against Google's `tokeninfo` and `userinfo` endpoints (see Section 10.5).

## 2.9 Celery and Celery Beat

**What Celery is:** a **background task queue**. Some work a web server needs to do — like sending an email — is slow (a network call to an email provider can take a second or more) and doesn't need to happen *before* the user gets their response. Celery lets Django say "do this task, but do it later, off to the side, so the user doesn't have to wait for it."

**Real-world analogy:** imagine a restaurant where the waiter (the web server) takes your order and immediately walks away to serve someone else, while the actual cooking (sending the email) happens in the kitchen (a separate Celery "worker" process) at its own pace. You get your food (the API response) fast; the slow part happens in parallel.

**What Celery Beat is:** a *scheduler* — a separate process whose only job is to say "it's been 5 minutes, time to run the SLA-breach-check task again," on a repeating schedule, forever. Think of it as a kitchen timer that keeps going off.

**Where this is used in ResolveHQ** (`backend/support_app/tasks.py`):
- `send_ticket_opened_email` and `send_ticket_assigned_notification` — background email sending, with automatic retries (`max_retries=3, default_retry_delay=60` — if sending fails, try again in 60 seconds, up to 3 times).
- `check_sla_breaches` — runs **every 300 seconds (5 minutes)**, scheduled via `CELERY_BEAT_SCHEDULE` in `settings.py`, checking every active ticket for a missed deadline (Section 6.6 / Section 15 have the full detail).
- `process_payout_batch` and `sync_ticket_to_osticket` — both currently **stub functions that only log a message and do nothing else** — they are placeholders for future work (the code is honest about this: `"payout processing is scheduled for Phase 4. No action taken."`).

**Version used:** celery 5.4.0, django-celery-beat 2.6.0 (this specific package stores the *schedule itself* in the database, editable from the Django admin panel, rather than only in a static Python file).

## 2.10 React 18

**What it is:** React is a JavaScript library for building user interfaces out of reusable **components** — small, self-contained pieces of UI (a button, a card, an entire page) that can manage their own data and re-render automatically when that data changes.

**Real-world analogy:** if a traditional website is like a printed poster (static, has to be entirely reprinted to change anything), a React application is like a living dashboard with digital gauges — each gauge (component) watches its own data and updates itself instantly without redrawing the whole poster.

**Why this project chose it:** ResolveHQ's frontend has a huge amount of shared, reusable UI — badges that show ticket status in six different colors, cards, tables, modals — used across dozens of different pages for six different user roles. React's component model is built exactly for this: `frontend/src/components/ui/Badge.jsx` is written once and reused everywhere a status pill needs to appear, guaranteeing visual consistency automatically.

**Version used:** react 18.3.1 / react-dom 18.3.1.

## 2.11 JavaScript (and JSX)

**What it is:** JavaScript is the programming language that runs inside web browsers (and, via Node.js, on servers too — though not in this project's backend). **JSX** is a syntax extension that lets you write HTML-like markup directly inside JavaScript code — e.g., `<Badge domain="ticketStatus" value={ticket.status} />` — which React then converts into real DOM elements.

**Why JSX instead of plain JavaScript + separate HTML templates:** it keeps a component's *structure* (what it looks like) and *logic* (what data it needs, what happens on click) in the same file, which is easier to reason about for a component-based UI than splitting them across separate files.

## 2.12 Vite

**What it is:** Vite ("veet," French for "fast") is a **build tool** and **development server** for modern JavaScript frontends. During development, it serves your source code to the browser almost instantly and updates the page live as you save files (called **Hot Module Replacement**, or HMR) without a full page reload. For production, it bundles and optimizes all your JavaScript/CSS into a small number of highly-compressed files.

**Real-world analogy:** Vite during development is like a photographer's instant Polaroid camera — you see the result the moment you make a change, instead of waiting for film to be developed. For production, it's like a professional print shop that takes your raw photos and produces a compact, print-ready album.

**Why this project chose it over the older "Create React App" tool:** Vite is dramatically faster, both for the dev server (near-instant startup, instant HMR) and for production builds. This project's `frontend/vite.config.js` also does deliberate production optimization: it manually splits vendor code into separate cacheable chunks (`vendor.js` for React/React-DOM/React Router, `state.js` for Zustand, `http.js` for Axios) so that when the app's *own* code changes on a new deploy, users' browsers don't have to re-download the (much larger, rarely-changing) third-party libraries — only the small app-code chunk.

**Version used:** vite 5.2.13.

## 2.13 Zustand (state management)

**What it is:** Zustand is a small, simple library for **global state management** in React — a way to share data (like "is the user logged in, and who are they?") between components that aren't directly nested inside each other, without manually passing that data down through every level of the component tree ("prop drilling").

**Real-world analogy:** Zustand is like a shared office whiteboard that any team member can read from or write on, instead of every piece of information having to be verbally passed person-to-person down a chain until it reaches whoever needs it.

**Why this project chose it over Redux (a more famous, older alternative):** Zustand requires far less boilerplate code for the same result. This project's entire authentication state — `frontend/src/store/authStore.js` — is one file, about 165 lines, holding `isAuthenticated`, `user`, `loading`, `error`, and `initializing`, plus the actions that change them (`setTokens`, `setUser`, `logout`, `initializeAuth`). Any component in the app can do `const user = useAuthStore((s) => s.user);` and instantly get the current logged-in user, fully reactively.

**Version used:** zustand 4.5.2.

## 2.14 Axios

**What it is:** Axios is a JavaScript library for making HTTP requests (the network calls a browser makes to a server) — an alternative to the browser's built-in `fetch()` function, with a friendlier API and more built-in features.

**Why this project chose it over `fetch()`:** Axios makes it easy to attach an "interceptor" — a function that runs automatically before every outgoing request or after every incoming response. This project uses that exact mechanism twice in one file (`frontend/src/api/client.js`):
1. A **request interceptor** automatically attaches the user's login token (`Authorization: Bearer <token>`) to every single outgoing API call, so no individual API function has to remember to do this itself.
2. A **response interceptor** automatically detects when a request fails with a `401 Unauthorized` (meaning the login token expired), silently fetches a fresh token using the "refresh token," retries the original request, and only redirects the user to the login page if that refresh *also* fails. This is the mechanism that lets a user stay logged in for days without ever manually logging in again, even though each individual access token only lives for 15 minutes (Section 10 explains this fully).

**Version used:** axios 1.7.2.

## 2.15 Tailwind CSS

**What it is:** CSS (Cascading Style Sheets) is the language that controls how a webpage *looks* — colors, spacing, fonts, layout. Tailwind CSS is a **utility-first CSS framework**: instead of writing custom CSS rules with your own class names (`.ticket-card { padding: 16px; border-radius: 8px; }`), you apply small, single-purpose, pre-built utility classes directly in your markup (`className="p-4 rounded-lg"`).

**Real-world analogy:** traditional CSS is like commissioning a custom-tailored suit for every single garment you own. Tailwind is like a well-stocked hardware store of interchangeable, labeled parts (a "4-unit padding" piece, an "8-pixel rounded corner" piece) that you snap together to build exactly what you need, fast, without writing a new pattern from scratch each time.

**Why this project chose it:** for a large application with dozens of pages built by (based on the git history and code comments) many different AI-assisted sessions over time, Tailwind keeps styling *consistent* and *co-located* with the markup — you can see exactly what a component looks like by reading its `className` attributes, without hunting through a separate CSS file. This project's `frontend/tailwind.config.js` also defines a custom color palette (a `brand` indigo/purple scale used throughout the UI) and custom animations (`fade-in`, `slide-up`, `skeleton-pulse`, etc.) that are reused everywhere via utility classes like `animate-fade-in`.

**Version used:** tailwindcss 3.4.4. **A documented gap:** this project has no `@tailwindcss/typography` plugin installed, so Markdown content (like Knowledge Base articles) cannot use Tailwind's `prose` class and is instead styled manually, field by field, in `frontend/src/components/kb/MarkdownRenderer.jsx`.

## 2.16 HTML and CSS (the fundamentals)

**What HTML is:** HyperText Markup Language — the actual structural language of every webpage. Every `<div>`, `<button>`, and `<input>` you see in this project's JSX files compiles down to real HTML elements in the browser. React/JSX doesn't replace HTML — it's a more convenient, component-based way of *generating* HTML.

**What CSS is:** the styling language that HTML elements are given classes from — in this project, almost entirely via Tailwind's utility classes rather than hand-written CSS rules, except for `frontend/src/index.css`, which holds the small amount of truly global styling (font imports, base resets) that doesn't fit the utility-class model.

## 2.17 Playwright

**What it is:** Playwright is a browser automation and end-to-end (E2E) testing tool. It launches a real browser (in this project, Chromium, configured in `frontend/playwright.config.js`), simulates a real user clicking around the actual running application, and asserts that the right things happened on screen.

**Real-world analogy:** if unit tests (Pytest, below) are like a mechanic checking each individual car part in isolation on a workbench, Playwright is a professional test driver actually driving the finished car around a track, checking that everything works together as a whole vehicle.

**Why this project uses it (and why in addition to Pytest, not instead of):** Pytest can verify that a Django view returns the correct JSON. It cannot verify that clicking the "Assign Engineer" button in the browser actually calls that view, updates the screen, and shows the right success message. Playwright is the only way to test the *whole system* — frontend and backend — working together, exactly as a real user would experience it. This project's tests log in as real seeded user accounts (`frontend/tests/e2e/fixtures/auth.js`, `global-setup.js`) rather than mocking authentication, so they exercise the real login flow, real JWT tokens, and the real backend.

**Version used:** @playwright/test ^1.61.1.

## 2.18 Pytest / pytest-django

**What it is:** Pytest is Python's most popular testing framework — a tool for writing small, automated checks ("tests") that verify a specific piece of code behaves correctly, and for running all of those checks quickly and reporting which ones pass or fail. `pytest-django` is an add-on that makes Pytest aware of Django's specific needs (a real, temporary test database, Django's settings system, etc.).

**Real-world analogy:** Pytest is like a factory quality-control checklist that runs automatically on every single product before it ships — instead of a human manually re-checking "does login still work?" after every code change, an automated test does it in milliseconds.

**Why both Pytest and Playwright exist in this one project:** they test at different *levels*. Pytest (`backend/tests/*.py`, 13 files) tests the backend in isolation — "does this specific Django view, given this specific input, return the correct response and correctly change the database?" Playwright tests the *whole system* end-to-end through a real browser. Both are necessary; neither replaces the other. (Section 16 covers this fully.)

**Version used:** pytest 8.2.1, pytest-django 4.8.0, pytest-cov 5.0.0 (coverage reporting), factory-boy 3.3.0 (a library for conveniently creating realistic fake database records inside tests).

## 2.19 Gunicorn

**What it is:** "Green Unicorn" — a **WSGI HTTP server** for running Python web applications in production. Django, by itself, comes with a tiny built-in development server (`python manage.py runserver`) that is explicitly *not* safe or fast enough for real production traffic. Gunicorn is the production-grade server that actually runs Django in this project whenever it's not on a developer's own laptop.

**Real-world analogy:** Django's code is the recipe; Gunicorn is the actual industrial kitchen with multiple cooking stations (worker processes) running that recipe simultaneously for many customers (requests) at once, instead of one home stovetop serving one customer at a time.

**How this project configures it:** `backend/gunicorn.conf.py` sets the number of worker processes using the classic formula `(2 × CPU cores) + 1`, a 60-second timeout per request, and automatic worker recycling after 1,000 requests (to prevent slow memory leaks from accumulating). In local development, `docker-compose.yml` runs Gunicorn with `--reload --workers 2` instead, so code changes are picked up without a manual restart.

**Version used:** gunicorn 22.0.0.

## 2.20 Nginx

**What it is:** Nginx (pronounced "engine-x") is a **reverse proxy** and **static file server**. In production, Nginx sits in front of everything, and is the *only* thing directly exposed to the internet.

**Real-world analogy:** Nginx is like the front desk / concierge of an office building — every visitor (internet request) talks to the front desk first, which then quietly routes them to the correct department (the API to Gunicorn/Django, static files served directly from disk, etc.) without visitors ever needing to know the building's internal layout.

**What this project's Nginx configuration actually does** (`nginx/nginx.conf`, used in the primary production deployment): terminates HTTPS/TLS (encrypts traffic using a Let's Encrypt certificate), redirects all plain HTTP to HTTPS, applies **rate limiting** at the network edge (a *second*, independent layer of protection on top of Django's own DRF throttles — e.g., `limit_req_zone ... rate=5r/m` for `/api/auth/login|register|token`), sets strict security headers (Content-Security-Policy, HSTS, X-Frame-Options — Section 14 covers these in full), serves the compiled React app's static files directly from disk (fast — no need to ask Django for a file that never changes), and proxies `/api/*` requests to Gunicorn.

**Version used:** referenced as `nginx:1.25-alpine` in the alternative fully-containerized frontend Dockerfile (`Dockerfile.frontend.prod`); the primary deployment path installs Nginx directly on the production server (a "VPS," or Virtual Private Server) via `apt install nginx`.

## 2.21 Docker and Docker Compose

**What Docker is:** Docker lets you package an application together with *everything it needs to run* (the exact version of Python, exact system libraries, etc.) into a single, portable unit called a **container** or **image**. A container runs identically on any machine that has Docker installed, regardless of what's actually installed on that machine's operating system.

**Real-world analogy:** a shipping container. Before standardized shipping containers existed, loading a ship was a slow, custom, error-prone process for every different type of cargo. A shipping container standardizes the *interface* (the size and shape) so any crane, truck, or ship can move it without caring what's inside. Docker does the same thing for software: it doesn't matter if your laptop runs Windows, Mac, or Linux — Docker guarantees the *exact same* Python 3.11 + PostgreSQL 15 + Redis 7 environment every time.

**What Docker Compose is:** a tool for defining and running a group of *multiple* related containers together as one system, described in a single YAML file (`docker-compose.yml`). ResolveHQ's development environment is six containers working together: `db` (PostgreSQL), `redis`, `backend` (Django/Gunicorn), `celery` (worker), `celerybeat` (scheduler), and `frontend` (Vite dev server) — Section 14 documents every one of these in complete detail, including every port, volume, and healthcheck.

**Why this project chose it:** it eliminates "works on my machine" problems entirely. A new engineer joining this project does not need to individually install Python 3.11, PostgreSQL 15, Redis 7, and Node.js 20 correctly configured — they run one command (`docker compose up --build`) and get an identical environment to every other developer and to production.

## 2.22 JWT (JSON Web Token)

Covered in depth in Section 10 (Authentication System) — introduced briefly here as part of the stack. A JWT is a compact, URL-safe, cryptographically signed string that represents a set of claims (like "user ID 123, role customer, expires at 3:45 PM"). Because it's *signed* (not encrypted, but tamper-evident), the server can trust the contents of a JWT it receives without needing to look anything up in a database — it just checks the signature is valid and hasn't expired.

## 2.23 Git and GitHub

**What Git is:** a **version control system** — software that tracks every change ever made to every file in this project, as a sequence of **commits** (snapshots), letting you see history, compare versions, and collaborate without overwriting each other's work.

**What GitHub is:** a website that *hosts* Git repositories in the cloud, and adds collaboration tools on top — Pull Requests (a way to propose and review a set of changes before merging them), Issues (a way to track bugs/features), and **GitHub Actions** (this project's CI/CD automation — see `.github/workflows/ci.yml` and `deploy.yml`, fully documented in Section 17).

**Real-world analogy:** Git is like a very detailed lab notebook where every experiment (change) is dated, attributed to whoever made it, and never erased — you can always flip back to see exactly what the code looked like at any point in the past.

## 2.24 Markdown

**What it is:** a lightweight text formatting language — this very document is written in Markdown. Headers use `#` symbols, bold text uses `**asterisks**`, lists use `-` dashes, and so on. It's designed to be readable as plain text *and* to render into nicely-formatted HTML.

**Where this project uses it beyond documentation:** Knowledge Base articles (`KBArticle.body` in the database) are stored as raw Markdown text and rendered into styled HTML in the browser using the `react-markdown` library (Section 7 covers `components/kb/MarkdownRenderer.jsx`).

## 2.25 Environment variables and `.env` files

**What they are:** small pieces of configuration (a database password, a secret signing key, a feature flag) that are kept *outside* the actual source code, in a separate file (`.env`) that is never committed to Git (`.gitignore` excludes it).

**Why this matters — and it matters a lot:** if a database password were hard-coded directly into `settings.py`, anyone with access to the source code (including, if the repository were ever made public, the entire internet) would have that password. Instead, `backend/supportmitra/settings.py` reads every sensitive value via `os.getenv("SOME_VAR")` or `os.environ["SOME_VAR"]`, and the actual secret values live only in `backend/.env` — a file that exists on each developer's machine and on the production server, but never in Git history. `backend/.env.example` and the root `.env.example` are the *templates* — safe-to-commit files listing every variable name with a placeholder or dummy value, and an explanation of what each one does, so a new developer knows exactly what to fill in.

## 2.26 `requirements.txt` and `requirements-dev.txt` (Python dependencies)

**What they are:** plain text files listing every third-party Python package this project depends on, and the exact version pinned (e.g., `Django==4.2.13`). `pip install -r requirements.txt` reads this file and installs every listed package.

**Why two files:** `backend/requirements.txt` lists packages needed to actually *run* the application in production (Django, DRF, Celery, Razorpay's SDK, etc.). `backend/requirements-dev.txt` lists packages only needed *while developing* — testing tools (Pytest), code formatters (`black`), linters (`flake8`), and a security scanner (`bandit`) — none of which should be installed in the production Docker image, both to keep it smaller and because there's no reason a production server needs a code formatter.

## 2.27 `package.json` and `package-lock.json` (JavaScript dependencies)

**What they are:** the JavaScript-world equivalent of `requirements.txt`. `frontend/package.json` lists every dependency (with a version *range*, e.g., `"react": "^18.3.1"` — the `^` means "any compatible version starting from 18.3.1"), plus the named **scripts** you can run (`npm run dev`, `npm run build`, `npm run lint`, `npm run test:e2e`). `frontend/package-lock.json` records the *exact* resolved version of every single package (including indirect, "sub-dependency" packages) that was actually installed, so that every developer and every deployment gets byte-for-byte identical dependencies, not just "a compatible version."

## 2.28 Node.js and npm

**What Node.js is:** a JavaScript runtime that lets JavaScript run *outside* a web browser — on a developer's laptop or on a server. This project doesn't use Node.js to run the actual production backend (that's Django/Python), but it uses Node.js as the engine that *builds* the frontend: running Vite, running Playwright, and running `npm` itself.

**What npm is:** "Node Package Manager" — the tool that reads `package.json` and downloads/installs every listed JavaScript dependency into a `node_modules` folder.

**Version used:** Node.js 20 (see `Dockerfile.frontend`: `FROM node:20-alpine`).

## 2.29 Every other library, at a glance

| Library | Where | What it does |
|---|---|---|
| `django-filter` 23.5 | Backend | Powers the Ops Ticket Queue's `?status=`, `?service_type=`, `?assigned_to=` filters via `OpsTicketFilterSet` in `views.py` |
| `django-cors-headers` 4.4.0 | Backend | Lets the browser (running the React app on a different port/origin during dev) make requests to the Django API without being blocked by browser security (CORS) |
| `python-dotenv` 1.0.1 | Backend | Loads variables from `backend/.env` into the Python process's environment |
| `whitenoise` 6.7.0 | Backend | Lets Gunicorn serve static files (CSS/JS for the Django admin panel) directly, without needing Nginx for that specific job |
| `razorpay` 1.4.1 | Backend | Official Python SDK for the Razorpay payment gateway — creating orders, verifying signatures, issuing refunds |
| `boto3` 1.34.102 + `django-storages` 1.14.3 | Backend | AWS S3 (or S3-compatible object storage) integration for file uploads — configured but, per the environment file comments, optional; local disk storage is the default |
| `sendgrid` 6.11.0 | Backend | Email delivery provider SDK, used in production (`EMAIL_BACKEND` is SMTP-based, pointed at SendGrid's SMTP relay) |
| `reportlab` 4.2.0 | Backend | PDF generation library — used by `invoice_pdf.py` to build GST tax invoices |
| `django-otp` 1.4.0 | Backend | Multi-factor authentication (MFA) library — `Customer.mfa_enabled` field exists in the database, but as of this reading, no MFA enrollment/verification views exist yet in `views.py`; this is installed but not yet wired up |
| `sentry-sdk` 2.3.1 | Backend | Error tracking — reports unhandled exceptions to Sentry.io in production (`SENTRY_DSN` environment variable) |
| `structlog` 24.2.0 | Backend | Structured (machine-parseable) logging library, installed as a dependency though `settings.py`'s `LOGGING` configuration uses Django's plain built-in logging, not structlog directly |
| `django-prometheus` 2.3.1 | Backend | Exposes a `/metrics` endpoint (staff-only) with request counts, database query timings, etc., for monitoring tools like Prometheus/Grafana |
| `Faker` 26.0.0 | Backend (dev) | Generates realistic fake names, companies, and text — used by the `seed_enterprise_demo` management command to build a large, realistic-looking demo dataset |
| `isort` 5.13.2 | Backend (dev) | Automatically sorts and organizes Python `import` statements consistently |
| `bandit` 1.7.8 | Backend (dev) | Scans Python code for common security mistakes (e.g., use of `eval()`, hardcoded passwords) — run in CI |
| `ipython` 8.24.0 + `django-extensions` 3.2.3 | Backend (dev) | A nicer interactive Python shell and extra `manage.py` commands (like `shell_plus`) for local debugging |
| `@react-oauth/google` 0.13.5 | Frontend | React components/hooks for the "Continue with Google" button |
| `framer-motion` 12.40.0 | Frontend | Animation library for React |
| `react-markdown` 9.1.0 | Frontend | Renders Markdown text (Knowledge Base article bodies) as styled React elements |
| `react-router-dom` 6.23.1 | Frontend | Client-side routing — maps URL paths like `/tickets/:id` to the correct React page component without a full page reload (`frontend/src/App.jsx`) |
| `eslint` 8.57.0 + plugins | Frontend (dev) | JavaScript/React code linter — **note:** as of this writing, no ESLint configuration file exists anywhere in this repository, so `npm run lint` fails immediately with a "couldn't find a configuration file" error. This is a pre-existing, known gap, not something broken by recent work. |
| `postcss` 8.4.38 + `autoprefixer` 10.4.19 | Frontend (dev) | CSS processing pipeline that Tailwind CSS runs on top of |

---

# 3. High-Level Architecture

## 3.1 The 30,000-foot view

ResolveHQ is a classic **client-server** application split into two independently-deployed halves that talk to each other only over HTTP, using JSON:

- **The frontend** — a React application that runs entirely inside the customer's web browser. It has no direct access to the database. It only knows how to render screens and make HTTP requests.
- **The backend** — a Django application that runs on a server. It is the *only* thing with direct access to the PostgreSQL database, the Redis cache/queue, the payment gateway, and the email provider.

This separation is deliberate and important: it means the backend has one single, auditable gatekeeper (Django REST Framework's permission system — Section 10) controlling every piece of data that ever leaves the database, no matter which of the six user roles is asking, and no matter whether the request comes from the real React app, a mobile app built later, or someone testing the API directly with `curl`.

```
                                    THE INTERNET
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │         Nginx (production only)        │
                      │  HTTPS, rate limiting, security headers│
                      │  routes /api/* → Django                │
                      │  routes /*     → React static files    │
                      └───────────────────┬─────────────────────┘
                                          │
                 ┌────────────────────────┼─────────────────────────┐
                 ▼                                                   ▼
    ┌─────────────────────────┐                       ┌─────────────────────────┐
    │   React app (browser)    │                       │  Gunicorn → Django/DRF   │
    │   pages/ components/     │  ── HTTP + JSON ──►    │  urls.py → views.py      │
    │   hooks/ api/ store/     │  ◄── HTTP + JSON ──    │  → serializers.py        │
    └─────────────────────────┘                       │  → services/*.py          │
                                                        └─────────────┬────────────┘
                                                                      │
                                          ┌───────────────────────────┼───────────────────────────┐
                                          ▼                           ▼                           ▼
                              ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
                              │   PostgreSQL 15     │      │      Redis 7        │      │  Outside services   │
                              │   (all real data)    │      │  Celery broker/     │      │  Razorpay, SendGrid, │
                              │                      │      │  result + cache/    │      │  Google OAuth        │
                              │                      │      │  rate-limit store    │      │                      │
                              └───────────────────┘      └─────────┬─────────┘      └───────────────────┘
                                                                     │
                                                                     ▼
                                                        ┌───────────────────────┐
                                                        │  Celery worker + Beat   │
                                                        │  send emails, check SLA │
                                                        │  breaches every 5 min    │
                                                        └───────────────────────┘
```

## 3.2 The request/response journey, one layer at a time

This is the single most important diagram in this document — every feature in ResolveHQ, no matter how complex, is built from this exact same sequence. Take, as a concrete example, an Operations Manager clicking "Assign" on a ticket in the Ops Ticket Queue:

```
 1. BROWSER
    The Ops Manager clicks the "Assign" button on frontend/src/pages/ops/OpsTicketQueue.jsx.
    │
    ▼
 2. REACT EVENT HANDLER
    A function inside OpsTicketQueue.jsx calls opsAssignTicket(ticketId, freelancerId)
    — a plain JavaScript function imported from frontend/src/api/ops.js.
    │
    ▼
 3. API LAYER (frontend/src/api/ops.js)
    opsAssignTicket() calls apiClient.post(`/ops/tickets/${ticketId}/assign/`, {...})
    — apiClient is the shared Axios instance from frontend/src/api/client.js.
    │
    ▼
 4. AXIOS INTERCEPTOR (frontend/src/api/client.js)
    Before the request leaves the browser, a request interceptor automatically
    attaches "Authorization: Bearer <access_token>" from sessionStorage.
    │
    ▼
 5. NETWORK
    In development: Vite's dev-server proxy forwards /api/* to http://backend:8000 (inside
    Docker) or http://localhost:8000 (outside Docker) — see frontend/vite.config.js.
    In production: Nginx receives the HTTPS request and proxy_passes it to Gunicorn on :8000.
    │
    ▼
 6. GUNICORN
    A worker process picks up the raw HTTP request and hands it to Django's WSGI application.
    │
    ▼
 7. DJANGO MIDDLEWARE (backend/supportmitra/settings.py MIDDLEWARE list, in order)
    Security headers, static file serving (WhiteNoise), CORS check, session/auth setup,
    Prometheus metrics timing — each middleware gets a chance to inspect or modify the
    request before it reaches the URL router.
    │
    ▼
 8. URL ROUTING (backend/supportmitra/urls.py → backend/support_app/urls.py)
    The path "/api/ops/tickets/<uuid:ticket_id>/assign/" is matched to the function
    ops_assign_ticket in backend/support_app/views.py.
    │
    ▼
 9. DRF PERMISSION CHECK (backend/support_app/permissions.py)
    Before ops_assign_ticket's body ever runs, DRF checks the view's declared
    permission_classes: [IsAuthenticated, IsTicketManagementStaff]. If the requesting
    user is a Finance Manager (who has no ticket-management authority), this check
    fails here and the request never reaches the view's logic — DRF returns 403
    Forbidden immediately.
    │
    ▼
10. VIEW (backend/support_app/views.py :: ops_assign_ticket)
    Validates the request body via AdminAssignSerializer, looks up the Ticket and
    Freelancer objects, and — critically — does NOT contain the actual business logic.
    │
    ▼
11. SERVICE LAYER (backend/support_app/services/ticket_service.py :: assign_ticket)
    This function contains the real business logic: inside one atomic database
    transaction, it closes the old TicketAssignment record (if any), updates
    Ticket.assigned_to and Ticket.status, creates a new TicketAssignment record,
    and writes a TicketActivityLog entry.
    │
    ▼
12. DJANGO SIGNALS (backend/support_app/signals.py)
    Saving the Ticket object automatically fires a pre_save signal
    (log_ticket_changes) that detects the status changed and would log it — but
    ticket_service.assign_ticket() already logs the "assigned" event explicitly
    itself with a more specific message, so this is a case where the signal-based
    generic logging and the service-layer specific logging work together, not
    redundantly (see Section 6.7 for the exact mechanics).
    │
    ▼
13. NOTIFICATIONS (backend/support_app/services/notification_service.py)
    create_notification() is called multiple times: once for the newly-assigned
    freelancer, once for the customer, and once for each other on-duty staff member
    — each creates one row in the Notification database table.
    │
    ▼
14. SERIALIZER (backend/support_app/serializers.py :: TicketDetailSerializer)
    The updated Ticket object is converted from a Python object into a JSON-ready
    Python dictionary.
    │
    ▼
15. RESPONSE
    DRF turns that dictionary into an actual HTTP response with a JSON body and a
    200 OK status code, which travels back up through Gunicorn, the network, and
    Axios's response interceptor (which would only intervene here if the response
    had been a 401).
    │
    ▼
16. REACT RE-RENDER
    The calling component's code (in OpsTicketQueue.jsx) receives the updated ticket
    data, updates its own React state, and React automatically re-renders exactly the
    parts of the screen that changed — the ticket's row now shows the new assignee.
```

Every single feature documented in Section 18 (Feature Walkthroughs) and Section 19 (Code Flow) follows this same 16-step shape. Once you understand this one flow deeply, you understand the shape of the entire application.

## 3.3 Why this architecture (the reasoning, not just the description)

- **Why a separate frontend and backend instead of Django rendering HTML pages directly?** A pure "Django renders HTML" application would be simpler for a small project, but ResolveHQ's frontend needs the kind of instant, app-like interactivity (live SLA countdowns, optimistic notification updates, drag-and-drop file uploads, a multi-step payment flow) that's painful to build with full-page reloads. Splitting them also means the API itself is reusable — nothing stops a future native mobile app from calling the exact same `/api/` endpoints.
- **Why a "thin views, fat services" pattern?** `views.py`'s own docstring states the rule: "Views are thin. They: 1) Parse and validate the request, 2) Check permissions, 3) Call the service layer for business logic, 4) Return an HTTP response." If business logic (like the ticket-assignment sequence above) lived directly inside the view function, it could *only* run in response to an HTTP request. By putting it in `services/ticket_service.py` instead, the exact same `assign_ticket()` function can be called from a view, from a Celery background task, from a management command (like the demo-data seeders), or from a test — with zero duplication.
- **Why does the service layer never raise HTTP-specific exceptions?** Looking at `ticket_service.py`, functions raise plain Python `ValueError` for invalid operations, never a DRF `Response` or an HTTP status code. This keeps the service layer's code honest about what it actually is — pure business logic — and lets *whichever caller* (a view, in this case) decide how to translate "you can't do that" into the right HTTP status code (`400 Bad Request`, in `views.py`'s `except ValueError as exc: return Response({"detail": str(exc)}, status=400)` pattern, repeated at nearly every write endpoint).

## 3.4 Architecture that does NOT yet exist (and why it's mentioned here)

A very recent (dated 2026-07-15, the same day as this document) architecture audit — `docs/REALTIME_NOTIFICATIONS_ARCHITECTURE.md`, written by a prior AI-assisted planning session and explicitly marked **"AUDIT COMPLETE — AWAITING APPROVAL. Do not implement until approved"** — proposes adding real-time WebSocket push (via Django Channels) on top of the current polling-based system. As of this document, **none of that plan has been implemented**: `backend/supportmitra/asgi.py` is still a bare, unused stub, `channels` is not in `requirements.txt`, and every "live" surface in the product still works by a browser-side JavaScript timer re-fetching data every 30-60 seconds. Section 13 (Notifications) covers exactly how the *current*, real, working polling system operates, and separately summarizes this *proposed, not-yet-built* future architecture so you understand where the system is headed without confusing the two.

---

# 4. Folder Structure

This section walks through every meaningful folder in the repository. For each one: why it exists, who is expected to put files there, and what should never be placed there.

```
fridaySystems_Tech/                    ← repository root
│
├── backend/                            ← the entire Django application
│   ├── manage.py                       ← Django's command-line entry point
│   ├── conftest.py                     ← shared Pytest fixtures for the whole test suite
│   ├── pytest.ini                      ← Pytest configuration
│   ├── gunicorn.conf.py                ← production web-server tuning
│   ├── requirements.txt                ← production Python dependencies
│   ├── requirements-dev.txt            ← development-only Python dependencies
│   ├── .env / .env.example             ← secrets (gitignored) / secrets template
│   │
│   ├── supportmitra/                   ← the Django "project" package — global config
│   │   ├── settings.py                 ← development settings (see Section 6.1)
│   │   ├── settings_prod.py            ← production overrides
│   │   ├── urls.py                     ← the root URL table
│   │   ├── celery.py                   ← Celery app configuration
│   │   ├── wsgi.py                     ← production entry point (Gunicorn uses this)
│   │   └── asgi.py                     ← stub entry point for future WebSocket support
│   │
│   ├── support_app/                    ← the ONE Django "app" containing all real code
│   │   ├── models.py                   ← every database table (Section 8)
│   │   ├── views.py                    ← every API endpoint's logic (3,321 lines)
│   │   ├── serializers.py              ← JSON ⇄ Python object translation
│   │   ├── urls.py                     ← every API URL path
│   │   ├── permissions.py              ← who is allowed to do what
│   │   ├── admin.py                    ← Django admin panel configuration
│   │   ├── signals.py                  ← automatic reactions to database saves
│   │   ├── tasks.py                    ← Celery background jobs
│   │   ├── validators.py               ← password strength / GSTIN format rules
│   │   ├── pagination.py               ← custom page-size rules
│   │   ├── exceptions.py               ← consistent error-response formatting
│   │   ├── invoice_pdf.py              ← GST tax invoice PDF generator
│   │   │
│   │   ├── services/                   ← business logic, organized by feature
│   │   │   ├── ticket_service.py       ← create/assign/comment/status-change logic
│   │   │   ├── payment_service.py      ← Razorpay orders, verification, refunds
│   │   │   ├── payout_service.py       ← engineer payout calculation
│   │   │   ├── sla_service.py          ← SLA deadline computation and breach detection
│   │   │   ├── notification_service.py ← in-app notification creation
│   │   │   ├── email_service.py        ← transactional email sending
│   │   │   ├── kb_service.py           ← Knowledge Base search and relevance scoring
│   │   │   ├── ai_assistant_service.py ← mock AI-suggestion provider
│   │   │   ├── ops_command_center_service.py    ← Operations dashboard aggregations
│   │   │   ├── executive_analytics_service.py   ← Executive dashboard aggregations
│   │   │   ├── ticket_signals.py       ← shared "who owns the next reply" queryset logic
│   │   │   └── service_catalog.py      ← the single source of truth for service pricing
│   │   │
│   │   ├── integrations/               ← third-party API client wrappers
│   │   │   ├── razorpay_client.py      ← Razorpay SDK client factory
│   │   │   ├── osticket.py             ← stub: future osTicket helpdesk sync
│   │   │   └── zammad.py               ← stub: future Zammad helpdesk sync
│   │   │
│   │   ├── management/commands/        ← custom `python manage.py <command>` scripts
│   │   │   ├── seed_demo_data.py       ← curated, hand-crafted demo dataset
│   │   │   ├── seed_demo_users.py      ← creates one login per role for manual QA
│   │   │   ├── seed_enterprise_demo.py ← large, Faker-generated realistic dataset
│   │   │   └── reset_uat.py            ← wipes and reseeds a UAT environment
│   │   │
│   │   └── migrations/                 ← 27 numbered database schema change scripts
│   │
│   ├── templates/email/                ← HTML email templates (Django template language)
│   ├── tests/                          ← the entire Pytest suite (13 files)
│   └── mediafiles/ (gitignored)        ← user-uploaded ticket attachments (dev only)
│
├── frontend/                           ← the entire React application
│   ├── index.html                      ← the single real HTML file (React mounts into it)
│   ├── package.json / package-lock.json← JavaScript dependencies
│   ├── vite.config.js                  ← dev server + production build configuration
│   ├── tailwind.config.js              ← design tokens (colors, animations)
│   ├── playwright.config.js            ← end-to-end test configuration
│   │
│   └── src/
│       ├── main.jsx                    ← the actual entry point — mounts <App /> into the DOM
│       ├── App.jsx                     ← the route table and every route-guard component
│       ├── index.css                   ← the small amount of truly global CSS
│       │
│       ├── api/                        ← one file per backend resource, thin Axios wrappers
│       ├── pages/                      ← one file per URL route — see Section 7
│       ├── components/                 ← every reusable piece of UI — see Section 7
│       ├── hooks/                      ← reusable stateful logic extracted from components
│       ├── store/                      ← Zustand global state (authStore.js)
│       ├── context/                    ← React Context providers (ToastContext.jsx)
│       ├── utils/                      ← pure functions with no React/network dependency
│       ├── config/                     ← small static configuration (contact.js)
│       └── data/                       ← static marketing content (services.jsx, pricing.js)
│
│   └── tests/e2e/                      ← Playwright end-to-end tests
│
├── docker-compose.yml                  ← local development environment (6 services)
├── docker-compose.prod.yml             ← production overrides
├── Dockerfile.backend                  ← Django/Gunicorn container image
├── Dockerfile.frontend                 ← Vite dev-server container image
├── Dockerfile.frontend.prod            ← alternative fully-containerized frontend image
│
├── nginx/                              ← production reverse-proxy configuration
├── scripts/                            ← operational shell scripts (backup, deploy, health check)
├── .github/workflows/                  ← CI and deploy automation (GitHub Actions)
├── docs/                               ← historical planning/audit documents + THIS file
└── prompts/                            ← saved prompt templates used in past AI-assisted sessions
```

## 4.1 Why "one Django app" instead of many

Django projects conventionally split functionality across multiple "apps" (e.g., a `tickets` app, a `payments` app, a `users` app). ResolveHQ deliberately does **not** do this — everything lives in one app, `support_app`. This is a real, confirmed architectural convention for this project (recorded in this project's engineering notes as: *"One Django app only. New features go in `models.py`/`views.py`/`serializers.py`/`urls.py` directly, plus a new `services/<feature>_service.py` for business logic — not a new Django app."*)

**Why this works here:** ResolveHQ's features are all deeply interconnected — a ticket touches customers, payments, SLA, notifications, and the knowledge base all at once, so splitting them into separate Django apps would create constant cross-app import complexity for very little organizational benefit. Instead, this project gets its organization from the `services/` subfolder, where each file is scoped to one feature area, while `models.py`, `views.py`, `serializers.py`, and `urls.py` stay as four large, well-commented, section-divided files.

## 4.2 What belongs where (a quick decision guide)

| If you're adding... | It goes in |
|---|---|
| A new database table or field | `backend/support_app/models.py`, plus a new numbered file in `migrations/` |
| A new API endpoint | `backend/support_app/views.py` (the function/class) + `backend/support_app/urls.py` (the URL) |
| A new JSON shape for requests/responses | `backend/support_app/serializers.py` |
| New business logic (anything more than "look up a row and return it") | A new or existing file in `backend/support_app/services/` |
| A new permission rule | `backend/support_app/permissions.py` |
| A new React page (a full URL route) | `frontend/src/pages/` + a new `<Route>` in `frontend/src/App.jsx` |
| A new reusable piece of UI | `frontend/src/components/ui/` (generic) or the relevant domain folder (`tickets/`, `dashboard/`, `kb/`, etc.) |
| A new frontend API call | The matching file in `frontend/src/api/` (never call `axios` directly from a page/component) |
| New reusable stateful logic | `frontend/src/hooks/` |
| A pure data-transformation function with no side effects | `frontend/src/utils/` |

---

# 5. Every Important File

This section is the complete index of every source file in the repository, organized by folder, with its purpose, its key collaborators (what it imports, who imports it), and — for the handful of files that are the true "engine room" of the product — a deeper walkthrough. Frontend pages and components are catalogued here at a glance; their full deep-dive (props, internal logic, composition) lives in Section 7, since duplicating ~120 file write-ups in two places would make this document longer without making it more useful.

## 5.1 Backend — project configuration (`backend/supportmitra/`)

| File | Purpose | Analogy |
|---|---|---|
| `settings.py` | The single source of truth for every configurable behavior of the Django application in development: installed apps, middleware order, database connection, DRF defaults, JWT lifetimes, CORS rules, Celery/Redis configuration, email backend, GST rate, feature flags, and logging. Every other backend file either directly imports values from here or has its behavior shaped by it. | The building's master control panel — every switch that changes how the whole building behaves lives on this one panel. |
| `settings_prod.py` | A small file of *overrides* layered on top of `settings.py` for production (see Section 17) — imports everything from `settings.py` with `from .settings import *` and then tightens specific values. |Retrofitting stricter locks onto the same building for a higher-security tenant, without redesigning the whole building. |
| `urls.py` (root) | The very first URL table Django consults. Routes `/django-admin/` to the built-in admin site, `/api/` to `support_app.urls` (everything else), and `/metrics/` to the staff-only Prometheus endpoint. Serves uploaded media files directly in development only. | The building directory in the lobby — "Admin office → 2nd floor; Everything else → ask the 3rd floor." |
| `celery.py` | Creates the Celery application object, points it at `settings.py` for configuration (`app.config_from_object("django.conf:settings", namespace="CELERY")`), and tells it to auto-discover `tasks.py` files. | The dispatcher's radio — this is what lets background workers "tune in" to the same configuration as the main application. |
| `wsgi.py` | The production entry point. Gunicorn is told to run `supportmitra.wsgi:application` — this file is what turns "a Django project" into "a runnable web server process." | The building's main power switch that Gunicorn (the electrician) flips on. |
| `asgi.py` | A currently-unused stub for a future asynchronous entry point (needed for WebSockets). Explicitly documented in its own docstring as "Not used at MVP." | A pre-wired but currently-unconnected electrical outlet, installed in anticipation of a future appliance. |

## 5.2 Backend — the core `support_app` files

| File | Lines | Purpose |
|---|---|---|
| `models.py` | 1,169 | Defines all 20 database tables as Python classes. This is the single most important file for understanding *what data ResolveHQ stores* — fully documented table-by-table in Section 8. |
| `views.py` | 3,321 | Defines every one of the ~95 API endpoints' request-handling logic. The largest file in the codebase — fully documented endpoint-by-endpoint in Section 9. |
| `serializers.py` | 886 | Defines every JSON shape the API sends and accepts — roughly 35 serializer classes, one per "view" of a model (e.g., three different Ticket serializers depending on whether a customer, freelancer, or ops staff member is looking). |
| `urls.py` | 182 | The complete, hand-written list of every URL path in the API, grouped by feature area with comments explaining ordering-sensitive routes (e.g., why `webhook/` must be listed before `<uuid:pk>/` so Django's URL matcher doesn't try to parse the literal word "webhook" as a UUID). |
| `permissions.py` | 268 | Defines the role hierarchy and every custom DRF permission class — the single place that answers "who is allowed to do this." Fully documented in Section 10. |
| `admin.py` | 325 | Configures the Django admin panel (`/django-admin/`) — which fields are visible, searchable, and filterable for each model, and which models (like `TicketActivityLog`) are locked completely read-only to preserve audit-trail integrity. |
| `signals.py` | 185 | Six functions that run automatically whenever specific models are saved — ticket-number generation, activity-log writing, `resolved_at` timestamping, and Knowledge Base slug/publish-date generation. Fully documented in Section 6.7. |
| `tasks.py` | 108 | Every Celery background job — two working (with retries), one scheduled (SLA checks), two honest stubs (payout batching, external helpdesk sync — not yet built). |
| `validators.py` | 63 | Two custom validation rules: `validate_gstin_format` (checks the 15-character Indian GST number format) and `StrongPasswordValidator` (requires an uppercase letter, lowercase letter, digit, and special character). |
| `pagination.py` | 16 | One custom pagination class (`OpsPageNumberPagination`) that allows a caller-controlled `?page_size=` (capped at 100) instead of the fixed default of 20. |
| `exceptions.py` | 108 | A custom DRF exception handler that normalizes every single error response in the entire API into the same shape: `{"detail": "...", "errors": {...}, "status": <code>}`, and logs 5xx errors with full tracebacks while logging 4xx errors as lightweight warnings. |
| `invoice_pdf.py` | 438 | Generates a professional, GST-compliant tax invoice PDF for a completed payment, using the ReportLab library — handles both B2B (customer has a GSTIN) and B2C invoice formats, and a base-fee/severity-surcharge line-item breakdown for resolution-fee payments. |

## 5.3 Backend — the service layer (`backend/support_app/services/`)

This is the folder that answers "where does the actual thinking happen." Every file follows the same contract, stated directly in `ticket_service.py`'s docstring: accept model instances (not raw IDs), return the created/modified object, raise plain `ValueError` for invalid operations, and never raise HTTP-specific exceptions.

| File | Lines | What it's responsible for |
|---|---|---|
| `ticket_service.py` | 258 | The ticket state machine: `create_ticket`, `assign_ticket`, `unassign_ticket`, `add_comment`, `update_status`. The single most important business-logic file in the project — deep-dived in Section 6.6. |
| `payment_service.py` | 647 | Every money-touching operation: generating unique invoice numbers under a database lock, creating Razorpay orders (or sandbox mocks), verifying payment signatures, processing webhooks, issuing refunds, and the resolution-fee payment flow that closes a ticket and triggers a payout. Deep-dived in Section 6.6 and Section 18.5. |
| `payout_service.py` | 148 | Calculates and creates the 65%/35% engineer/platform payout split once a resolution fee is paid, and lets finance staff mark a payout as processed with a bank/UPI transaction reference. |
| `sla_service.py` | 196 | Looks up (or falls back to default) SLA policies, sets a ticket's response/resolution deadlines when it opens, and checks tickets for breaches — the function the Celery Beat schedule calls every 5 minutes. Deep-dived in Section 6.6. |
| `notification_service.py` | 75 | The single function (`create_notification`) that every other part of the backend calls to create an in-app notification row, plus stub/thin wrappers for email and (disabled-by-default) WhatsApp dispatch. |
| `email_service.py` | 169 | Renders and sends every transactional email (welcome, ticket created, ticket assigned, ticket resolved, new comment, resolution rejected, email verification, password reset) — every function fails silently (logs, never raises) so a broken email configuration can never break a ticket action. |
| `kb_service.py` | 110 | Knowledge Base search (simple case-insensitive substring match with a lightweight relevance score) and "find articles related to this ticket" scoring, deliberately written to work identically on PostgreSQL or SQLite. |
| `ai_assistant_service.py` | 148 | A small `AIProvider` abstract interface with one implementation, `MockAIProvider` — deterministic (no `random`), rule-based suggestions derived from the ticket's service type and severity. Designed so a real LLM-backed provider can be swapped in later by adding one new class, with zero changes to any view, URL, or frontend code. |
| `ops_command_center_service.py` | 305 | Powers the Operations Command Center's eight data widgets — live incident queue, SLA risk board, escalation queue, engineer capacity, service health, critical customers, ticket flow, recent activity. Deep-dived in Section 12. |
| `executive_analytics_service.py` | 645 | Powers the entire Executive Analytics dashboard — one function per metric group (summary, SLA, engineer utilization, ticket aging, priority/service distribution, CSAT, revenue, top problem categories, breached tickets, most active customers) composed into one unified payload. Deep-dived in Section 11. |
| `ticket_signals.py` | 43 | One shared function, `annotate_reply_ownership_signals`, that computes "who does the ball sit with" (customer, engineer, or internal team) for a batch of tickets in a single efficient database query, reused by three different ticket-list views so the logic never has to be written twice. |
| `service_catalog.py` | 137 | The single source of truth for the eight-service catalogue, consulting fee, severity surcharges, and the engineer/platform revenue split. Every price shown anywhere in the product traces back to this one file. Fully covered in Section 1.2 and Section 18.1. |

## 5.4 Backend — integrations, management commands, migrations

| File | Purpose |
|---|---|
| `integrations/razorpay_client.py` | A 4-line factory function returning an authenticated Razorpay SDK client — the one place credentials are wired up. |
| `integrations/osticket.py`, `integrations/zammad.py` | Both are honest, 9-line stubs — a `push_ticket()` function that immediately `raise NotImplementedError`. Placeholders for a documented future integration with these external helpdesk tools, not yet built. |
| `management/commands/seed_demo_data.py` | Creates a small, curated, hand-crafted set of demo tickets/users/payments in a known-good final state (bypassing signals via `disconnect`/`try...finally` so timestamps can be backdated realistically). |
| `management/commands/seed_demo_users.py` | Creates exactly one login per role (`admin@resolvehq.dev`, `customer@resolvehq.dev`, etc.) — the accounts the Playwright E2E test suite logs in as. |
| `management/commands/seed_enterprise_demo.py` | Uses the `Faker` library to generate a large (`--scale small|medium|large`), realistic-looking dataset (hundreds of tickets) for demoing or load-testing the Executive Analytics dashboard, tagged with a distinct email domain (`@entdemo.local`) so it can be flushed independently of the curated seed data. |
| `management/commands/reset_uat.py` | Wipes and reseeds a UAT (User Acceptance Testing) environment. |
| `migrations/0001_initial.py` … `0027_alter_freelancer_skills_alter_kbarticle_category_and_more.py` | 27 sequential, auto-numbered files, each one a small Python script describing exactly one schema change (add a field, add an index, rename a choice, etc.). Django replays these in order to build (or update) the database schema — this is the *complete, exact history* of how the database structure evolved over the project's life. Never edit an already-applied migration file directly; always generate a new one. |

## 5.5 Frontend — application entry and global concerns

| File | Purpose |
|---|---|
| `frontend/src/main.jsx` | The true entry point — the one line of code that finds the `<div id="root">` in `index.html` and tells React to render `<App />` into it. |
| `frontend/src/App.jsx` | 366 lines. The complete route table (every URL path mapped to a page component) and every route-guard component (`PrivateRoute`, `AdminRoute`, `OpsRoute`, `PaymentRoute`, etc. — 9 guards in total). This is the file that answers "which page loads at this URL, and is this user even allowed to see it." Deep-dived in Section 7.1. |
| `frontend/src/index.css` | The small amount of global CSS that doesn't fit Tailwind's utility-class model (font imports, base resets). |
| `frontend/src/store/authStore.js` | 165 lines. The single Zustand store holding the logged-in user's identity and tokens — deep-dived in Section 10. |
| `frontend/src/context/ToastContext.jsx` | A React Context provider implementing the app-wide toast/snackbar notification system (`success`/`error`/`info`/`warning`, auto-dismissing after 3–6 seconds depending on severity). |

## 5.6 Frontend — the API layer (`frontend/src/api/`)

Every file here is a thin wrapper: it imports the shared `apiClient` from `client.js` and exports one small function per backend endpoint. None of them contain business logic — they exist purely so that no page or component ever has to know a raw URL string or call `axios`/`fetch` directly.

| File | Wraps these backend routes |
|---|---|
| `client.js` | Not a resource wrapper — the shared Axios instance itself, with the token-attachment and auto-refresh interceptors (Section 10.6). |
| `auth.js` | `/auth/register/`, `/auth/login/`, `/auth/token/refresh/`, `/auth/logout/`, `/auth/google/`, `/auth/me/`, `/customers/me/` |
| `tickets.js` | `/tickets/`, `/tickets/{id}/`, comments, CSAT, accept/reject-resolution, admin & freelancer ticket actions, resolution payment flow |
| `ops.js` | The entire `/ops/` namespace except command-center and executive-analytics: dashboard, ticket queue, users, roles, services, payments, escalation, role-scoped analytics |
| `opsCommandCenter.js` | `/ops/command-center/` and `/ops/command-center/live/` |
| `executiveAnalytics.js` | `/ops/executive-analytics/` |
| `payments.js` | `/customers/me/payments/`, `/payments/{id}/`, invoice download, per-ticket payment initiation/verification, admin payment list/confirm |
| `notifications.js` | `/notifications/`, unread-count, mark-read, mark-all-read |
| `knowledgeBase.js` | `/kb/articles/`, `/kb/categories/`, per-ticket article linking |
| `aiAssistant.js` | `/tickets/{id}/ai-assistant/` and its log-insert endpoint |
| `attachments.js` | `/tickets/{id}/attachments/` (list, upload, delete) |
| `analytics.js` | `/analytics/` (the original, single role-aware analytics endpoint) |
| `settings.js` | `/auth/profile/`, `/auth/change-password/` |

## 5.7 Frontend — hooks (`frontend/src/hooks/`)

| File | What it extracts into reusable logic |
|---|---|
| `useAuth.js` | Login/register/logout actions with toast feedback and error-message extraction, wrapping `authStore`. |
| `useRoles.js` | The single source of truth for every role-boolean (`isSuperAdmin`, `isOpsManager`, `isEngineer`, `isTicketManagementStaff`, etc.), mirroring the backend's permission predicates. |
| `useNotifications.js` | The full notification-bell data layer: 30-second tab-visibility-aware unread-count polling, lazy full-list fetch, and optimistic mark-read/mark-all-read. |
| `useTickets.js` | Fetches a filtered ticket list with loading/error state and a request-cancellation guard. |
| `useSlaClocks.js` | Derives the Response-SLA and Resolution-SLA countdown/status for a ticket entirely from timestamps already present on it — a client-side mirror of the backend's `SLAStatusMixin` thresholds. |
| `useConversationFeed.js` | Fetches and merges a ticket's comments, attachments, and activity log into one chronological feed. |
| `useRoleTicketFetcher.js` | Picks the correct ticket-detail-fetching function (customer/freelancer/admin endpoint) based on the current user's role. |
| `useSelection.js` | Generic multi-select (checkbox) state as a `Set`, reusable anywhere a list needs bulk selection. |
| `useCountdown.js` | A live "time remaining until" ticking display, re-rendering every 30 seconds. |
| `useFocusTrap.js` | Confines keyboard Tab-cycling inside a modal/drawer while it's open, and restores focus on close — an accessibility primitive built from scratch (no library existed for this in the project). |
| `useIsMobile.js` | Detects touch-primary devices via a `matchMedia` query, used to decide "tap to call" vs. "click to copy" phone-number UI. |
| `usePageTitle.js` | Sets `document.title` to `"<Page> — ResolveHQ"` and resets it on unmount. |

## 5.8 Frontend — utils (`frontend/src/utils/`)

| File | Purpose |
|---|---|
| `ticketPriority.js` | Client-side scoring and bucketing algorithm that sorts an engineer's tickets into triage sections (Requires Immediate Attention, Waiting on Internal, Ready to Resolve, Waiting on Customer, Today's Work) — powers the Engineer Workspace. |
| `customerTicketPriority.js` | The customer-facing mirror of the above, bucketing a customer's own tickets (Needs Your Action, Overdue, Waiting on You, With Engineer) — powers the customer Dashboard. |
| `resolution.js` | Encodes/decodes the structured "Resolution Summary" (root cause, steps taken, notes, prevention, time spent) as a specially-formatted internal comment, since no dedicated database fields exist for this yet (documented in-file as required future backend work). |
| `apiError.js` | Extracts a consistent, human-readable error message from any Axios error, in priority order (backend `detail` → field errors → HTTP status text → network error → generic fallback). |
| `time.js` | Relative/absolute time formatting (`"5m ago"`, `"12 May, 02:30 PM"`) and date-bucket grouping (Today/Yesterday/Earlier). |
| `displayName.js` | Resolves the best available human-readable name for a user object, in priority order, never falling back to an email address. |
| `dailyBrief.js` | Pure function that turns an engineer's already-fetched triage buckets into a short, plain-English "brief" (no AI/LLM call involved despite living next to `AIDailyBriefCard`). |
| `operationsBrief.js` | The Operations Command Center's equivalent of `dailyBrief.js`, over the Command Center's core+live payloads. |

## 5.9 Frontend — pages and components

`frontend/src/pages/` contains 45 files — one per URL route — organized into public/marketing pages, auth/onboarding pages, customer pages, the one freelancer page, and 14 operations/admin pages. `frontend/src/components/` contains 78 reusable files organized into a design-system layer (`ui/`), domain layers (`tickets/`, `dashboard/`, `kb/`), and structural layers (`layout/`, `layouts/`, `table/`, `filters/`, `onboarding/`, `auth/`, `freelancer/`). **Every single one of these 123 files is individually catalogued — purpose, props, API calls, hooks used, and internal logic — in Section 7 (Frontend Deep Dive)**, which is long enough to warrant its own section rather than being folded into this file index.

---

# 6. Backend Deep Dive

## 6.1 Settings — the control panel, mechanism by mechanism

`backend/supportmitra/settings.py` is read once when the Django process starts. A few mechanisms deserve deeper explanation than Section 2 gave them:

**`INSTALLED_APPS`** tells Django which reusable applications (Django's own built-ins, third-party packages, and this project's own `support_app`) are active. Order rarely matters here (unlike `MIDDLEWARE`, below), but every model, admin registration, and template tag from an app only works if that app is listed. `django.contrib.sites` is listed specifically because `django-allauth` requires a "Sites framework" concept (`SITE_ID = 1`) even though this project only ever runs as one site.

**`MIDDLEWARE`** is a list, and *order matters completely* — each request passes through this list top-to-bottom on the way in, and bottom-to-top on the way out. This project's list, and why each entry is positioned where it is:

1. `PrometheusBeforeMiddleware` — must be *first* so it can start a timer before anything else happens, to measure true total request time.
2. `SecurityMiddleware` — applies HTTPS-redirect and security headers early.
3. `WhiteNoiseMiddleware` — intercepts requests for static files (like Django admin's CSS) before they reach the rest of the stack, which is faster.
4. `SessionMiddleware` — enables Django's session framework (used by the Django admin panel's login, and by `django-allauth`; the React app itself uses JWTs, not sessions).
5. `CorsMiddleware` — must run *before* `CommonMiddleware` so cross-origin headers are set correctly.
6. `CommonMiddleware` — general request/response housekeeping.
7. `CsrfViewMiddleware` — Cross-Site Request Forgery protection (relevant for the Django admin's own login form).
8. `AuthenticationMiddleware` — attaches `request.user` for Django's own session-based views (not the JWT-authenticated DRF API, which authenticates independently per-request — see Section 10).
9. `MessageMiddleware` — enables Django's one-time "flash message" framework (again, mostly for the admin panel).
10. `XFrameOptionsMiddleware` — blocks the site from being embedded in an `<iframe>` on another domain (clickjacking protection).
11. `AccountMiddleware` (allauth) — required by django-allauth.
12. `PrometheusAfterMiddleware` — must be *last* so it can stop the timer after every other middleware and the view itself have finished.

**`REST_FRAMEWORK`** configures Django REST Framework's defaults for every single view in the project unless a specific view overrides them: JWT as the only authentication method, a permission default that flips based on `DEBUG` (in development, `AllowAny` so you can explore the API freely without a token; `settings_prod.py` tightens this to `IsAuthenticated`), 20-item pagination by default, and — critically — the throttle configuration:

| Throttle scope | Rate | Applies to |
|---|---|---|
| `anon` (global default) | 20/minute per IP | Any unauthenticated request without a more specific scope |
| `user` (global default) | 100/minute per user | Any authenticated request without a more specific scope |
| `auth` | 5/minute per IP | Login, registration, Google login, password reset request |
| `analytics` | 30/hour per user | `/api/analytics/` and `/api/ops/executive-analytics/` (they share one bucket — Section 11 explains a real consequence of this) |
| `password_change` | 5 per 15-minute window per user | Changing your own password (a custom-coded window, since DRF's rate-string parser can't express "15 minutes" natively) |
| `ai_assistant` | 20/minute per user | The AI Assistant panel |

`EXCEPTION_HANDLER` points at `support_app.exceptions.custom_exception_handler` (Section 5.2), guaranteeing every single error response across the entire API — regardless of which view raised it — has the identical `{"detail": ..., "errors": ..., "status": ...}` shape, which is exactly what `frontend/src/utils/apiError.js` is written to expect.

**`SIMPLE_JWT`** sets the access token lifetime to 15 minutes and the refresh token lifetime to 7 days by default (both overridable via environment variables), with `ROTATE_REFRESH_TOKENS = True` (every refresh issues a brand-new refresh token) and `BLACKLIST_AFTER_ROTATION = True` (the old refresh token is immediately invalidated so it can never be reused, even if intercepted). Section 10 covers exactly what this means in practice.

**The production environment guard** is a small but important piece of defensive code: when `DEBUG` is `False`, `settings.py` immediately checks that `DATABASE_URL`, `SECRET_KEY`, `APP_URL`, both Razorpay keys, and `BUSINESS_GSTIN` are all actually set, and **crashes on startup with a clear error message** if any are missing, rather than silently starting with broken payments or a fake GST number. This is a deliberate "fail loudly and immediately, not silently in production" design choice.

## 6.2 Models — pointer

`models.py` defines the database schema. It is documented completely, table-by-table, field-by-field, in **Section 8 (Database Deep Dive)** — repeating it here would be pure duplication.

## 6.3 Serializers — the JSON translation layer, in depth

`serializers.py` (886 lines, ~35 classes) follows a few consistent patterns worth understanding once, since they explain almost every serializer in the file:

**Pattern 1 — one serializer per "view" of a model, not one serializer with conditional fields.** There isn't a single `TicketSerializer` with an `if request.user.is_staff` branch inside it. Instead there are `TicketListSerializer` (bare minimum fields for a list row), `OpsTicketListSerializer` (adds assignment info, SLA status, and reply-ownership signals for staff), `FreelancerTicketListSerializer` (SLA status but no `freelancer` field — an engineer viewing their own tickets already knows they're theirs), `CustomerTicketListSerializer` (adds the assigned engineer's public info), and `TicketDetailSerializer` (the full detail view). This keeps each serializer's field list honest and easy to audit for "does this leak anything it shouldn't" — a real security property, not just a style choice.

**Pattern 2 — `source="..."` to reach across a foreign key.** `email = serializers.EmailField(source="user.email", read_only=True)` on `CustomerSerializer` means "when building the `email` field, actually go read `self.user.email` on the underlying object" — letting the JSON response present a flat shape even though the database stores `email` on a *different* table (`CustomUser`, not `Customer`).

**Pattern 3 — `SerializerMethodField` for anything computed, not stored.** Fields like `sla_status`, `total_amount`, `waiting_on_customer`, or `csat_score` don't exist as columns in the database — they're computed on the fly by a `get_<fieldname>(self, obj)` method every time the object is serialized. This is how `SLAStatusMixin.get_sla_status()` (shared by four different serializers via Python multiple inheritance) can answer "is this ticket overdue right now" without that ever being a stored, potentially-stale database value.

**Pattern 4 — mixins for logic shared across multiple serializers.** `SLAStatusMixin` and `ReplyOwnershipSignalsMixin` are plain Python classes (not `ModelSerializer` subclasses themselves) that define `get_<field>` methods. `OpsTicketListSerializer(SLAStatusMixin, ReplyOwnershipSignalsMixin, TicketListSerializer)` inherits from all three, so the exact same "is this overdue" and "who owns the next reply" logic is computed identically whether an Ops Manager, a Support Agent, an engineer, or a customer is looking at the ticket list — a single source of truth instead of four copy-pasted implementations that could silently drift apart from each other over time.

**Pattern 5 — plain `Serializer` (not `ModelSerializer`) for action payloads that don't map to a whole model.** `AdminAssignSerializer` (just a `freelancer_id`), `AdminStatusSerializer` (`new_status` + `note`), `PaymentVerifySerializer` (the four fields a Razorpay checkout callback provides) — these validate the *body of a specific action*, not a database row, so they extend the more general `serializers.Serializer` rather than `ModelSerializer`.

**A documented trap, straight from the code comments:** `TicketDetailSerializer`'s docstring warns that its `waiting_on_customer`/`awaiting_engineer_reply`/`waiting_on_internal`/`last_public_comment_at` fields are **only accurate when the ticket instance came from a queryset that was annotated** via `services.ticket_signals.annotate_reply_ownership_signals` first. A handful of endpoints (like `accept_resolution`, or the admin/ops assign/status/unassign actions) build the serializer directly from a bare `get_object_or_404(Ticket, ...)` — for those responses, this mixin's `getattr(..., None)` safe-default kicks in and those four fields are simply *not trustworthy*, by design, in that specific response. This is exactly the kind of subtle, easy-to-miss correctness detail that a "read every important file" pass is meant to surface.

## 6.4 Views — the request handlers, pattern by pattern

`views.py` (3,321 lines) implements roughly 95 endpoints as a mix of class-based `generics.*APIView` subclasses and plain `@api_view` decorated functions — never DRF's `ViewSet`/`Router` combination (Section 2.3 explains why). A few patterns repeat throughout the file and are worth understanding once:

**The permission declaration is always explicit and visible.** Every single view states its `permission_classes` list directly, e.g. `permission_classes = [permissions.IsAuthenticated, IsTicketManagementStaff]`. There is no global "everything requires role X unless stated otherwise" magic — you can always answer "who can call this?" by reading the ten characters right above the function/class.

**Object-access helper functions are shared, not re-derived.** `_get_ticket_for_user(user, ticket_id)` (used by the attachments and related-tickets endpoints) and the equivalent inline pattern repeated in `TicketDetailView.get_queryset`, `TicketCommentListCreateView._get_ticket`, and `TicketActivityLogListView.get_queryset` all implement the same rule: staff/internal roles can see any ticket, a freelancer can see only their assigned tickets, a customer can see only their own tickets, and anyone else gets `PermissionDenied`. This rule is checked independently in a few different places rather than one single shared function everywhere (a known, minor duplication in the codebase), but it is always the *same* rule, never a different one.

**Views delegate to services for anything beyond "look up and return."** Compare `admin_assign_ticket`, `ops_assign_ticket`, and the (removed, redirect-only in the frontend) freelancer self-assign concept — all three ultimately call the exact same `ticket_service.assign_ticket()` function. The view's own code is only: validate input via a serializer, fetch the objects, call the service function inside a `try/except ValueError`, send notifications, and return the serialized result.

**Throttles are attached per-view where the default isn't tight enough.** `CustomTokenObtainPairView` and `RegisterView` both set `throttle_classes = [AuthRateThrottle]`; `analytics_view` and `executive_analytics` both set `throttle_classes_dec([AnalyticsRateThrottle])`; `change_password` sets `throttle_classes_dec([PasswordChangeRateThrottle])`; `ai_assistant_view` sets `throttle_classes_dec([AIAssistantRateThrottle])`. Every other view falls back to the global `user`/`anon` throttle rates from `settings.py`.

**File uploads get their own, unusually careful validation.** `ticket_attachments` (the POST branch) doesn't just check the file's declared MIME type — it independently checks the file extension against a hard-blocked list (`.exe`, `.php`, `.js`, `.svg` — the last one because SVG files can embed executable JavaScript — and about 25 others), *and* cross-checks that the extension actually matches the declared MIME type (catching a file renamed from `malware.exe` to `invoice.pdf` with a forged `Content-Type` header), *and* enforces a hard 5 MB size cap. This three-layer check (extension blocklist → MIME allowlist → extension-matches-MIME) is more defense-in-depth than a typical tutorial file-upload endpoint, and is worth calling out explicitly as a real security-conscious design decision.

## 6.5 Permissions — the complete role hierarchy

`permissions.py` defines the role hierarchy directly in its own module docstring: **`customer < freelancer(engineer) < support_agent | finance_manager < operations_manager < admin(super_admin)`.**

It's built from two layers: **predicate functions** (plain functions returning `True`/`False`, like `is_super_admin(user)`) that are reused both inside permission classes *and* directly inside view logic (e.g., `payment_invoice`'s manual staff check), and **permission classes** (DRF `BasePermission` subclasses that DRF calls automatically) built on top of those predicates.

| Permission class | Allows | Used for |
|---|---|---|
| `IsAdminUser` / `IsSuperAdmin` | Only `admin` role with `is_staff=True` (both required — prevents privilege escalation if `is_staff` is ever mistakenly set on a non-admin account) | Legacy `/admin/` endpoints; role/deactivation management |
| `IsCustomer` | Any user with a linked `Customer` profile | Customer-only ticket/payment endpoints |
| `IsFreelancer` | A user with a `Freelancer` profile whose `onboarding_status == "approved"` | Freelancer ticket endpoints — a *pending* freelancer cannot yet act |
| `IsFreelancerOrAdmin` | Approved freelancers or Super Admins | (declared, used where either role needs the same access) |
| `IsOperationsManager`, `IsFinanceManager`, `IsSupportAgent` | Exactly one specific staff role (and not `is_staff`, since none of these three roles has Django-admin access) | Fine-grained single-role gates |
| `IsOpsManagerOrSuperAdmin` | Ops Manager or Super Admin | User/role management reads |
| `IsFinanceManagerOrSuperAdmin` | Finance Manager or Super Admin | Payment confirm/refund writes |
| `IsAnyStaffRole` | Any of the four internal staff roles | Ops dashboard, ticket queue reads, Command Center |
| `IsTicketManagementStaff` | Ops Manager, Support Agent, or Super Admin — **explicitly excludes Finance Manager** | Assign/unassign/status-update/escalate a ticket, AI Assistant, KB article linking |
| `IsPaymentReader` | Ops Manager, Finance Manager, or Super Admin | Reading payment lists/summaries |
| `IsExecutiveAnalytics` | Ops Manager, Finance Manager, or Super Admin — identical role set to `IsPaymentReader` today, kept as its own class "so executive-dashboard access can evolve independently of payment-read access later" | The Executive Analytics endpoint |
| `IsOwnerOrAdmin` / `IsOwnerOrStaff` | Object-level checks: the record's own customer, or (for the "Staff" variant) any internal staff role | Ticket detail read access |

**The single most important line in this whole file, worth memorizing:** Finance Managers can see and act on *money*, but cannot touch tickets. Ops Managers, Support Agents, and Super Admins can touch tickets, but only Ops Managers and Super Admins can manage *users and services*. No single non-Super-Admin role can do everything — this is a deliberate separation-of-duties design (a real internal-controls concept: the person who can approve a refund should not also be the person who can silently reassign every ticket, and vice versa).

## 6.6 The service layer — the engine room, line by line

### 6.6.1 `ticket_service.py` — the ticket state machine

This is the single most-called service module in the codebase. Its five functions are the *only* correct way to change a ticket's state anywhere in the backend — no view, task, or management command should ever call `ticket.save()` directly to change a status or assignment (a few legacy spots do update fields directly, like the manual payment-confirmation code paths, but the *documented, intended* pattern is always to go through this file).

`create_ticket(customer, validated_data)` creates the row with `status="pending_payment"`, and then does something worth calling out specifically: `transaction.on_commit(lambda: send_ticket_created(ticket))`. This schedules the confirmation email to fire *only after* the surrounding database transaction has actually committed successfully — if anything else in the same request fails and the transaction rolls back, the customer never receives an email about a ticket that doesn't actually exist. This `transaction.on_commit` pattern repeats throughout the service layer (payment confirmation emails, assignment emails) for the exact same reason.

`assign_ticket(ticket, freelancer, assigned_by)` is the clearest example of "one business action, several database side effects, all inside one atomic transaction" in the whole codebase. In order: (1) if the ticket was already assigned to someone else, close that old `TicketAssignment` record by stamping its `unassigned_at`; (2) set `ticket._actor = assigned_by` (a plain Python attribute, not a database field — explained in Section 6.7) so the `log_ticket_changes` signal knows *who* triggered the change it's about to log; (3) update `ticket.assigned_to` and `ticket.status = "assigned"`; (4) create a brand-new `TicketAssignment` row recording this specific assignment; (5) write an explicit `TicketActivityLog` entry with a clear "assigned" or "reassigned" action and the correct from/to freelancer emails; (6) schedule the assignment email via `transaction.on_commit`. All of this happens inside one `with transaction.atomic():` block — if step 4 fails for any reason, steps 1–3 are automatically undone too, so the database can never end up in a state where `Ticket.assigned_to` says one thing and the `TicketAssignment` history says another.

`add_comment(ticket, author, body, is_internal)` contains the exact logic that starts the **first-response SLA clock**: a comment only counts as "the first response" if it is *not* internal, and the author is *not* the ticket's own customer (`not hasattr(author, "customer_profile") or author.customer_profile != ticket.customer`), and `ticket.first_response_at` is still `None`. The very first comment meeting all three conditions permanently stamps `first_response_at` — this is the moment SLA compliance reporting (Section 11) measures against.

`update_status(ticket, new_status, actor, note)` is the generic status-transition function, used by both the freelancer-facing and ops-facing status-update endpoints. It validates the new status is a real choice, refuses to touch an already-`closed` ticket, sets `resolved_at` when moving *into* `resolved` (and clears it again if a resolved ticket is reopened past that state — handling the "customer rejects the resolution" flow correctly), and fires the "ticket resolved" email specifically when the new status is `resolved`.

### 6.6.2 `payment_service.py` — money, correctly

This file is the most defensively-written code in the entire backend, and for good reason — it's the one place where a bug directly costs or loses real money.

**`_generate_invoice_number()`** solves a subtle concurrency problem: if two customers pay at the *exact same millisecond*, how do you guarantee they never get the same invoice number? The answer is a **database row lock**: `InvoiceCounter.objects.select_for_update().filter(year_month=prefix_month).first()` locks that month's counter row so that if two requests try to increment it simultaneously, the second one automatically *waits* until the first one's transaction finishes, rather than both reading `last_seq = 41` and both writing `42`. A nested `try/except IntegrityError` savepoint handles the one-time edge case of the very first invoice of a new month, where two requests might both try to *create* the counter row simultaneously.

**`create_order_for_ticket(ticket)`** is written to be **idempotent** — calling it twice for the same ticket returns the *same* pending payment and the *same* Razorpay order, rather than creating a duplicate. It also branches cleanly on whether `RAZORPAY_KEY_ID` is configured: if it is, it makes a real call to Razorpay's API; if not, it fabricates a deterministic mock order ID (`order_mock_<random hex>`) so the entire payment UI can be exercised in development without ever needing real payment gateway credentials. The frontend detects this via the returned `mode: "sandbox"` vs `mode: "live"` field.

**`verify_and_complete_payment(...)`** verifies a Razorpay HMAC-SHA256 signature by recomputing it from the order ID and payment ID using the secret key, and comparing with `hmac.compare_digest` — a constant-time comparison specifically chosen over a plain `==` to prevent a timing-attack side channel (a real, if obscure, cryptographic best practice). Only after the signature check passes does it mark the payment `completed` and hand off to `_open_ticket_after_payment`, which moves the ticket to `open`, initializes its SLA deadlines (Section 6.6.3), and notifies the customer.

**`issue_refund(payment, ...)`** is the most heavily-commented function in the entire codebase (its docstring is nearly 40 lines), because refunds are irreversible and must never be double-issued. It takes a `select_for_update()` row lock on the specific `Payment` row for the entire duration of the Razorpay API call — an explicit design decision documented in the code as "the lock is intentionally held during the API call because the alternative — check, release, call, re-lock — introduces a window where two threads could both issue a Razorpay refund for the same payment." If the Razorpay API call itself fails, the payment record is deliberately left untouched (still `completed`) so an admin can safely retry, rather than being left in some ambiguous half-refunded state.

### 6.6.3 `sla_service.py` — the promise-keeping engine

`_DEFAULTS` is a plain Python dictionary mapping severity → `(first_response_seconds, resolution_seconds)`, used whenever no matching `SLAPolicy` database row exists — Critical tickets get 30 minutes to first contact and 8 hours to resolve; Low severity tickets get 4 hours and 72 hours respectively.

`set_ticket_due_at(ticket)` is called exactly once, at the moment a ticket first transitions from `pending_payment` to `open` (from inside `payment_service._open_ticket_after_payment`), and is deliberately **idempotent by design** — if `ticket.due_at` is already set, the function does nothing and returns immediately, specifically so that a later reassignment or status change passing back through "open" can never silently reset a customer's SLA clock.

`check_ticket_sla(ticket)` is the function called (indirectly) every 5 minutes by Celery Beat, once per active ticket. It compares `now` against `ticket.due_at`; if breached and not already flagged, it stamps `sla_breach_notified = True` (a one-way flag preventing duplicate breach alerts for the same ticket), writes an `SLALog` "breach" entry, and notifies every admin user via `create_notification`.

**A documented, important gotcha, worth repeating from this project's own engineering notes:** `SLALog.status` can **never** be trusted as the source of truth for "did this ticket meet its SLA?" — this service only ever writes a `"created"` (pending) event when a ticket opens and a `"breach"` event when one is missed; **it never writes a `"met"` event** for a ticket that resolved on time. Anywhere in the codebase that needs a real SLA-compliance percentage (Section 11's Executive Analytics, most notably) must instead directly compare `Ticket.resolved_at` against `Ticket.due_at` (and `first_response_at` against `first_response_due_at`) — never query `SLALog` for compliance math.

## 6.7 Signals — automatic reactions to a save

`signals.py` implements six `@receiver`-decorated functions, each reacting to Django's `pre_save` or `post_save` events on a specific model. The most important mechanism here is the **actor-tracking pattern** used by `log_ticket_changes`:

When any code in the codebase wants a status/severity change to be attributed to a specific person in the resulting `TicketActivityLog` entry, it sets a plain Python attribute on the in-memory object *before* calling `.save()` — for example, `ticket._actor = assigned_by` inside `ticket_service.assign_ticket()`. This is **not** a database column (note the underscore prefix, and it never appears in `models.py`) — it's a temporary, request-scoped piece of information riding along on the Python object itself. The `pre_save` signal `log_ticket_changes` then reads `getattr(instance, "_actor", None)` — if it was set, the resulting log entry correctly says "Priya assigned this to Rahul"; if it wasn't set (a Celery task, a management command, or the Django shell saving a ticket directly), it correctly defaults to `None`, meaning "the system did this, not a specific person."

**Why this is thread-safe and request-safe without any global state or locks:** each HTTP request fetches its *own* fresh `Ticket` Python object from the database. Setting `_actor` on *that* object cannot possibly leak into or affect any other concurrent request's *separate* `Ticket` object, even for the same database row — there is no shared, global "current actor" variable anywhere. This is explicitly called out in the code's own comments as a deliberate alternative to Python's `threading.local()` ("threadlocals") pattern, which is a more common — but more fragile and harder to reason about — way to solve the same "how does deep code know who's asking" problem.

The **ticket number generator** (`auto_generate_ticket_number`) runs `pre_save` and uses the last 8 hex characters of the ticket's own randomly-generated UUID to build a human-readable `TKT-XXXXXXXX` identifier — deliberately *not* a simple incrementing counter, because an incrementing counter would require a database lock on every single ticket creation (unlike invoice numbers, which genuinely need sequential numbers for tax-compliance reasons and therefore *do* use a lock — see `payment_service.py` above).

## 6.8 The Django admin panel

`admin.py` configures `/django-admin/`, a full web-based interface for directly viewing and editing database records, built into Django and customized here with `list_display` (which columns show in a list), `search_fields` (including cross-table search like `"customer__user__email"`, which searches the *linked* Customer's linked User's email), `list_filter` (sidebar filter dropdowns), and `readonly_fields`.

The most important design decision in this file: **`TicketActivityLog` and `AuditLog` are both configured with `has_add_permission`, `has_change_permission`, and `has_delete_permission` all hard-coded to return `False`.** Even a Super Admin logged into the Django admin panel *cannot* edit or delete an activity log entry through this interface — only the application code itself can create them. This is what makes these two tables a trustworthy audit trail: if staff could quietly edit history through the admin panel, the audit trail would be worthless the moment anyone needed to actually trust it (e.g., in a dispute with a customer, or a compliance review).

`Ticket` is registered with three **inlines** (`TicketActivityLogInline`, `TicketAssignmentInline`, `TicketCommentInline`) — meaning when a Super Admin opens one ticket in the admin panel, they see its full activity log, assignment history, and comment thread directly on that same page, without navigating away.

## 6.9 Caching and rate-limiting (Redis, in practice)

`CACHES["default"]` points Django's cache framework at Redis. This project doesn't use Django's cache for arbitrary "cache this expensive query result" purposes anywhere in the code that was read — its real, load-bearing job is backing DRF's **throttle** system. Every throttle class in `settings.py`'s `DEFAULT_THROTTLE_RATES` table works by writing a counter key into this same Redis cache (e.g., a key like `throttle_auth_<hashed-ip>`) that increments on every matching request and automatically expires after the rate window. This is *why* rate limits in this project persist across separate `pytest` process restarts (a real, documented gotcha from this project's own engineering history) — an in-memory Python cache would reset every time the process restarts, but Redis keeps counting regardless of which process is asking.

---

# 7. Frontend Deep Dive

## 7.1 React fundamentals, applied to this codebase

Before the catalog, four React concepts you'll see constantly:

- **Components** are functions that return JSX (markup). `frontend/src/components/ui/Badge.jsx` is a component; so is an entire page like `frontend/src/pages/Dashboard.jsx`. Big components are built by composing small ones — this is called the **component tree**.
- **Props** ("properties") are the inputs a component receives from whoever renders it — exactly like arguments to a function. `<Badge domain="ticketStatus" label={ticket.status} />` is passing two props, `domain` and `label`, into the `Badge` component.
- **State** is data a component remembers *between* renders and can change over time (via React's `useState`), causing React to automatically re-render whenever it changes. A dropdown's open/closed flag, a form's current input values, and a fetched list of tickets are all state.
- **Hooks** are functions starting with `use` that let a plain function-component "hook into" React features — `useState` (remember a value), `useEffect` (run code in response to the component mounting, updating, or unmounting — almost always used here to fetch data), and this project's own custom hooks (Section 5.7), which are just regular JavaScript functions that happen to call other hooks internally, letting you extract and reuse stateful logic across many components without copy-pasting it.

## 7.2 Routing — `App.jsx` and the nine route guards

`frontend/src/App.jsx` is the traffic control center for the entire frontend. It does two jobs:

**Job 1 — code-splitting.** Notice the two different `import` styles at the top of the file: a handful of pages (`Dashboard`, `Login`, `NewTicket`, `Register*`, `TicketDetailPage`, `NotFoundPage`, `ForbiddenPage`) are imported *eagerly* (normal `import X from "./pages/X"`), meaning their code is bundled into the very first JavaScript file the browser downloads. Every other page — roughly 30 of them — is imported *lazily*, via `const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));`, meaning Vite compiles that page into its own separate file that the browser only downloads the first time a user actually navigates there. This keeps the initial page load small and fast: a customer landing on the marketing homepage never has to download the code for the Executive Analytics dashboard they'll never see.

**Job 2 — route guards.** `App.jsx` defines nine small wrapper components, each answering one specific access-control question by reading `useAuthStore`:

| Guard | Question it answers | Redirects unauthorized users to |
|---|---|---|
| `PrivateRoute` | Is anyone logged in at all? | `/login` |
| `PublicOnlyRoute` | Is this an *already logged in* user hitting `/login` or `/register`? | `/operations`, `/freelancer`, or `/dashboard` depending on role |
| `AdminRoute` | Is this specifically a Super Admin (`is_staff=True` **and** `role="admin"` — both required) | `/dashboard` |
| `FreelancerRoute` | Is this specifically an engineer? | `/operations` (staff) or `/dashboard` (everyone else) |
| `OpsRoute` | Is this any of the four internal staff roles? | `/dashboard` |
| `OpsManagerRoute` | Is this specifically an Ops Manager or Super Admin (not Finance/Support)? | `/403` |
| `FinanceRoute` | Is this specifically a Finance Manager or Super Admin? | `/403` |
| `PaymentRoute` | Is this an Ops Manager, Finance Manager, **or** Super Admin? | `/403` |
| `SuperAdminOpsRoute` | Is this specifically a Super Admin, reached from within `/operations/*`? | `/403` |

**A critical, load-bearing detail worth memorizing:** these guards are a *convenience and UX* layer — they stop an unauthorized user from ever seeing a flash of a page they can't use, and they send them somewhere sensible instead of a blank error. They are **not** the actual security boundary. The real security boundary is the Django backend's `permission_classes` on every single API endpoint (Section 6.5, Section 10) — even if a route guard were buggy or bypassed entirely, the backend would still refuse to return data to a role that isn't allowed to see it. This split (client-side guards for UX, server-side permissions for real security) is a standard and correct web-application pattern, and this project follows it consistently.

The whole app is also wrapped, from the outside in, by `<ToastProvider>` (global toast notifications), `<ErrorBoundary>` (catches any uncaught rendering crash and shows a recovery screen instead of a blank white page), and `<BrowserRouter>` (React Router's URL-matching engine), plus a global `<OfflineBanner />` and `<FloatingSupportWidgets />` rendered outside the `<Routes>` tree so they persist across every page.

## 7.3 State management — Zustand and Context, and when each is used

This project uses **two** different state-sharing mechanisms, each for a different kind of problem:

**Zustand (`store/authStore.js`)** holds exactly one thing: who is logged in. This is *global, long-lived, cross-cutting* state — nearly every page and component in the app needs to know the current user's identity and role, so it lives in one shared store any component can read from directly via `useAuthStore((s) => s.user)`, without a parent component having to manually pass `user` down through ten levels of props ("prop drilling").

**React Context (`context/ToastContext.jsx`)** implements the app-wide toast/snackbar system. Context is React's built-in mechanism for "any descendant of this Provider can call `useToast()` and get the same `addToast` function" — chosen here over Zustand specifically because toasts are a pure, self-contained UI concern (with their own internal rendering, in the Provider itself) rather than data other parts of the app need to *read*.

**Everything else is local `useState`,** deliberately. A form's current field values, a modal's open/closed flag, a table's current sort order — none of that needs to be globally shared, so it isn't. This project does not use Redux, MobX, or any other heavier state library — Zustand plus Context plus plain `useState` covers every real need in the app.

## 7.4 The API layer — already catalogued

Every frontend network call goes through one of the 13 files in `frontend/src/api/`, all built on the shared, interceptor-equipped `client.js` Axios instance. The full list of what each file wraps is in Section 5.6 — repeated here only as a reminder of the rule: **no page or component ever imports `axios` or calls `fetch()` directly.** This is what makes the JWT-attachment and auto-refresh behavior (Section 10.6) automatic and universal, with zero chance of a new page accidentally forgetting to attach the auth header.

## 7.5 Component composition — how the design system is layered

```
                    ┌─────────────────────────────────────────┐
                    │   components/ui/   (23 files)             │
                    │   Badge, Button, Card, Modal, Drawer,      │
                    │   Input, Select, Textarea, Spinner, ...    │
                    │   — the alphabet every other component     │
                    │     is spelled with. No business meaning.  │
                    └───────────────────┬─────────────────────┘
                                        │ built on top of
              ┌──────────────────────────┼───────────────────────────┐
              ▼                          ▼                           ▼
 ┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
 │ components/dashboard/     │ │ components/table/         │ │ components/filters/       │
 │ components/kb/            │ │ components/filters/       │ │                            │
 │ KPI tiles, charts, SLA     │ │ Pagination, sortable       │ │ Search/status/quick-view   │
 │ badges, health banners      │ │ headers, table shell        │ │ toolbars                   │
 └─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
              │                          │                           │
              └──────────────────────────┼───────────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │   components/tickets/   (19 files)         │
                    │   TicketDetail.jsx (918 lines) is the       │
                    │   composition root — pulls together        │
                    │   almost everything above into the single  │
                    │   most complex screen in the product.       │
                    └─────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │   pages/   (45 files)                       │
                    │   Each page fetches its own data and        │
                    │   assembles it from the layers above,       │
                    │   wrapped in AppShell / MainLayout /        │
                    │   OnboardingShell.                          │
                    └─────────────────────────────────────────┘
```

Two deliberate, documented "keep these separate" decisions worth calling out because they look, at first glance, like they could be merged:

- **`Modal`, `Drawer`, and `Popover`** are three different overlay primitives, not one component with a `variant` prop — `Modal` fully blocks the page and locks scrolling (for a committed action like assigning a ticket), `Drawer` is a lighter-weight slide-over that leaves the page behind it interactive (for a form you might dismiss quickly), and `Popover` is a small, non-blocking anchored dropdown with no backdrop at all (for a quick single input like pasting a remote-session URL). Each is intentionally shaped for a different interaction weight.
- **`components/ui/Badge.jsx`** (a general-purpose "domain"-driven chip for ticket status, severity, role, onboarding status, and payment status) and **`components/dashboard/SLABadge.jsx`** (a separate component for the unrelated SLA-health enum: overdue/due-soon/ok/met/no-deadline) are kept as two different components on purpose, because they represent two genuinely different, unrelated sets of possible values — merging them would mean stuffing two unrelated color-and-label lookup tables into one component's props.

## 7.6 Every page, organized by who uses it

`frontend/src/pages/` contains 45 files. Each is described below with its purpose, layout wrapper, real API calls, and notable behavior — read directly from the source code.

### 7.6.1 Public / marketing pages (10 files — no login required)

| Page | Purpose |
|---|---|
| `Landing.jsx` (1,519 lines — the largest page in the app) | The marketing homepage: hero, "How It Works," service highlights, trust signals, popular problems, a platform preview, an SLA promise section, recent-activity ticker, engineer profile showcase, a Help Center preview, a "become a freelancer" CTA, and an FAQ accordion — 15 self-contained sections, entirely static content plus `framer-motion` scroll-reveal animation, no API calls at all. |
| `AboutPage.jsx` | Mission, values, milestones timeline, and (fictional/placeholder) team bios. Static. |
| `ServicesPage.jsx` | Public catalogue of all eight service categories with a category filter, sourced from the static `data/services.js` file (not a live API call). |
| `PricingPage.jsx` | Explains the ₹299 consulting fee, a resolution-fee table per service, and severity surcharges — all figures come from the static `data/pricing.js` constants, deliberately kept in sync with the backend's `service_catalog.py` by convention (not by a shared source, since one is Python and one is JavaScript). |
| `ContactPage.jsx` | Contact-channel cards and a form that opens a pre-filled `mailto:` link — **does not submit to the backend** (a code comment marks this as "replace with API call in production"). |
| `HelpCenterPage.jsx` | Static self-service explainer (ticket lifecycle, payment process, refund policy, FAQ) with a sticky in-page section-jump nav — the one public-content page that uses the shared `MainLayout` wrapper instead of a custom header/footer. |
| `PrivacyPage.jsx` / `TermsPage.jsx` | Static legal text with a sticky table-of-contents sidebar. |
| `NotFoundPage.jsx` (404) | Generic "page not found," with a "Go home" button whose destination is computed from the current auth state (staff→`/admin`, freelancer→`/freelancer`, authenticated→`/dashboard`, else→`/`). |
| `ForbiddenPage.jsx` (403) | Generic "access denied" — the landing target every `OpsManagerRoute`/`FinanceRoute`/`PaymentRoute`/`SuperAdminOpsRoute` guard redirects to. |

### 7.6.2 Auth and onboarding pages (10 files)

| Page | Purpose |
|---|---|
| `Login.jsx` | Email/password sign-in plus optional "Sign in with Google," with role-based post-login redirect (staff→`/operations`, engineer→`/freelancer`, else→`/dashboard`) and a "session expired" banner (`?session_expired=1`, set by `client.js`'s interceptor). |
| `Register.jsx` | A simpler, generic/legacy registration form — appears to predate the newer role-specific flows below. |
| `RegisterRole.jsx` | "How would you like to use ResolveHQ?" — two large cards routing to `/register/customer` or `/register/freelancer`. |
| `RegisterCustomer.jsx` | Customer signup, including a two-step Google flow: if a brand-new Google account has no company name yet, a follow-up "one last thing" step captures it before redirecting to onboarding. |
| `RegisterFreelancer.jsx` | Engineer signup with a multi-select skill-tag picker (8 predefined skills) and an experience-level dropdown; shows a "reviewed by admin within 24h" notice. No Google OAuth option on this specific form. |
| `ForgotPassword.jsx` / `ResetPassword.jsx` | Request a reset link by email; complete the reset via the emailed `?uid=&token=` link. |
| `VerifyEmail.jsx` | Confirms the emailed verification link on mount, showing success or failure. |
| `onboarding/CustomerOnboarding.jsx` | 4-step post-registration wizard (Company Info → Industry → Team Size → Welcome), fully skippable at every step, persists the company name via a direct `PATCH /customers/me/` call. |
| `onboarding/FreelancerOnboarding.jsx` | 5-step wizard (Skills → Experience → Availability → Profile Check → Welcome) — notably, **this wizard does not save any of its collected data to the backend at all**; it is a purely client-side "getting you oriented" experience before landing on `/freelancer`. |

### 7.6.3 Customer-facing pages (10 files)

| Page | Purpose |
|---|---|
| `Dashboard.jsx` (667 lines) | A **role router**, not just a page — it renders `<Navigate>` straight to `/operations` for any staff role or `/freelancer` for engineers, and only customers actually see the real `CustomerDashboard`: a greeting, trust bar, 4 KPI tiles, a "Getting Started" banner for brand-new accounts, recent activity, and either a filtered ticket list or (when no filter is active) a 5-bucket triage view (Needs Your Attention / Overdue / Waiting On You / With Engineer / Recently Updated) computed client-side by `utils/customerTicketPriority.js`. |
| `NewTicket.jsx` | Thin wrapper around the `TicketForm` component; redirects to the new ticket's detail page on success. |
| `TicketDetailPage.jsx` | The generic ticket viewer for every role — resolves the correct fetch endpoint via `useRoleTicketFetcher`, then delegates all real rendering to the shared `TicketDetail` component (Section 7.7.3). Silently polls every 30 seconds while `status === "open" && role === "customer"`, to catch an engineer assignment without a manual refresh. |
| `ResolveTicketPage.jsx` (614 lines) | The dedicated "Resolution Workspace" at `/tickets/:id/resolve` — a full page where a freelancer or ticket-management staff fills in structured resolution fields (root cause, steps taken, notes are required; time spent and prevention are optional), attaches files, and either saves a draft or formally resolves the ticket. Blocks access unless `ticket.status === "in_progress"`. |
| `BillingPage.jsx` | Payment history with per-row PDF invoice download (via a Blob-download helper) and 3 summary stat cards. |
| `AnalyticsPage.jsx` | Personal (or, for admins, platform-wide) ticket analytics — hand-rolled SVG bar/donut charts, no charting library, deliberately color-matched to `Badge`'s severity palette so charts and badges never visually disagree. |
| `SettingsPage.jsx` | Two tabs: Profile (name plus role-specific fields — company/phone/address/GSTIN for customers, skills/availability for freelancers) and Security (change password). |
| `NotificationsPage.jsx` | Full notification inbox, date-grouped, built entirely on top of the `useNotifications` hook. |
| `KnowledgeBasePage.jsx` / `KnowledgeBaseArticlePage.jsx` | Self-service KB browsing (search + category filter + article grid) and single-article reading (Markdown-rendered body; staff additionally see a "Linked Tickets" card). |

### 7.6.4 The freelancer page (1 file)

`freelancer/EngineerWorkspace.jsx` (366 lines) is the engineer's entire home base: an AI-style daily brief, a workload donut, 4 productivity KPIs, a search + Quick Views filter bar, six client-computed triage sections (mirroring the customer dashboard's pattern but from the engineer's side — Requires Immediate Attention, Waiting on Internal Team, Today's Work, Waiting on Customer, Ready to Resolve, Recently Updated), a separately server-paginated Recently Closed list, bulk multi-select status updates, and a "new assignment arrived" banner detected by comparing ticket counts across 30-second polls.

### 7.6.5 Operations / staff / admin pages (14 files)

| Page | Purpose |
|---|---|
| `ops/OpsDashboard.jsx` | The Operations Command Center — Section 12 covers this in full detail. |
| `ops/OpsTicketQueue.jsx` (834 lines — the largest ops page) | The full ticket-management table: saved-view quick filters, a filter bar, a sortable+paginated table, single and bulk assign/status-update actions, and full URL-query-string synchronization (supports browser back/forward without losing filter state) via a `queryStateRef` pattern that keeps a `useCallback`'s dependency array stable while always reading current filter values. |
| `ops/OpsAssignments.jsx` | A focused assignment view — two columns (Assigned / Unassigned Open), an assignment-history drawer per ticket, and an "Assign Engineer" modal that ranks candidates by matching skills first. |
| `ops/OpsFreelancers.jsx` | A read-only engineer directory/roster with skill search and availability filtering. |
| `ops/OpsUsers.jsx` | Platform-wide user management — Super-Admin-only Change Role / Deactivate / Reactivate actions, each behind a confirmation step; every other role sees "View only." |
| `ops/OpsRoles.jsx` | A read-only audit log of every historical role change. |
| `ops/OpsServices.jsx` | CRUD for the service catalogue (name/description/required skills/status). |
| `ops/OpsPayments.jsx` | Payment table with Confirm/Refund actions, gated so only Super Admin can issue a refund while Finance Manager can confirm but not refund. |
| `ops/OpsSettings.jsx` | A stub — "Platform settings coming soon," not yet implemented. |
| `ops/OpsAnalytics.jsx` | Role-scoped analytics — an Operational section (Ops Manager/Super Admin) and a Financial section (Finance Manager/Super Admin), each independently gated. |
| `ops/ExecutiveAnalytics.jsx` (446 lines) | The full Executive dashboard — Section 11 covers this in complete detail. |
| `ops/OpsKnowledgeBase.jsx` | Staff-side Knowledge Base CRUD manager. |
| `admin/FreelancerList.jsx`, `admin/PaymentsDashboard.jsx` | **Two legacy/parallel admin pages** — both use raw `apiClient` calls directly (bypassing the `api/ops.js` wrapper functions) and the older `MainLayout` wrapper instead of `AppShell`, strongly suggesting these predate and were never fully consolidated with the newer `pages/ops/OpsFreelancers.jsx` and `pages/ops/OpsPayments.jsx`. Both remain reachable (`/admin/freelancers`, `/admin/payments`) and functional — documented here explicitly as a known duplication, not a bug to silently "fix" without product input. |

## 7.7 Every reusable component

`frontend/src/components/` contains 78 files. They are organized below exactly as they are on disk.

### 7.7.1 Design-system primitives — `components/ui/` (23 files)

The base vocabulary every other component is built from. None of these know anything about tickets, payments, or roles — they are pure, generic UI building blocks.

| Component | What it is |
|---|---|
| `Alert.jsx` | Shared error/warning/info/success banner box, replacing five separately hand-rolled variants that used to exist. |
| `Badge.jsx` (167 lines) | The canonical status chip — a `domain` prop (`ticketStatus`, `severity`, `onboarding`, `paymentStatus`, `role`, `active`) looks up the correct color/label from a config table, unifying what used to be several independently-drifting status-color implementations. |
| `Button.jsx` | The one button component for the whole app — `primary`/`secondary`/`danger`/`ghost`/`warning` variants, a `loading` state that shows a spinner and auto-disables. |
| `Card.jsx` | Shared card chrome (white background, border, rounded corners, shadow) with two header shapes — a small uppercase sidebar-style `title`, or a larger `header`/`description`/`viewAllTo` section-header shape. |
| `Drawer.jsx` | Right-side slide-over panel that does *not* lock page scrolling — for forms where the page behind should stay interactive. |
| `EmptyState.jsx` | The "nothing here" placeholder — icon, title, description, optional action — in a default or compact size. |
| `ErrorBoundary.jsx` | A class-based React error boundary catching any rendering crash in its subtree and showing a "Try again" / "Reload page" recovery screen instead of a blank white page. |
| `FileTypeBadge.jsx` | Small colored file-type badge (PDF/ZIP/image/spreadsheet/text/generic), sniffed from MIME type and filename extension. |
| `FloatingCallButton.jsx` | Two widgets in one file — a desktop floating call button and a mobile sticky call bar, both `tel:` links, both hidden entirely for staff users. |
| `FormSection.jsx` | A gradient-topped card grouping a labeled block of form fields. |
| `Input.jsx` / `Select.jsx` / `Textarea.jsx` | Styled form field wrappers sharing one size/error-state API. |
| `LiveDot.jsx` | An animated double-ring "ping" status dot, used everywhere something needs to visually read as "live" or "urgent." |
| `Modal.jsx` | The full-block centered dialog — includes a deliberately engineered, reference-counted body-scroll-lock fix (documented at length in-file) to correctly handle two modals toggling open/closed in the same React render commit. |
| `NotificationBell.jsx` (285 lines) | The header bell icon and its full dropdown — badge-pulse animation on new arrivals, lazy list fetch on first open, date-grouped rows, mark-read/mark-all-read. |
| `OfflineBanner.jsx` | A top-of-page banner shown when the browser loses network connectivity, with a green "reconnected" flash for 3 seconds on recovery. |
| `PageHeader.jsx` | The standard top-of-page title block (title, description, right-aligned actions). |
| `Popover.jsx` | A lightweight, non-blocking anchored dropdown (no backdrop) for quick single-field actions. |
| `RowCheckbox.jsx` | A checkbox supporting the visual "indeterminate" state (a DOM property with no plain JSX prop equivalent). |
| `Skeleton.jsx` / `Spinner.jsx` | Loading-state primitives — a shimmer placeholder div and a spinning-circle indicator, plus `PageSpinner`/`SkeletonCard`/`SkeletonDetailCard` composite loading layouts. |
| `StickyTicketCTA.jsx` | A floating "Create Ticket" pill that fades in once a visitor scrolls 400px down a marketing page. |

### 7.7.2 Dashboard / analytics components — `components/dashboard/` (17 files)

| Component | Purpose |
|---|---|
| `ActivityTimeline.jsx` | Vertical timeline of activity-log entries with a connecting line and per-action-type colored icon. |
| `AIDailyBriefCard.jsx` | Renders a "Daily Brief" — entirely computed client-side from already-fetched data via `utils/dailyBrief.js`/`utils/operationsBrief.js`, **no LLM call**, despite the "AI" name. |
| `DashboardSection.jsx` | Thin wrapper standardizing the "white card with a section header" shape used across every dashboard page. |
| `EngineerCapacityBoard.jsx` / `EngineerWorkloadBars.jsx` | Two similar-but-distinct engineer-workload bar charts — one reads the richer Command Center payload (active count + utilization %), the other reads the simpler `/ops/freelancers/` payload (raw active-ticket count only). |
| `KpiCard.jsx` / `KpiRow.jsx` | The canonical single-stat card and its grid wrapper — the single source of truth replacing four near-identical local implementations that used to exist across different dashboard pages. |
| `OperationsHealthBanner.jsx` | A horizontal "what needs attention right now" status strip for the Command Center, tone-computed (ok/warning/critical) from incident/breach/escalation/over-capacity counts. |
| `ServiceHealthGrid.jsx` | Per-service-category health grid (healthy/degraded/critical), driven by the backend's derived proxy metric (ticket volume + SLA breach rate — there is no real uptime signal to measure against). |
| `SLABadge.jsx` / `SLACountdown.jsx` | The SLA-specific status chip and live countdown text (distinct from `ui/Badge`, see Section 7.5). |
| `StatTile.jsx` | A flatter, no-shadow stat tile — a visually distinct family from `KpiCard`, used in analytics/payment summary rows. |
| `WorkloadSummaryPanel.jsx` | A donut breakdown of one engineer's own active tickets by status. |
| `charts/BarRow.jsx`, `charts/Donut.jsx`, `charts/ProgressBar.jsx`, `charts/Sparkline.jsx` | Four **zero-dependency, hand-rolled SVG chart primitives** — this project deliberately never adds a charting library (a confirmed, explicit product decision — see this project's own engineering history), instead building every bar/pie/trend-line visual from raw `<svg>` math. |

### 7.7.3 Ticket components — `components/tickets/` (19 files)

The most complex domain in the frontend, culminating in one very large composition root.

| Component | Purpose |
|---|---|
| `ActionIcons.jsx` | A small hand-inlined library of SVG icons (no icon package is installed anywhere in this project) used by ticket action buttons. |
| `AdminTicketActions.jsx` | The staff action panel — assign, change status, unassign, or jump to the Resolve workflow — gated entirely on `useRoles().isTicketManagementStaff`. |
| `AIAssistantPanel.jsx` | The internal agent-assist sidebar — root cause, resolution, related articles, similar tickets, and a tone-adjustable draft reply, all from the mock AI provider (Section 5.3). |
| `ConversationFeed.jsx` (601 lines) | The single unified conversation surface — merges comments, attachments, and activity events into one chronological, chat-style thread (the modern convention used by GitHub Issues/Linear/Intercom, rather than separate Comments/Files/Activity tabs). Supports drag-and-drop upload, clipboard-paste upload, an internal-note toggle that always resets after sending (preventing accidental leakage of a private note as public), and inline code-block formatting. |
| `CSATWidget.jsx` | Post-close satisfaction rating — a fallback path for when a ticket is closed directly by an admin without going through the normal accept-and-pay flow (which already collects CSAT). |
| `CustomerResolutionActions.jsx` (398 lines) | The customer's full decision flow once a ticket is resolved — Accept (pay → rate → close) or Reject (reopen with a note) — including a self-healing check for an "orphaned" state where CSAT exists but the ticket never actually closed. |
| `FreelancerTicketActions.jsx` | The engineer's action bar — advance status, request information from the customer via canned templates, upload a file, share a remote-session link. |
| `PaymentGateway.jsx` | The initial ₹299 consulting-fee payment CTA, dual-mode sandbox/live Razorpay. |
| `RelatedArticlesCard.jsx` | Sidebar Knowledge Base suggestions, with a staff-only "manage links" modal featuring debounced live search. |
| `ResolutionPanel.jsx` / `ResolutionSummary.jsx` | The structured resolution-summary capture form and its read-only display counterpart (Section 5.8's `resolution.js` explains the underlying encoding). |
| `TicketCard.jsx` | The compact clickable ticket-summary card used throughout list views. |
| `TicketDetail.jsx` (918 lines — the largest component in the entire codebase) | The complete ticket-detail page body and composition root — orchestrates nearly every other ticket component listed here, role by role, plus several internal sub-components (a status-milestone tracker, a post-payment preferences card, and the sidebar assembly logic). Fully diagrammed as part of Section 3.2's request/response walkthrough and Section 23's end-to-end story. |
| `TicketForm.jsx` | The new-ticket creation form with a live, itemized price preview. |
| `TicketSLAPanel.jsx` | Side-by-side Response SLA and Resolution SLA clocks, all computation delegated to the `useSlaClocks` hook. |
| `queue/BulkActionModal.jsx` | Shared two-step modal chrome factored out of what used to be duplicated bulk-action modal code. |
| `queue/EngineerBulkStatusModal.jsx` | Bulk status update for the Engineer Workspace — loops sequentially over selected tickets (no true bulk-update backend endpoint exists), reporting succeeded/failed counts. |
| `queue/TicketQueueTable.jsx` | The Ops Ticket Queue's sortable, selectable data table with a responsive desktop-grid/mobile-card layout switch. |
| `queue/TicketSectionList.jsx` | The shared row renderer for the Engineer Workspace's six triage sections. |

### 7.7.4 Table, filter, and Knowledge Base components (10 files)

| Component | Purpose |
|---|---|
| `table/Pagination.jsx` | A full pagination bar with a windowed page-number list (always shows first/last + a ±2 window with "…" gaps, so huge datasets never render hundreds of page buttons). |
| `table/SortableColumnHeader.jsx` | A clickable column header with an ↑/↓ active-sort indicator. |
| `table/TableCard.jsx` | Shared table-shell chrome (loading skeleton / empty state / real rows), extracted from identical blocks that used to be duplicated across ops list pages. |
| `filters/FilterBar.jsx`, `filters/QuickViews.jsx`, `filters/SearchInput.jsx`, `filters/SelectFilter.jsx` | The standard search + status + extra-filter toolbar, a horizontal "saved view" preset-pill row, and their two underlying input primitives. |
| `kb/ArticleCard.jsx`, `kb/ArticleEditorForm.jsx`, `kb/MarkdownRenderer.jsx` | The KB article summary card, the full create/edit form (with a live Markdown preview toggle), and the shared Markdown-to-styled-HTML renderer (styled manually per-element, since no `@tailwindcss/typography` plugin is installed — Section 2.15). |

### 7.7.5 Layout, onboarding, and auth components (9 files)

| Component | Purpose |
|---|---|
| `layout/AppShell.jsx` | The authenticated dashboard shell — fixed sidebar + slim mobile topbar — used by the customer Dashboard, Engineer Workspace, and every `/operations/*` page. |
| `layout/Sidebar.jsx` (328 lines) | The primary left-hand navigation — an entirely role-driven link tree (separate Customer, Engineer, and four-way-subdivided Ops navigation), with a hand-inlined ~15-icon SVG dictionary. |
| `layout/Header.jsx` (333 lines) | The top navigation bar for `MainLayout`-wrapped pages — extensive role-based conditional nav rendering (different Dashboard targets, hidden New Ticket button for staff, etc.). |
| `layout/Footer.jsx` / `layout/LandingFooter.jsx` | The compact authenticated-app footer and the large multi-column dark-theme marketing-site footer. |
| `layouts/MainLayout.jsx` | The generic public/non-dashboard page shell — Header + centered `<main>` + Footer. |
| `onboarding/OnboardingShell.jsx`, `onboarding/OnboardingStepHeader.jsx`, `onboarding/OnboardingFooterNav.jsx` | Shared chrome for both onboarding wizards — extracted after the two wizard pages were found to have byte-identical box-shadow/shell markup independently copy-pasted between them. |
| `auth/GoogleLoginButton.jsx` | The single place in the entire codebase that touches the `@react-oauth/google` library, deliberately isolated so no page component needs to know how Google OAuth works. |

### 7.7.6 The freelancer showcase component (1 file)

`freelancer/FreelancerProfileCard.jsx` (209 lines) — a rich public engineer-profile card (avatar, bio, skills, certifications, stats, star rating, an animated "available now" status dot) used on the Landing page's engineer showcase, reusable later for a public engineer-profile page. Notably, it hand-inlines its own pulse-dot animation rather than reusing `ui/LiveDot.jsx`, despite the visually identical technique — a small, documented duplication.

## 7.8 Charts and dashboard widgets — the zero-dependency decision

Every chart anywhere in ResolveHQ — bar charts, donut/pie charts, sparklines, progress bars — is hand-built from raw SVG and CSS, using the four primitives in `components/dashboard/charts/`. This was a deliberate, explicit product decision made during the Executive Analytics build (documented in this project's own engineering history) to stay "zero-dependency" rather than adding a charting library like Recharts or Chart.js, even though a charting library was the more conventional recommendation at the time. The trade-off: every new chart type requires someone to hand-write the SVG math (as `Donut.jsx`'s `strokeDasharray`/`strokeDashoffset` circle-slicing shows), but the resulting bundle stays smaller and every chart automatically matches the app's own design tokens exactly, with no library-specific theming to fight.

## 7.9 Responsive design

Tailwind's breakpoint prefixes (`sm:`, `md:`, `lg:`) are used throughout to adapt layouts for phones, tablets, and desktops — the most notable examples being `TicketQueueTable.jsx` (which switches from a desktop grid-column table to a stacked mobile card layout below the `md:` breakpoint) and the `useIsMobile()` hook (Section 5.7), which detects touch-primary devices via a `(hover: none) and (pointer: coarse)` media query to decide, for example, whether a phone number should render as a tappable `tel:` link (mobile) or a click-to-copy button (desktop) — a pattern repeated identically in `Footer.jsx`, `Header.jsx`, `LandingFooter.jsx`, `ContactPage.jsx`, `HelpCenterPage.jsx`, and `NotFoundPage.jsx`.

---

# 8. Database Deep Dive

## 8.1 What a relational database actually is, concretely

Think of PostgreSQL as a set of linked spreadsheets. Each **table** (like `Ticket` or `Payment`) is one spreadsheet — every row is one record, every column is one piece of information about that record. What makes it *relational* is that rows in one spreadsheet can point to rows in another via a shared ID — for example, every row in the `Ticket` spreadsheet has a `customer_id` column whose value matches exactly one row's ID in the `Customer` spreadsheet. This pointer is called a **foreign key**, and it's how the database knows "this ticket belongs to that customer" without duplicating the customer's entire information onto every single one of their tickets.

Every table in this project uses a **UUID** (Universally Unique Identifier — a 128-bit random-looking value like `a1b2c3d4-...`) as its primary key, instead of a simple incrementing number (1, 2, 3...). `models.py`'s own comments explain why: a sequential integer ID is *guessable* (if ticket `#41` exists, an attacker can reasonably assume `#42` and `#40` also exist and try to access them) and it *leaks business information* (a competitor watching your ticket IDs over time can estimate how many customers you have). A UUID is non-guessable and safe to expose directly in a URL, like `/tickets/a1b2c3d4-.../`.

## 8.2 Entity-relationship diagram

```
 CustomUser (the ONE login table for every role)
     │ 1-to-1                              │ 1-to-1
     ▼                                      ▼
 Customer ◄──────────────┐        Freelancer ◄──────────────┐
     │ 1-to-many          │            │ 1-to-many            │
     ▼                    │            ▼                      │
 Ticket ─────────────────►│      TicketAssignment ────────────┘
     │ 1-to-many                        (history of every
     ├──► TicketComment                  assignment ever made)
     ├──► TicketAttachment
     ├──► TicketActivityLog (immutable audit trail)
     ├──► SLALog
     ├──► Payment (1-to-many: consulting fee + resolution fee, separately)
     ├──► Payout (1-to-1, via the resolution Payment)
     ├──► CSATSurvey (1-to-1)
     ├──► Notification (1-to-many, one row per recipient per event)
     └──► KBArticleTicketLink ──► KBArticle

 Customer ──► Subscription (1-to-many, for future monthly/annual plans)
 Payment ──► InvoiceCounter (not a foreign key — a per-month sequence table)
 CustomUser ──► RoleChangeAudit (both as changer and as target)
 CustomUser ──► AuditLog (system-wide security/compliance log)
 Service (the platform's editable service catalogue — separate from the
          hardcoded pricing catalogue in service_catalog.py — see 8.3.19)
```

## 8.3 Every table, field by field

For every table below: what real-world thing it represents, its important fields, its relationships, and — for the ones that matter — its indexes and why they exist. Fields common to nearly every table (`id` as a UUID primary key, `created_at`/`updated_at` timestamps) are only called out where something unusual applies.

### 8.3.1 `CustomUser` — the one login table for everyone

Django's built-in `User` model can't be modified once a project has real data in it, so this project defines its own `CustomUser` (extending Django's `AbstractUser`) from day one, activated via `AUTH_USER_MODEL = "support_app.CustomUser"` in `settings.py`. This is the single table every one of the six roles logs in through.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (primary key) | Non-guessable, safe in URLs |
| `email` | unique email | **Replaces `username`** entirely (`username = None`) — this project logs in by email, not a separate username |
| `role` | choice: `customer`/`freelancer`/`admin`/`operations_manager`/`finance_manager`/`support_agent` | The single field that drives the entire authorization system (Section 10) |
| `is_verified` | boolean, default `True` | Set `False` on self-registration, flipped `True` after the emailed verification link is clicked |
| `is_staff` (inherited) | boolean | `True` **only** for Super Admins — grants Django admin panel access |
| `is_active` (inherited) | boolean | `False` = account is deactivated and cannot log in |
| Index: `idx_user_role_active` on `(role, is_active)` | | Speeds up "how many active customers/freelancers do we have" queries used throughout analytics |

A custom `CustomUserManager` provides `create_user()` (normalizes the email's domain casing, hashes the password with PBKDF2-SHA256 — never stores plain text) and `create_superuser()` (forces `is_staff=True`, `is_superuser=True`, `role="admin"`).

### 8.3.2 `Customer` — one row per business account

A **one-to-one extension** of `CustomUser` (`user = OneToOneField(...)`), holding fields that only make sense for customers: `company`, `phone`, `address`, `plan` (`free`/`silver`/`gold`/`platinum` — the subscription tier, currently mostly aspirational since ticket-level pay-per-use is the primary business model), `gstin` (validated against the real 15-character Indian GST format via `validate_gstin_format`), `oauth_provider`/`oauth_id` (set for Google-signup accounts), and `mfa_enabled` (a field that exists but, as of this reading, has no corresponding enrollment/verification flow built in `views.py` yet — installed groundwork, not a finished feature).

### 8.3.3 `Freelancer` — one row per engineer

Also a one-to-one extension of `CustomUser`. Key fields: `skills` (a comma-separated text tag list, e.g. `"aws,kubernetes,server_admin"` — deliberately a plain string, not a separate many-to-many table, kept simple since search is just a substring match), `availability` (`full_time`/`part_time`/`ad_hoc`/`unavailable` — feeds the utilization-percentage heuristic in Executive Analytics), `rating` (a decimal, currently always `0.00` in the schema — no rating-submission mechanism was found wired up in `views.py`, meaning it's a field waiting for a future feature), `onboarding_status` (`pending`/`approved`/`suspended` — a *pending* freelancer cannot act on tickets at all, enforced by `IsFreelancer`'s permission check), and `payout_details` (a `JSONField` storing bank/UPI transfer details — with an explicit code comment: **"intentionally excluded from all API serializers... Stored as plaintext JSON — at-rest encryption is a Phase 5 deliverable... Never expose this field via API."** This is an honestly-documented, known security gap, not a hidden one).

### 8.3.4 `Ticket` — the center of the universe

The single most important table in the schema. Every other feature in the product either creates, reads, or reacts to a `Ticket`.

| Field | Type / Choices | Notes |
|---|---|---|
| `ticket_number` | unique string, e.g. `TKT-A1B2C3D4` | Auto-generated by a `pre_save` signal from the tail of the ticket's own UUID (Section 6.7) |
| `customer` | FK → `Customer`, `on_delete=PROTECT` | **Cannot delete a customer who has tickets** — the database itself refuses the delete, protecting business/financial records |
| `service_type` | choice, sourced from `service_catalog.SERVICE_CHOICES` | One of the eight service categories — never hardcode this list elsewhere (Section 1.2) |
| `severity` | `low`/`medium`/`high`/`critical` | Drives SLA deadlines and the resolution-fee surcharge |
| `status` | `pending_payment`/`open`/`assigned`/`in_progress`/`resolved`/`closed` | The ticket lifecycle state machine — see the diagram in Section 8.4 |
| `communication_preference` | `phone`/`chat` (optional) | Set by the customer right after paying, while waiting for assignment |
| `preferred_language` | `english`/`hindi`/`marathi` (optional) | |
| `assigned_to` | FK → `Freelancer`, `on_delete=SET_NULL` | If a freelancer's account is ever deleted, the ticket stays but becomes unassigned — history is preserved separately in `TicketAssignment` |
| `first_response_at` / `first_response_due_at` | timestamps | The response-SLA clock (Section 6.6.1, Section 6.6.3) |
| `due_at` | timestamp | The resolution-SLA deadline |
| `sla_breach_notified` | boolean | A one-way flag preventing duplicate breach alerts |
| `remote_session_url` | URL (optional) | AnyDesk/TeamViewer link shared during active work |
| `notes` | text (optional) | Quick admin-only annotations — separate from the structured `TicketComment` internal-note mechanism |
| Indexes | `idx_ticket_status_customer`, `idx_ticket_assigned_status`, `idx_ticket_status_due_at` | Each speeds up one of the most common real query shapes in the app: "this customer's tickets by status," "this engineer's tickets by status," and "which active tickets have the earliest deadlines" (used constantly by the SLA and Command Center services) |

### 8.3.5 `TicketComment` — the conversation

One row per message. `is_internal` (boolean) is the single field that determines visibility — `False` means every party can read it, `True` means only staff and the assigned engineer can. `author` is `SET_NULL` on delete (so old messages survive even if the person who wrote them later has their account removed — the UI shows "Deleted User"). `is_edited` tracks whether a message was changed after posting, shown transparently to all parties as "(edited)."

### 8.3.6 `TicketAttachment` — uploaded files

Stores **metadata only** — `file_name`, `file_size`, `mime_type`, and either a real Django `FileField` (`file`, stored on local disk by default) or a `storage_url` (for a future S3-backed storage path). `uploaded_by` is `SET_NULL` on delete, preserving a security audit trail even for a since-deleted account.

### 8.3.7 `TicketActivityLog` — the immutable audit trail

**Rows are only ever inserted, never updated or deleted** (enforced both by convention in the service layer and literally locked down in the Django admin panel — Section 6.8). Every meaningful ticket event — creation, status change, severity change, assignment, comment, resolution, closure, reopening, SLA breach, escalation, KB article linking, AI suggestion use — writes one row here, with `from_value`/`to_value` stored as plain strings (not foreign keys) specifically so the log entry remains fully readable even if the referenced records are later changed or deleted. This is the data source for every "ticket timeline" UI in the frontend, the Operations Command Center's Activity Timeline widget, and any future dispute-resolution or compliance need.

### 8.3.8 `TicketAssignment` — assignment history, separate from "current state"

This table exists specifically because `Ticket.assigned_to` only ever shows *who has it right now* — the moment a ticket is reassigned, that old information is gone from the `Ticket` row itself. `TicketAssignment` is the permanent, append-only history: every row records one freelancer's tenure on one ticket, with `assigned_at`/`unassigned_at` timestamps and a `reason` (`initial`/`reassigned`/`freelancer_unavailable`/`customer_request`/`admin_action`/`auto_assigned`). `ticket_service.assign_ticket()` always writes to *both* tables together, inside one transaction (Section 6.6.1), so they can never disagree.

### 8.3.9 `Payment` — every financial transaction

`payment_type` distinguishes `consulting_fee`, `resolution_fee`, `subscription`, and `refund`. `customer` is `on_delete=PROTECT` (same reasoning as `Ticket.customer` — financial records must never be silently deleted), while `ticket` is `on_delete=SET_NULL` (**not** `CASCADE`) — meaning deleting a `Ticket` does *not* automatically delete its `Payment` records; they must be deleted explicitly, a deliberate safeguard against accidentally destroying financial history as a side effect of cleaning up ticket data. `invoice_number` is globally unique, generated under a database lock (Section 6.6.2). `gateway_refund_id` has its own index (`idx_payment_gateway_order_id` covers `gateway_order_id`) since refund/webhook lookups need to be fast.

### 8.3.10 `InvoiceCounter` — the sequence generator

Not a "business" table at all — a small, purely mechanical table with one row per calendar month (`year_month`, e.g. `"202607"`) and a `last_seq` integer, whose only job is to be locked and incremented by `payment_service._generate_invoice_number()` to guarantee gap-tolerant, duplicate-proof, sequential invoice numbers (Section 6.6.2).

### 8.3.11 `Payout` — what an engineer is owed

Created exactly once per ticket, the moment the resolution fee is paid (`OneToOneField` to `Ticket`, `on_delete=PROTECT`). Stores the frozen-at-payout-time breakdown: `resolution_fee` (pre-GST base + surcharge), `severity_surcharge`, `engineer_share` (65%), `platform_share` (35%). `status` moves from `pending` to `processed` once finance staff completes the actual bank/UPI transfer and records a `utr_number` (the bank's Unique Transaction Reference).

### 8.3.12 `Subscription` — monthly/annual plans

Represents the Silver/Gold/Platinum recurring plans referenced in `Customer.plan` and `Landing.jsx`'s pricing content. The model exists fully (plan choices, billing cycle, `tickets_used` counter, `started_at`/`expires_at`) but — based on the complete read of `views.py` — **there is no API endpoint anywhere that creates, upgrades, or checks usage against a Subscription.** This is schema built ahead of a feature that hasn't been wired up to the API yet; worth knowing so you don't go looking for a subscription-purchase flow that doesn't exist.

### 8.3.13 `SLAPolicy` — configurable SLA targets

An optional override table: a specific `(service_type, severity, plan)` combination can have its own `first_response_seconds`/`resolution_seconds`, looked up by `sla_service.get_sla_policy()` before falling back to the hardcoded `_DEFAULTS` dictionary (Section 6.6.3). `unique_together` on those three fields prevents two conflicting policies for the same combination.

### 8.3.14 `SLALog` — SLA events (with a known limitation)

Records `created`/`assigned`/`first_response`/`resolved`/`breach` events. **As documented at length in Section 6.6.3, this table is missing "met" events entirely** — it is not queryable for a true SLA-compliance percentage; that math must be done directly against `Ticket.resolved_at`/`due_at` instead.

### 8.3.15 `CSATSurvey` — how happy was the customer

One-to-one with `Ticket`. `score` is 1 (very unhappy) to 5 (very happy), with an optional free-text `comment`.

### 8.3.16 `Notification` — the in-app inbox

One row **per recipient, per event** — deliberately not a single event row with a many-to-many "read by" join table. The code's own analogy: "like email — the same event sends separate emails to each person. One person marking their email 'read' doesn't affect others." `category` is one of six values (`ticket_assigned`, `ticket_resolved`, `comment_added`, `status_changed`, `sla_breach`, `payment_confirmed`). Index `idx_notif_recipient_read` on `(recipient, is_read)` exists specifically to make the unread-count badge query (`WHERE recipient_id = ? AND is_read = false`) — hit every 30 seconds by every logged-in user's browser tab — as cheap as possible.

### 8.3.17 `AuditLog` — system-wide security/compliance log

A more general, model-agnostic audit table (distinct from the ticket-specific `TicketActivityLog`) — `entity` (a table name string like `"tickets"`), `entity_id`, `action`, a flexible `metadata` `JSONField`, and `ip_address`. Its docstring explicitly cites the reason: **DPDP Act 2023** — India's Digital Personal Data Protection Act — a real regulatory compliance driver for keeping this kind of record. Like `TicketActivityLog`, it is locked fully read-only in the Django admin.

### 8.3.18 `RoleChangeAudit` — who promoted/demoted whom

A dedicated, immutable log written every time `ops_change_role` succeeds (Section 9). Both `changed_by` and `target_user` are `SET_NULL` on delete, but `target_email` is separately *snapshotted* as a plain string at the moment of the change, so the record stays readable even if the target account is later deleted entirely.

### 8.3.19 `Service` — the *editable* platform catalogue (distinct from `service_catalog.py`)

This is one of the more subtle, easy-to-confuse parts of the schema: `Service` is a **database table**, editable by Ops Managers and Super Admins through `/operations/services` (name, description, status, required skills) — but it is a completely **separate, parallel concept** from `service_catalog.SERVICE_CATALOG`, the hardcoded Python list that actually drives ticket creation's `service_type` choices, pricing, and severity surcharges. Editing a `Service` row in the database does **not** change what a customer can select when opening a ticket, and does not change any price. As of this reading, `Service` appears to function as an internal-facing catalogue of *offerings the business provides* (useful for staff reference and future expansion) rather than the live pricing engine — that job belongs entirely to the static `service_catalog.py` file. This distinction is important enough that it's worth re-stating in Section 21 (Common Mistakes).

### 8.3.20 `KBArticle` and `KBArticleTicketLink` — the Knowledge Base

`KBArticle` holds `title`, an auto-generated unique `slug` (via a `pre_save` signal, Section 6.7), `body` (raw Markdown text), `category` (reuses the exact same eight service-catalog keys plus a ninth `"general"` catch-all — so KB articles line up with the same taxonomy customers already see when opening a ticket), `status` (`draft`/`published`), and `view_count` (incremented via a single atomic `UPDATE ... SET view_count = view_count + 1`, avoiding a read-then-write race condition under concurrent views). `published_at` is stamped automatically, once, the first time an article's status flips from `draft` to `published`.

`KBArticleTicketLink` is a **through-table** — a deliberate choice over a plain Django `ManyToManyField` — specifically so that *who* linked an article to a ticket, and *when*, is recorded (the same "always track who + when" convention used by `TicketAssignment` and `TicketAttachment`). A `UniqueConstraint` on `(article, ticket)` prevents linking the same article to the same ticket twice.

## 8.4 The ticket lifecycle state machine

```
 pending_payment ──(consulting fee paid)──► open ──(engineer assigned)──► assigned
                                                                              │
                                                                (engineer starts work)
                                                                              ▼
                                                                        in_progress
                                                                              │
                                                              (engineer marks resolved)
                                                                              ▼
                                                                          resolved
                                                                     ╱              ╲
                                              (customer pays + rates)          (customer rejects)
                                                        ▼                                ▼
                                                     closed                     back to in_progress
```

A few rules worth memorizing, all enforced in `ticket_service.update_status()` and the permission layer: **`in_progress` covers all active work, including ordinary back-and-forth messaging with the customer** — there is deliberately no separate "waiting on customer" *status*; that information instead lives in the *computed* `waiting_on_customer` signal (Section 6.3), keeping the actual state machine simple while still surfacing the richer "who owns the next reply" nuance in the UI. **Freelancers can never move a ticket directly to `closed`** — only `in_progress` and `resolved` (`FreelancerStatusSerializer`'s choice list is deliberately narrower than the admin/ops equivalent). **A closed ticket can never be updated again** (`update_status` explicitly raises if `ticket.status == "closed"`) — the only way back into activity is the customer's reject-resolution flow, which only works from `resolved`, not from `closed`.

## 8.5 Migrations — the database's own history book

The 27 files in `backend/support_app/migrations/` are, read top to bottom, a literal chronology of every schema decision made on this project: `0001_initial` (the original schema), `0002_phase3_ticket_improvements`, `0003_phase4_notification_model`, ... through `0024_remove_waiting_customer_status` (removing that dedicated status in favor of the computed `waiting_on_customer` signal described above), `0025_add_knowledge_base_and_activity_actions`, `0026_replace_service_catalog` (the service-category rename from the old desktop/linux/windows/patching/security/vmware/sap set to today's laptop_desktop/server_admin/aws/azure/kubernetes/database/devops_cicd/infra_automation set), and `0027_alter_freelancer_skills_alter_kbarticle_category_and_more` (the most recent, syncing field choices after that rename). **The rule for adding a new migration, always: never hand-edit an already-applied migration file** — Django tracks which migrations have run in its own `django_migrations` table, and editing history after the fact desynchronizes that tracking from reality. Always generate a *new* numbered file for a *new* change (Section 20 walks through exactly how).

---

# 9. API Deep Dive

Every URL in this section is read directly from `backend/support_app/urls.py` and cross-referenced against its handler in `views.py`. All paths are prefixed with `/api/`. "Permission" lists the exact `permission_classes` declared on that view. Where a dedicated frontend caller exists, it's named from Section 5.6's API-layer catalog.

## 9.1 System and authentication

| Method & URL | Permission | Purpose |
|---|---|---|
| `GET /health/` | none (public) | Returns `{"status": "ok", "db": true}` (200) or `{"status": "degraded", "db": false}` (503) — used by every Docker healthcheck and the production deploy workflow |
| `POST /auth/register/` | public, throttled 5/min | Creates a customer or freelancer account (`RegisterSerializer`), returns JWT tokens + user info; fires (best-effort, non-blocking) welcome + verification emails |
| `POST /auth/login/` | public, throttled 5/min | `CustomTokenObtainPairView` — the standard SimpleJWT login, extended to also return `{id, email, is_staff, role, first_name, last_name}` alongside the tokens |
| `POST /auth/logout/` | public | Blacklists the given refresh token (always returns 204, even on a bad/missing token) |
| `POST /auth/google/` | public, throttled 5/min | Verifies a Google OAuth access token against Google's own `tokeninfo`/`userinfo` endpoints, gets-or-creates a `customer`-role account, returns JWTs + a `needs_company` flag |
| `POST /auth/token/refresh/` and `POST /auth/refresh/` | public | Both are the identical SimpleJWT `TokenRefreshView` — two URLs kept because the Axios interceptor uses the first one; the second is a cleaner public alias |
| `GET /auth/me/` | authenticated | Returns identity + role-specific `profile` sub-object for **any** role — the correct endpoint for the frontend's post-refresh session check (unlike `/customers/me/`, which 403s for non-customers) |
| `GET/PATCH /auth/profile/` | authenticated | Read/update your own name plus role-specific fields (company/phone/address/gstin, or skills/availability) |
| `POST /auth/change-password/` | authenticated, throttled 5/15min | Requires the current password; validates the new one against Django's password rules + `StrongPasswordValidator` |
| `POST /auth/verify-email/` | public | Confirms an emailed `uid`/`token` pair, sets `is_verified=True` |
| `POST /auth/verify-email/resend/` | authenticated | Re-sends the verification email |
| `POST /auth/password/reset/` | public, throttled 5/min | Always returns 200 regardless of whether the email exists (anti-enumeration) |
| `POST /auth/password/reset/confirm/` | public | Validates the token, sets the new password |

## 9.2 Customer profile, services, and tickets (customer-facing)

| Method & URL | Permission | Purpose |
|---|---|---|
| `GET/PATCH /customers/me/` | `IsCustomer` | Own `CustomerSerializer` profile |
| `GET /customers/me/payments/` | `IsCustomer` | Own payment history |
| `GET /services/` | public | The full service catalogue with prices and severity surcharges — powers `TicketForm`'s live pricing preview |
| `GET/POST /tickets/` | `IsCustomer` | List own tickets (with `?status=`, `?exclude_status=`, `?service_type=`, `?severity=`, `?search=`, `?ordering=`, `?page_size=`) or create a new one |
| `GET/PATCH /tickets/{id}/` | `IsOwnerOrStaff` | Full ticket detail; PATCH is customer-or-Super-Admin only, for editing description/preferences before assignment |
| `GET/POST /tickets/{id}/comments/` | authenticated | List/add comments — visibility and `is_internal` write-permission both vary by role |
| `GET /tickets/{id}/activity/` | authenticated | The event timeline, access-scoped like the ticket itself |
| `GET /tickets/{id}/related/` | authenticated | Up to 5 other tickets from the *same customer* (deliberately not cross-customer similarity — that's the staff-only AI panel's job) |
| `POST /tickets/{id}/csat/` | `IsCustomer` | Submit a 1–5 rating for a **closed** ticket (a fallback path — the primary rating flow is bundled into accept-resolution below) |
| `POST /tickets/{id}/accept-resolution/` | `IsCustomer` | Idempotent: submits CSAT + closes the ticket in one atomic call; self-heals an orphaned "CSAT exists but ticket never closed" state |
| `POST /tickets/{id}/reject-resolution/` | `IsCustomer` | Reopens to `in_progress`, notifies the assigned engineer by email |
| `POST /tickets/{id}/initiate-payment/`, `POST /tickets/{id}/verify-payment/` | `IsCustomer` | The consulting-fee (₹299) payment flow |
| `GET /tickets/{id}/resolution-quote/`, `POST /tickets/{id}/initiate-resolution-payment/`, `POST /tickets/{id}/verify-resolution-payment/` | `IsCustomer` | The resolution-fee payment flow — the last of these three also saves CSAT and creates the engineer payout |
| `GET/POST /tickets/{id}/attachments/`, `DELETE /tickets/{id}/attachments/{attachment_id}/` | authenticated | File upload/list/delete, three-layer validated (Section 6.4) |

## 9.3 Payments (customer + admin) and notifications

| Method & URL | Permission | Purpose |
|---|---|---|
| `GET /payments/{id}/` | `IsCustomer` (own only) | One payment's detail |
| `GET /payments/{id}/invoice/` | authenticated (owner or any staff) | Streams a generated GST tax invoice PDF |
| `POST /payments/webhook/` | public (Razorpay-signature-verified, not JWT) | Razorpay's server-to-server payment confirmation callback |
| `GET /admin/payments/` | `IsAdminUser` | All payments, filterable — a legacy/parallel path to the newer `/ops/payments/` |
| `POST /admin/payments/{id}/confirm/` | `IsAdminUser` | Manual payment confirmation for when a webhook fails to arrive |
| `GET /notifications/`, `GET /notifications/unread-count/`, `PATCH /notifications/{id}/read/`, `POST /notifications/mark-all-read/` | authenticated | The full in-app notification inbox, scoped to the caller |

## 9.4 Freelancer-only endpoints

| Method & URL | Permission | Purpose |
|---|---|---|
| `GET /freelancer/tickets/` | `IsFreelancer` | Own assigned tickets (with `?status=`, `?exclude_status=`, `?search=`, `?page_size=`) |
| `GET /freelancer/tickets/{id}/` | `IsFreelancer` | Full detail of an own assigned ticket (404 otherwise, not 403 — doesn't reveal existence) |
| `POST /freelancer/tickets/{id}/status/` | `IsFreelancer` | Move to `in_progress` or `resolved` only — never `closed` |
| `POST /freelancer/tickets/{id}/remote-session/` | `IsFreelancer` | Attach an AnyDesk/TeamViewer URL and post it as a comment |

## 9.5 Legacy admin ticket/freelancer management

| Method & URL | Permission | Purpose |
|---|---|---|
| `GET /admin/tickets/` | `IsAdminUser` | All tickets, filterable — the older, Super-Admin-only counterpart to `/ops/tickets/` |
| `POST /admin/tickets/{id}/assign/`, `/status/`, `/unassign/` | `IsAdminUser` | Same underlying `ticket_service` functions as their `/ops/` equivalents |
| `GET/POST /admin/freelancers/` | `IsAdminUser` | List, or atomically create a User+Freelancer pair via `FreelancerCreateSerializer` |

## 9.6 Analytics (the original, role-aware endpoint)

`GET /analytics/` — authenticated, throttled 30/hour — a single endpoint that changes its own scope entirely based on who's asking: Super Admin/internal-staff roles see every ticket; a freelancer sees only their assigned tickets; a customer sees only their own. This predates the newer `ops_analytics` and `executive_analytics` endpoints and remains the one the customer-facing `AnalyticsPage.jsx` and Engineer Workspace call.

## 9.7 The Operations namespace (`/ops/`) — staff only, role-layered

This is the largest, most finely role-gated group of endpoints in the API. Every row below requires at minimum `IsAuthenticated` plus the listed class.

| Method & URL | Permission | Purpose |
|---|---|---|
| `GET /ops/dashboard/` | `IsAnyStaffRole` | Aggregated overview metrics; omits the `revenue` field specifically for Support Agents |
| `GET /ops/tickets/` | `IsAnyStaffRole` | The full ops ticket queue — `django-filter`-powered (`status`, `service_type`, `assigned_to`, and a `priority` alias for `severity`), plus search and `ordering_fields` |
| `POST /ops/tickets/{id}/assign/`, `/unassign/`, `/status/`, `/escalate/` | `IsTicketManagementStaff` | Ops Manager, Support Agent, or Super Admin only — **Finance Manager is explicitly blocked from all four** |
| `GET /ops/tickets/{id}/history/` | `IsAnyStaffRole` | Read-only activity log for any ticket |
| `GET /ops/freelancers/` | `IsAnyStaffRole` | Engineer directory with live active-ticket counts, filterable by availability/skill |
| `GET /ops/users/`, `GET /ops/users/{id}/` | `IsOpsManagerOrSuperAdmin` | User list/detail, read-only for Ops Manager, full for Super Admin |
| `POST /ops/users/{id}/role/` | `IsSuperAdmin` | Change a user's role — validated against a hardcoded `_ALLOWED_TRANSITIONS` matrix, blocks self-changes, writes a `RoleChangeAudit` row |
| `POST /ops/users/{id}/deactivate/`, `/reactivate/` | `IsSuperAdmin` | Toggle login ability — self-deactivation is explicitly blocked |
| `GET /ops/role-audit/` | `IsOpsManagerOrSuperAdmin` | The full role-change history log, searchable |
| `GET/POST /ops/services/`, `GET/PATCH /ops/services/{id}/`, `POST /ops/services/{id}/toggle/` | `IsOpsManagerOrSuperAdmin` | CRUD for the platform `Service` catalogue table (Section 8.3.19 — distinct from ticket pricing) |
| `GET /ops/payments/`, `GET /ops/payments/summary/` | `IsPaymentReader` | Ops Manager gets read-only visibility; response serializer varies (`OpsPaymentSerializer` adds `refund_eligible` for Finance Manager/Super Admin) |
| `POST /ops/payments/{id}/confirm/`, `/refund/` | `IsFinanceManagerOrSuperAdmin` | Manual confirmation, and irreversible refund issuance (idempotent, row-locked — Section 6.6.2) |
| `GET /ops/command-center/`, `GET /ops/command-center/live/` | `IsAnyStaffRole` | The Operations Command Center's two-tier payload — full detail in Section 12 |
| `GET /ops/analytics/` | `IsAnyStaffRole` | Role-scoped operational/financial sections — full detail in that page's description, Section 7.6.5 |
| `GET /ops/executive-analytics/` | `IsExecutiveAnalytics`, throttled 30/hour (shared bucket with `/analytics/`) | The unified Executive dashboard payload — full detail in Section 11 |

## 9.8 Knowledge Base and AI Assistant

| Method & URL | Permission | Purpose |
|---|---|---|
| `GET/POST /kb/articles/` | `IsStaffOrReadOnly` (any authenticated user reads; only internal staff writes) | Browse/search (customers/freelancers see published only; staff also see drafts) or create |
| `GET/PATCH/DELETE /kb/articles/{id}/` | `IsStaffOrReadOnly` | View (increments `view_count`), edit, or delete |
| `GET /kb/categories/` | public-ish (no explicit override — falls to the global default) | The fixed category list (service catalogue + "General") |
| `GET /tickets/{id}/kb-articles/` | authenticated | Linked + auto-suggested articles for a ticket |
| `POST/DELETE /tickets/{id}/kb-articles/{article_id}/link/` | `IsTicketManagementStaff` | Attach/detach an article, logging a `kb_article_linked` activity event on link |
| `GET /tickets/{id}/ai-assistant/` | `IsTicketManagementStaff`, throttled 20/min | Root cause, resolution, related articles, similar tickets, and a tone-adjustable draft reply from the mock AI provider |
| `POST /tickets/{id}/ai-assistant/log-insert/` | `IsTicketManagementStaff` | Records (as an `ai_suggestion_used` activity event) that a staff member actually inserted the AI's draft reply |

## 9.9 A worked example: tracing one endpoint completely

To make the abstraction concrete, here is `POST /api/ops/tickets/{ticket_id}/assign/` traced through every layer, file, and line:

1. **URL** (`support_app/urls.py:132`): `path("ops/tickets/<uuid:ticket_id>/assign/", views.ops_assign_ticket, name="ops-assign-ticket")`.
2. **Permission** (`views.py`): `@permission_classes([permissions.IsAuthenticated, IsTicketManagementStaff])` — a Finance Manager's request is rejected with 403 before `ops_assign_ticket`'s body runs at all.
3. **Request validation** (`serializers.py`): `AdminAssignSerializer` requires exactly one field, `freelancer_id` (a UUID) — a malformed or missing value returns 400 automatically.
4. **View body** (`views.py :: ops_assign_ticket`): rejects assignment on a `pending_payment` ticket (400), looks up the `Freelancer` (404 if it doesn't exist), then delegates entirely to the service layer.
5. **Service** (`services/ticket_service.py :: assign_ticket`): the full atomic five-step sequence from Section 6.6.1.
6. **Notifications** (`services/notification_service.py`): three separate `create_notification()` calls — the newly-assigned freelancer, the customer, and every other on-duty Support Agent/Ops Manager (excluding the person who made the assignment).
7. **Response**: `TicketDetailSerializer(ticket).data`, HTTP 200.
8. **Frontend caller**: `frontend/src/api/ops.js :: opsAssignTicket(ticketId, freelancerId)`, called from `AdminTicketActions.jsx`'s assign modal and `OpsAssignments.jsx`'s `AssignEngineerModal`.

---

# 10. Authentication System

## 10.1 What "authentication" and "authorization" mean, and why they're two different problems

**Authentication** answers "who are you?" **Authorization** answers "are you allowed to do this?" ResolveHQ solves the first problem with JWTs (this section) and the second with the role/permission system already documented in Section 6.5 and Section 7.2 — this section focuses on the mechanics of *staying logged in* correctly and securely.

## 10.2 What a JWT actually contains

A JWT (JSON Web Token) is three pieces of Base64-encoded text joined by periods: `header.payload.signature`. The **payload** contains claims — in this project, things like the user's ID, their role, and an expiration timestamp. The **signature** is a cryptographic proof, computed using the server's secret key, that the payload hasn't been tampered with since the server issued it. Critically: **a JWT's payload is *readable* by anyone who has the token** (it's only Base64-encoded, not encrypted) — it is *tamper-evident*, not *secret*. This is why ResolveHQ never puts a password or other truly sensitive data inside a JWT payload — only identity claims that are safe to be technically "visible" as long as they can't be *forged*.

## 10.3 Access tokens vs. refresh tokens — two tokens, two jobs

ResolveHQ issues **two** tokens on every login, each with a different lifetime and a different job:

| | Access token | Refresh token |
|---|---|---|
| **Lifetime** | 15 minutes (`JWT_ACCESS_TOKEN_LIFETIME_MINUTES`) | 7 days (`JWT_REFRESH_TOKEN_LIFETIME_DAYS`) |
| **Job** | Sent on *every single API request* as proof of identity | Used *only* to obtain a new access token when the old one expires |
| **Stored where (frontend)** | `sessionStorage` — cleared automatically when the browser tab closes | `localStorage` — persists across tab closes and browser restarts |

**Why two tokens with such different lifetimes, instead of one long-lived token?** This is a real, deliberate security trade-off. A short-lived access token limits the damage window if it's ever stolen (e.g., via an XSS attack) — a stolen access token is useless within 15 minutes. But forcing a user to re-enter their password every 15 minutes would be unusable, so the longer-lived refresh token exists specifically to *silently* obtain new access tokens without ever bothering the user — as long as that refresh token itself stays valid.

**Why `sessionStorage` for the access token and `localStorage` for the refresh token — not just one storage for both?** This is a specific, documented security hardening (labeled "H-09" in this project's own code comments, dated 2026-06-15) with an honestly-stated trade-off: `sessionStorage` clears when a browser tab closes, so if an attacker's malicious JavaScript (via an XSS vulnerability) manages to read `sessionStorage`, it only gets a token valid for the *current* tab session — it cannot persist that theft across the victim closing and reopening their browser. The refresh token in `localStorage` *does* persist (that's its whole job — keeping you logged in across visits) — the code comment is explicit that this is a real remaining trade-off: **"XSS can still read sessionStorage within the active tab. Full protection requires httpOnly cookies (a documented future roadmap item)."** This document reports this honestly rather than overstating the current security posture.

`ROTATE_REFRESH_TOKENS = True` plus `BLACKLIST_AFTER_ROTATION = True` (in `SIMPLE_JWT` settings) means every single time the refresh token is used, the server issues a *brand new* refresh token and immediately invalidates the old one (adding it to `rest_framework_simplejwt.token_blacklist`'s database table). This means a stolen refresh token has a much narrower window of usefulness than it otherwise would — the moment the legitimate user's browser uses it again, the stolen copy stops working.

## 10.4 The login flow, step by step

```
1. User submits email + password on Login.jsx
2. useAuth().loginUser() calls POST /api/auth/login/ (api/auth.js :: login)
3. Backend: CustomTokenObtainPairView (extends SimpleJWT's login view)
   → validates credentials → issues {access, refresh, user: {...}}
4. Frontend: authStore.setTokens(access, refresh)
     → access  saved to sessionStorage
     → refresh saved to localStorage
   authStore.setUser(user) → saved to localStorage AND to Zustand's in-memory state
5. Login.jsx redirects based on user.role:
     staff roles  → /operations
     freelancer   → /freelancer
     everyone else → /dashboard
```

## 10.5 Google Sign-In — the actual verification steps

`google_auth_view` (`views.py`) does **not** trust the frontend's claim about who the Google user is — it independently re-verifies with Google itself, in two separate calls:

1. **Token ownership check**: calls Google's `https://oauth2.googleapis.com/tokeninfo` endpoint with the access token, and confirms the returned `azp` (authorized party) field matches `GOOGLE_OAUTH_CLIENT_ID` — this specifically prevents a valid Google token that was issued to a *different* application from being replayed against ResolveHQ's backend.
2. **Profile + verification check**: calls `https://www.googleapis.com/oauth2/v3/userinfo` with the token, and requires `email_verified: true` in the response — a Google account with an unconfirmed email cannot be used to sign in.

Only after both checks pass does the backend `get_or_create` a `CustomUser` (with `role="customer"`, an unusable password — `set_unusable_password()`, since this account can never log in with a password directly), and issue JWTs identically to the normal login flow. If the account is brand-new and has no `company` name on its `Customer` profile yet, the response includes `needs_company: true`, which is what triggers `RegisterCustomer.jsx`'s follow-up "one last thing" company-name step (Section 7.6.2).

## 10.6 Staying logged in — the Axios interceptor's automatic refresh

This is the mechanism that lets a user's session survive far longer than the 15-minute access token, without ever showing them a "please log in again" screen unnecessarily. It lives entirely in `frontend/src/api/client.js`:

```
 Every outgoing request
      │
      ▼
 Request interceptor: attach "Authorization: Bearer <access_token>"
 (read fresh from sessionStorage on every single request — not cached)
      │
      ▼
 Request sent
      │
      ▼
 Response received
      │
      ├── Success (2xx) ─────────────────────────► pass through untouched
      │
      └── 401 Unauthorized AND not already retried once
               │
               ▼
          Read refresh_token from localStorage
               │
               ▼
          POST /api/auth/token/refresh/  { refresh: refresh_token }
               │
          ┌────┴────┐
          ▼         ▼
      Success    Failure
          │         │
          ▼         ▼
   Save new access  Clear all stored tokens/user
   (+ new refresh,  window.location.replace(
   since rotation     "/login?session_expired=1")
   is on) → RETRY
   the original
   failed request
   automatically
```

The `originalRequest._retry = true` flag is what prevents an infinite loop — if the *retried* request also somehow comes back 401 (meaning the refresh token itself was invalid or expired too), the code does not try to refresh again; it falls straight through to the failure branch and forces a clean logout. The `session_expired=1` query parameter is what powers `Login.jsx`'s "your session expired, please sign in again" banner — a small but real UX detail that prevents a confusing, unexplained bounce back to the login page.

## 10.7 `initializeAuth()` — what happens on every page refresh

Because a full browser refresh wipes all of React's in-memory state, `App.jsx` calls `authStore.initializeAuth()` exactly once on mount, and blocks rendering any route until it finishes (`if (initializing) return <Spinner />`) — without this guard, a route guard like `AdminRoute` would briefly evaluate `user === null` before the real profile fetch returns, and incorrectly redirect a legitimate admin away.

`initializeAuth()`'s logic, exactly: if neither an access token nor a refresh token exists anywhere, the user has genuinely never logged in (or fully logged out) — set `isAuthenticated: false` immediately, no network call needed. Otherwise, it **always** calls `GET /api/auth/me/` to re-validate against the server — this is deliberate, not redundant: it's what catches an account that was deactivated, or had its role changed, by a Super Admin *since* the last time this browser tab loaded, rather than trusting a possibly-stale cached user object. If that call fails with a genuine `401`, the session truly is dead — clear everything. If it fails for any *other* reason (a network error, the server being briefly down), the code deliberately falls back to the last cached user from `localStorage` rather than forcing a logout — a documented "offline tolerance" design choice, so a flaky connection doesn't kick a legitimate user out of an app they were already using.

## 10.8 Logout

`authStore.logout()` first attempts `POST /api/auth/logout/` with the current refresh token (which blacklists it server-side, so it can never be used again even if it leaked) — but this is explicitly "fire-and-forget": even if that network call fails entirely (server unreachable), the function *still* proceeds to clear every local token and reset Zustand's state, guaranteeing the user is logged out in their own browser regardless of network conditions.

## 10.9 The complete role → access matrix

Combining Section 1.4, Section 6.5, and Section 7.2 into one reference table:

| Capability | Customer | Engineer | Support Agent | Ops Manager | Finance Manager | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Create/view own tickets | ✅ | — | — | — | — | ✅ |
| Work assigned tickets | — | ✅ | — | — | — | ✅ |
| Assign/reassign/escalate any ticket | — | — | ✅ | ✅ | — | ✅ |
| View all tickets (read) | — | — | ✅ | ✅ | ✅ | ✅ |
| View payments / confirm | — | — | — | read-only | ✅ | ✅ |
| Issue refunds | — | — | — | — | — | ✅ |
| Manage services catalogue | — | — | — | ✅ | — | ✅ |
| Manage users / change roles | — | — | — | read-only | — | ✅ |
| View Executive Analytics | — | — | — | ✅ | ✅ | ✅ |
| Django admin panel (`/django-admin/`) | — | — | — | — | — | ✅ |

---

# 11. Executive Analytics

## 11.1 What it's for, and who it's for

The Executive Analytics dashboard (`/operations/executive-analytics`, `ExecutiveAnalytics.jsx`) is ResolveHQ's answer to what tools like ServiceNow Performance Analytics or Jira Service Management's reporting dashboards provide for a traditional help desk — a leadership-facing view answering "how healthy is the business, this period, compared to last period," not "what does any one person need to do right now" (that's the Operations Command Center, Section 12). Access is restricted to exactly three roles — Super Admin, Operations Manager, and Finance Manager — via the dedicated `IsExecutiveAnalytics` permission class.

## 11.2 One endpoint, one unified payload

Unlike `ops_analytics` (Section 9.7), which returns *different sections* depending on the caller's specific role, `GET /api/ops/executive-analytics/` always returns the **same complete payload** to all three permitted roles. The reasoning, straight from the code: since access is already gated to exactly those three roles at the permission layer, there's no need to *also* partition the response — anyone who can see the dashboard at all is trusted to see all of it.

## 11.3 The period system

Every metric in the payload is computed over a resolved date window, chosen by `resolve_period()`: either an explicit `?start=` / `?end=` pair of ISO dates, or a `?period=` shortcut — `7d`, `30d` (the default), `90d`, or `all` (from the very first ticket ever created). For every window, the service also computes the *immediately preceding window of the same length* (`prev_start`/`prev_end`) — this is what powers every "▲ 12% vs. last period" delta shown on the Executive Summary KPI tiles.

## 11.4 Every metric group, and exactly how it's computed

| Payload section | Backend function | What it answers |
|---|---|---|
| `summary` | `get_summary()` | Total/open/closed ticket counts, total revenue, SLA compliance %, average CSAT, active customer count — each with a period-over-period % change |
| `operational_health` | `get_operational_health()` | Created-vs-resolved ticket volume trend (auto-bucketed by day if the window is ≤45 days, by week otherwise), open-vs-closed split |
| `sla` | `get_sla_metrics()` | Resolution and first-response compliance percentages, met/missed counts, average resolution and first-response times in hours |
| `engineer_utilization` | `get_engineer_utilization()` | Per-engineer active load, resolved count, average resolution time, and a **utilization %** heuristic |
| `ticket_aging` | `get_ticket_aging()` | How long currently-open tickets have been sitting, bucketed 0-1 / 1-3 / 3-7 / 7+ days |
| `priority_distribution`, `ticket_status_distribution`, `service_category_distribution` | Three similar `Count`-and-`group by` functions | Volume breakdowns by severity, status, and service category |
| `csat` | `get_csat_metrics()` | Average score, response count, weekly trend |
| `top_problem_categories` | `get_top_problem_categories()` | The 5 highest-volume services, each with an average resolution time |
| `recently_breached_tickets` | `get_recently_breached_tickets()` | Up to 10 tickets that missed their SLA, with how many minutes over |
| `most_active_customers` | `get_most_active_customers()` | Top 10 customers by ticket count in the window, with associated revenue |
| `revenue` | `get_revenue_metrics()` | Total revenue, a trend, a breakdown by payment type, and total pending engineer payouts |
| `sla_trend` | `get_sla_trend()` | The same resolved-vs-due comparison as `sla`, bucketed over time |
| `insights` | `get_executive_insights()` | A handful of deterministic, template-generated plain-English sentences — see below |

**The single most important correctness rule in this entire dashboard, worth repeating from Section 6.6.3 because it's easy to get wrong:** every SLA-compliance number here is computed by directly comparing `Ticket.resolved_at`/`due_at` and `first_response_at`/`first_response_due_at` — **never** by querying `SLALog`, which (as documented in Section 6.6.3 and Section 8.3.14) only ever records "pending" and "breach" events, never "met" events, and would silently produce a wrong (too-low) compliance percentage if used naively.

## 11.5 "Executive Insights" — a template engine, not AI

`get_executive_insights(payload)` is called *last*, after every other section of the payload has already been assembled, and produces a short list of plain-English sentences by checking each already-computed number against a fixed threshold and appending a pre-written sentence template if it applies — for example, comparing `sla.resolution_compliance_pct` against `SLA_TARGET_PCT = 95` to say either *"SLA compliance remains above target at 97%"* or *"SLA compliance is at 88%, below the 95% target and needs attention."* This is honestly a **template engine, not a machine-learning model or an LLM** — it's deliberately deterministic and cheap, and it degrades gracefully: if a particular section's data is sparse or missing, that sentence is simply skipped rather than the whole feature crashing.

## 11.6 A documented calibration gap, worth knowing before trusting the numbers

The `utilization_pct` figures shown on the Engineer Utilization table are computed from a hardcoded heuristic (`_AVAILABILITY_CAPACITY = {"full_time": 8, "part_time": 4, "ad_hoc": 2, "unavailable": 0}` — "how many concurrent active tickets can this engineer realistically carry") — **not** a real, configured, or measured capacity value. Against this project's own large seeded demo dataset, several engineers show utilization well over 100% (600%+ for the most loaded), which the code itself flags in a comment as "under-calibrated for that seed data's scale... revisit if capacity needs to become configurable." The frontend (`ExecutiveAnalytics.jsx`) is aware of this and deliberately color-codes anything over 100% distinctly (red) rather than presenting it as a normal, trustworthy value — a good example of a frontend honestly reflecting a known backend limitation instead of hiding it.

## 11.7 The frontend rendering, and the throttle trap to know about

`ExecutiveAnalytics.jsx` (446 lines) renders the entire payload with a single `GET` on mount — an Executive Summary 6-tile KPI row, Operational Health KPIs, status/priority donuts, SLA-trend and weekly-volume sparklines, a revenue-trend sparkline plus service-category bar chart, a Top Customers table, Most Active / Highest Workload engineer tables, a Recently Breached Tickets table, a Top Service Categories table, and the Executive Insights bullet list — all built from the zero-dependency chart primitives described in Section 7.8.

**A real, easy-to-hit gotcha worth knowing:** `/api/ops/executive-analytics/` shares its `AnalyticsRateThrottle` bucket (30 requests/hour, per user) with the *original* `/api/analytics/` endpoint (Section 9.6) — so a Super Admin who refreshes both `/admin/analytics` and `/operations/executive-analytics` a handful of times during one review session can plausibly exhaust the shared budget and start seeing `429 Too Many Requests`. This is a known, accepted trade-off from when the Executive dashboard was built (reusing the existing throttle scope rather than adding a new one), flagged in this project's own engineering notes as "worth reconsidering if it becomes a real complaint" — not yet fixed as of this document.

---

# 12. Operations Command Center

## 12.1 What it's for, and how it differs from Executive Analytics

The Operations Command Center (`/operations`, `OpsDashboard.jsx`) answers a fundamentally different question than Executive Analytics: not "how are we doing this month" but **"what needs attention right now, this minute."** It is reachable by all four internal staff roles (`IsAnyStaffRole`) — this is everyone's default landing page after logging in, per `OpsRoute` in `App.jsx`.

## 12.2 No Incident or Escalation database table — everything is derived

A deliberate, documented architectural choice: there is **no dedicated `Incident` or `Escalation` model anywhere in the schema.** Instead, `ops_command_center_service.py`'s own docstring defines these concepts purely in terms of signals that already exist: **"Incident" = an open ticket at critical/high severity.** **"Escalated" = a ticket whose most recent relevant `TicketActivityLog` action is `"escalated"`** — reusing the *exact* mechanism `ReplyOwnershipSignalsMixin.get_waiting_on_internal()` already uses elsewhere in the serializer layer (Section 6.3), so "is this ticket in the Escalation Queue" and "does this ticket's badge show waiting-on-internal" can never silently disagree with each other. This is a good example of getting a lot of functionality from a small, already-existing data model rather than adding new tables for every new dashboard concept.

## 12.3 Why the API is split into two endpoints

`GET /ops/command-center/` ("core") and `GET /ops/command-center/live/` ("live") are two separate calls, and the split is deliberate and load-bearing, not arbitrary:

| Endpoint | Widgets | Fetch pattern |
|---|---|---|
| **core** | Escalation Queue, Engineer Capacity, Service Health, Critical Customers, Ticket Flow | Fetched **once** on page mount |
| **live** | Live Incident Queue, SLA Risk Board, Activity Timeline | Fetched on mount, then **re-fetched every 45 seconds** (`OpsDashboard.jsx`) |

The reasoning, from the view function's own code comment: forcing a single unified payload would mean re-running *all eight* widgets' underlying database queries on every 45-second poll tick, for no UX benefit — the five "core" widgets genuinely don't need to feel instantaneous, while the three "live" widgets (an incident that just became critical, an SLA that's about to breach, "what just happened") benefit from staying fresh.

## 12.4 The eight widgets, one by one

| Widget | Backend function | What it shows |
|---|---|---|
| Live Incident Queue | `get_incident_queue_queryset()` | Open tickets at critical/high severity, most-severe-first, then soonest-due-first |
| SLA Risk Board | `get_sla_risk_queryset(horizon_hours=4)` | Open tickets whose deadline is already past or falls within the next 4 hours, earliest-first |
| Escalation Queue | `get_escalation_queryset()` | Not-yet-closed tickets whose latest relevant activity is "escalated" |
| Engineer Capacity | `get_engineer_capacity()` | Per-engineer active-ticket count + a point-in-time utilization %, flagging anyone `over_capacity` |
| Service Health | `get_service_health(start, end)` | Per-service open load + SLA breach rate, tone-classified `healthy`/`degraded`/`critical` against fixed thresholds — an explicitly-labeled **proxy** metric, since no real uptime/health signal exists anywhere in the system |
| Critical Customers | `get_critical_customers()` | Customers currently affected by an open critical/high ticket or an overdue one — deliberately *not* the same as "highest ticket volume" (that's Executive Analytics' Most Active Customers) |
| Ticket Flow | `get_ticket_flow(hours=24)` | Created vs. resolved counts over a rolling 24-hour window, plus the full status funnel |
| Activity Timeline | `get_recent_activity(hours=4)` | A cross-ticket activity feed — the **first** cross-ticket activity view in the codebase (every other activity-log read is scoped to one ticket) |

## 12.5 The health banner and AI brief — computed entirely on the client

`OperationsHealthBanner` and `AIDailyBriefCard` (Section 7.7.2) both render data that has **no dedicated backend endpoint at all** — `OpsDashboard.jsx` combines counts already present in the core+live payloads (incident count, SLA-breaching-soon count, escalated count, over-capacity engineer count) into an overall `healthTone` (`ok`/`warning`/`critical`), and `utils/operationsBrief.js`'s `buildOperationsBrief()` turns the same already-fetched data into a short bullet list — no additional network round-trip, no LLM call, purely a pure JavaScript function over data the page already has in memory.

---

# 13. Notifications

## 13.1 The system that exists today (real, working, polling-based)

Every "live" surface in ResolveHQ today works the same fundamental way: **a browser-side JavaScript timer periodically re-asks the server "anything new?"** There is no push mechanism — no WebSockets, no Server-Sent Events — anywhere in this codebase as of this document.

**The data model:** `Notification` (Section 8.3.16) — one row per (event, recipient) pair, fanned out at write time. `create_notification()` (`services/notification_service.py`) is the single function every other part of the backend calls to write one of these rows — roughly 7 call sites across `views.py`, covering ticket assignment, comments, status changes, SLA breaches, and payment confirmations.

**The API:** `GET /api/notifications/` (paginated list), `GET /api/notifications/unread-count/` (a single, cheap `SELECT COUNT(*)`), `PATCH /api/notifications/{id}/read/`, `POST /api/notifications/mark-all-read/` — all scoped to `recipient=request.user`.

**The frontend:** `useNotifications.js` (Section 5.7) polls the unread-count endpoint every 30 seconds, but **only while the browser tab is actually visible** — `document.hidden` pauses the timer entirely, and regaining visibility triggers an immediate re-poll plus resumed interval. The full notification *list* is fetched only lazily, the first time the bell dropdown is opened — not on every poll tick, which would be wasteful. Marking a notification read updates the on-screen badge count and row state **immediately, optimistically**, before the server confirms — the API call happens in the background, and only re-syncs from the server if it fails.

**Two other, independent 30-second polling loops exist** — `TicketDetailPage.jsx` (only while `status === "open" && role === "customer"`, to catch an engineer assignment) and `EngineerWorkspace.jsx` (unconditionally, for new-ticket detection) — plus the Operations Command Center's 45-second `live` poll (Section 12.3). **None of these three currently pause when their tab is hidden** — only `useNotifications` has that optimization; this is a real, documented inconsistency (see 13.3 below).

## 13.2 A quick self-audit: are polling and notifications actually a good architecture here?

Yes, for this product's actual latency needs, with one honest caveat. A 30-45 second delay before a notification badge updates is completely acceptable for a ticket-support product — nobody is going to notice or care that a "ticket assigned" notification took 20 seconds to appear rather than 200 milliseconds. Where polling genuinely starts to show its limits is the *duplication*: four independently hand-rolled `setInterval` loops, three of which never learned the tab-visibility-pause trick the fourth already has, meaning backgrounded browser tabs are needlessly burning API requests (and eating into the shared per-user rate-limit budget) for no user-visible benefit. That's a real, fixable inefficiency — not a fundamental flaw in choosing polling over push for a product at this latency requirement.

## 13.3 What has been proposed, but NOT yet built

A same-day architecture audit (`docs/REALTIME_NOTIFICATIONS_ARCHITECTURE.md`, dated 2026-07-15, explicitly marked **"AWAITING APPROVAL. Do not implement until approved"**) proposes a four-phase plan to fix the duplication above and eventually add real push. **As of this document, none of it has been built.** It is summarized here so you understand the direction being considered without mistaking it for what currently runs in production:

| Phase | Proposed work | Status |
|---|---|---|
| **1** | Extract a shared `usePolling(fetchFn, {intervalMs, enabled})` hook from `useNotifications`'s existing tab-visibility-aware pattern; migrate the other two/three hand-rolled loops onto it | Not started |
| **2** | Move `create_notification()`'s per-recipient loop off the synchronous request path and onto a Celery task using `bulk_create()` instead of N individual `INSERT`s (today's ticket-assignment notification loop, which notifies every on-duty staff member one row at a time with no batching, is the specific example the audit flags) | Not started |
| **3** | Add real push via Django Channels — fill in the already-stubbed `asgi.py`, add `channels`/`channels-redis`, a new ASGI Docker Compose service, a per-user WebSocket channel group — with the *existing* REST/polling system kept running underneath as an automatic fallback if the socket ever drops | Not started |
| **4** | Extend the same channel-layer plumbing to the Operations Command Center's `live` widgets (a "refetch" signal, not the full payload, to avoid duplicating the heavy aggregation queries into the push path) | Not started |

**Why this matters for you as a reader of this document, not just as trivia:** the infrastructure this plan would build on top of — Redis, Celery, and a stubbed `asgi.py` — already exists in the running system *for other reasons* (Section 15), so if you come across a future version of this codebase with real-time push working, this is the plan it most likely followed. If you're looking for a WebSocket connection in the browser's Network tab today, you won't find one — every "live" number in the product genuinely is a browser JavaScript timer re-asking the server, and that is by design, not by accident or laziness.

---

# 14. Docker Infrastructure

## 14.1 The development environment — six containers, one command

`docker compose up --build` (using `docker-compose.yml`) starts six containers on one shared private network, each with a specific, single job:

| Service | Image / build | Port(s) | Job |
|---|---|---|---|
| `db` | `postgres:15-alpine` | `5432:5432` (published to host, so a local DB GUI can connect) | The one real database |
| `redis` | `redis:7-alpine`, `command: redis-server --appendonly yes` | `6379:6379` | Celery broker + result backend + Django cache/throttle store |
| `backend` | Built from `Dockerfile.backend` | `8000:8000` | Django/Gunicorn API — the source-mounted `./backend:/app` volume plus Gunicorn's `--reload` flag means code edits take effect without a manual rebuild |
| `celery` | Same image as `backend` | *(no published port — it's not a web server)* | The background task worker |
| `celerybeat` | Same image as `backend` | *(no published port)* | The recurring-task scheduler |
| `frontend` | Built from `Dockerfile.frontend` | `5173:5173` | The Vite dev server, with `./frontend/src` and `index.html` bind-mounted for hot reload |

**Startup ordering is enforced, not assumed.** `backend`, `celery`, and `celerybeat` all declare `depends_on: { db: { condition: service_healthy }, redis: { condition: service_healthy } }` — Docker Compose will not even *start* these containers until `db`'s and `redis`'s own healthchecks report healthy, which prevents the classic "the app container started faster than the database and immediately crashed trying to connect" race condition. `frontend` similarly waits on `backend` being healthy. `celerybeat` additionally waits on `celery` itself.

**Every healthcheck is a real, functional check, not just "is the process running":** `db`'s uses `pg_isready`; `redis`'s uses `redis-cli ping`; `backend`'s makes an actual HTTP request to `/api/health/` (which itself checks the database connection — Section 9.1); `celery`'s runs `celery -A supportmitra inspect ping --timeout=5`, which round-trips an actual message through Redis and back, proving the worker is truly consuming tasks, not just that the process exists; `celerybeat` (which has no broker-side ping to ask, since it doesn't process tasks itself) checks `/proc/1/cmdline` directly for the string "beat," since the container's minimal image has no `ps` command available.

**A specific, documented `start_period` tuning decision on `db`:** the healthcheck's `interval`/`retries` alone only allow 50 seconds before Docker gives up and marks the container unhealthy — but PostgreSQL startup after a non-graceful stop can genuinely take well over a minute (mandatory data-directory fsync and WAL crash recovery). Without a 90-second `start_period` grace window, `docker compose up` would abort with "dependency failed to start: db is unhealthy" even while Postgres was still recovering completely normally — a real bug this project's own history records hitting and fixing.

## 14.2 The two backend Dockerfiles compared

`Dockerfile.backend` (used by every environment, dev and prod alike — the *command* run against it differs, not the image itself) is a **multi-stage build**: Stage 1 (`builder`, `python:3.11-slim`) installs `libpq-dev`/`gcc`/`libffi-dev` (needed to *compile* `psycopg2` and `cryptography`) and runs `pip install --prefix=/install`; Stage 2 (`runtime`, a fresh `python:3.11-slim`) copies *only* the installed packages from `/install`, plus the application source, into a clean image with none of the build tools — shrinking the final image by roughly 200MB and reducing its attack surface (no compiler available inside a running production container). The final image also creates and switches to a dedicated non-root `django` user (`USER django`) before the container ever runs — a real, standard security hardening: if a dependency were ever compromised, the blast radius is limited to whatever a non-root, non-privileged user can touch, not full container root.

## 14.3 Production overrides (`docker-compose.prod.yml`)

Run together with the base file: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`. The differences, all deliberate:

- **`restart: unless-stopped`** on every service — automatic recovery after a VPS reboot or a crashed process, without dev's assumption that a human is watching the terminal.
- **`DJANGO_SETTINGS_MODULE: supportmitra.settings_prod`** on `backend`/`celery`/`celerybeat` — switches to the production settings overlay (Section 6.1, Section 17).
- **No source-code volume mounts** — the built image runs exactly as compiled, with no `--reload`, matching what was actually tested and deployed rather than whatever happens to be on a developer's disk at that moment.
- **`db`/`redis` ports are *not* published to the host** (`ports: []`) — in production, nothing outside the Docker network can reach the database or Redis directly, closing off a real, common attack surface that dev deliberately leaves open for convenience (connecting a local DB GUI).
- **Named volumes for `media_files` and `static_files`** — uploaded attachments and collected static assets survive a container being replaced entirely on the next deploy, rather than living only inside the ephemeral container filesystem.
- **The `frontend` service is disabled entirely** (`profiles: ["dev-only"]`) — in production there is no running Node.js/Vite process at all; the React app is pre-compiled into static files and served by the host's own Nginx installation (Section 14.4), not by a container.
- **Bounded, rotated JSON-file container logs** (`max-size`/`max-file`) — prevents container logs from silently filling the server's disk over weeks of uptime, something dev doesn't need to worry about.

`docker-compose.yml`'s dev-only `backend` command runs `collectstatic && migrate` automatically **every single startup** — convenient for development, but the prod override deliberately drops the automatic `migrate` from the container's own startup command specifically to avoid a race condition if the service is ever scaled to multiple replicas (two containers starting simultaneously and both trying to run migrations at once); in production, migrations are instead run explicitly, once, by the deploy script (Section 17).

## 14.4 Nginx — the production front door

In the primary deployment path, Nginx is installed directly on the production VPS (not run as a Docker container) via `nginx/nginx.conf`, and does five distinct jobs: **HTTPS termination** (Let's Encrypt certificate via `certbot`, `TLSv1.2`/`TLSv1.3` only), **HTTP→HTTPS redirect**, **rate limiting at the network edge** — a second, independent layer of throttling *in addition to* Django's own DRF throttles, using `limit_req_zone` (e.g., `auth` zone at 5 requests/minute per IP, matched deliberately to Django's own `auth` throttle scope so the two layers agree), **security headers** (HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a full `Content-Security-Policy` — the CSP's own inline comments explain a specific, deliberate decision: `script-src` has **no** `'unsafe-inline'` because a static-inspection audit of the compiled React bundle and Razorpay's `checkout.js` confirmed neither ever needs it, while `style-src` **keeps** `'unsafe-inline'` specifically because Razorpay's third-party `checkout.js` sets inline `style` attributes directly via JavaScript for widget positioning — code this project doesn't control and can't retrofit with CSP nonces), and **static file serving** (React's compiled JS/CSS with a 1-year immutable cache, since Vite's content-hashed filenames guarantee a changed file always gets a new URL; user-uploaded media with a shorter 7-day cache).

An alternative, fully-containerized frontend path exists too (`Dockerfile.frontend.prod` + `nginx/frontend-standalone.conf`) — a small `nginx:1.25-alpine` container serving the built React app plus proxying `/api/*` to the `backend` container by its Docker service name, with the *identical* security headers duplicated (not shared via a common file) into that config, since this container has no TLS of its own and is meant to run behind a separate TLS-terminating load balancer.

---

# 15. Celery & Redis

## 15.1 The message queue mental model

A **task queue** decouples "deciding work needs to happen" from "actually doing the work." When `ticket_service.create_ticket()` finishes, it doesn't personally connect to SendGrid and send an email — it hands a small message ("send the ticket-created email for ticket X") to Redis, which acts as a waiting-room/mailbox, called the **broker**. A completely separate process — the Celery **worker** container — is constantly watching that mailbox, and picks up and executes the message the moment it arrives, entirely independent of the original web request, which has already returned its response to the user by then.

## 15.2 Every scheduled and triggered task in the codebase

| Task (`backend/support_app/tasks.py`) | Trigger | Retry behavior | Status |
|---|---|---|---|
| `send_ticket_opened_email` | Called via `.delay()` from `ticket_service.create_ticket()` | `bind=True, max_retries=3, default_retry_delay=60` | Working |
| `send_ticket_assigned_notification` | Available to be called via `.delay()` (though `ticket_service.assign_ticket()` currently calls `email_service.send_ticket_assigned` synchronously via `transaction.on_commit`, not through this specific Celery task — a small, real inconsistency in the codebase worth knowing about) | `bind=True, max_retries=3, default_retry_delay=60` | Working |
| `check_sla_breaches` | **Scheduled**, every 300 seconds, via `CELERY_BEAT_SCHEDULE` in `settings.py` | None (catches its own exceptions and logs them, doesn't retry the whole sweep) | Working — this is the SLA engine's heartbeat (Section 6.6.3) |
| `process_payout_batch` | Not currently scheduled or called anywhere | N/A | **Honest stub** — logs "payout processing is scheduled for Phase 4. No action taken." and returns |
| `sync_ticket_to_osticket` | Not currently called anywhere | N/A | **Honest stub** — logs a "scheduled for Phase 4" message, matching the equally-stubbed `integrations/osticket.py`/`zammad.py` |

## 15.3 `django-celery-beat` — why the schedule lives in the database, not just in Python

`CELERY_BEAT_SCHEDULE` in `settings.py` defines the SLA-check schedule as plain Python — but the `celerybeat` container is configured to run with `--scheduler django_celery_beat.schedulers:DatabaseScheduler` rather than Celery's simpler built-in file-based scheduler. This specific package additionally lets *new* periodic tasks be added, edited, or paused directly from the Django admin panel by a Super Admin, with no code deploy required — useful groundwork for the notification-digest and other periodic ideas listed in Section 13.3's future-work list, even though today only the one hardcoded SLA-check schedule actually exists.

## 15.4 Redis's three simultaneous jobs, and why one instance can safely do all three

As introduced in Section 2.5 and referenced throughout this document, one single Redis container plays three roles at once: **Celery broker** (the task mailbox above), **Celery result backend** (where a task's return value, if any, is stored temporarily after it finishes), and **Django's cache backend**, which in practice means it's also the storage for every API rate-limit counter (Section 6.9). This works safely because Redis's data is organized by key, and Celery's and Django's key namespaces never collide — a full explanation of why a single Redis instance is trusted with this much responsibility, rather than three separate Redis containers, comes down to genuine operational simplicity for a project at this scale: one container to run, monitor, and back up, instead of three.

## 15.5 What happens if Redis goes down

Because Redis is load-bearing for three different systems, its failure has three separate, cascading effects worth understanding: (1) Celery tasks can no longer be queued or picked up — emails and the SLA-breach check silently stop happening (the web application itself keeps running, since these are all fire-and-forget background actions, not something a user's request waits on); (2) Django's cache backend becomes unavailable, which — since the *only* real use of the cache in this project is rate-limiting — means DRF's throttle classes would raise their own errors trying to reach a dead cache backend, a real, if edge-case, failure mode; (3) any already-queued-but-not-yet-processed task messages are lost unless Redis's `--appendonly yes` persistence (Section 2.5) had already written them to disk before the crash, which is exactly why that flag, plus the named `redis_data` volume, are both present in `docker-compose.yml` even in local development.

---

# 16. Testing

## 16.1 Why two entirely different testing tools exist (recap and expansion of Section 2.17/2.18)

Pytest verifies the backend in isolation, at the level of "given this exact HTTP request, does the Django view return the correct response and leave the database in the correct state." Playwright verifies the *whole system* — a real browser, a real running Vite dev server, a real running Django backend — behaving correctly together, exactly the way an actual user would experience it. A backend test can confirm `ops_assign_ticket` returns the right JSON; only Playwright can confirm that clicking the literal "Assign" button in `AdminTicketActions.jsx` actually triggers that exact call and the screen updates correctly afterward. Neither tool can replace the other.

## 16.2 The Pytest suite — 13 files, 349 test functions, 7,099 lines

`backend/pytest.ini` points Pytest at `supportmitra.settings` (via `DJANGO_SETTINGS_MODULE` — the **dev** settings module, so the suite runs standalone without extra environment setup) and tells it to discover `tests/test_*.py`. `backend/conftest.py` defines three shared fixtures (`api_client`, `make_user`, `auth_api_client` — described in Section 16.1's table). **In practice, most individual test files don't use these three** — they define their own local, file-specific helper fixtures and functions (e.g. `test_auth.py`'s own `client`/`sample_user`, `test_payments.py`'s bare helper functions called directly with no fixtures at all, and most role-matrix files' own `super_admin`/`ops_manager`/etc. fixtures using Django's `force_authenticate` rather than a real login round-trip, specifically to avoid burning through the `auth` rate-limit quota during a single test run). Every test in the suite is a plain function — no test classes are used anywhere, despite `pytest.ini` supporting `Test*` class discovery.

| Test file | Lines / functions | What it verifies |
|---|---|---|
| `test_auth.py` | 467 / 24 | Registration, login, logout, token refresh + rotation + blacklisting, `/auth/me/`, protected-route token validation, and the password-change endpoint's dedicated 15-minute rate limit (including that it correctly *resets* after the window passes) |
| `test_tickets.py` | 714 / 30 | Ticket creation and listing, comment visibility/ownership rules, the full CSAT submission lifecycle (including the double-submission-is-rejected and wrong-status-is-rejected cases), the computed SLA-status and reply-ownership fields on both list and detail responses, and the related-tickets endpoint's same-customer-only scoping |
| `test_ticket_system.py` | 326 / 13 | The service-layer mechanics directly: activity logging on creation/status-change/assignment/reassignment, `resolved_at` stamping, `first_response_at` stamping rules (and specifically that internal comments and the customer's own comments never trigger it), and internal-comment visibility enforcement |
| `test_api_phase4.py` | 687 / 42 | Admin ticket assignment/status/unassign flows and their notification side effects, freelancer-scoped ticket access and the freelancer status-transition restrictions (cannot close, cannot move to a disallowed status), the full notification list/unread-filter/mark-read/mark-all-read surface, and — notably — Support Agent-specific coverage (list/search/filter, ticket detail visibility, assignment authority) added as this role was built out |
| `test_permissions.py` | 829 / 69 (the largest permissions-focused file) | An exhaustive, table-driven sweep of the entire role matrix from Section 10.9 — the file's own docstring contains a literal permission-matrix table documenting the intended access rules, which the tests then verify line by line: every combination of role × endpoint for ticket management, payment refund/confirm/summary/list, service management, user management, role changes, ops dashboard/analytics (including that revenue is hidden from Support Agent but shown to Finance Manager), and object-level ticket/comment/invoice ownership checks |
| `test_payments.py` | 1,783 / 64 (by far the largest test file in the project) | The entire money-handling surface, with tests visibly grouped by internal fix/ticket ID in comments — **C-002** (Razorpay signature verification, all three fields now required with no silent sandbox defaults), **C-001** (atomicity: a failure inside `_open_ticket_after_payment` correctly rolls back the payment save), **C-004** (GSTIN validation and invoice compliance — a hardcoded placeholder GSTIN must never appear in a generated PDF), **C-005** (the concurrent-safe invoice-number generator, including a real 10-thread concurrent-load test), **C-NEW-001/2/3** (refund workflow idempotency, webhook idempotency, and admin/ops payment-confirm idempotency) — a genuinely unusual level of regression-test discipline, each cluster reads like it was written directly against a specific past incident |
| `test_signal_actor.py` | 607 / 17 | The `_actor`/`_actor_note` mechanism from Section 6.7, specifically: that every status/assignment/unassignment change is attributed to the *correct* person in the resulting activity log, that a system-triggered save (no actor set) correctly logs `None`, that every one of the six roles is correctly captured as an actor, and — most interestingly — **concurrency tests** (`test_concurrent_status_changes_have_correct_actors`, `test_concurrent_same_ticket_different_users_no_actor_swap`) that directly verify Section 6.7's core safety claim: that two different requests' `_actor` attributes, set on two separate in-memory Python objects, can never leak into or overwrite each other |
| `test_sla.py` | 464 / 20 | The default SLA windows per severity, breach detection (not-yet-due, already-notified, and just-breached cases), that `set_ticket_due_at` is genuinely idempotent, that a payment confirmation correctly initializes the SLA clock, first-response deadline timing precision, and that closed tickets are correctly excluded from the recurring breach-check sweep. Also contains a small cluster of what read as regression/smoke tests guarding against specific past bugs by name (`test_django_admin_url_at_django_admin_not_admin`, `test_payment_invoice_no_longer_returns_501`, `test_celery_tasks_are_not_stubs` — this last one currently checks that the two working tasks aren't stubs, not the two intentionally-still-stubbed ones) |
| `test_executive_analytics.py` | 301 / 15 | Access control for exactly the three permitted roles (Section 11.2), the complete payload shape, and — most importantly — a **direct correctness test that SLA compliance is computed from `resolved_at`/`due_at`, not from `SLALog`** (`test_ticket_resolved_before_due_at_counts_as_sla_met` / `..._after_due_at_counts_as_sla_missed_and_breached`), plus period-resolution logic (default 30 days, explicit `?period=`, explicit `?start=`/`?end=` override) and that the Insights section always returns a non-empty list of strings |
| `test_ops_command_center.py` | 425 / 21 | Access control for all four staff roles, both payloads' complete shape, and — in real depth — the exact filtering/ordering rules of all three "live" queues (incident queue severity ordering, SLA risk board's soonest-due-first ordering, and critically, that the Escalation Queue correctly **excludes** a ticket whose escalation was superseded by a later activity event, directly testing the "most recent relevant action wins" rule from Section 12.2), plus a divide-by-zero guard test for the `unavailable` capacity tier (0 capacity) in the utilization math |
| `test_knowledge_base.py` | 224 / 15 | Draft/published visibility per role, staff-only create/edit/delete, auto-slug generation (and uniqueness on a title collision), search matching, the atomic view-count increment, and the linked/suggested article split on the per-ticket endpoint |
| `test_ai_assistant.py` | 175 / 12 | Access restricted to ticket-management staff only (explicitly including a dedicated Finance-Manager-denied case, matching `IsTicketManagementStaff`'s exclusion), that the mock provider is genuinely deterministic (Section 6.6's design goal, directly tested), and that inserting a draft reply writes exactly one activity log entry |
| `test_seed_enterprise_demo.py` | 97 / 7 | That the Faker-based demo-data seeder runs cleanly, that its `--flush` correctly removes only its own tagged (`@entdemo.local`) rows and nothing else, and — a subtle one — that Django's ticket-related signals are correctly reconnected afterward even if the seeding run fails partway through (`test_signals_reconnected_after_mid_run_failure`) |

**A cross-cutting theme worth naming explicitly:** a large fraction of these tests are not naive "does the happy path work" checks — they specifically target concurrency races (invoice numbers, actor attribution), idempotency (refunds, webhooks, resolution acceptance), and negative/boundary cases (wrong role, wrong ticket status, already-processed payment) at least as much as the successful path. This is a genuinely well-tested backend for a project of this size.

## 16.3 Running the backend suite

```bash
cd backend
pytest tests/ -v                                                   # everything, verbose
pytest tests/test_payments.py -v                                   # one file
pytest tests/ -k "refund"                                          # anything matching "refund" by name
pytest tests/ --cov=support_app --cov-report=term-missing           # with coverage (CI requires ≥ 50%)
```

**A real, documented gotcha worth repeating from this project's own operating history:** `/api/auth/login/` and `/api/auth/register/` are throttled via the same Redis-backed limiter used in production (5/minute/IP) — and because Redis persists state independently of the Pytest process, running the full suite (which includes real-endpoint auth tests) more than 2–3 times in quick succession can exhaust that budget and cause unrelated-looking `429` failures on a *subsequent* run, not the one that "used up" the quota. If a clean re-run suddenly shows auth-test failures with no code changes, check for this before assuming a real regression — clearing the specific Redis throttle key (`docker compose exec redis redis-cli DEL <key>`) resolves it immediately.

## 16.4 The Playwright E2E suite — real browser, real backend, real seeded accounts

`frontend/playwright.config.js` configures a single Chromium project against `http://localhost:5173` (Vite's dev server, either already running or started automatically via the `webServer` block), with `fullyParallel: false` and `workers: 1` — deliberately *serial*, not parallel, because the test suite logs in as a small, fixed set of shared seeded accounts, and parallel runs would risk two tests racing against the same account's session state.

**`global-setup.js`** runs once before the entire suite: it logs in, through the real login form, as each of six seeded demo accounts (`admin@resolvehq.dev`, `ops@resolvehq.dev`, `finance@resolvehq.dev`, `support@resolvehq.dev`, `engineer@resolvehq.dev`, `customer@resolvehq.dev` — created by `python manage.py seed_demo_users`, Section 5.4) and saves **two** things per role, not just Playwright's standard session snapshot: the full `storageState` (cookies + `localStorage`, which captures the `refresh_token`) *and* the `access_token` separately (read directly out of `sessionStorage`, since — as the file's own extensive comments explain — `access_token` is deliberately excluded from `storageState` by the app's own security design, Section 10.3). This distinction matters because the backend **rotates and blacklists** refresh tokens on every use (Section 10.3) — a saved `refresh_token` is single-use, so if individual spec files relied on it, the *second* test to run would already find it blacklisted. Saving and re-injecting the separately-captured `access_token` (which doesn't rotate and lives for the whole ~15-minute test run) sidesteps that entirely. A deliberate 13-second delay between each of the six logins keeps the whole sequence comfortably under the same 5-per-minute login throttle mentioned above.

| Spec file | What it covers |
|---|---|
| `roles.spec.js` | For each of the six roles: logs in, confirms landing on the correct home route (`/operations`, `/freelancer`, or `/dashboard` per Section 10.4), and asserts **zero browser console errors** — a lightweight but broad smoke test run across every role |
| `design-system.spec.js` | The largest and broadest spec — asserts that the shared design-system components (`Card`, `PageHeader`, `Badge`, `Input`/`Select`, `TableCard`, `StatTile`, `EmptyState`, `Alert`, `Skeleton`) render consistently across roughly 20 different pages spanning staff, customer, and engineer surfaces — this is effectively an automated audit that the component-reuse conventions documented throughout Section 7 are actually being followed in the real, rendered application, not just in the source code |
| `executive-analytics.spec.js` | For each of the three permitted roles: confirms every major section of the dashboard (Executive Summary, Operational Health, Business Metrics, Operations tables) renders without console errors; separately, for each of the three *disallowed* roles, confirms the page is genuinely unreachable |
| `operations-command-center.spec.js` | Confirms all 10 Command Center widgets render for every staff role, confirms old/removed dashboard widgets are genuinely gone (a regression guard against a stale UI reappearing), and — notably — directly verifies the **45-second live-poll / load-once-core** timing split described in Section 12.3 by watching actual network requests over time |

## 16.5 Running the Playwright suite

```bash
cd frontend
python ../backend/manage.py seed_demo_users   # one-time / whenever accounts are reset
npx playwright test                            # headless, full suite
npx playwright test --ui                       # interactive UI mode
npx playwright test executive-analytics.spec.js  # one file
```

**A documented environment quirk worth knowing before you go looking for a bug that isn't one:** the `frontend` Docker container's *baked-in* `package.json` (fixed at image-build time) has, at points in this project's history, lagged behind the *host* repository's `package.json` — specifically missing the `test:e2e`/`test:e2e:ui` scripts and the `@playwright/test` dependency itself. The reliable, confirmed-working approach is to run Playwright directly from the **host** machine (`cd frontend && npx playwright test`), not via `docker compose exec frontend ...` — the host already has `node_modules` and a cached Chromium install, and `playwright.config.js`'s `reuseExistingServer: !process.env.CI` setting means it will happily attach to the Vite dev server already running inside the `frontend` container (published to `localhost:5173`) rather than needing to start a second one.

**Two more throttle-related gotchas, both real and both previously hit during this project's own development:** repeated manual Playwright runs against the same seeded accounts within a short window can exhaust the shared `analytics` throttle bucket (30/hour — the same bucket shared between `/analytics/` and `/ops/executive-analytics/`, Section 11.7) *and*, separately, `global-setup.js`'s six sequential logins can themselves add up toward the IP-based `auth` throttle (5/minute) if the whole suite is re-invoked several times in quick succession, since global setup re-runs on every single `npx playwright test` invocation, not just once per day. Both are resolved the same way as the backend gotcha in Section 16.3 — clear the specific Redis throttle key rather than assuming a real regression.

## 16.6 What CI actually enforces (cross-reference to Section 17.4)

The full backend job (lint, format-check, security scan, tests with ≥50% coverage) and the frontend job (lint, production build, build-output verification) both run on every push and pull request — already documented in complete detail in Section 17.4, including the honestly-reported gap that `npm run lint` has no ESLint configuration file to actually run against as of this reading. Playwright is **not** part of the automated CI pipeline described in `.github/workflows/ci.yml` — it is a manually-run suite (Section 16.5), not a required merge gate.

---
# 17. Deployment

## 17.1 Development — the one-command setup

From the repository root: `cp .env.example backend/.env` (fill in at least `SECRET_KEY`), then `docker compose up --build` (or the equivalent wrapper, `bash scripts/start.sh`). This single command builds all six images (Section 14.1) and starts them in the correct dependency order. First-time setup additionally needs `docker compose exec backend python manage.py migrate` and `docker compose exec backend python manage.py createsuperuser` — both run *inside* the backend container, never on the host directly (Section 2.4's SQLite-fallback warning explains exactly why that distinction matters).

## 17.2 `settings_prod.py` — every production-only change, and why

`backend/supportmitra/settings_prod.py` starts with `from .settings import *` — it inherits every single development setting and then *overrides* a specific list, each with a clear, security-relevant reason:

| Override | Why |
|---|---|
| `DEBUG = False` | Errors return generic JSON, never a full HTML stack trace with source code and local variable values (a serious information leak if left on in production) |
| `ALLOWED_HOSTS` locked to `resolvehq.in`/`www.resolvehq.in` | Rejects any request claiming a `Host` header Django wasn't told to trust — a real protection against a class of cache-poisoning and password-reset-link-poisoning attacks |
| `SECURE_PROXY_SSL_HEADER` + `USE_X_FORWARDED_HOST` | **The single most important line in this file.** Nginx terminates HTTPS and forwards plain HTTP internally to Gunicorn on `:8000`. Without telling Django to trust Nginx's `X-Forwarded-Proto: https` header, Django's own `SECURE_SSL_REDIRECT` would see every internal request as "insecure HTTP" and issue a redirect to HTTPS — which Nginx would then forward again as internal HTTP — creating an **infinite redirect loop**. This exact failure mode is documented directly in the file's own comments as the reason this setting exists. |
| `REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [IsAuthenticated]` | Closes the development-only `AllowAny` default (Section 6.1) — every endpoint now requires a valid JWT unless it individually opts out |
| `CORS_ALLOW_ALL_ORIGINS = False`, `CORS_ALLOWED_ORIGINS` locked to the real domains | Closes the wide-open development CORS policy |
| Structured, production-appropriate `LOGGING` | Adds `celery`/`celery.task` loggers, includes the process ID in every log line, writes only to stdout/stderr (captured by Docker's own logging driver — Section 14.3's log-rotation settings) — the file's own comment explicitly says *not* to write log files inside the container, since containers are ephemeral and any log written only inside one would be lost the moment that container is replaced |
| Optional Sentry initialization | Only activates if `SENTRY_DSN` is set; `send_default_pii=False` is a deliberate privacy choice — never send personally-identifiable user data to the external error-tracking service |

## 17.3 The production environment variable checklist

`backend/.env.example` ends with an explicit, literal go-live checklist, worth reproducing here as the canonical pre-launch reference:

- [ ] `SECRET_KEY` is 50+ characters, unique to this environment, never committed to git
- [ ] `DEBUG=0`
- [ ] `ALLOWED_HOSTS` contains only the real production domain(s)
- [ ] `DATABASE_URL` uses a strong, unique password — never the `supportmitra`/`supportmitra` development default
- [ ] `REDIS_URL` includes a password
- [ ] `RAZORPAY_*` keys are **live** (`rzp_live_*`), not test keys
- [ ] `EMAIL_HOST_PASSWORD` (the SendGrid API key) is set
- [ ] `SENTRY_DSN` is set for production error visibility
- [ ] AWS keys (if S3 storage is used) are IAM-scoped to only the uploads bucket
- [ ] Docker Compose does **not** expose ports `5432` (Postgres) or `6379` (Redis) publicly — enforced automatically by using `docker-compose.prod.yml`'s `ports: []` overrides (Section 14.3)

## 17.4 CI — what runs on every push and pull request

`.github/workflows/ci.yml` defines three parallel jobs, all of which must pass before a pull request can be merged (assuming branch protection is configured on GitHub, which is a repository setting outside this file itself):

| Job | Steps |
|---|---|
| **Backend** (lint + security + tests) | Spins up a real `postgres:15-alpine` service container → installs `requirements.txt` + `requirements-dev.txt` → `flake8` (max line length 100, migrations excluded) → `black --check --diff` (format check, not auto-fix) → `bandit -r support_app/ -ll` (security scan) → `pytest tests/ -v --cov=support_app --cov-report=term-missing --cov-fail-under=50` (the build **fails** if backend test coverage drops below 50%) |
| **Frontend** (lint + build) | `npm ci` → `npm run lint` → `npm run build` → verifies `frontend/dist/index.html` actually exists and reports the build size |
| **Docker** (compose validation) | Validates both `docker-compose.yml` alone and the dev+prod combination parse correctly (`docker compose config --quiet`), and actually **builds** `Dockerfile.backend`'s `runtime` target and `Dockerfile.frontend.prod`'s `builder` target, catching a broken Dockerfile before it ever reaches a real deploy |

**A known, notable gap, worth being upfront about:** Section 7.7.5's frontend lint step (`npm run lint`) is listed in CI as a required job — but Section 2.29 already documented that **no ESLint configuration file exists anywhere in this repository**, meaning `npm run lint` fails immediately, locally, with a "couldn't find a configuration file" error the moment anyone tries to run it outside CI's own environment. Whether CI's copy of this step currently passes, fails, or has been separately patched is not fully determinable from the source files alone — this is flagged here explicitly as exactly the kind of inconsistency this document promised to report honestly rather than paper over.

## 17.5 CD — automatic deployment after CI passes

`.github/workflows/deploy.yml` triggers via `workflow_run`, specifically listening for the **CI** workflow (above) to complete successfully on `master` — meaning a deploy can never fire from code that hasn't already passed every lint/security/test/build check. It then:

1. Re-validates the Compose configuration one more time (a second, independent safety check before ever touching the real server).
2. SSHes into the production VPS (DigitalOcean, per the workflow's comments) using a private key stored as a GitHub Actions secret, and runs, in order: `git pull origin master` → build the React frontend (`npm ci && npm run build`) → rebuild only the `backend` Docker image → run migrations (`docker compose run --rm --no-deps backend python manage.py migrate --noinput`) → collect static files → restart exactly `backend`, `celery`, and `celerybeat` (**not** `db`/`redis`/anything stateful — a deliberate, minimal-blast-radius restart).
3. Polls `https://supportmitra.in/api/health/` up to 12 times, 5 seconds apart (60 seconds total), and fails the whole workflow loudly if the health check never passes.
4. Sends an optional Slack notification on both success and failure, if `SLACK_WEBHOOK_URL` is configured.

This is essentially the exact same sequence as the standalone `scripts/deploy.sh` (Section 17.6) — the GitHub Actions workflow is effectively an automated trigger for the same steps a human could run by hand over SSH.

## 17.6 The operational shell scripts

`scripts/` holds five small, human-run (or cron-run) Bash scripts, each with `set -euo pipefail` at the top — a defensive Bash convention meaning the script immediately stops on the first error, on any reference to an undefined variable, or on a failure anywhere inside a piped command chain, rather than silently continuing after something has already gone wrong.

| Script | Purpose |
|---|---|
| `start.sh [prod]` | Starts either the dev or prod Compose stack; in dev mode, auto-copies `.env.example` to `backend/.env` on first run and prints the three local URLs (frontend/backend/admin) |
| `stop.sh [--clean\|--wipe]` | Plain `stop` keeps all data; `--clean` also removes the containers/network; `--wipe` **destroys the database and all uploaded files** and requires the operator to literally type "yes" to confirm — a real, deliberate guardrail against an accidental destructive command |
| `deploy.sh` | The same 7-step sequence described in Section 17.5, runnable directly on the VPS without going through GitHub Actions — useful for a manual deploy or for debugging why the automated one failed |
| `backup.sh` | Dumps the PostgreSQL database (via `pg_dump`, gzipped) and archives the `mediafiles/` directory (uploaded attachments), both timestamped, and automatically prunes backups older than `RETENTION_DAYS` (default 7). Documented for a daily 2 AM cron job. |
| `health_check.sh [prod]` | Curls a handful of endpoints and checks they return the *expected* status code — not just 200 everywhere: `/api/health/` should be 200, but `/api/auth/register/` (a GET on a POST-only endpoint) should correctly be 405, and `/api/tickets/` without a token should correctly be 401. A 500 on any of these — even the "should fail" ones — indicates something is genuinely broken, whereas the expected 401/405 responses indicate the server is behaving exactly correctly. |

## 17.7 Backups and scaling — what exists, and what's genuinely out of scope for this document

**Backups**, as described above, are handled by `scripts/backup.sh`, intended to run on a schedule via cron on the production VPS, writing to local disk by default (`BACKUP_DIR`) with an environment-variable override for pointing at a separately-mounted backup volume. There is no automated *off-server* backup replication (e.g., to S3) configured anywhere in this repository — that would be a reasonable operational hardening step to add, but as of this reading, it does not exist.

**Scaling**, honestly: this deployment is architected for a **single VPS** — one `db` container, one `redis` container, Gunicorn's worker count auto-scaled to that one machine's CPU count (`gunicorn.conf.py`, Section 2.19). There is no load balancer, no read replica, no multi-region setup, and no Kubernetes anywhere in this codebase. This is entirely appropriate for a product at ResolveHQ's current stage (Section 1) — the honest thing to say here is that the architecture would need real, deliberate rework (a managed database with replicas, multiple Gunicorn hosts behind a load balancer, a properly clustered Redis) before it could safely absorb an order-of-magnitude jump in traffic, and none of that work is present in this repository today.

---

# 18. Feature Walkthroughs

Each feature below is traced through every layer it touches, cross-referencing the deep-dive sections above rather than re-explaining the underlying mechanics from scratch.

## 18.1 Ticket creation and pricing

A customer fills out `TicketForm.jsx` (Section 7.7.3), which on mount fetches `GET /api/services/` to render the live price preview computed by `service_catalog.get_resolution_fee()` (Section 1.2, Section 5.3). Submitting calls `createTicket()` (`api/tickets.js`) → `POST /api/tickets/` → `TicketListCreateView.create()` (`views.py`) → `ticket_service.create_ticket()` (Section 6.6.1), which saves the row in `pending_payment` status, triggers `auto_generate_ticket_number` and `log_ticket_created` (Section 6.7), and schedules the confirmation email via `transaction.on_commit`. The response includes the new `id` and `ticket_number`, letting the frontend navigate straight to `/tickets/{id}`, where `PaymentGateway.jsx` (Section 7.7.3) immediately renders the consulting-fee payment prompt since the ticket is still `pending_payment`.

## 18.2 Replies (the conversation)

Every comment — customer, engineer, or staff — goes through the one shared endpoint, `POST /api/tickets/{id}/comments/`, handled by `TicketCommentListCreateView.perform_create()` → `ticket_service.add_comment()` (Section 6.6.1). Whether a comment is allowed to be marked `is_internal=True` is decided server-side, not trusted from the request — only staff, internal roles, and freelancers can set it; a customer's attempt to send an internal note is silently downgraded to `is_internal=False` in the same line of view code that builds the flag. The frontend never shows a single "Comments" list in isolation — `ConversationFeed.jsx` (Section 7.7.3) always merges comments with attachments and activity-log events into one interleaved thread via `useConversationFeed` (Section 5.7).

## 18.3 Assignment

Traced completely, endpoint-to-database, in Section 9.9 — the canonical worked example of this document's request/response lifecycle (Section 3.2). The short version: `assign_ticket()` (Section 6.6.1) is the single function every assignment path (`admin_assign_ticket`, `ops_assign_ticket`) funnels through, always inside one atomic transaction updating both `Ticket.assigned_to` and the `TicketAssignment` history table together.

## 18.4 Escalation

The lightest-weight feature in the entire codebase, by design: `POST /api/ops/tickets/{id}/escalate/` (`ops_ticket_escalate`, gated `IsTicketManagementStaff`) does nothing more than write one `TicketActivityLog` row with `action="escalated"`. There is no `Escalation` model, no status change, no notification fired directly from this endpoint. Everything downstream — the Operations Command Center's Escalation Queue (Section 12.4), the `waiting_on_internal` computed signal shown as a chip on `TicketCard.jsx` (Section 7.7.3) — is *derived* from the mere existence and recency of that one log row, via `ticket_signals.annotate_reply_ownership_signals()` (Section 6.3, Section 6.5). A later comment or status change on the same ticket automatically supersedes the escalation for signal purposes (the "most recent relevant activity" query naturally picks up the newer event), so nothing ever needs to explicitly "un-escalate" a ticket.

## 18.5 Payments — the two-payment lifecycle in full

**Payment 1 — the consulting fee (₹299 + GST), always the same amount:** `PaymentGateway.jsx` calls `initiatePayment()` → `ticket_initiate_payment` → `payment_service.create_order_for_ticket()` (Section 6.6.2), which is idempotent and returns either a real Razorpay order or a sandbox mock depending on whether `RAZORPAY_KEY_ID` is configured. The customer completes checkout (real Razorpay widget, or a "Simulate Payment" button in sandbox mode); either way, the frontend then calls `verifyPayment()` → `ticket_verify_payment` → `payment_service.verify_and_complete_payment()`, which checks the HMAC signature (skipped in sandbox), marks the `Payment` `completed`, and calls `_open_ticket_after_payment()` — moving the ticket to `open`, calling `sla_service.set_ticket_due_at()` to start the SLA clocks (Section 6.6.3), and notifying the customer.

**Payment 2 — the resolution fee (service base fee + severity surcharge + GST), only once the ticket is `resolved`:** `CustomerResolutionActions.jsx`'s multi-step flow (Section 7.7.3) calls `getResolutionQuote()` → `resolution_quote` (a pure, side-effect-free calculation) to show the itemized breakdown, then the same initiate/verify pattern as above but through `initiateResolutionPayment`/`verifyResolutionPayment`, landing in `payment_service.verify_resolution_payment_service()` (Section 6.6.2) — which, all inside one atomic block, marks the payment complete, closes the ticket, saves the CSAT score submitted in the same request, and then — deliberately **outside** that atomic block, so a payout-creation failure can never roll back an already-confirmed customer payment — calls `payout_service.create_payout_for_ticket()` (Section 8.3.11) to create the pending 65/35 payout record, and notifies the assigned engineer.

**Refunds:** Finance Manager or Super Admin only, via `ops_payment_refund` → `payment_service.issue_refund()` (Section 6.6.2) — the most defensively-written function in the codebase, with a held row lock for the entire duration of the external Razorpay API call.

## 18.6 Notifications — every trigger point in one place

Cross-referencing the ~7 call sites of `create_notification()` found across `views.py`, here is every event that produces an in-app notification today: a ticket is assigned (both the engineer *and* the customer are notified, plus every other on-duty Support Agent/Ops Manager — Section 9.9), a ticket's status changes (the customer is notified), a payment is confirmed (the customer is notified, and after a resolution-fee payment, the engineer is separately notified that a payout is pending), and an SLA deadline is breached (every admin user is notified — `sla_service._notify_admins_of_breach()`, Section 6.6.3). Section 13 covers the full delivery mechanism (polling, not push) and the documented future plan for real-time delivery.

## 18.7 Analytics — three different dashboards, three different jobs

| Dashboard | Audience | Question it answers | Section |
|---|---|---|---|
| `/analytics` (`AnalyticsPage.jsx`) | Any authenticated user, scoped to their own data (or everything, for staff) | "How am I doing personally?" | 9.6 |
| `/operations` Command Center (`OpsDashboard.jsx`) | All 4 staff roles | "What needs attention right now?" | Section 12 |
| `/operations/executive-analytics` (`ExecutiveAnalytics.jsx`) | Super Admin, Ops Manager, Finance Manager | "How is the business doing this period, vs. last period?" | Section 11 |

## 18.8 Operations — the day-to-day staff toolset

Beyond the Command Center itself (Section 12), the Operations portal's remaining pages (Section 7.6.5) cover the full administrative surface: the Ticket Queue (bulk assignment/status changes with full filter/sort/pagination state synced to the URL), a focused Assignments view (skill-matched engineer recommendations), the Freelancer directory, User management (role changes, deactivation — Super Admin only, with a full audit trail), the Service catalogue CRUD, and Payments (confirm/refund, gated by the Finance Manager/Super Admin split documented in Section 10.9's access matrix).

---

# 19. Code Flow — What Happens When...

Six concrete "what happens when" traces, written as numbered sequences through real files and functions. Each builds on the request/response mechanics already fully diagrammed in Section 3.2 — these are shorter, focused variations on that same shape.

## 19.1 ...a user logs in

1. `Login.jsx` submits the form → `useAuth().loginUser(email, password)`.
2. `api/auth.js :: login()` → `POST /api/auth/login/`.
3. `CustomTokenObtainPairView` (`views.py`) — SimpleJWT validates the password, then `CustomTokenObtainPairSerializer.validate()` adds the `user` object to the response.
4. Response: `{access, refresh, user: {id, email, is_staff, role, first_name, last_name}}`.
5. `authStore.setTokens()` (access → `sessionStorage`, refresh → `localStorage`) and `authStore.setUser()` (→ `localStorage` + Zustand state) — Section 10.3, Section 10.4.
6. `Login.jsx` reads `role`/`is_staff` from the response and navigates to `/operations`, `/freelancer`, or `/dashboard`.

## 19.2 ...a user creates a ticket

Fully traced in Section 18.1. In one sentence: `TicketForm.jsx` → `createTicket()` → `TicketListCreateView.create()` → `ticket_service.create_ticket()` → signals fire (ticket number, activity log) → email scheduled on commit → response includes the new ticket's ID for immediate navigation.

## 19.3 ...an engineer replies

1. Engineer types in `ConversationFeed.jsx`'s composer (rendered inside `TicketDetail.jsx`, Section 7.7.3) and submits (Ctrl/Cmd+Enter or the send button).
2. `addComment(ticketId, body, isInternal)` (`api/tickets.js`) → `POST /api/tickets/{id}/comments/`.
3. `TicketCommentListCreateView.perform_create()` resolves whether `is_internal` is actually honored based on the caller's role, then calls `ticket_service.add_comment()`.
4. Inside `add_comment()` (Section 6.6.1): the comment is saved; if this is the very first public, non-customer response, `ticket.first_response_at` is stamped (starting-gun for first-response SLA compliance); a `TicketActivityLog` "comment_added" entry is written (public comments only); `create_notification()` fires for the customer (or, if the customer commented, for the assigned engineer); an email is scheduled via `transaction.on_commit`.
5. The frontend's `useConversationFeed` either re-fetches or the component's local state is updated with the new comment, and `ConversationFeed.jsx` auto-scrolls to the bottom.

## 19.4 ...a manager assigns a ticket

Fully traced in Section 9.9 (the canonical worked example) and Section 18.3.

## 19.5 ...a notification is sent (and received)

1. Some backend action (Section 18.6's list) calls `notification_service.create_notification(recipient, category, title, body, ticket)`.
2. One `Notification` row is inserted, `is_read=False`.
3. **Nothing is pushed to the browser at this moment** — Section 13 explains why: there is no WebSocket/push layer.
4. Up to 30 seconds later (or immediately, if the recipient's browser tab was hidden and just regained focus), `useNotifications.js`'s poll timer fires `GET /api/notifications/unread-count/`.
5. `NotificationBell.jsx`'s badge count updates, with a brief pulse animation if the count increased.
6. Only when the user actually clicks the bell does `useNotifications.js` lazily fetch the full list (`GET /api/notifications/`) for the first time.
7. Clicking a notification row optimistically marks it read on-screen immediately, fires `PATCH /api/notifications/{id}/read/` in the background, and navigates to the linked ticket if one exists.

## 19.6 ...the Operations Command Center dashboard loads

1. `OpsDashboard.jsx` mounts.
2. `GET /ops/command-center/` fires once → `ops_command_center_core` → five service functions run (Section 12.4) → one combined JSON payload.
3. `GET /ops/command-center/live/` fires immediately as well → `ops_command_center_live` → the three time-sensitive service functions run → a second payload.
4. Both responses populate the page's widgets; `OperationsHealthBanner` and `AIDailyBriefCard` compute their content **client-side**, from data already in these two payloads — no third network call.
5. Every 45 seconds thereafter, only step 3 repeats (Section 12.3's core-vs-live split, and its stated reasoning).

## 19.7 ...the Executive Analytics dashboard loads

1. `ExecutiveAnalytics.jsx` mounts, calls `getExecutiveAnalytics()` (`api/executiveAnalytics.js`) once → `GET /ops/executive-analytics/?period=30d` (the default).
2. `executive_analytics` view (Section 9.7) checks `IsExecutiveAnalytics` (Section 6.5), applies the `AnalyticsRateThrottle` (Section 6.1 — shared bucket with `/analytics/`, Section 11.7's documented gotcha), then calls `build_executive_analytics_payload()` (Section 11.4), which runs roughly a dozen separate aggregation functions and assembles one JSON object, finishing with the deterministic `get_executive_insights()` sentence generator (Section 11.5).
3. The entire dashboard — 6-tile KPI row, donuts, sparklines, tables, insights — renders from this single response; no further network calls happen unless the user changes the period selector, which re-fetches the whole payload with new `?period=`/`?start=`/`?end=` parameters.

---

# 20. How to Modify the Project

Each recipe below is written for someone who has read this document but has never touched this specific codebase before — real file paths, real commands, in the exact order this project's own conventions expect (Section 4.1, Section 4.2).

## 20.1 How to add a new database field

**Example: adding an `internal_priority_note` text field to `Ticket`.**

1. Open `backend/support_app/models.py`, find the `Ticket` class, add the field: `internal_priority_note = models.TextField(blank=True)`.
2. Generate a migration. Because of a real, documented permissions quirk in this project (the backend Docker container runs as a non-root user that can't write new files into the host-mounted `migrations/` folder), run this from the **host** machine's own Python virtual environment, not via `docker compose exec`:
   ```bash
   cd backend
   DATABASE_URL=postgres://supportmitra:supportmitra@localhost:5432/supportmitra \
     .venv/bin/python manage.py makemigrations
   ```
   (Postgres's port is published to the host in `docker-compose.yml`, so this reaches the real running database directly.)
3. Django will generate a file like `0028_ticket_internal_priority_note.py` — **rename it** to something descriptive, e.g. `0028_add_ticket_internal_priority_note.py` (matching the naming convention every prior migration in the folder already follows).
4. Apply it: `docker compose exec backend python manage.py migrate`.
5. If this field should be visible via the API, add it to the relevant serializer(s) in `serializers.py` (Section 6.3) — remember the "one serializer per view of the model" pattern; decide which of `TicketDetailSerializer`, `TicketListSerializer`, etc. actually needs it, rather than adding it everywhere by default.
6. Write a test in `backend/tests/` covering the new field's behavior.

## 20.2 How to add a new API endpoint

**Example: an endpoint for a freelancer to add a private "personal note" to a ticket, separate from the shared internal-comment thread.**

1. **Serializer** (`serializers.py`): add a small `Serializer` (not `ModelSerializer`, since it's validating an action body, not a whole model — Section 6.3's Pattern 5) — e.g. `FreelancerNoteSerializer` with a `note = serializers.CharField()` field.
2. **Service function** (a new or existing file in `services/`): write the actual logic as a plain function taking model instances, following `ticket_service.py`'s contract (Section 6.6) — accept objects, return the result, raise `ValueError` for invalid states, never raise HTTP exceptions.
3. **View** (`views.py`): a thin `@api_view(["POST"])` function — validate via the serializer, call the service function inside a `try/except ValueError`, return the result. Declare `permission_classes` explicitly (Section 6.4) — in this example, `[IsAuthenticated, IsFreelancer]`.
4. **URL** (`urls.py`): add one `path(...)` line in the appropriate section, watching for ordering conflicts with existing UUID-matching routes (Section 9's repeated "literal paths before `<uuid:pk>`" warning).
5. **Frontend API wrapper** (the matching file in `frontend/src/api/`): a one-line function following the existing pattern, e.g. `export const addFreelancerNote = (ticketId, note) => apiClient.post(`/tickets/${ticketId}/note/`, { note });` — never call `axios`/`apiClient` directly from a page or component (Section 7.4).
6. **Frontend UI**: call the new wrapper from wherever it belongs — likely a small addition to `FreelancerTicketActions.jsx` (Section 7.7.3).
7. **Tests**: a Pytest test covering the permission boundary (does a customer correctly get 403?) and the success path, following the exact patterns already used throughout `backend/tests/` (Section 16.2).

## 20.3 How to add a new page

1. Create `frontend/src/pages/<Area>/<PageName>.jsx` (or directly under `pages/` for a top-level page).
2. Wrap it in the correct layout (Section 7.2/7.6): `AppShell` for a dashboard-style staff/customer/engineer page, `MainLayout` for a content-style page, or nothing (custom `Header`/`LandingFooter`) for a public marketing page.
3. Add a lazy import and a `<Route>` in `frontend/src/App.jsx`, wrapped in the correct guard component from Section 7.2's nine-guard table — pick the *narrowest* guard that actually matches who should see this page, not the broadest one that happens to work.
4. If it's a staff page, add a link to it in `components/layout/Sidebar.jsx`'s role-appropriate nav section (Section 7.7.5).
5. Call `usePageTitle("Your Page Name")` near the top of the component (every single page in this codebase does this — Section 5.7).
6. Fetch data only through the `api/` layer (Section 7.4), never `axios` directly.

## 20.4 How to add a new dashboard widget / chart

1. Decide which of the four zero-dependency chart primitives fits (`BarRow`, `Donut`, `ProgressBar`, `Sparkline` — Section 7.8) — this project has an explicit, confirmed policy against adding a charting library.
2. If none fit, build a new one in `components/dashboard/charts/`, following the same pattern: pure SVG/CSS, a `data` prop, and no dependency on any specific page's data shape.
3. Add the backend aggregation as a new function in the relevant service file (`executive_analytics_service.py` for period-scoped leadership metrics, `ops_command_center_service.py` for point-in-time operational metrics — Section 5.3), then wire it into that service's `build_*_payload()`/view function so it becomes part of the existing single-request payload rather than a new separate endpoint, unless it genuinely needs its own independent polling cadence (Section 12.3 explains when that split is justified).
4. Add the widget component under `components/dashboard/`, reusing `KpiCard`/`DashboardSection`/`Card` for consistent chrome (Section 7.7.2).

## 20.5 How to add a new in-app notification trigger

1. Find the exact point in a `services/*.py` function or `views.py` view where the triggering event happens.
2. Call `notification_service.create_notification(recipient=<user>, category="<category>", title="...", body="...", ticket=<ticket or None>)` (Section 6.6, Section 13.1) — if this is a genuinely new *kind* of event, add a new value to `Notification.CATEGORY_CHOICES` in `models.py` first, plus a migration (Section 20.1).
3. If the notification should also have an email, add a corresponding function to `email_service.py` following the existing pattern (render a template from `backend/templates/email/`, wrap in `try/except` so a broken email config can never break the triggering action) and call it via `transaction.on_commit()` if it's inside a database transaction (Section 6.6.1's reasoning for why).
4. No frontend change is required for the notification to *appear* — `NotificationBell.jsx` and `NotificationsPage.jsx` are already generic over `category` (Section 5.7, Section 13.1) — but consider adding an entry to `NotificationBell.jsx`'s `CATEGORY_META` icon/color lookup table so the new category doesn't fall through to the generic default icon.

## 20.6 How to add a new Celery task

1. Add a new `@shared_task`-decorated function to `backend/support_app/tasks.py`, following the existing retry pattern for anything that calls an external service: `@shared_task(bind=True, max_retries=3, default_retry_delay=60)`, and re-fetch any model instance by ID inside the task rather than passing a model object across the Celery boundary (tasks are serialized as JSON — Section 2.9, Section 15.2).
2. To run it immediately from other code: `from .tasks import your_task; your_task.delay(some_id)`.
3. To run it on a recurring schedule, add an entry to `CELERY_BEAT_SCHEDULE` in `settings.py` (Section 6.1, Section 15.3) — or, since `django-celery-beat`'s `DatabaseScheduler` is active, a Super Admin can alternatively add/edit a periodic schedule directly from the Django admin panel with no code deploy at all.
4. Restart the `celery`/`celerybeat` containers (`docker compose restart celery celerybeat`) to pick up the new task — a currently-running worker will not discover a newly-added function without a restart.

## 20.7 How to add a new user role

This is the most invasive kind of change in the whole system, since roles are threaded through the entire authorization stack — Section 10.9's access matrix is the map to follow:

1. Add the new role to `CustomUser.ROLE_CHOICES` in `models.py`, plus a migration (Section 20.1).
2. Add the matching entry to `AuditLog.USER_TYPE_CHOICES` and `RoleChangeAudit.ROLE_CHOICES` if the new role should be promotable/demotable through the existing role-management flow.
3. Add a predicate function (`is_<new_role>(user)`) and, if needed, new `BasePermission` classes in `permissions.py` (Section 6.5) — decide deliberately which of the existing role-group classes (`IsAnyStaffRole`, `IsTicketManagementStaff`, `IsPaymentReader`, etc.) the new role should or shouldn't be folded into.
4. Update `_ALLOWED_TRANSITIONS` and `_ROLE_DISPLAY` in both `views.py` and `serializers.py` (they're currently separately duplicated, not shared — Section 9.7).
5. Add the matching boolean to `useRoles()` in the frontend (`hooks/useRoles.js`, Section 5.7) and to any route guard in `App.jsx` that should admit this role (Section 7.2).
6. Update `Sidebar.jsx`'s nav-section visibility logic (Section 7.7.5) so the new role sees an appropriate navigation menu.
7. Write permission tests following `test_permissions.py`'s exhaustive role × endpoint pattern (Section 16.2) for every endpoint the new role should and shouldn't reach.

---

# 21. Common Mistakes

Real, documented, or structurally-obvious mistakes to avoid when working in this codebase — some are traps this project's own history has already fallen into and fixed; some are gaps that still exist today.

1. **Running `python manage.py ...` directly on the host instead of via `docker compose exec backend ...`.** Section 2.4's central warning: without `DATABASE_URL` set in your shell, Django silently falls back to a local SQLite file, a completely different database from the real Postgres container — any user or data change made this way is invisible to the actual running application.
2. **Trusting `SLALog.status` for SLA compliance reporting.** It only ever records "pending" and "breach" events, never "met" (Section 6.6.3, Section 8.3.14) — always compute compliance directly from `Ticket.resolved_at`/`due_at`.
3. **Confusing the `Service` database table with `service_catalog.py`.** Editing a `Service` row through `/operations/services` does **not** change ticket pricing or the service dropdown a customer sees when opening a ticket — that's entirely driven by the hardcoded `service_catalog.SERVICE_CATALOG` list (Section 8.3.19).
4. **Hardcoding service-category keys anywhere new** (a seed script, a test fixture, a skill tag). This project's own history records the entire eight-category key set being renamed once already — always read `SERVICE_CATALOG`/`SERVICE_CHOICES` at runtime instead (Section 1.2).
5. **Gating a staff-only feature on the collapsed `role` prop threaded through `TicketDetail.jsx`/`TicketSummarySidebar`, instead of `useRoles()`.** That prop collapses Ops Manager, Support Agent, *and* Finance Manager all down to the single string `"support_agent"` — using it to gate a genuinely `IsTicketManagementStaff`-only feature (which explicitly excludes Finance Manager) would incorrectly show that feature to Finance Managers too. Always use `useRoles().isTicketManagementStaff` directly for that specific check (Section 7.1's guard-versus-permission distinction, Section 10.9).
6. **Assuming `docker compose exec backend pytest` and a host-run pytest process can safely run at the same time.** Both hit the same shared, fixed-name `test_supportmitra` test database — this project's own operating history repeatedly documents `database "test_supportmitra" already exists`/`is being accessed by other users` errors from exactly this collision. Check `ps aux | grep pytest` before assuming a scary test failure is a real regression rather than contention.
7. **Re-running the full Pytest or Playwright suite many times in quick succession and concluding a regression from the resulting `429` errors.** Redis-backed throttles (`auth`, `analytics`) persist across process restarts by design (Section 6.9) — a clean re-run can fail purely from quota exhaustion left over from the *previous* run, not from any code change (Section 16.3, Section 16.5).
8. **Expecting `npm run lint` to work out of the box.** No ESLint configuration file exists anywhere in this repository as of this reading (Section 2.29) — this is a known, pre-existing gap, not something a normal change accidentally broke.
9. **Chasing full `black --check` compliance as a merge blocker.** A clean, unmodified checkout of this repository already fails `black --check --diff` on dozens of files (Section 17.4's CI notes) — the codebase's style predates full black adoption. The bar for a change is "don't add *new* violations on the lines you touched," not "make the whole repository pass."
10. **Adding a new charting library.** This project has an explicit, confirmed policy of staying zero-dependency for every chart, using the four hand-rolled SVG primitives instead (Section 7.8, Section 20.4) — this was a deliberate choice made against the more conventional recommendation at the time, not an oversight.
11. **Calling `axios`/`fetch` directly from a page or component.** Every network call must go through the matching wrapper function in `frontend/src/api/` (Section 7.4) — bypassing this loses the automatic JWT-attachment and token-refresh behavior (Section 10.6) for that one call.
12. **Forgetting that `Payment.ticket` is `SET_NULL`, not `CASCADE`, while `Payment.customer` and `Ticket.customer` are `PROTECT`.** Any bulk-delete or data-cleanup logic touching `Customer` or `Ticket` rows must delete `Payout` and `Payment` rows first, or it will raise a `ProtectedError` — and deleting a `Ticket` will **not** automatically delete its `Payment` history, which must be handled explicitly (Section 8.3.9).
13. **Editing an already-applied migration file directly instead of generating a new one.** Django tracks which migrations have run in its own table — hand-editing history after the fact desynchronizes that tracking from what the database schema actually looks like (Section 8.5).
14. **Assuming the two legacy `pages/admin/*` pages (`FreelancerList.jsx`, `PaymentsDashboard.jsx`) and their newer `pages/ops/*` counterparts are interchangeable or safe to delete casually.** Both pairs remain independently reachable and functional; the legacy pair uses raw `apiClient` calls and the older `/admin/` endpoint family rather than the newer `/ops/` wrapper functions (Section 7.6.5) — removing either without product/engineering sign-off risks breaking a route someone still relies on.
15. **Assuming Executive Analytics' `utilization_pct` values over 100% indicate a data bug.** They reflect a documented, honestly-flagged *calibration gap* in the hardcoded per-availability-tier capacity heuristic, not corrupted data (Section 11.6) — the correct fix is recalibrating or making capacity configurable, not "clamping" the number to hide it.
16. **Looking for a WebSocket connection to explain "real-time" behavior in this product.** There isn't one yet — every live-feeling number in ResolveHQ today is a browser-side polling timer (Section 13). Don't debug a "notification felt slow" report by looking for a broken socket; look for a throttle exhaustion, a paused-tab poll timer, or simply the expected 30–45 second latency working as designed.

---

# 22. Glossary

Every technical term used in this document, defined in plain English.

**API (Application Programming Interface):** a defined set of rules for how two pieces of software talk to each other. In this project, the backend exposes a "REST API" — a set of URLs the frontend calls to fetch or change data.

**Authentication:** proving who you are (Section 10). Contrast with **Authorization**: proving you're *allowed* to do a specific thing.

**Authorization:** the system deciding whether an already-identified user is permitted to perform a specific action (Section 6.5, Section 10.9).

**Axios:** a JavaScript library for making network requests from the browser to a server (Section 2.14).

**Backend:** the part of an application that runs on a server, with access to the database and other private resources — never directly visible to or runnable by the end user's browser. In this project: the Django application.

**Broker (message broker):** the "waiting room" a background task queue uses to pass messages from the code that requests work to the workers that perform it. In this project: Redis, for Celery (Section 15.1).

**Cache:** a place to store a piece of data temporarily so it can be retrieved faster the next time, instead of recomputing or re-fetching it. In this project, mostly used for rate-limit counters, not general query caching (Section 6.9).

**CI/CD (Continuous Integration / Continuous Deployment):** automatically running checks (tests, lint, builds) on every code change (CI), and automatically shipping a passing change to production (CD). This project's CI/CD lives in `.github/workflows/` (Section 17.4, Section 17.5).

**Component (React):** a self-contained, reusable piece of a user interface, written as a function that returns markup (Section 7.1).

**Container (Docker):** a lightweight, isolated, portable bundle of an application plus everything it needs to run (Section 2.21).

**CORS (Cross-Origin Resource Sharing):** a browser security rule that blocks a webpage from making requests to a different domain/port than the one it was loaded from, unless the server explicitly allows it. This project's backend explicitly allows the frontend's origin via `django-cors-headers` (Section 2.29, Section 6.1).

**CSAT (Customer Satisfaction score):** a 1–5 rating a customer gives after their ticket is resolved (Section 8.3.15).

**Deploy / Deployment:** the process of taking application code and making it run on a real, live production server, reachable by real users (Section 17).

**Django:** the Python web framework this project's backend is built on (Section 2.2).

**DRF (Django REST Framework):** the add-on to Django this project uses to build its JSON API (Section 2.3).

**Endpoint:** one specific URL + HTTP method combination that the API responds to — e.g., `POST /api/tickets/` is one endpoint.

**Environment variable:** a small piece of configuration kept outside the source code, usually in a `.env` file, so secrets never get committed to Git (Section 2.25).

**Foreign key:** a column in one database table that points to a row in another table, creating a relationship between them (Section 8.1) — e.g., `Ticket.customer_id` points to a row in `Customer`.

**Frontend:** the part of an application that runs inside the user's own web browser. In this project: the React application.

**Git:** the version-control system that tracks every change to this project's source code over time (Section 2.23).

**GST / GSTIN:** Goods and Services Tax and the associated GST Identification Number — India's consumption tax system and the 15-character registration number a registered business must show on invoices (Section 8.3.2, Section 6.6's invoice generator).

**HTTP / HTTPS:** the protocol (set of rules) web browsers and servers use to communicate. HTTPS is the encrypted version — everything in production runs over HTTPS (Section 14.4).

**Hook (React):** a function, always starting with `use`, that lets a plain function-component tap into React features like state or side effects (Section 7.1).

**Idempotent:** describes an operation that produces the same end result no matter how many times it's repeated — calling it twice is exactly as safe as calling it once. Several of this project's payment functions are deliberately idempotent (Section 6.6.2) to safely handle retried requests and duplicate webhook deliveries.

**Index (database):** a special data structure a database maintains alongside a table specifically to make certain queries much faster to look up, at the cost of slightly slower writes and more disk space. This project defines specific indexes for its most common query patterns (Section 8.3).

**JSON (JavaScript Object Notation):** a simple, human-readable text format for structured data — the format the frontend and backend exchange with each other on every API call.

**JWT (JSON Web Token):** a compact, signed piece of text proving a user's identity, used instead of traditional server-side login sessions (Section 2.22, Section 10.2).

**Manager (Django model manager):** the object responsible for creating and querying rows of a specific model — e.g., `CustomUserManager` (Section 8.3.1) is what actually runs when you call `User.objects.create_user(...)`.

**Middleware:** a piece of code that runs on every single request/response, positioned in an ordered chain, before the actual view logic (Section 6.1).

**Migration:** a small, numbered Python script describing exactly one change to the database's structure, generated and applied by Django (Section 8.5).

**Model:** a Python class representing one database table — each instance of the class represents one row (Section 8.1).

**ORM (Object-Relational Mapper):** the layer that lets you write Python code instead of raw SQL to talk to the database (Section 2.6).

**Payload:** the actual data contents of a request or response — e.g., "the Executive Analytics payload" means the full JSON body that endpoint returns.

**Permission (DRF):** a rule class DRF checks before running a view's logic, deciding whether the requesting user is allowed to proceed at all (Section 6.5).

**Polling:** repeatedly asking a server "anything new?" on a fixed timer, as opposed to the server pushing updates the instant they happen. This project's entire notification and live-dashboard system works this way today (Section 13).

**Props (React):** the inputs passed into a component by whoever renders it, exactly like function arguments (Section 7.1).

**Race condition:** a bug that only happens when two things occur at nearly the same time in an unexpected order — e.g., two payments both trying to generate the same invoice number simultaneously. This project defends against several specific race conditions with database row locks (Section 6.6.2).

**Redis:** the fast, in-memory key-value store this project uses as a Celery broker, Celery result store, and Django's cache/rate-limit backend (Section 2.5).

**REST (Representational State Transfer):** a common architectural style for designing web APIs around resources (like "tickets" or "payments") and standard HTTP methods (GET, POST, PATCH, DELETE).

**Route / Routing:** the mapping between a URL and the code that should handle it — on the backend, `urls.py`; on the frontend, `App.jsx`'s `<Routes>` (Section 3.2, Section 7.2).

**Serializer (DRF):** the layer that converts between Python/database objects and JSON (Section 6.3).

**Service layer:** this project's own convention for where business logic lives, separate from views — the `services/` folder (Section 6.6).

**Signal (Django):** a mechanism for code to run automatically in reaction to an event, like a model being saved, without the triggering code needing to know about it directly (Section 6.7).

**SLA (Service Level Agreement):** a promised time limit — in this project, how quickly a ticket must receive a first response and be fully resolved, varying by severity (Section 6.6.3).

**State (React):** data a component remembers between renders, which can change over time and causes the component to automatically re-render when it does (Section 7.1).

**Task queue:** a system for running work in the background, off the main request/response cycle (Section 15.1) — Celery, in this project.

**Throttle (DRF):** a rate limit — a rule capping how many requests a given user or IP can make in a given time window (Section 6.1, Section 6.9).

**Transaction (database):** a group of database operations that either *all* succeed together or *all* fail together, with nothing left half-done — this project uses `transaction.atomic()` extensively for exactly this guarantee (Section 6.6.1).

**UUID (Universally Unique Identifier):** a long, effectively-unguessable random identifier used as the primary key for every table in this project instead of a simple incrementing number (Section 8.1).

**View (Django/DRF):** the function or class that actually handles one specific API endpoint's request and produces a response (Section 6.4).

**Webhook:** an automated HTTP request one system sends to another the instant something happens — in this project, Razorpay calling `POST /api/payments/webhook/` the moment a payment is captured (Section 9.3, Section 6.6.2).

---

# 23. Complete End-to-End Story: The Life of One Ticket

This final section tells the complete, uninterrupted story of a single support ticket from the moment a customer opens their browser to the moment every part of the system — database, analytics, notifications, operations dashboards — has fully absorbed the outcome. Every file, function, API call, and database table named below has already been documented in full detail earlier in this book; this section's job is to show them all working together, in the correct order, as one continuous story.

**Our customer:** Priya, running a 12-person marketing agency, whose shared Windows Server is reporting "disk full" (the exact scenario introduced in Section 1.3).

## Act 1 — Priya opens a ticket

Priya visits ResolveHQ, already logged in (her browser holds a valid access token in `sessionStorage` and a refresh token in `localStorage` — Section 10.3). She clicks "New Ticket," landing on `frontend/src/pages/NewTicket.jsx` (Section 7.6.3), wrapped in `MainLayout`. The page renders `components/tickets/TicketForm.jsx` (Section 7.7.3), which on mount calls `listServices()` → `GET /api/services/` → `views.py :: services_list` → reads `service_catalog.SERVICE_CATALOG` (Section 1.2, Section 5.3) directly, no database query needed at all, since pricing is hardcoded Python, not a database table.

Priya selects **Server Administration Support**, types her disk-full description, and sets severity to **High**. `TicketForm.jsx`'s `PricingPreview` sub-component computes and displays, entirely client-side: consulting fee ₹299 + 18% GST = ₹352.82 due now, and a resolution-fee preview of ₹999 (base) + ₹500 (High surcharge) = ₹1,499 subtotal + 18% GST = ₹1,768.82, due only once resolved.

She submits. `createTicket(formData)` → `POST /api/tickets/` → `TicketListCreateView.create()` → `TicketCreateSerializer` validates the four fields → `ticket_service.create_ticket()` (Section 6.6.1) saves a new `Ticket` row with `status="pending_payment"`. Three things happen automatically at this exact moment via Django signals (Section 6.7): `auto_generate_ticket_number` stamps `ticket_number = "TKT-A1B2C3D4"` (derived from the row's own UUID), `log_ticket_created` writes the very first `TicketActivityLog` row (`action="created"`, `actor=`Priya's user account, since her `Customer` profile is the one creating it), and `transaction.on_commit()` schedules `email_service.send_ticket_created()` for after the database write is safely committed. The API responds `201 Created` with the new ticket's `id` and `ticket_number`, and Priya's browser navigates straight to `/tickets/{id}`.

## Act 2 — Priya pays the consulting fee

`TicketDetailPage.jsx` (Section 7.6.3) fetches the ticket via `useRoleTicketFetcher` → `getTicket(id)` (customer-scoped) → `TicketDetailView` → `TicketDetailSerializer` (Section 6.3). Since `status === "pending_payment"`, `TicketDetail.jsx` renders `PaymentGateway.jsx` (Section 7.7.3). Priya clicks Pay: `initiatePayment(ticketId)` → `ticket_initiate_payment` → `payment_service.create_order_for_ticket()` (Section 6.6.2) creates a `Payment` row (`payment_type="consulting_fee"`, a freshly-locked, guaranteed-unique invoice number from `InvoiceCounter` — Section 8.3.10) and, since this is a development/demo environment without live Razorpay keys configured, returns a sandbox mock order.

Priya (in this sandbox scenario) clicks "Simulate Payment." `verifyPayment()` → `ticket_verify_payment` → `payment_service.verify_and_complete_payment()` — signature verification is skipped in sandbox mode — marks the `Payment` `completed`, then calls `_open_ticket_after_payment()`: the ticket's `_actor` is set (for the signal to log correctly), `status` moves to `"open"`, `sla_service.set_ticket_due_at()` (Section 6.6.3) computes and stamps `due_at` (24 hours from now — the High-severity default) and `first_response_due_at` (2 hours from now), writes an `SLALog` "created"/pending row, and `create_notification()` fires a `payment_confirmed` notification for Priya.

## Act 3 — An Operations Manager assigns an engineer

Somewhere in ResolveHQ's staff office, Aditi (an Operations Manager) is looking at `/operations/tickets` — `OpsTicketQueue.jsx` (Section 7.6.5), polling `GET /ops/tickets/` (Section 9.7). Priya's new ticket appears, status `open`, no assignee, `sla_status` computed as `"ok"` (still comfortably inside the 24-hour window). Aditi clicks Assign. This is the exact sequence traced completely in Section 9.9: `AdminTicketActions.jsx`'s modal → `opsAssignTicket()` → `POST /ops/tickets/{id}/assign/` → `IsTicketManagementStaff` permission check passes (Aditi is an Ops Manager) → `ticket_service.assign_ticket()` (Section 6.6.1) atomically closes any prior assignment (none exists), sets `assigned_to = Rahul`, `status = "assigned"`, creates a `TicketAssignment` row, writes an explicit "assigned" `TicketActivityLog` entry — and three `create_notification()` calls fire: one for Rahul (the newly-assigned engineer), one for Priya (her ticket is being handled), and one for every other on-duty Support Agent/Ops Manager.

Up to 30 seconds later, Rahul's `NotificationBell.jsx` (he's logged into the Engineer Workspace) shows an updated unread badge (Section 13.1). Up to 30 seconds later, Priya's own `TicketDetailPage.jsx` poll (Section 7.6.3, since her ticket's `status === "open" && role === "customer"` — though by now it's actually `"assigned"`, so this specific poll condition has already stopped applying by the time she next looks) or her next manual page load shows Rahul's name and profile.

## Act 4 — Rahul works the ticket

Rahul opens `EngineerWorkspace.jsx` (Section 7.6.4). The new ticket appears in his **Today's Work** triage bucket (`utils/ticketPriority.js`'s `bucketAndSortTickets`, Section 5.8) — not yet **Requires Immediate Attention**, since it isn't overdue or due-soon yet. He opens the ticket, sees `TicketDetail.jsx`'s full layout (Section 7.7.3), and clicks "Start Working" — `FreelancerTicketActions.jsx` → `freelancerUpdateStatus(id, "in_progress")` → `POST /freelancer/tickets/{id}/status/` → `ticket_service.update_status()` (Section 6.6.1) moves the ticket to `in_progress`.

Rahul posts a public comment via `ConversationFeed.jsx`'s composer: "Hi Priya, I can see the disk-full issue — connecting now via remote session." This is his **first public, non-customer response** — `ticket_service.add_comment()` stamps `ticket.first_response_at` at this exact moment (Section 6.6.1), starting the clock that will later determine first-response SLA compliance (Section 11.4). He then shares a remote-session link via `FreelancerTicketActions.jsx`'s popover (`freelancerStartRemoteSession`), which both saves `ticket.remote_session_url` and posts an announcement comment.

Working remotely, Rahul finds old IIS log files eating disk space, clears them safely, and confirms the server is healthy. He navigates to `/tickets/{id}/resolve` — `ResolveTicketPage.jsx` (Section 7.6.3) — and fills in the required structured fields (Root Cause: "Unrotated IIS logs consumed available disk space"; Steps Taken; Resolution Notes), which `utils/resolution.js`'s `composeBody()` (Section 5.8) encodes and saves as an internal comment via `addComment(id, body, true)`. He clicks "Resolve Ticket" → `resolveTicketByRole("freelancer", id, note)` → `freelancerUpdateStatus(id, "resolved")` → `ticket_service.update_status()` stamps `resolved_at` and fires `email_service.send_ticket_resolved()` to Priya.

## Act 5 — Priya accepts and pays the resolution fee

Priya returns to her ticket. `CustomerResolutionActions.jsx` (Section 7.7.3) renders the Accept/Reject decision. She reviews `ResolutionSummary.jsx`'s read-only display of Rahul's structured notes (Section 7.7.3) and clicks Accept. `getResolutionQuote(id)` → `resolution_quote` returns the itemized ₹1,768.82 breakdown, computed live from `service_catalog.get_resolution_fee()` (Section 1.2). She pays (sandbox-simulated again, for this story): `verifyResolutionPayment()` → `verify_resolution_payment_service()` (Section 6.6.2), which — inside one atomic transaction — marks the `Payment` completed, closes the ticket (`status = "closed"`, `resolved_at` confirmed), and saves her `CSATSurvey` (5 stars, "Fast and professional!"). **Outside** that transaction (deliberately, so a downstream failure here can never undo her already-confirmed payment), `payout_service.create_payout_for_ticket()` creates a `Payout` row: `resolution_fee = ₹1,499`, `severity_surcharge = ₹500` (already included in that subtotal), `engineer_share = ₹974.35` (65%), `platform_share = ₹524.65` (35%), `status = "pending"`. Rahul is notified his payout is pending.

## Act 6 — The paper trail

Priya downloads her GST tax invoice: `downloadInvoice(paymentId)` → `GET /payments/{id}/invoice/` → `invoice_pdf.generate_invoice_pdf()` (Section 5.2) renders a ReportLab PDF showing the base fee + severity surcharge as separate line items (since a surcharge was actually applied — Section 6.6's `_get_resolution_breakdown` logic), her B2C or B2B status depending on whether her `Customer.gstin` is set, and ResolveHQ's own GSTIN. Every step of this ticket's life — created, status_changed (×4), severity unchanged, assigned, comment_added (×several), resolved, closed — sits permanently, immutably, in `TicketActivityLog` (Section 8.3.7), visible in the ticket's own timeline UI and readable (but never editable or deletable, even by a Super Admin — Section 6.8) forever.

## Act 7 — The organization absorbs the outcome

Within a day, this one ticket's numbers ripple into every aggregate view in the product without any special-cased code anywhere having to know about *this specific ticket*:

- **Executive Analytics** (Section 11): the next time a Super Admin, Ops Manager, or Finance Manager loads `/operations/executive-analytics`, this ticket contributes to `total_tickets`, `total_revenue` (both payments — ₹352.82 + ₹1,768.82), `sla_compliance_pct` (counted as *met*, since `resolved_at` was before `due_at`), `csat_avg` (pulled up by Priya's 5-star rating), `top_problem_categories`'s Server Administration Support bucket, `revenue.pending_payouts_total` (until Rahul's ₹974.35 is marked processed), and — assuming enough similar tickets exist — a sentence in `get_executive_insights()`'s generated summary (Section 11.5).
- **Operations Command Center** (Section 12): while the ticket was open, it briefly appeared in the SLA Risk Board if it ever came within 4 hours of its deadline, contributed to Rahul's `active_ticket_count` in Engineer Capacity, and to the Server Administration row in Service Health's open-load count. Once closed, it drops out of every "live" widget entirely and lives on only in aggregate history.
- **Rahul's own dashboard**: his `EngineerWorkspace.jsx` KPI row (`getAnalytics()`, Section 9.6) now counts this ticket in his resolved total and average resolution time; his workload donut (`WorkloadSummaryPanel`, Section 7.7.2) no longer shows it as active.
- **Priya's own dashboard**: her `Dashboard.jsx` (Section 7.6.3) KPI tiles update, and the ticket moves out of every active-ticket triage bucket (`utils/customerTicketPriority.js`) and into her plain ticket history.
- **Finance**: `/operations/payments` (`OpsPayments.jsx`, Section 7.6.5) shows both completed payments; the pending payout awaits a Finance Manager marking it `processed` with a real bank transfer UTR number (`payout_service.mark_payout_processed()`, Section 5.3), at which point it disappears from `revenue.pending_payouts_total` on every future Executive Analytics load.

**One ticket. One customer. One engineer. Two payments. One PDF invoice. Roughly a dozen database rows across seven different tables. Zero lines of code anywhere that mention "Priya," "Rahul," or "TKT-A1B2C3D4" specifically** — every single behavior in this story comes from the same general-purpose models, services, views, permissions, and React components documented throughout this book, applied once to one real, concrete story. That is the entire architecture of ResolveHQ, and now you've seen it work, start to finish.

---

*This document was produced by reading the complete source code of this repository — every backend Python file, every frontend JavaScript/JSX file, every configuration file, every test file, and every Docker/CI file referenced above — as it existed on 2026-07-15. Where the code's own comments documented history, trade-offs, or known gaps, this document reports them faithfully rather than smoothing them over. If you find something here that no longer matches the code, trust the code — and consider updating this document to match, the same way every other change to this project is expected to keep its documentation honest.*

