# SupportMitra — Environment Variables Reference

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
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | Comma-separated hostnames Django accepts. In production: `supportmitra.in,www.supportmitra.in` |
| `DJANGO_SETTINGS_MODULE` | `supportmitra.settings` | Set to `supportmitra.settings_prod` in production (done automatically by `docker-compose.prod.yml`). |
| `TIME_ZONE` | `Asia/Kolkata` | Timezone for display and SLA deadline calculations. |

---

## JWT tokens

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | `15` | How long an access token stays valid. Short is more secure. |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | `7` | How long a refresh token stays valid. Users are logged out after this. |

---

## Payments — Razorpay

**Required in production.** Get these from [dashboard.razorpay.com](https://dashboard.razorpay.com) → Settings → API Keys.

| Variable | Example | Description |
|----------|---------|-------------|
| `RAZORPAY_KEY_ID` | `rzp_test_xxxx` | API key ID. Use `rzp_test_` prefix for test mode, `rzp_live_` for production. |
| `RAZORPAY_KEY_SECRET` | `xxxxxxxx` | API key secret. Keep this private — it signs payment requests. |
| `RAZORPAY_WEBHOOK_SECRET` | `xxxxxxxx` | Webhook secret from Razorpay Dashboard → Settings → Webhooks. Used to verify that webhook calls come from Razorpay (HMAC-SHA256 signature). |

---

## Email — SendGrid

In development (`DEBUG=1`), emails are printed to the terminal — no SendGrid needed.
In production (`DEBUG=0`), SendGrid is required for ticket confirmations, password resets, SLA alerts.

| Variable | Example | Description |
|----------|---------|-------------|
| `SENDGRID_API_KEY` | `SG.xxxxxx` | SendGrid API key. Dashboard → Settings → API Keys → Create. |
| `DEFAULT_FROM_EMAIL` | `support@supportmitra.in` | The "From" address for all outgoing emails. Must match a verified SendGrid sender. |

---

## WhatsApp — Gupshup

Optional. Set `ENABLE_WHATSAPP_NOTIFICATIONS=true` to activate.

| Variable | Example | Description |
|----------|---------|-------------|
| `GUPSHUP_API_KEY` | `xxxxxxxx` | Gupshup API key from the dashboard. |
| `GUPSHUP_APP_NAME` | `SupportMitra` | The Gupshup app name as configured in their dashboard. |
| `GUPSHUP_PHONE_NUMBER` | `+918XXXXXXXXX` | Your Gupshup sender phone number. |
| `ENABLE_WHATSAPP_NOTIFICATIONS` | `false` | Set to `true` to enable WhatsApp notifications via Gupshup. |

---

## Feature flags

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTO_ASSIGNMENT` | `false` | Auto-assign tickets to available freelancers based on skills. Not yet implemented. |

---

## Business / GST

| Variable | Default | Description |
|----------|---------|-------------|
| `GST_RATE` | `0.18` | GST rate applied to invoices (18% = 0.18). |
| `BUSINESS_GSTIN` | `` | Your 15-digit GSTIN for GST invoices. Required for compliant invoicing. |
| `BUSINESS_NAME` | `SupportMitra Technologies` | Business name printed on invoices. |

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
| `SENTRY_DSN` | `` | Sentry Data Source Name. Leave blank to disable. Set in production to receive error alerts. Get from sentry.io → New Project → Django. |

---

## Notes for production

1. **Generate a new SECRET_KEY** — never use the insecure dev key in production.
2. **Set DEBUG=0** — this enables `settings_prod.py` which enforces authentication, disables debug pages, and sends real emails.
3. **DJANGO_SETTINGS_MODULE** is set to `supportmitra.settings_prod` automatically by `docker-compose.prod.yml`. You don't need to set it in `backend/.env`.
4. **DATABASE_URL and REDIS_URL** use Docker service names (`db`, `redis`) — these are valid inside Docker Compose. Don't change them unless you move to an external database.
5. **Razorpay keys** — use `rzp_test_` keys during staging, switch to `rzp_live_` only when go-live.
