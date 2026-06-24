from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0016_remove_priority_field"),
    ]

    operations = [
        migrations.AlterField(
            model_name="ticketactivitylog",
            name="action",
            field=models.CharField(
                choices=[
                    ("created",          "Ticket Created"),
                    ("status_changed",   "Status Changed"),
                    ("severity_changed", "Severity Changed"),
                    ("assigned",         "Assigned to Freelancer"),
                    ("unassigned",       "Unassigned"),
                    ("reassigned",       "Reassigned"),
                    ("comment_added",    "Comment Added"),
                    ("resolved",         "Resolved"),
                    ("closed",           "Closed"),
                    ("reopened",         "Reopened"),
                    ("sla_breached",     "SLA Breached"),
                    ("escalated",        "Escalated"),
                ],
                max_length=32,
            ),
        ),
    ]
