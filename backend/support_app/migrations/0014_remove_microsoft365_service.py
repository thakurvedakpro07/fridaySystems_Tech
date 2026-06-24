"""
Migration: remove microsoft365 from approved service catalog.

Data step: any existing ticket with service_type='microsoft365' is remapped
to 'desktop' (closest match — M365 issues are user-facing desktop problems).

Schema step: AlterField removes microsoft365 from Ticket.service_type choices.
"""

from django.db import migrations, models


def remap_microsoft365_tickets(apps, schema_editor):
    Ticket = apps.get_model("support_app", "Ticket")
    count = Ticket.objects.filter(service_type="microsoft365").count()
    if count:
        Ticket.objects.filter(service_type="microsoft365").update(service_type="desktop")


def reverse_remap(apps, schema_editor):
    # Reversal is intentionally a no-op: we cannot know which desktop tickets
    # were originally microsoft365, and re-adding an obsolete service type
    # would require re-adding the choice to the model as well.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0013_add_microsoft365_service"),
    ]

    operations = [
        # Step 1: remap data before removing the choice from the schema
        migrations.RunPython(remap_microsoft365_tickets, reverse_remap),

        # Step 2: remove microsoft365 from the choices list
        migrations.AlterField(
            model_name="ticket",
            name="service_type",
            field=models.CharField(
                choices=[
                    ("desktop",  "Desktop / Laptop Support"),
                    ("linux",    "Linux Provisioning"),
                    ("windows",  "Windows Provisioning"),
                    ("patching", "OS Patching"),
                    ("security", "Security Hardening"),
                    ("vmware",   "VMware / Hypervisor"),
                    ("sap",      "SAP Basis Lite"),
                ],
                max_length=32,
            ),
        ),
    ]
