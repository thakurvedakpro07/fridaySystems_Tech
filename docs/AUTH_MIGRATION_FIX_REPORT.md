# SupportMitra — Auth Migration Fix Report

**Date:** 2026-06-15  
**Error:** `django.db.utils.ProgrammingError: column support_app_customuser.is_verified does not exist`  
**Endpoint affected:** `POST /api/auth/login/`  
**Status:** RESOLVED — no code changes required

---

## Timeline

| Time (IST) | Event |
|------------|-------|
| ~11:39 | Phase 23 committed — `0007_add_is_verified_to_customuser.py` + `models.py` changes written to disk |
| ~14:58 | Gunicorn `--reload` detected file changes, hot-reloaded Python code |
| 14:58:08 | Login started failing — `ProgrammingError: column support_app_customuser.is_verified does not exist` |
| 15:01 | `0008_alter_freelancer_payout_details.py` created (unrelated; confirmed correct dependency on 0007) |
| ~15:05 | Container restarted — startup command ran `python manage.py migrate`, applying 0007 + 0008 |
| 15:05+ | Login working; error gone from logs |

---

## Root Cause

The Docker backend container starts with:

```sh
python manage.py collectstatic --noinput && python manage.py migrate && gunicorn ... --reload
```

Gunicorn's `--reload` flag watches for Python file changes and hot-reloads the application when source files change. **This reload does not re-run `migrate`.**

When Phase 23 changes (migration file + updated `models.py`) were written to disk:

1. Gunicorn detected the change and hot-reloaded the Django app
2. The ORM Python model now included the `is_verified` field
3. Django generated `SELECT ... "support_app_customuser"."is_verified" ...` on login
4. **The database column did not yet exist** — `0007` was never applied to the DB
5. PostgreSQL returned `UndefinedColumn` → Django wrapped it as `ProgrammingError`

A container restart (which re-runs `migrate`) fixed it.

---

## Investigation Results

### Migration file — existed and correct

```
backend/support_app/migrations/0007_add_is_verified_to_customuser.py
  Created: Jun 15 11:39
  Dependencies: ("support_app", "0006_approve_pending_freelancers")
  Operations: AddField(model="customuser", name="is_verified", field=BooleanField(default=True))
```

### Migration state — all applied

```
support_app
 [X] 0006_approve_pending_freelancers
 [X] 0007_add_is_verified_to_customuser   ← applied
 [X] 0008_alter_freelancer_payout_details ← applied (correct dep on 0007)
```

### Database schema — column present

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'support_app_customuser' AND column_name = 'is_verified';

-- Result: is_verified | boolean | NO | (present)
```

### makemigrations --check

```
No changes detected
```

No model fields are missing migrations. The schema and Python models are in sync.

---

## Verification

### Login — all three roles

| Role | Email | Result |
|------|-------|--------|
| Admin | admin@test.com | ✅ 200 — returns access + refresh + user |
| Customer | customer@test.com | ✅ 200 — returns access + refresh + user |
| Freelancer | freelancer@test.com | ✅ 200 — returns access + refresh + user |

### /auth/me/ — is_verified present

```json
{
  "id": "8402291c-...",
  "email": "admin@test.com",
  "role": "admin",
  "is_staff": true,
  "is_verified": true
}
```

### Security endpoints — functional

| Endpoint | Test input | Result |
|----------|-----------|--------|
| `POST /api/auth/password/reset/` | non-existent email | ✅ 200 — generic message (no user enumeration) |
| `POST /api/auth/verify-email/` | invalid uid+token | ✅ 400 — "Invalid or expired verification link." |

### Backend tests

```
tests/test_sla.py — 13/13 passed ✅
```

---

## Email Verification — NOT removed

The `is_verified` field, migration, and all email verification features remain fully intact:

- `CustomUser.is_verified` — `BooleanField(default=True)` on model and in DB
- `RegisterSerializer.create()` — sets `is_verified=False` for new registrations
- `POST /api/auth/verify-email/` — marks user as verified via token
- `POST /api/auth/verify-email/resend/` — resends verification email
- `frontend/src/pages/VerifyEmail.jsx` — frontend handler page
- All routes in `App.jsx` — `/verify-email` route active

---

## Prevention

The root cause was gunicorn `--reload` reloading app code without running `migrate`. This is a known dev-mode footgun. Three mitigations:

1. **Already present:** Container restart always runs `migrate` (correct behavior for production)
2. **Recommendation:** In dev, after committing migration files, restart the backend container explicitly:  
   `docker compose restart backend`  
   rather than relying on `--reload` to pick up schema changes
3. **Optional:** A health-check or entrypoint guard that fails fast if pending migrations exist (not implemented — would require a `showmigrations` check in the entrypoint script)
