# ResolveHQ — Django Admin URL Change Note

**Changed in:** Phase 22 (2026-06-15)  
**Commit:** `6bf6e96`  
**Fix ID:** C-01 (Critical — Django admin completely unreachable in production)

---

## Current correct URL

```
http://127.0.0.1:8000/django-admin/        ← development (direct to gunicorn)
https://supportmitra.in/django-admin/       ← production (via nginx)
```

**ResolveHQ uses `/django-admin/` instead of Django's default `/admin/` route.**

---

## Why the URL was changed

Django's default admin URL is `path("admin/", admin.site.urls)`, making it available at `/admin/`.

ResolveHQ's production setup puts nginx in front of gunicorn. The nginx config uses a `try_files $uri $uri/ /index.html` catch-all to serve the React SPA for all unmatched routes. This meant:

1. Browser requests `/admin/`
2. nginx catches it with the `location /` `try_files` catch-all
3. nginx serves `index.html` — the React SPA — instead of proxying to Django
4. The Django admin login page **never appeared**

The nginx config already had a dedicated block for the Django admin:

```nginx
location /django-admin/ {
    proxy_pass http://django;
    ...
}
```

The fix was to rename the Django URL to match: `path("django-admin/", admin.site.urls)` in `backend/supportmitra/urls.py`.

This also provides a minor security benefit — the Django admin is no longer at the well-known default path.

---

## Affected file

**`backend/supportmitra/urls.py`** — line 5:

```python
# Before (broken in production):
path("admin/", admin.site.urls),

# After (Phase 22 fix):
path("django-admin/", admin.site.urls),
```

---

## What `/admin/` does now

`/admin/` is the **React SPA admin frontend dashboard** — the in-app admin panel for managing tickets, freelancers, and payments. It is served by nginx → React, not Django.

| URL | What it is |
|-----|-----------|
| `/admin/` | React SPA admin dashboard (frontend) |
| `/admin/freelancers` | React SPA freelancer management page |
| `/admin/payments` | React SPA payments dashboard |
| `/django-admin/` | Django admin panel (backend data management) |
| `/api/admin/tickets/` | REST API endpoint (not a UI page) |

---

## Common troubleshooting

### "I get a React page when I go to /admin/"

That is expected. The React SPA handles `/admin/` — it is the in-app admin dashboard.  
Use `http://127.0.0.1:8000/django-admin/` to reach the Django admin panel.

### "I get a 404 at /django-admin/"

The backend container is probably not running or is still starting up.

```bash
docker compose ps          # check backend is Up / healthy
docker compose logs backend --tail=20  # look for gunicorn startup line
```

Wait for: `Listening at: http://0.0.0.0:8000 (PID)`

### "Django admin has no CSS/JS styling"

WhiteNoise serves static files through gunicorn. Make sure `collectstatic` ran:

```bash
docker compose exec backend python manage.py collectstatic --noinput
```

Then restart the backend:

```bash
docker compose restart backend
```

### "Login says 'Please enter the correct email and password for a staff account'"

The admin user must have `is_staff=True`. Check via the database or reset:

```bash
docker compose exec backend python manage.py shell -c \
  "from support_app.models import CustomUser; u = CustomUser.objects.get(email='admin@test.com'); print(u.is_staff)"
```

If `False`, grant staff status:

```bash
docker compose exec backend python manage.py shell -c \
  "from support_app.models import CustomUser; u = CustomUser.objects.get(email='admin@test.com'); u.is_staff=True; u.save()"
```

### "Password reset changed the password in the wrong database"

Always run management commands via Docker, not locally:

```bash
# CORRECT — runs against the PostgreSQL database the container uses
docker compose exec backend python manage.py changepassword admin@test.com

# WRONG — runs against local SQLite fallback, has no effect on the running app
python manage.py changepassword admin@test.com
```

---

## Test credentials (dev)

| Role | Email | Password | Django Admin access |
|------|-------|----------|---------------------|
| Admin | admin@test.com | Admin123! | ✓ Full access |
| Customer | customer@test.com | Customer123! | ✗ No access |
| Freelancer | freelancer@test.com | Freelancer123! | ✗ No access |

Django admin requires `is_staff=True` on the user record. Only `admin@test.com` has this set.

---

## Quick verification

```bash
# Should return 200 (Django admin login page)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/django-admin/login/

# Should return 404 (React SPA does not render this as an admin panel)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/admin/login/
```
