from django.db import migrations


def approve_pending_freelancers(apps, schema_editor):
    """
    Bulk-approve all freelancers currently stuck with onboarding_status='pending'.

    These were created via POST /api/admin/freelancers/ which used the model
    default ('pending') instead of setting 'approved'. Since admin-created
    freelancers are pre-approved by definition, this corrects the data.

    The reverse is a no-op — we cannot know which records were genuinely
    pending vs. incorrectly pending, so we do not roll back.
    """
    Freelancer = apps.get_model("support_app", "Freelancer")
    Freelancer.objects.filter(onboarding_status="pending").update(onboarding_status="approved")


class Migration(migrations.Migration):
    dependencies = [
        ("support_app", "0005_attachment_file_field"),
    ]

    operations = [
        migrations.RunPython(approve_pending_freelancers, migrations.RunPython.noop),
    ]
