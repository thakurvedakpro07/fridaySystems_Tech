"""
Root URL configuration for SupportMitra.

Every URL in the project is listed here (or included from an app).
"""
from django.contrib import admin
from django.urls import include, path
from django_prometheus import exports as prometheus_exports

urlpatterns = [
    # ── Django admin UI ───────────────────────────────────────────
    path("admin/", admin.site.urls),

    # ── All app API routes live under /api/ ───────────────────────
    path("api/", include("support_app.urls")),

    # ── Prometheus metrics scrape endpoint ───────────────────────
    path("metrics/", prometheus_exports.ExportToDjangoView, name="prometheus-metrics"),
]
