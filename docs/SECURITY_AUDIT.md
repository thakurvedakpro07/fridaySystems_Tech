# SupportMitra — Security Audit
**Phase 10: Production Readiness**
**Date:** 2026-05-20
**Auditor:** Claude Sonnet 4.6

---

## Audit Scope

This is a code-level security audit covering authentication, authorization, API security, data handling, and infrastructure hardening. All tests performed against the local Docker environment.

---

## Authentication & JWT Security

### ✅ Access token lifetime: 15 minutes

Short-lived access tokens minimise exposure if a token is intercepted. Even if an attacker captures a token, it expires in 15 minutes.

```python
"ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 15)))
```

### ✅ Refresh token rotation + blacklisting

Every use of a refresh token issues a NEW refresh token and blacklists the old one:
```python
"ROTATE_REFRESH_TOKENS": True,
"BLACKLIST_AFTER_ROTATION": True,
```

This prevents refresh token replay attacks. If an attacker steals a refresh token and uses it, the legitimate user's next refresh will fail (token already invalidated), alerting them.

### ✅ Logout blacklists refresh token server-side

```python
# views.py: LogoutView
token = RefreshToken(request.data["refresh"])
token.blacklist()  # marks token in the database — can never be used again
```

This means logout is cryptographically enforced, not just a client-side token deletion.

### ✅ Axios auto-refresh with _retry guard

The frontend Axios interceptor refreshes the access token on 401 and retries the original request. The `_retry` flag prevents infinite refresh loops if the refresh token itself is invalid:

```js
if (error.response?.status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  // try refresh → if it fails, redirect to /login
}
```

---

## Authorization (Role Isolation)

### ✅ All endpoints protected with explicit permission classes

| Endpoint | Permission | Verified |
|----------|-----------|---------|
| `/api/tickets/` | `IsCustomer` | ✅ 403 for freelancer/admin |
| `/api/admin/tickets/` | `IsAdminUser` | ✅ 403 for customer/freelancer |
| `/api/freelancer/tickets/` | `IsFreelancer` | ✅ 403 for customer/admin |
| `/api/auth/me/` | `IsAuthenticated` | ✅ 401 for anonymous |
| `/api/admin/freelancers/` | `IsAdminUser` | ✅ 403 for non-admin |

### ✅ Customer cannot access another customer's ticket

`TicketDetailView.get_queryset()` filters by `customer=request.user`:
```python
def get_queryset(self):
    if self.request.user.is_staff:
        return Ticket.objects.all()
    return Ticket.objects.filter(customer=self.request.user)
```

Cross-customer ticket access returns 404 (not 403 — this is intentional; we don't confirm the ticket exists to an unauthorized user).

### ✅ Internal comments filtered from customer responses

Comments with `is_internal=True` are excluded from customer-facing serializers:
```python
# CommentSerializer context check
if comment.is_internal and not (user.is_staff or user.role == "freelancer"):
    # comment is not included in the response
```

### ✅ Freelancer can only access their assigned tickets

`FreelancerTicketDetailView` verifies the ticket is currently assigned to the requesting freelancer — not just any ticket.

### ✅ Non-approved freelancers cannot access endpoints

`IsFreelancer` permission checks `onboarding_status == "approved"`:
```python
class IsFreelancer(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == "freelancer" and
            hasattr(request.user, "freelancer_profile") and
            request.user.freelancer_profile.onboarding_status == "approved"
        )
```

---

## API Security

### ✅ Rate limiting on all endpoints

| Bucket | Rate | Scope |
|--------|------|-------|
| `auth` | 10 requests/minute | Login, register, token endpoints |
| `anon` | 20 requests/minute | All unauthenticated requests |
| `user` | 100 requests/minute | All authenticated requests |

Rate limits return HTTP 429 with a `Retry-After` header. The `AuthRateThrottle` uses `AnonRateThrottle` under the hood, so rate limiting works even before a token is issued.

### ✅ Razorpay webhook HMAC verification

Webhook signature is verified before processing any payment:
```python
# webhooks.py
expected_sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()
if not hmac.compare_digest(expected_sig, received_sig):
    return Response(status=400)
```

### ✅ CORS restricted to production domain

Development allows all origins (`CORS_ALLOW_ALL_ORIGINS = True`). Production only allows:
```python
CORS_ALLOWED_ORIGINS = [
    "https://supportmitra.in",
    "https://www.supportmitra.in",
]
```

### ✅ SECRET_KEY loaded from environment (never hard-coded)

```python
SECRET_KEY = os.environ["SECRET_KEY"]  # raises KeyError if missing
```

The app refuses to start if `SECRET_KEY` is not set — preventing accidental deployment with a weak or default key.

---

## Secure HTTP Headers (Phase 10 additions)

The following headers were added to `settings.py` for production (`DEBUG=False`):

| Header | Value | Protection |
|--------|-------|-----------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME-type sniffing attacks |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframes |
| `SECURE_SSL_REDIRECT` | `True` | Redirects HTTP → HTTPS at Django level |
| `SESSION_COOKIE_SECURE` | `True` | Session cookie only sent over HTTPS |
| `CSRF_COOKIE_SECURE` | `True` | CSRF cookie only sent over HTTPS |

Plus nginx-level headers in `nginx/nginx.conf`:
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

---

## Data Security

### ✅ Passwords hashed with PBKDF2 (Django default)

Django uses PBKDF2-SHA256 with 720,000 iterations (Django 4.2 default). This is NIST-approved and brute-force resistant.

### ✅ UUID primary keys everywhere

All models use UUID PKs (`uuid4`). This prevents IDOR (Insecure Direct Object Reference) attacks that rely on sequential integer IDs:
- Attacker can't guess `GET /api/tickets/12346/` by incrementing
- UUID4 has 2^122 possible values — not guessable

### ✅ Password validation rules enforced

```python
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "...MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "...CommonPasswordValidator"},   # blocks "password123", etc.
    {"NAME": "...NumericPasswordValidator"},   # blocks all-digit passwords
]
```

### ✅ Database foreign key cascades correct

Ticket deletion cascades to Comments, TicketActivityLog, and TicketAssignment records. Customer deletion closes their tickets. No orphaned data.

---

## Identified Security Gaps

### ⚠️ No Content Security Policy (CSP) header

**Risk:** Medium. Without CSP, if an XSS vulnerability exists, attackers can load external scripts.

**Status:** Not implemented — requires frontend audit of inline scripts. Tailwind's CSS-in-JS and Vite build hashes complicate it slightly.

**Recommended fix (nginx.conf):**
```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.razorpay.com;
  frame-src 'none';
" always;
```

**Priority:** Medium — implement before public launch.

---

### ⚠️ Admin panel accessible at /django-admin/

**Risk:** Low. Django admin is powerful and, if an admin account is compromised, can modify all data.

**Recommendations:**
1. Change the URL: `admin.site.urls` → a non-obvious path like `/management-portal/`
2. Add IP restriction in nginx (allow only your office IP)
3. Enable 2FA for admin accounts (django-two-factor-auth)

---

### ⚠️ No per-user session invalidation

**Risk:** Low. If an admin's password is changed, their existing JWTs remain valid for up to 15 minutes (access token lifetime). Their refresh tokens could remain valid for 7 days unless manually blacklisted.

**Recommended fix:** When a user changes their password, blacklist all their active refresh tokens.

---

### ⚠️ Prometheus /metrics endpoint publicly accessible in development

**Risk:** Low in dev, Medium in production. Metrics can reveal internal service details (request counts, latencies, error rates).

The nginx config (Phase 10) already restricts `/metrics` to `127.0.0.1`. Make sure this is applied in production.

---

## Security Score

| Area | Score | Notes |
|------|-------|-------|
| Authentication | 9.5/10 | JWT + rotation + blacklisting |
| Authorization | 9.5/10 | Role isolation verified for all endpoints |
| API Security | 8.5/10 | Rate limiting + CORS + HMAC webhooks |
| Secure Headers | 8/10 | HSTS + X-Frame + nosniff; CSP missing |
| Data Security | 9/10 | UUID PKs + hashed passwords + validators |
| Infrastructure | 7.5/10 | Nginx + Docker; admin URL hardening pending |
| Input Validation | 8.5/10 | DRF serializers validate all inputs |

**Overall Security Score: 8.6/10**

**Conclusion:** Production-ready for beta. The missing CSP and admin URL hardening should be addressed before a public launch.
