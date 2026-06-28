from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("support_app", "0020_add_invoice_counter")]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="gateway_refund_id",
            field=models.CharField(blank=True, db_index=True, max_length=255),
        ),
    ]
