"""
Django settings for SupportMitra.

All sensitive values are read from environment variables (never hard-coded).
Copy .env.example → .env and fill in your values before running.

Documentation: https://docs.djangoproject.com/en/4.2/ref/settings/
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

# ── Base directory ────────────────────────────────────────────────
# Build paths like: BASE_DIR / "subdir"
BASE_DIR = Path(__file__).resolve().parent.parent

# Load variables from backend/.env (or project-root .env via Docker)
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")  # also try project root

# ── Security ──────────────────────────────────────────────────────
SECRET_KEY = os.environ["SECRET_KEY"]  # raises error if missing — intentional

DEBUG = os.getenv("DEBUG", "0") == "1"

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# ── Security Headers (production only) ───────────────────────────
# These are handled by Django's SecurityMiddleware, which is already in MIDDLEWARE.
# In development (DEBUG=True) they're off so HTTPS isn't forced on localhost.
if not DEBUG:
    SECURE_SSL_REDIRECT = True                         # redirect HTTP → HTTPS
    SESSION_COOKIE_SECURE = True                       # session cookie over HTTPS only
    CSRF_COOKIE_SECURE = True                          # CSRF cookie over HTTPS only
    SECURE_HSTS_SECONDS = 31536000                     # tell browsers: only HTTPS for 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_BROWSER_XSS_FILTER = True                   # legacy IE XSS filter header
    SECURE_CONTENT_TYPE_NOSNIFF = True                 # block MIME-type sniffing
    X_FRAME_OPTIONS = "DENY"                           # prevent clickjacking (no iframes)

# ── Additional Security Headers ───────────────────────────────────
# These apply in all environments; Django's SecurityMiddleware sends them.
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

# ── Installed Apps ────────────────────────────────────────────────
INSTALLED_APPS = [
    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",        # required by django-allauth (SITE_ID = 1)

    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "django_celery_beat",
    "django_prometheus",

    # Our app
    "support_app.apps.SupportAppConfig",
]

# ── Middleware ────────────────────────────────────────────────────
MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",  # metrics — must be first
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",               # serve static files via Gunicorn
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",                    # CORS — before CommonMiddleware
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",   # metrics — must be last
]

ROOT_URLCONF = "supportmitra.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "supportmitra.wsgi.application"

# ── Database ──────────────────────────────────────────────────────
#
# THIS PROJECT ALWAYS USES POSTGRESQL — set via DATABASE_URL in backend/.env
#
# WARNING — SQLite fallback trap (incident 2026-05-20):
#   If DATABASE_URL is not in your shell environment, dj_database_url silently
#   falls back to a local SQLite file (backend/db.sqlite3). That is a DIFFERENT
#   database from the PostgreSQL container. Any user you create or password you
#   change there will NOT be visible to the Docker backend — and vice versa.
#
#   RULE: NEVER run "python manage.py ..." directly in your terminal.
#         ALWAYS use: docker compose exec backend python manage.py ...
#
#   The SQLite fallback default below exists only so Django can start without
#   crashing in CI or test environments where no DATABASE_URL is set. It is
#   not a supported workflow for this project. Do not recreate backend/db.sqlite3.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

# ── Production environment guard ──────────────────────────────────
# Raise early if required secrets are missing in production.
# In development (DEBUG=True) these can be absent — tests and local dev
# use SQLite / console email anyway. In production, missing values are bugs.
if not DEBUG:
    import sys
    from django.core.exceptions import ImproperlyConfigured

    _REQUIRED_PROD_VARS = [
        "DATABASE_URL",
        "SECRET_KEY",
        "APP_URL",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
    ]
    _missing = [v for v in _REQUIRED_PROD_VARS if not os.environ.get(v)]
    if _missing:
        raise ImproperlyConfigured(
            f"Missing required production environment variables: {', '.join(_missing)}. "
            "Set them in backend/.env before starting the server."
        )

# ── Password Validation ───────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "support_app.validators.StrongPasswordValidator"},
]

# ── Internationalisation ──────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

# ── Static & Media Files ──────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "mediafiles"

# ── Custom User Model ─────────────────────────────────────────────
# CRITICAL: must be set before the first migration.
# Tells Django to use support_app.CustomUser instead of auth.User everywhere:
#   - Admin login, JWT auth, allauth, permissions, sessions — all updated automatically.
# Format: "app_label.ModelName"
AUTH_USER_MODEL = "support_app.CustomUser"

# ── Primary Key Type ──────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Django REST Framework ─────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # In development allow unauthenticated requests so you can explore the API.
    # settings_prod.py switches this to IsAuthenticated.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny" if DEBUG
        else "rest_framework.permissions.IsAuthenticated"
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/minute",
        "user": "100/minute",
        # Separate bucket for login and register — stricter than global anon.
        # 10 attempts/minute per IP before a 429 is returned.
        # In production, consider lowering to 5/minute.
        "auth": "10/minute",
        # Analytics runs expensive DB aggregations; limit to 30/hour per user.
        "analytics": "30/hour",
    },
    # Centralizes all DRF exception responses into a consistent JSON shape
    # and logs server errors with full context.
    "EXCEPTION_HANDLER": "support_app.exceptions.custom_exception_handler",
}

# ── JWT Token Settings ────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 15))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7))
    ),
    "ROTATE_REFRESH_TOKENS": True,   # each use issues a new refresh token
    "BLACKLIST_AFTER_ROTATION": True, # old refresh token is invalidated
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── CORS ──────────────────────────────────────────────────────────
# In development: allow all origins so the Vite dev server can call the API.
# In production: only allow the real domain.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [
        "https://supportmitra.in",
        "https://www.supportmitra.in",
    ]

# ── Redis / Celery ────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True  # silence Celery 6.0 deprecation warning

# ── Cache ─────────────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

# ── Email ─────────────────────────────────────────────────────────
if DEBUG:
    # Print emails to the terminal instead of actually sending them
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "support@supportmitra.in")

# ── django-allauth ────────────────────────────────────────────────
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
SITE_ID = 1
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = "email"
# Tell allauth we removed the username field entirely from our CustomUser model.
# Without this, allauth tries to access user.username and crashes on every login.
ACCOUNT_USER_MODEL_USERNAME_FIELD = None

# ── Business / GST ────────────────────────────────────────────────
GST_RATE = float(os.getenv("GST_RATE", "0.18"))
BUSINESS_GSTIN = os.getenv("BUSINESS_GSTIN", "")
BUSINESS_NAME = os.getenv("BUSINESS_NAME", "SupportMitra Technologies")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")

# ── Razorpay ─────────────────────────────────────────────────────
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

# ── Feature Flags ─────────────────────────────────────────────────
ENABLE_WHATSAPP_NOTIFICATIONS = os.getenv("ENABLE_WHATSAPP_NOTIFICATIONS", "false").lower() == "true"
ENABLE_AUTO_ASSIGNMENT = os.getenv("ENABLE_AUTO_ASSIGNMENT", "false").lower() == "true"

# ── Logging ───────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "support_app": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
