from django.db import migrations, models


def collapse_waiting_customer(apps, schema_editor):
    """
    "waiting_customer" no longer exists as a status — the ticket now stays
    "in_progress" while the engineer and customer communicate. Any ticket
    currently sitting in "waiting_customer" moves to "in_progress"; the
    historical transition itself remains visible in TicketActivityLog.
    """
    Ticket = apps.get_model("support_app", "Ticket")
    Ticket.objects.filter(status="waiting_customer").update(status="in_progress")


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0023_add_ticket_preferences"),
    ]

    operations = [
        migrations.RunPython(collapse_waiting_customer, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="ticket",
            name="status",
            field=models.CharField(
                max_length=32,
                choices=[
                    ("pending_payment", "Pending Payment"),
                    ("open", "Open"),
                    ("assigned", "Assigned"),
                    ("in_progress", "In Progress"),
                    ("resolved", "Resolved"),
                    ("closed", "Closed"),
                ],
                default="pending_payment",
            ),
        ),
    ]
