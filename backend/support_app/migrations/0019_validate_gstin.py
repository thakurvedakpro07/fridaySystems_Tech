from django.db import migrations, models
import support_app.validators


class Migration(migrations.Migration):
    dependencies = [("support_app", "0018_add_first_response_due_at")]

    operations = [
        migrations.AlterField(
            model_name="customer",
            name="gstin",
            field=models.CharField(
                blank=True,
                help_text="GST registration number for B2B customers — 15-char format: 29ABCDE1234F1Z5",
                max_length=15,
                validators=[support_app.validators.validate_gstin_format],
            ),
        ),
    ]
