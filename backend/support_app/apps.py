from django.apps import AppConfig


class SupportAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "support_app"

    def ready(self):
        import support_app.signals  # noqa: F401 — connects all @receiver handlers
        import support_app.tasks    # noqa: F401 — registers @shared_task handlers with Celery
