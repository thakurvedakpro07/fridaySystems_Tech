from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("support_app", "0021_add_payment_gateway_refund_id")]

    operations = [
        migrations.AddIndex(
            model_name="customuser",
            index=models.Index(fields=["role", "is_active"], name="idx_user_role_active"),
        ),
        migrations.AddIndex(
            model_name="freelancer",
            index=models.Index(fields=["onboarding_status", "active"], name="idx_freelancer_status_active"),
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["gateway_order_id"], name="idx_payment_gateway_order_id"),
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["customer", "status"], name="idx_payment_customer_status"),
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["status", "created_at"], name="idx_payment_status_created"),
        ),
        migrations.AddIndex(
            model_name="ticket",
            index=models.Index(fields=["status", "due_at"], name="idx_ticket_status_due_at"),
        ),
    ]
