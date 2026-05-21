from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0004_phase7_composite_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticketattachment",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to="attachments/%Y/%m/"),
        ),
        migrations.AlterField(
            model_name="ticketattachment",
            name="storage_url",
            field=models.URLField(blank=True, max_length=1024),
        ),
        migrations.AlterField(
            model_name="ticketattachment",
            name="file_size",
            field=models.PositiveIntegerField(default=0, help_text="File size in bytes"),
        ),
    ]
