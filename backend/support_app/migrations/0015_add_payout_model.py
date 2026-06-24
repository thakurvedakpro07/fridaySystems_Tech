"""
Migration: add Payout model.

Creates the payout table for tracking engineer payouts after customers
pay the resolution fee. One payout per closed ticket.
"""

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("support_app", "0014_remove_microsoft365_service"),
    ]

    operations = [
        migrations.CreateModel(
            name="Payout",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "resolution_fee",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        help_text="base_fee + severity_surcharge (pre-GST)",
                    ),
                ),
                (
                    "severity_surcharge",
                    models.DecimalField(decimal_places=2, default=0, max_digits=10),
                ),
                (
                    "engineer_share",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        help_text="65% of resolution_fee",
                    ),
                ),
                (
                    "platform_share",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        help_text="35% of resolution_fee",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("processed", "Processed")],
                        default="pending",
                        max_length=16,
                    ),
                ),
                (
                    "utr_number",
                    models.CharField(
                        blank=True,
                        max_length=64,
                        help_text="Bank/UPI transaction reference after transfer",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "freelancer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payouts",
                        to="support_app.freelancer",
                    ),
                ),
                (
                    "payment",
                    models.ForeignKey(
                        help_text="The resolution_fee Payment that triggered this payout",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payouts",
                        to="support_app.payment",
                    ),
                ),
                (
                    "ticket",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payout",
                        to="support_app.ticket",
                    ),
                ),
            ],
            options={
                "verbose_name": "Payout",
                "verbose_name_plural": "Payouts",
                "ordering": ["-created_at"],
            },
        ),
    ]
