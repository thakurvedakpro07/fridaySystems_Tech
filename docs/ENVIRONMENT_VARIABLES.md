# ResolveHQ — Environment Variables Reference

All environment variables are read from `backend/.env`.
Copy `.env.example` to `backend/.env` and fill in the values.

**Never commit `backend/.env` to git.** It is listed in `.gitignore`.

---

## Required in all environments

| Variable | Example | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `abc123...xyz` | Django secret key. Must be ≥50 chars, unique per environment. Generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` | `postgres://supportmitra:pass@db:5432/supportmitra` | PostgreSQL connection string. Host `db` resolves to the Docker container. |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string. Host `redis` resolves to the Docker container. |

---

## Django behaviour

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `0` | `1` = dev mode (verbose errors, console email). `0` = production. **Must be `0` in production.** |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | Comma-separated hostnames Django accepts. In production: `resolvehq.in,www.resolvehq.in` |
| `DJANGO_SETTINGS_MODULE` | `supportmitra.settings` | Set to `supportmitra.settings_prod` in production (done automatically by `docker-compose.prod.yml`). |
| `TIME_ZONE` | `Asia/Kolkata` | Timezone for display and SLA deadline calculations. |
| `APP_URL` | `http://localhost:5173` | **Required in production** (startup raises `ImproperlyConfigured` if missing when `DEBUG=0`). Used to build links in transactional emails. Must be your live domain, no trailing slash — e.g. `https://resolvehq.in`. |

---

## JWT tokens

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | `15` | How long an access token stays valid. Short is more secure. |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | `7` | How long a refresh token stays valid. Users are logged out after this. |

---

## Brute-force / account lockout protection

Identifier-based failed-attempt counting (login email, password-reset token uid) with a
temporary lockout and progressive backoff — complements, not replaces, the per-IP
`AuthRateThrottle` (5/minute). See `support_app/services/account_protection_service.py`.

| Variable | Default | Description |
|----------|---------|-------------|
| `BRUTE_FORCE_PROTECTION_ENABLED` | `true` | Master switch. Set to `false` to fully disable (e.g. for local load testing). |
| `LOGIN_LOCKOUT_THRESHOLD` | `5` | Failed attempts against one identifier within the window before it locks. |
| `LOGIN_LOCKOUT_WINDOW_SECONDS` | `900` | Rolling window (seconds) the failed-attempt count is measured over. |
| `LOGIN_LOCKOUT_BASE_DURATION_SECONDS` | `900` | Lockout duration on the first offense. |
| `LOGIN_LOCKOUT_MAX_DURATION_SECONDS` | `86400` | Cap on lockout duration — progressive backoff never exceeds this. |
| `LOGIN_LOCKOUT_STRIKE_WINDOW_SECONDS` | `86400` | How long repeat lockouts keep doubling the duration before the "strike count" resets. |
| `PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS` | `60` | Minimum time between password-reset emails sent to the same address. |

---

## Payments — Razorpay

**Required in production.** Get these from [dashboard.razorpay.com](https://dashboard.razorpay.com) → Settings → API Keys.

| Variable | Example | Description |
|----------|---------|-------------|
| `RAZORPAY_KEY_ID` | `rzp_test_xxxx` | API key ID. Use `rzp_test_` prefix for test mode, `rzp_live_` for production. |
| `RAZORPAY_KEY_SECRET` | `xxxxxxxx` | API key secret. Keep this private — it signs payment requests. |
| `RAZORPAY_WEBHOOK_SECRET` | `xxxxxxxx` | Webhook secret from Razorpay Dashboard → Settings → Webhooks. Used to verify that webhook calls come from Razorpay (HMAC-SHA256 signature). |

---

## Email — SMTP (e.g. SendGrid)

In development (`DEBUG=1`), emails are printed to the terminal — no SMTP config needed.
In production (`DEBUG=0`), real SMTP credentials are required for ticket confirmations,
password resets, SLA alerts. **The code reads `EMAIL_HOST_PASSWORD` etc. directly — there
is no `SENDGRID_API_KEY` variable anywhere in the codebase**, even though that name appears
in some older docs/examples. Use the variables below regardless of which SMTP provider you use.

| Variable | Example | Description |
|----------|---------|-------------|
| `EMAIL_HOST` | `smtp.sendgrid.net` | SMTP server hostname. |
| `EMAIL_PORT` | `587` | SMTP port. |
| `EMAIL_USE_TLS` | `1` | Use STARTTLS. |
| `EMAIL_HOST_USER` | `apikey` | SMTP username. For SendGrid this is the literal string `apikey`, not your account email. |
| `EMAIL_HOST_PASSWORD` | `SG.xxxxxx` | SMTP password. For SendGrid, this is your API key (Dashboard → Settings → API Keys → Create). |
| `DEFAULT_FROM_EMAIL` | `support@resolvehq.in` | The "From" address for all outgoing emails. Must match a verified sender for your SMTP provider. |

---

## Google OAuth ("Sign in with Google")

Optional — enables the Google Sign-In button on login/register.

| Variable | Example | Description |
|----------|---------|-------------|
| `GOOGLE_OAUTH_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | OAuth client ID from [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials. Leave blank to disable Google Sign-In (email/password login still works). |

---

## WhatsApp — Gupshup (NOT YET IMPLEMENTED)

**These variables currently have no effect.** `send_whatsapp()` in
`support_app/services/notification_service.py` is a stub — it logs a message and returns
without ever making an HTTP call to Gupshup. The variables below are placeholders for when
that integration is actually built; don't expect WhatsApp messages to send by setting them today.

| Variable | Example | Description |
|----------|---------|-------------|
| `GUPSHUP_API_KEY` | `xxxxxxxx` | Gupshup API key from the dashboard. |
| `GUPSHUP_APP_NAME` | `ResolveHQ` | The Gupshup app name as configured in their dashboard. |
| `GUPSHUP_PHONE_NUMBER` | `+918XXXXXXXXX` | Your Gupshup sender phone number. |
| `ENABLE_WHATSAPP_NOTIFICATIONS` | `false` | Set to `true` once the Gupshup integration is actually implemented. |

---

## Feature flags

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTO_ASSIGNMENT` | `false` | Auto-assign tickets to available freelancers based on skills. Not yet implemented. |
| `AI_ASSISTANT_PROVIDER` | `mock` | AI Assistant panel's suggestion provider. Only `mock` (deterministic, rule-based) exists today — no real LLM provider is wired up. |
| `USE_X_ACCEL_REDIRECT` | `false` | When `true`, ticket attachment downloads hand byte-streaming off to nginx via `X-Accel-Redirect` instead of streaming through the Django/Gunicorn worker. Set `true` in production (requires the `/media/` `internal;` nginx location — already configured in `nginx/nginx.conf`). Leave `false` in dev (no nginx in front). |

---

## Business / GST

| Variable | Default | Description |
|----------|---------|-------------|
| `GST_RATE` | `0.18` | GST rate applied to invoices (18% = 0.18). |
| `BUSINESS_GSTIN` | `` | Your 15-digit GSTIN for GST invoices. Required for compliant invoicing. |
| `BUSINESS_NAME` | `Friday Tech Systems` | Business name printed on invoices. |
| `BUSINESS_SUPPORT_EMAIL` | `` | Support contact email shown in invoices and transactional emails. |
| `BUSINESS_SUPPORT_PHONE` | `` | Support contact phone number shown in invoices and transactional emails. |

---

## DPDP Act 2023 Compliance

| Variable | Default | Description |
|----------|---------|-------------|
| `DPDP_POLICY_VERSION` | `2026-07-31` | Stamped onto every `ConsentRecord` row at registration. Bump this whenever the Privacy Policy / Terms materially change, so each consent record stays tied to the exact version the user agreed to. |
| `ACCOUNT_DELETION_GRACE_PERIOD_DAYS` | `30` | Days between a self-service account-deletion request (Settings → Privacy & Data) and automatic PII anonymization by the daily `anonymize_pending_deletions` Celery Beat task. |

---

## File storage (optional — S3 / DigitalOcean Spaces)

By default, user uploads (ticket attachments) are stored in `backend/mediafiles/` on the VPS disk.

To use S3-compatible object storage, set all four variables:

| Variable | Example | Description |
|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | `AKIAIOSFODNN7EXAMPLE` | S3 access key. For DigitalOcean Spaces, create in API → Spaces Keys. |
| `AWS_SECRET_ACCESS_KEY` | `wJalrXUtnFEMI...` | S3 secret key. |
| `AWS_STORAGE_BUCKET_NAME` | `supportmitra-assets` | Bucket/Space name. |
| `AWS_S3_ENDPOINT_URL` | `https://blr1.digitaloceanspaces.com` | Override for non-AWS providers. Leave blank for real AWS S3. |
| `AWS_S3_REGION_NAME` | `ap-south-1` | AWS region (or DO Spaces region like `blr1`). |

---

## Error tracking (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTRY_DSN` | `` | Sentry Data Source Name. Leave blank to disable. Set in production to receive error alerts. Get from sentry.io → New Project → Django. **If left blank when `DEBUG=0`, a startup warning is logged (`support_app` logger) — don't ignore it.** |
| `SENTRY_ENVIRONMENT` | `production` | Sentry environment tag, so events can be filtered by env (e.g. `staging` vs `production`) if `settings_prod.py` is ever reused for a non-prod deployment. |

---

## Notes for production

1. **Generate a new SECRET_KEY** — never use the insecure dev key in production.
2. **Set DEBUG=0** — this enables `settings_prod.py` which enforces authentication, disables debug pages, and sends real emails.
3. **DJANGO_SETTINGS_MODULE** is set to `supportmitra.settings_prod` automatically by `docker-compose.prod.yml`. You don't need to set it in `backend/.env`.
4. **DATABASE_URL and REDIS_URL** use Docker service names (`db`, `redis`) — these are valid inside Docker Compose. Don't change them unless you move to an external database.
5. **Razorpay keys** — use `rzp_test_` keys during staging, switch to `rzp_live_` only when go-live.
6. **SENTRY_DSN is not in the required-vars list** (`settings.py`'s `_REQUIRED_PROD_VARS`) — production will boot successfully without it, but you get zero error-tracking visibility. A missing `SENTRY_DSN` now logs a startup warning (see `settings_prod.py`) precisely so this doesn't silently regress again; don't ignore that warning in your deploy logs.
7. **Backup offsite copy** (`scripts/backup.sh`) reads the same `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_STORAGE_BUCKET_NAME`/`AWS_S3_ENDPOINT_URL`/`AWS_S3_REGION_NAME` variables documented above under File Storage — set these to enable the automatic offsite upload step, even if you don't use S3 for live media serving.
