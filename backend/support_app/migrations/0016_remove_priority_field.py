from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0015_add_payout_model"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="ticket",
            name="priority",
        ),
    ]
