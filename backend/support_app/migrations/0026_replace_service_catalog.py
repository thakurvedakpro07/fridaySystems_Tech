"""
Migration: replace the legacy 7-service catalog with the standardized
8-service catalog (Laptop/Desktop, Server Administration, AWS, Azure,
Kubernetes, Database, DevOps CI/CD, Infrastructure Platform Automation).

Data step: remap any existing ticket using an old service_type value to its
closest new equivalent, since none of the 8 new categories line up 1:1 with
the old ones:
  desktop, linux, windows, patching, security, vmware, sap -> server_admin
  desktop -> laptop_desktop (exact match, handled first so it isn't
  swallowed by the catch-all above)

Schema step: AlterField replaces Ticket.service_type choices with the new
8-key catalog.
"""

from django.db import migrations, models

OLD_TO_NEW = {
    "desktop":  "laptop_desktop",
    "linux":    "server_admin",
    "windows":  "server_admin",
    "patching": "server_admin",
    "security": "server_admin",
    "vmware":   "server_admin",
    "sap":      "server_admin",
}


def remap_old_service_types(apps, schema_editor):
    Ticket = apps.get_model("support_app", "Ticket")
    for old_key, new_key in OLD_TO_NEW.items():
        Ticket.objects.filter(service_type=old_key).update(service_type=new_key)


def reverse_remap(apps, schema_editor):
    # Reversal is intentionally a no-op: the old->new mapping is lossy
    # (multiple old keys collapse into server_admin), so there is no way
    # to reconstruct the original values.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0025_add_knowledge_base_and_activity_actions"),
    ]

    operations = [
        # Step 1: remap data before removing the old choices from the schema
        migrations.RunPython(remap_old_service_types, reverse_remap),

        # Step 2: replace the choices list with the standardized 8-service catalog
        migrations.AlterField(
            model_name="ticket",
            name="service_type",
            field=models.CharField(
                choices=[
                    ("laptop_desktop",   "Laptop / Desktop Support"),
                    ("server_admin",     "Server Administration Support"),
                    ("aws",              "AWS Support"),
                    ("azure",            "Azure Support"),
                    ("kubernetes",       "Kubernetes Support"),
                    ("database",         "Database Support"),
                    ("devops_cicd",      "DevOps CI/CD Support"),
                    ("infra_automation", "Infrastructure Platform Automation Support"),
                ],
                max_length=32,
            ),
        ),
    ]
