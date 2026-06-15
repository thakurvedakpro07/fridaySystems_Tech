# SupportMitra — Razorpay TEST Mode Setup

**Configured:** 2026-06-15  
**Mode:** TEST (rzp_test_* keys — no real money moves)  
**Status:** ✅ ACTIVE — verified working

---

## Current state

| Setting | Value |
|---------|-------|
| Key type | TEST (`rzp_test_*`) |
| Order creation | ✅ Verified — real Razorpay order IDs returned |
| Checkout button | `Pay ₹353` (live mode, real Razorpay dialog) |
| Sandbox mode | Disabled (was active before credentials were set) |
| Webhook verification | Skipped — webhook secret not yet configured |

---

## Where credentials are stored

**One file only:**

```
backend/.env
```

```
# ── Payments — Razorpay ───────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_...          ← your TEST Key ID
RAZORPAY_KEY_SECRET=...               ← your TEST Key Secret
RAZORPAY_WEBHOOK_SECRET=...           ← configure when you set up a webhook URL
```

**This file is gitignored** (`.gitignore` line 38: `backend/.env`). Credentials never touch version control.

### How the value reaches the app

```
backend/.env
  └─ docker-compose.yml  env_file: - backend/.env
       └─ Django container environment
            └─ settings.py  RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
                 └─ payment_service.py  if getattr(settings, "RAZORPAY_KEY_ID", ""):
                      └─ razorpay_client.py  razorpay.Client(auth=(KEY_ID, KEY_SECRET))
```

---

## Payment flow (live mode)

```
Customer clicks "Pay ₹353"
  → POST /api/tickets/{id}/initiate-payment/
      → payment_service.create_order_for_ticket()
          → razorpay.Client.order.create(amount=35300, currency="INR")
          → Returns { order_id, key_id, amount_paise, mode: "live" }
  → Frontend loads checkout.razorpay.com/v1/checkout.js
  → Opens Razorpay dialog (test cards accepted, no real charge)
  → Customer completes payment in dialog
  → Razorpay calls handler() with { razorpay_payment_id, razorpay_order_id, razorpay_signature }
  → POST /api/tickets/{id}/verify-payment/
      → payment_service.verify_and_complete_payment()
          → HMAC-SHA256 signature verification
          → Payment status → "completed"
          → Ticket status → "open"
  → Frontend shows "Payment confirmed!" banner
```

---

## How to rotate keys

When you generate new API keys in the Razorpay dashboard:

1. Get the new Key ID and Key Secret from **Razorpay Dashboard → Settings → API Keys → Regenerate**
2. Edit `backend/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_NEWKEYIDHERE
   RAZORPAY_KEY_SECRET=NEWKEYSECRETHERE
   ```
3. Recreate the backend container (restart alone is not enough — env vars are baked at creation):
   ```bash
   docker compose up -d backend celery celerybeat
   ```
4. Verify the new key is loaded:
   ```bash
   docker exec fridaysystems_tech-backend-1 python -c \
     "import os; print(os.getenv('RAZORPAY_KEY_ID','NOT SET'))"
   ```
5. Test order creation:
   ```bash
   docker exec fridaysystems_tech-backend-1 python -c "
   import razorpay, os
   client = razorpay.Client(auth=(os.getenv('RAZORPAY_KEY_ID'), os.getenv('RAZORPAY_KEY_SECRET')))
   order = client.order.create({'amount': 35300, 'currency': 'INR', 'receipt': 'rotate_test'})
   print('order_id:', order['id'], '— status:', order['status'])
   "
   ```

> **Important:** `docker compose restart` does NOT reload env_file values. You must use `docker compose up -d` to recreate containers.

---

## How to switch from TEST to LIVE mode

When you're ready to accept real payments:

1. **Get LIVE keys** from Razorpay Dashboard → Settings → API Keys → Generate Live Key
2. **Create a webhook** in Razorpay Dashboard → Settings → Webhooks:
   - URL: `https://supportmitra.in/api/payments/webhook/`
   - Events: `payment.captured`
   - Copy the webhook secret shown
3. **Update `backend/.env`**:
   ```
   RAZORPAY_KEY_ID=rzp_live_YOURLIVEKEY
   RAZORPAY_KEY_SECRET=YOURLIVESECRET
   RAZORPAY_WEBHOOK_SECRET=YOURWEBHOOKSECRET
   ```
4. **Recreate containers**:
   ```bash
   docker compose up -d backend celery celerybeat
   ```
5. **Verify mode** — hit the initiate-payment endpoint and confirm `"mode": "live"` in response
6. **Test with a real small amount** (₹1 test order if possible) before announcing launch

> **Note:** The `RAZORPAY_KEY_ID` value is sent to the frontend (included in the `initiate-payment` response as `key_id`). This is intentional and safe — the Key ID is public. The `KEY_SECRET` and `WEBHOOK_SECRET` never leave the backend.

---

## Webhook configuration (optional — needed for server-side payment confirmation)

SupportMitra supports two payment confirmation paths:

| Path | When it runs | Requires |
|------|-------------|---------|
| **Frontend verify** | Immediately after checkout dialog closes | `RAZORPAY_KEY_SECRET` (for signature check) |
| **Webhook** | Server-to-server, even if user closes browser | `RAZORPAY_WEBHOOK_SECRET` |

For development, the frontend verify path is sufficient. For production, configure both.

To configure webhooks:
1. In Razorpay Dashboard → Settings → Webhooks → Add New Webhook
2. URL: `https://supportmitra.in/api/payments/webhook/`
3. Secret: generate a random string, save it
4. Add to `backend/.env` as `RAZORPAY_WEBHOOK_SECRET=<your_secret>`
5. Recreate backend container

---

## Test card numbers (no real charge)

Use these in the Razorpay TEST checkout dialog:

| Card type | Number | Expiry | CVV |
|-----------|--------|--------|-----|
| Visa success | 4111 1111 1111 1111 | Any future date | Any 3 digits |
| Mastercard success | 5267 3181 8797 5449 | Any future date | Any 3 digits |
| UPI success | `success@razorpay` | — | — |
| Card failure | 4000 0000 0000 0002 | Any future date | Any 3 digits |

Full list: https://razorpay.com/docs/payments/payments/test-card-details/

---

## Troubleshooting

### "mode: sandbox" still showing in response

The backend is not seeing the `RAZORPAY_KEY_ID`. Check:
```bash
docker exec fridaysystems_tech-backend-1 python -c \
  "import os; print(repr(os.getenv('RAZORPAY_KEY_ID')))"
```
If it prints `None` or `''`, recreate the container (not just restart):
```bash
docker compose up -d backend
```

### "BAD_REQUEST_ERROR" from Razorpay SDK

Invalid credentials. Double-check that `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` match the key pair shown in Razorpay Dashboard → Settings → API Keys. Test and Live keys are separate — don't mix them.

### Signature verification failed on /verify-payment/

This means the `RAZORPAY_KEY_SECRET` in `.env` does not match the key used to create the order. Ensure you're using the same key pair for both order creation and signature verification.

### Webhook returning 400

`RAZORPAY_WEBHOOK_SECRET` in `.env` doesn't match the secret set in Razorpay Dashboard → Settings → Webhooks. Since Phase 23 (H-08 fix), the backend explicitly rejects webhooks when the secret is not configured, preventing silent bypass.

---

## Verification commands

```bash
# 1. Confirm container reads credentials
docker exec fridaysystems_tech-backend-1 python -c \
  "import os; print('KEY_ID:', os.getenv('RAZORPAY_KEY_ID','NOT SET'))"

# 2. Test SDK connectivity (creates a throwaway test order)
docker exec fridaysystems_tech-backend-1 python -c "
import razorpay, os
client = razorpay.Client(auth=(os.getenv('RAZORPAY_KEY_ID'), os.getenv('RAZORPAY_KEY_SECRET')))
order = client.order.create({'amount': 100, 'currency': 'INR', 'receipt': 'verify_test'})
print('order_id:', order['id'], '| status:', order['status'])
"

# 3. Test the full API endpoint (replace TOKEN and TICKET_ID)
curl -s -X POST http://localhost:8000/api/tickets/<TICKET_ID>/initiate-payment/ \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" | python3 -m json.tool
# Expect: { "order_id": "order_...", "mode": "live", "key_id": "rzp_test_..." }
```
