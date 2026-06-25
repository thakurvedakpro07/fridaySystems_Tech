from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("support_app", "0019_validate_gstin")]

    operations = [
        migrations.CreateModel(
            name="InvoiceCounter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year_month", models.CharField(max_length=6, unique=True)),
                ("last_seq", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": []},
        ),
    ]
