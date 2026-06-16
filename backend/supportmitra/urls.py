"""
Root URL configuration for ResolveHQ.

Every URL in the project is listed here (or included from an app).
"""
from django.conf import settings
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.urls import include, path
from django_prometheus import exports as prometheus_exports

admin.site.site_header = "ResolveHQ Control Center"
admin.site.site_title = "ResolveHQ Admin"
admin.site.index_title = "Operations Dashboard"

urlpatterns = [
    # ── Django admin UI ───────────────────────────────────────────
    # Served at /django-admin/ to avoid conflict with React SPA's catch-all.
    # nginx has a dedicated location /django-admin/ block that proxies here.
    path("django-admin/", admin.site.urls),

    # ── All app API routes live under /api/ ───────────────────────
    path("api/", include("support_app.urls")),

    # ── Prometheus metrics scrape endpoint ───────────────────────
    # Restricted to staff — exposes request counts, DB query times, etc.
    path("metrics/", staff_member_required(prometheus_exports.ExportToDjangoView), name="prometheus-metrics"),
]

# Serve uploaded media files in development
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
