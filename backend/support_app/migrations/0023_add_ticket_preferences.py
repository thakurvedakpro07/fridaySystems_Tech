from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0022_add_missing_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="communication_preference",
            field=models.CharField(
                blank=True,
                choices=[("phone", "Phone Call"), ("chat", "Live Chat")],
                default="",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="ticket",
            name="preferred_language",
            field=models.CharField(
                blank=True,
                choices=[("english", "English"), ("hindi", "Hindi"), ("marathi", "Marathi")],
                default="",
                max_length=16,
            ),
        ),
    ]
