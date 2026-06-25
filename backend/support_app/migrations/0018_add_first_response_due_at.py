from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0017_remove_priority_action_choice"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="first_response_due_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
