# ResolveHQ — Final Launch Checklist
**Phase 10: Production Readiness**
**Date:** 2026-05-20
**Status:** Ready for Beta Launch

---

## How to Use This Checklist

Work through each section top-to-bottom before deploying to production. Sections marked ✅ are already done in the codebase. Sections marked ☐ require action from you.

---

## 1. Infrastructure Setup

| # | Task | Status |
|---|------|--------|
| 1.1 | Provision Ubuntu 22.04 server (min 2 vCPU, 4 GB RAM) | ☐ |
| 1.2 | Point domain A record to server IP | ☐ |
| 1.3 | Install Docker + Docker Compose on server | ☐ |
| 1.4 | Install nginx and certbot | ☐ |
| 1.5 | Create non-root `deploy` user with sudo | ☐ |
| 1.6 | Set up SSH key authentication (disable password login) | ☐ |
| 1.7 | Configure UFW firewall: allow only 22, 80, 443 | ☐ |

---

## 2. Environment Configuration

| # | Task | Status |
|---|------|--------|
| 2.1 | Copy `backend/.env.example` → `backend/.env` | ☐ |
| 2.2 | Generate and set `SECRET_KEY` (50+ random chars) | ☐ |
| 2.3 | Set `DEBUG=0` | ☐ |
| 2.4 | Set `ALLOWED_HOSTS=supportmitra.in,www.supportmitra.in` | ☐ |
| 2.5 | Set `DATABASE_URL` with a strong PostgreSQL password | ☐ |
| 2.6 | Set `REDIS_URL` | ☐ |
| 2.7 | Verify `.env` is in `.gitignore` — NEVER commit it | ✅ |
| 2.8 | Set `CORS_ALLOWED_ORIGINS` to production domain | ✅ (already in settings.py) |

---

## 3. Backend Django Configuration

| # | Task | Status |
|---|------|--------|
| 3.1 | `SECRET_KEY` loaded from env (not hard-coded) | ✅ |
| 3.2 | `DEBUG=False` in production | ✅ |
| 3.3 | `ALLOWED_HOSTS` set | ✅ |
| 3.4 | HTTPS security headers enabled for production | ✅ (Phase 10) |
| 3.5 | HSTS enabled (`SECURE_HSTS_SECONDS=31536000`) | ✅ (Phase 10) |
| 3.6 | `SESSION_COOKIE_SECURE=True` | ✅ (Phase 10) |
| 3.7 | `CSRF_COOKIE_SECURE=True` | ✅ (Phase 10) |
| 3.8 | `X_FRAME_OPTIONS=DENY` | ✅ (Phase 10) |
| 3.9 | `SECURE_CONTENT_TYPE_NOSNIFF=True` | ✅ (Phase 10) |
| 3.10 | Rate limiting configured (auth: 10/min, user: 100/min) | ✅ |
| 3.11 | JWT access token: 15 min lifetime | ✅ |
| 3.12 | JWT refresh token rotation + blacklisting | ✅ |

---

## 4. Database

| # | Task | Status |
|---|------|--------|
| 4.1 | PostgreSQL container running | ☐ |
| 4.2 | Run all migrations: `docker compose exec backend python manage.py migrate` | ☐ |
| 4.3 | Create admin superuser: `docker compose exec backend python manage.py createsuperuser` | ☐ |
| 4.4 | Verify no SQLite file being used (check `DATABASE_URL` is set) | ☐ |
| 4.5 | Set up daily backup cron job (see PRODUCTION_DEPLOYMENT_GUIDE.md §10) | ☐ |
| 4.6 | Test backup restore before going live | ☐ |

---

## 5. Static Files & Nginx

| # | Task | Status |
|---|------|--------|
| 5.1 | Run `collectstatic`: `docker compose exec backend python manage.py collectstatic --noinput` | ☐ |
| 5.2 | Build React frontend: `cd frontend && npm run build` | ☐ |
| 5.3 | Copy `nginx/nginx.conf` to `/etc/nginx/sites-available/supportmitra` | ☐ |
| 5.4 | Update paths in nginx.conf for your deploy directory | ☐ |
| 5.5 | Add `limit_req_zone` directives to `/etc/nginx/nginx.conf` http block | ☐ |
| 5.6 | Test nginx config: `sudo nginx -t` | ☐ |
| 5.7 | Enable site and reload nginx | ☐ |

---

## 6. SSL Certificate

| # | Task | Status |
|---|------|--------|
| 6.1 | Run certbot: `sudo certbot --nginx -d supportmitra.in -d www.supportmitra.in` | ☐ |
| 6.2 | Verify auto-renewal: `sudo certbot renew --dry-run` | ☐ |
| 6.3 | Verify HTTPS works: `curl -I https://supportmitra.in/` | ☐ |
| 6.4 | Verify HTTP redirects to HTTPS | ☐ |

---

## 7. Security Verification

| # | Task | Status |
|---|------|--------|
| 7.1 | Test unauthenticated API access returns 401 | ✅ (Phase 9 QA) |
| 7.2 | Test cross-role access returns 403 | ✅ (Phase 9 QA) |
| 7.3 | Test cross-customer ticket access returns 404 | ✅ (Phase 9 QA) |
| 7.4 | Test internal comments hidden from customers | ✅ (Phase 9 QA) |
| 7.5 | Verify `/metrics` is blocked from public access (nginx) | ☐ |
| 7.6 | Change Django admin URL from `/django-admin/` to something obscure | ☐ |
| 7.7 | Verify `DEBUG=False` shows no stack traces in 500 errors | ☐ |

---

## 8. Payment Integration (Razorpay)

| # | Task | Status |
|---|------|--------|
| 8.1 | Create Razorpay account + get live API keys | ☐ |
| 8.2 | Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in `.env` | ☐ |
| 8.3 | Configure Razorpay webhook URL: `https://supportmitra.in/api/payments/webhook/` | ☐ |
| 8.4 | Set `RAZORPAY_WEBHOOK_SECRET` in `.env` | ☐ |
| 8.5 | Test webhook signature verification | ☐ |
| 8.6 | Test payment flow end-to-end in Razorpay test mode | ☐ |

*Note: Payment integration is an MVP gap. Tickets currently default to `pending_payment` status and must be manually opened by admin until Razorpay is wired up.*

---

## 9. Email (Transactional)

| # | Task | Status |
|---|------|--------|
| 9.1 | Create SendGrid (or AWS SES) account | ☐ |
| 9.2 | Verify sender domain (`support@supportmitra.in`) | ☐ |
| 9.3 | Set `EMAIL_HOST_PASSWORD` in `.env` | ☐ |
| 9.4 | Test password reset email sends | ☐ |
| 9.5 | Test ticket notification email sends | ☐ |

*Note: In development (`DEBUG=1`), emails print to terminal — no SMTP needed.*

---

## 10. File Uploads (S3)

| # | Task | Status |
|---|------|--------|
| 10.1 | Create AWS S3 bucket (`supportmitra-uploads`) | ☐ |
| 10.2 | Set bucket policy (private, accessible only via presigned URLs) | ☐ |
| 10.3 | Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME` in `.env` | ☐ |
| 10.4 | Implement file upload API endpoint (currently MVP gap) | ☐ |

*Note: The `TicketAttachment` model exists in the database. The API endpoint and S3 integration are Phase 11 work.*

---

## 11. Monitoring & Logging

| # | Task | Status |
|---|------|--------|
| 11.1 | Set up Sentry for error monitoring (recommended) | ☐ |
| 11.2 | Configure log aggregation (CloudWatch / Papertrail / Logtail) | ☐ |
| 11.3 | Set up uptime monitoring (UptimeRobot, BetterUptime) | ☐ |
| 11.4 | Verify Django logs are accessible: `docker compose logs -f backend` | ☐ |
| 11.5 | Configure log rotation | ☐ |

---

## 12. Pre-Launch Smoke Tests

Run these tests AFTER deploying to production, before announcing to users:

| # | Test | Expected |
|---|------|---------|
| 12.1 | Open `https://supportmitra.in` | Landing page loads |
| 12.2 | Register a new customer account | Email/password accepted, redirect to dashboard |
| 12.3 | Create a support ticket | Ticket created with TKT-XXXXXX number |
| 12.4 | Login as admin | Redirected to /admin dashboard |
| 12.5 | Assign ticket to a freelancer (must create one first) | Ticket status changes |
| 12.6 | Login as freelancer | Sees assigned ticket |
| 12.7 | Freelancer marks ticket in_progress | Status updates |
| 12.8 | Logout | Session cleared, redirect to /login |
| 12.9 | Try accessing dashboard without login | Redirect to /login |
| 12.10 | Check HTTPS is working | No browser security warnings |

---

## 13. Launch Day Operations

| # | Task |
|---|------|
| 13.1 | Double-check all environment variables are set |
| 13.2 | Run final backend tests: `docker compose exec backend pytest` |
| 13.3 | Monitor error logs for first 30 minutes after launch |
| 13.4 | Have a rollback plan (git revert + `docker compose up --build`) |
| 13.5 | Brief any support staff on the admin workflow |

---

## MVP Limitations to Communicate to Beta Users

Be upfront with beta users about these known gaps:

| Limitation | Impact | Timeline |
|-----------|--------|---------|
| File uploads not available | Cannot attach screenshots to tickets | Phase 11 |
| Payment flow not complete | Admin manually activates tickets | Phase 11 |
| No mobile app | Web browser only | Future |
| No real-time notifications | 30-second polling delay | Future |
| No ticket reopen button | Customer must contact admin | Phase 11 |
| No analytics dashboard | Admin can't see metrics | Phase 11 |

---

## Overall Launch Readiness

| Area | Score | Ready? |
|------|-------|--------|
| Core workflows (customer/freelancer/admin) | 8.5/10 | ✅ Yes |
| Authentication & security | 9/10 | ✅ Yes |
| Error handling | 8/10 | ✅ Yes |
| Deployment infrastructure | Ready with guide | ✅ Yes |
| Payment integration | Not implemented | ⚠️ Beta only |
| File uploads | Not implemented | ⚠️ Beta only |

**Verdict: Beta launch approved. Limit to 50–100 users until Phase 11 is complete.**
