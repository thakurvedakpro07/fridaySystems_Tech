"""
Management command: seed_demo_data

Populates the database with a complete, realistic demo environment:
  - 10 demo customers (Indian SMB profiles)
  - 8 demo engineers (freelancers) with domain-specific skills
  - 15 demo tickets across all lifecycle statuses
  - Realistic activity timelines for each ticket
  - Threaded comments (customer ↔ engineer ↔ internal notes)
  - Payment records for all open/active/resolved tickets
  - TicketAssignment history for assigned/in-progress/resolved tickets

All demo records use email addresses ending in .demo so they are never
confused with real users. The command is fully idempotent — safe to run
multiple times. Use --flush to wipe and re-seed from scratch.

Usage:
    python manage.py seed_demo_data
    python manage.py seed_demo_data --flush    # delete existing demo data first
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models.signals import pre_save, post_save
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import uuid

User = get_user_model()
GST_RATE = Decimal("0.18")


# ── Demo customer definitions ─────────────────────────────────────

DEMO_CUSTOMERS = [
    {"email": "priya.sharma@techforge.demo",   "first_name": "Priya",   "last_name": "Sharma",  "company": "TechForge Solutions",       "phone": "+91-9811001001", "plan": "gold"},
    {"email": "rohan.mehta@nexusretail.demo",   "first_name": "Rohan",   "last_name": "Mehta",   "company": "Nexus Retail Pvt Ltd",      "phone": "+91-9822002002", "plan": "silver"},
    {"email": "sunita.patel@cloudbridge.demo",  "first_name": "Sunita",  "last_name": "Patel",   "company": "CloudBridge Technologies",  "phone": "+91-9833003003", "plan": "platinum"},
    {"email": "amir.khan@pinnacle.demo",        "first_name": "Amir",    "last_name": "Khan",    "company": "Pinnacle Logistics",        "phone": "+91-9844004004", "plan": "gold"},
    {"email": "deepa.nair@kratos.demo",         "first_name": "Deepa",   "last_name": "Nair",    "company": "Kratos Fintech",            "phone": "+91-9855005005", "plan": "platinum"},
    {"email": "vikram.singh@meridian.demo",     "first_name": "Vikram",  "last_name": "Singh",   "company": "Meridian Healthcare",       "phone": "+91-9866006006", "plan": "silver"},
    {"email": "anjali.gupta@starlink.demo",     "first_name": "Anjali",  "last_name": "Gupta",   "company": "Starlink Exports",          "phone": "+91-9877007007", "plan": "free"},
    {"email": "suresh.reddy@vertex.demo",       "first_name": "Suresh",  "last_name": "Reddy",   "company": "Vertex Manufacturing",      "phone": "+91-9888008008", "plan": "silver"},
    {"email": "meena.iyer@horizon.demo",        "first_name": "Meena",   "last_name": "Iyer",    "company": "Horizon Education",         "phone": "+91-9899009009", "plan": "gold"},
    {"email": "raj.khanna@sapphire.demo",       "first_name": "Raj",     "last_name": "Khanna",  "company": "Sapphire Hospitality",      "phone": "+91-9800010010", "plan": "silver"},
]


# ── Demo engineer definitions ─────────────────────────────────────

DEMO_ENGINEERS = [
    {"email": "arjun.verma@engineers.demo",   "first_name": "Arjun",   "last_name": "Verma",   "skills": "server_admin,active_directory,windows_server,dns,dhcp,gpo",  "availability": "full_time",  "rating": "4.80"},
    {"email": "kavita.rao@engineers.demo",    "first_name": "Kavita",  "last_name": "Rao",     "skills": "aws,ec2,vpc,iam,cloudwatch,s3",                              "availability": "full_time",  "rating": "4.90"},
    {"email": "nitin.chawla@engineers.demo",  "first_name": "Nitin",   "last_name": "Chawla",  "skills": "azure,azure_ad,virtual_machines,networking,resource_groups", "availability": "full_time",  "rating": "4.75"},
    {"email": "pooja.desai@engineers.demo",   "first_name": "Pooja",   "last_name": "Desai",   "skills": "kubernetes,docker,helm,ingress,containers",                  "availability": "full_time",  "rating": "4.85"},
    {"email": "sanjay.kumar@engineers.demo",  "first_name": "Sanjay",  "last_name": "Kumar",   "skills": "database,postgresql,mysql,sql_server,backup,tuning",         "availability": "part_time",  "rating": "4.70"},
    {"email": "ritika.sharma@engineers.demo", "first_name": "Ritika",  "last_name": "Sharma",  "skills": "laptop_desktop,windows,endpoint,antivirus,troubleshooting",  "availability": "full_time",  "rating": "4.95"},
    {"email": "dev.malhotra@engineers.demo",  "first_name": "Dev",     "last_name": "Malhotra","skills": "devops_cicd,github_actions,jenkins,docker,ci_cd",            "availability": "full_time",  "rating": "4.88"},
    {"email": "anita.pillai@engineers.demo",  "first_name": "Anita",   "last_name": "Pillai",  "skills": "infra_automation,terraform,ansible,provisioning,scripting", "availability": "ad_hoc",     "rating": "4.65"},
]


# ── Demo ticket definitions ───────────────────────────────────────
#
# Each tuple:
#   (demo_id, title, service_type, severity, final_status,
#    customer_idx, engineer_idx_or_None, days_ago, base_amount_inr, description)

DEMO_TICKETS = [
    # ── Open — 3 tickets (paid, waiting for assignment) ──────────────
    (
        "DEMO_01",
        "S3 bucket ACL misconfigured — customer files publicly accessible",
        "aws", "high", "open",
        0, None, 2, 2000,
        "Our AWS S3 bucket 'techforge-customer-docs' was found to have public read access "
        "after a bucket policy update three days ago meant to support a new reporting Lambda "
        "function. Security scanning flagged that customer invoice PDFs are accessible via "
        "direct URL with no authentication. We need the bucket locked down immediately, the "
        "offending policy statement identified, and an audit of what may have been accessed "
        "externally via CloudTrail.",
    ),
    (
        "DEMO_02",
        "Production pods crash-looping after node pool upgrade",
        "kubernetes", "high", "open",
        1, None, 1, 2500,
        "Since upgrading our EKS node pool to a new AMI version yesterday, three deployments "
        "in the 'checkout' namespace are stuck in CrashLoopBackOff. Pods start, fail a readiness "
        "probe within 15 seconds, and restart repeatedly. Rolling back the deployment image "
        "didn't help, so this looks tied to the node upgrade rather than application code. "
        "Checkout traffic is failing for roughly 30% of customers during peak hours.",
    ),
    (
        "DEMO_03",
        "40 staff laptops failing Windows Hello login after policy push",
        "laptop_desktop", "medium", "open",
        2, None, 3, 1500,
        "After an Intune configuration policy was pushed this morning, 40 out of 65 staff "
        "laptops are rejecting Windows Hello PIN sign-in with 'Something went wrong' errors. "
        "Password login still works as a fallback but employees are locked out of Hello-gated "
        "apps. The policy was intended to enforce stronger PIN complexity for a 5-person pilot "
        "group but appears to have applied to the whole device group instead.",
    ),

    # ── Assigned — 3 tickets (engineer assigned, not yet in progress) ─
    (
        "DEMO_04",
        "Linux file server CPU pegged at 100%, NFS mounts timing out",
        "server_admin", "high", "assigned",
        3, 0, 5, 3000,
        "Our primary Ubuntu 22.04 file server (fileserver01) has been running at 95-100% CPU "
        "for the past two days. NFS clients across the warehouse network are experiencing "
        "mount timeouts and stale handle errors. 'top' shows nfsd and rsync processes consuming "
        "most cycles, but no obvious runaway job was scheduled. Around 60 warehouse staff depend "
        "on these shares for scanning and logistics software.",
    ),
    (
        "DEMO_05",
        "Azure VM unreachable after NSG rule change — production app down",
        "azure", "critical", "assigned",
        4, 2, 4, 2500,
        "Our production application VM (kratos-app-prod-01) in Azure has been unreachable via "
        "RDP and HTTPS since a Network Security Group rule was modified by our network team "
        "last night. The VM shows as 'Running' in the Azure Portal but all inbound traffic on "
        "ports 443 and 3389 is timing out. This is directly blocking customer access to our "
        "payment onboarding portal. We need connectivity restored immediately.",
    ),
    (
        "DEMO_06",
        "PostgreSQL replication lag growing, read replicas falling behind",
        "database", "high", "assigned",
        5, 4, 3, 4000,
        "Our primary PostgreSQL 14 database has three streaming replicas used for reporting "
        "and patient record lookups. Over the past 48 hours, replication lag has grown from "
        "under a second to over 20 minutes and is steadily increasing. Reporting dashboards "
        "built on the replicas are now showing stale data, and WAL segment retention on the "
        "primary is climbing — we're worried about disk space if this isn't resolved soon.",
    ),

    # ── In Progress — 3 tickets (engineer actively working) ──────────
    (
        "DEMO_07",
        "GitHub Actions deployment pipeline failing on every merge to main",
        "devops_cicd", "high", "in_progress",
        6, 6, 7, 2000,
        "Our GitHub Actions deployment workflow has failed on every merge to main for the "
        "last four days, blocking all releases. The failure occurs at the 'docker build and "
        "push' step with an authentication error against our container registry, even though "
        "the registry credentials secret hasn't changed recently. Engineers are currently "
        "deploying manually as a workaround, which is error-prone and slow.",
    ),
    (
        "DEMO_08",
        "Ingress controller crash causing intermittent 502s in production",
        "kubernetes", "critical", "in_progress",
        7, 3, 8, 5000,
        "Our NGINX ingress controller in the production Kubernetes cluster has been "
        "crash-restarting roughly every 20 minutes since a config map change was applied two "
        "days ago. During each restart window, customers hit intermittent 502 Bad Gateway "
        "errors for 30-60 seconds. Pod logs show the controller running out of memory shortly "
        "before each crash, affecting order placement on our manufacturing portal.",
    ),
    (
        "DEMO_09",
        "Shared drive permissions broken after desktop migration to new AD group",
        "laptop_desktop", "medium", "in_progress",
        8, 5, 6, 1500,
        "As part of migrating staff desktops to a new Active Directory OU, the Faculty and "
        "Admin departments lost access to their shared network drives. Users see 'Access "
        "Denied' on folders they previously owned, though IT admin accounts can access "
        "everything fine. This is blocking grade submission and admissions document processing "
        "for around 25 staff members.",
    ),

    # ── In progress, awaiting customer info — 2 tickets ──────────────
    (
        "DEMO_10",
        "RDS instance CPU credits exhausted, queries timing out",
        "aws", "medium", "in_progress",
        9, 1, 10, 2000,
        "Our AWS RDS MySQL instance (db.t3.medium) has been running at sustained high CPU for "
        "the past three days, and CloudWatch shows the CPU credit balance has hit zero. "
        "Booking queries that normally complete in under 200ms are now timing out entirely "
        "during peak hours. We suspect an inefficient query introduced in a recent release but "
        "need help confirming the root cause and right-sizing the instance.",
    ),
    (
        "DEMO_11",
        "DNS records pointing to wrong IP after domain registrar migration",
        "server_admin", "high", "in_progress",
        0, 0, 9, 2000,
        "After migrating our domain from GoDaddy to Cloudflare, several DNS records are "
        "pointing to the old server IP (203.0.113.45) instead of our new server (198.51.100.22). "
        "The www and mail subdomains are affected. Website loads the old server content for "
        "approximately 40% of users depending on their DNS cache. Our IT team can see both IPs "
        "in Cloudflare but the propagation seems stuck.",
    ),

    # ── Resolved — 4 tickets ─────────────────────────────────────────
    (
        "DEMO_12",
        "Terraform state corruption blocking all infrastructure deploys",
        "infra_automation", "critical", "resolved",
        1, 7, 20, 5000,
        "Our Terraform state file for the production AWS account became corrupted after a CI "
        "job was interrupted mid-apply during a network outage. Every subsequent 'terraform "
        "plan' now fails with a state lock and resource drift errors, blocking all "
        "infrastructure changes including an urgent security patch rollout. We need the state "
        "file recovered or rebuilt without destroying existing resources.",
    ),
    (
        "DEMO_13",
        "Docker image builds failing in Jenkins pipeline after base image update",
        "devops_cicd", "high", "resolved",
        2, 6, 18, 2500,
        "Our Jenkins CI pipeline started failing all Docker image builds after the team "
        "updated the base image tag in the Dockerfile last week. The build fails at the "
        "'npm install' layer with a Node ABI mismatch error. This is blocking every deployment "
        "for the platform team, currently forcing them to deploy from local builds.",
    ),
    (
        "DEMO_14",
        "Azure AD conditional access policy locking out remote staff",
        "azure", "low", "resolved",
        3, 2, 15, 1500,
        "A new Conditional Access policy requiring compliant devices was enabled in Azure AD "
        "last week, and it's now blocking 12 remote logistics staff who use personal devices "
        "from signing into Microsoft 365. The policy was intended to apply only to the finance "
        "security group but appears to have been scoped to 'All Users' instead. Affected staff "
        "cannot access email or the shipment tracking app.",
    ),
    (
        "DEMO_15",
        "MySQL backup silently failing for 3 days — recovery risk",
        "database", "high", "resolved",
        4, 4, 12, 3000,
        "Our MySQL backup job has been returning exit code 0 (success) but no dump files have "
        "actually been written for the past three days. The backup script logs show a "
        "successful connection but zero bytes written to the S3 destination. A recent IAM "
        "policy change on the backup role is the suspected cause. We currently have no valid "
        "recent backup and need this treated as top priority.",
    ),
]


# ── Realistic comments per ticket ────────────────────────────────
# Each entry: (demo_id, author_type, body, is_internal, hours_after_creation)
# author_type: "customer" | "engineer" | "staff"

DEMO_COMMENTS = [
    # DEMO_01 — Open: S3 bucket publicly exposed
    ("DEMO_01", "customer", "Adding more detail: the bucket policy change was made by our new analytics contractor. We've since revoked their write access. Can you confirm if any files were actually downloaded by an outside party?", False, 1),
    ("DEMO_01", "staff", "Checked CloudTrail sample — public GetObject calls visible from unfamiliar IPs starting two days ago. Escalating for immediate remediation once assigned.", True, 2),

    # DEMO_02 — Open: EKS pods crash-looping
    ("DEMO_02", "customer", "Update: we found the new node AMI uses containerd 1.7 instead of 1.6. Not sure if that's related, but flagging in case it helps. Attaching pod logs from one of the crash-looping pods.", False, 0.5),

    # DEMO_03 — Open: Windows Hello login failures
    ("DEMO_03", "customer", "Our IT admin confirms the policy was meant for a 5-person pilot group but the Intune group assignment included the whole 'All Staff' device group by mistake. Is there a way to roll back the policy while you investigate?", False, 1),
    ("DEMO_03", "staff", "Confirmed via Intune portal — PIN complexity policy scoped to 'All Devices' dynamic group instead of 'Pilot-WindowsHello'. Will need to fix group scoping once assigned.", True, 1.5),

    # DEMO_04 — Assigned: Linux file server CPU
    ("DEMO_04", "customer", "fileserver01 also runs our nightly rsync backup to a secondary NAS. We can schedule a maintenance window from 11 PM to 5 AM if a restart is needed.", False, 1),
    ("DEMO_04", "engineer", "Reviewing the process list — rsync appears stuck in a retry loop against the secondary NAS, which seems to be dropping the connection mid-transfer. This is likely compounding with nfsd load. Will check NAS-side logs next.", False, 5),
    ("DEMO_04", "staff", "Assigned to Arjun Verma. Estimated resolution: 4 hours from start.", True, 4),

    # DEMO_05 — Assigned: Azure VM unreachable
    ("DEMO_05", "customer", "The NSG change was made by our network vendor for a compliance audit. We can provide read access to the NSG flow logs and the change ticket immediately.", False, 0.5),
    ("DEMO_05", "engineer", "Reviewing the NSG. Found a new deny-all inbound rule with a higher priority than the existing allow rules for 443/3389. This looks like an ordering mistake rather than an intentional block.", False, 4),
    ("DEMO_05", "staff", "CRITICAL — production app down. Nitin assigned, monitor closely.", True, 3),

    # DEMO_06 — Assigned: PostgreSQL replication lag
    ("DEMO_06", "customer", "Our DBA who set up replication is on leave. We can provide superuser access to the primary if that speeds up diagnosis.", False, 1),
    ("DEMO_06", "engineer", "Connected to the primary. pg_stat_replication shows replica 2 has fallen furthest behind — its WAL receiver appears to be reconnecting repeatedly, likely a network blip between AZs. Checking replication slot retention next to prevent WAL bloat.", False, 3),

    # DEMO_07 — In Progress: GitHub Actions pipeline failing
    ("DEMO_07", "customer", "Happy to grant repo admin access if useful. We've also noticed the failure only happens on the 'build-and-push' job, not on PR checks.", False, 0.5),
    ("DEMO_07", "engineer", "Reproduced locally — the registry credential secret is valid, but the workflow is using an outdated version of docker/login-action that no longer supports our registry's auth flow.", False, 7),
    ("DEMO_07", "engineer", "Bumped docker/login-action and docker/build-push-action to current versions and re-ran the pipeline successfully on a test branch. Rolling the fix out to the main workflow file now.", False, 8),
    ("DEMO_07", "staff", "Good progress. Ask customer if they want us to also add a pipeline status Slack alert so this is caught faster next time.", True, 8.5),

    # DEMO_08 — In Progress: Ingress controller crashing
    ("DEMO_08", "customer", "We can provide kubectl access to the affected namespace. A secondary cluster in another region has spare capacity if failover is needed.", False, 1),
    ("DEMO_08", "engineer", "Reviewing OOMKilled events — the ingress controller's memory limit wasn't raised when the config map change added a large custom error page. Current limit is 256Mi, usage spikes to 300Mi+ under load.", False, 9),
    ("DEMO_08", "engineer", "Raised the ingress controller memory limit to 512Mi and reverted the oversized custom error page. No crashes in the last 2 hours, monitoring continues.", False, 10),
    ("DEMO_08", "staff", "Ingress stable after fix. Documenting root cause and recommending a HorizontalPodAutoscaler review for the customer KB.", True, 11),

    # DEMO_09 — In Progress: Shared drive permissions after desktop migration
    ("DEMO_09", "customer", "The IT admin who ran the OU migration is available for a screen-share session if that helps speed things up.", False, 1),
    ("DEMO_09", "engineer", "Checked AD and NTFS permissions — the Faculty share's security group reference wasn't updated during the OU move, so it's still pointing at the old group SID. Restoring the correct group mapping now.", False, 6),
    ("DEMO_09", "engineer", "Faculty share access restored and verified. Admin share has a more complex nested folder structure with explicit deny rules — working through those now, ETA 30 minutes.", False, 6.5),

    # DEMO_10 — Waiting on Customer: RDS CPU credits exhausted
    ("DEMO_10", "customer", "We can authorize a temporary instance class upgrade if that's the fastest fix — just need to know the expected downtime.", False, 1),
    ("DEMO_10", "engineer", "Confirmed CPU credit exhaustion from CloudWatch metrics. Also found one query missing an index on the bookings.created_at column, which is likely the main driver. Need to know if a brief maintenance window is available to add the index.", False, 10),
    ("DEMO_10", "engineer", "Waiting on customer to confirm a maintenance window for the index build — it will briefly lock the bookings table.", False, 10.5),

    # DEMO_11 — Waiting on Customer: DNS wrong IP
    ("DEMO_11", "customer", "We can see in Cloudflare that both the old and new A records exist. But only Cloudflare's nameservers are authoritative now. Our old GoDaddy DNS still shows for some resolvers.", False, 1),
    ("DEMO_11", "engineer", "I've run dig queries from 5 global DNS resolvers. 3 of 5 now return the correct IP. The issue is at the old GoDaddy authoritative NS — it's still serving the old IP and some resolvers are caching it (TTL 3600). Two things I need from you: (1) Confirm GoDaddy delegation was updated to Cloudflare nameservers at the registrar level (not just DNS settings), (2) Share a screenshot of your Cloudflare DNS page so I can confirm no conflicting records exist.", False, 9),
    ("DEMO_11", "staff", "Customer needs to check their GoDaddy registrar NS records. The Cloudflare DNS is correct but if GoDaddy is still authoritative, that's the root cause.", True, 9.5),

    # DEMO_12 — Resolved: Terraform state corruption
    ("DEMO_12", "customer", "This is blocking an urgent CVE patch rollout for our payment service. We can provide AWS console access and the last known-good state backup from our CI artifacts if that helps.", False, 0.5),
    ("DEMO_12", "engineer", "Located a state backup from the CI job just before the interrupted apply. Cross-referencing it against 'terraform plan' output on the live AWS resources to check for drift before restoring.", False, 4),
    ("DEMO_12", "engineer", "Restored state from the CI backup and reconciled two resources that had drifted (a security group rule and an IAM policy). 'terraform plan' now shows zero unexpected changes.", False, 6),
    ("DEMO_12", "engineer", "Ran the pending security patch apply successfully. Added a remote state locking check to the CI pipeline to prevent this from recurring on interrupted runs.", False, 8),
    ("DEMO_12", "customer", "Excellent — the patch deployed cleanly and we can see infrastructure is back to a known state. Thanks for the fast turnaround.", False, 10),

    # DEMO_13 — Resolved: Docker builds failing after base image update
    ("DEMO_13", "customer", "The base image bump was meant to pick up a security patch. Happy to revert it if that unblocks things faster while you investigate.", False, 1),
    ("DEMO_13", "engineer", "Confirmed — the new base image ships Node 20 while the app's native dependencies were built against Node 18's ABI. Rebuilding the lockfile against the new image resolves the mismatch.", False, 6),
    ("DEMO_13", "engineer", "Updated package-lock.json and the Dockerfile to pin compatible native dependency versions. Full pipeline run succeeded end-to-end including the deploy stage.", False, 14),
    ("DEMO_13", "customer", "Confirmed deploys are working again. Please also invoice us for updating our onboarding docs to reflect the new base image — happy to pay for that.", False, 16),

    # DEMO_14 — Resolved: Azure AD conditional access lockout
    ("DEMO_14", "customer", "Confirmed the policy was meant to apply only to our Finance security group in Azure AD.", False, 1),
    ("DEMO_14", "engineer", "Reviewed the Conditional Access policy — the assignment target was set to 'All Users' instead of the Finance group, likely a dropdown selection error during setup. Corrected the scope and confirmed non-compliant devices outside Finance are no longer blocked.", False, 8),
    ("DEMO_14", "customer", "Confirmed — all 12 staff can sign in again from their personal devices. Thank you for the quick fix.", False, 10),

    # DEMO_15 — Resolved: MySQL backup silently failing
    ("DEMO_15", "customer", "The IAM policy change was made by a new team member setting up a separate reporting role. I can share the current backup role policy via secure link.", False, 1),
    ("DEMO_15", "engineer", "Found the issue — the updated IAM policy added a condition restricting s3:PutObject to a specific prefix that doesn't match the backup script's target path, so writes were silently denied while the script still exited 0. Corrected the policy condition and ran a manual test backup.", False, 5),
    ("DEMO_15", "engineer", "Test backup succeeded and the scheduled job at 2 AM completed normally with a full dump verified against checksum. Added a CloudWatch alarm so silent failures like this trigger an alert going forward.", False, 18),
    ("DEMO_15", "customer", "All good — backups are running normally again and we appreciate the alarm being added. Will look at adding similar monitoring for our other jobs.", False, 20),
]


class Command(BaseCommand):
    help = "Seed a complete demo environment: 10 customers, 8 engineers, 15 tickets with history."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            default=False,
            help="Delete all existing demo data (.demo emails, DEMO_xx tickets) before re-seeding.",
        )

    def handle(self, *args, **options):
        from support_app.models import (
            Customer, Freelancer, Ticket, TicketActivityLog,
            TicketAssignment, TicketComment, Payment,
        )
        from support_app import signals as app_signals

        if options["flush"]:
            self._flush()

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== ResolveHQ Demo Data Seeder ===\n"))

        # Temporarily disconnect ticket signals so we can set all fields manually
        # and create a clean, backdated activity log ourselves.
        pre_save.disconnect(app_signals.log_ticket_changes, sender=Ticket)
        post_save.disconnect(app_signals.log_ticket_created, sender=Ticket)

        try:
            customers  = self._seed_customers(Customer)
            engineers  = self._seed_engineers(Freelancer)
            staff_user = self._get_staff_actor()
            self._seed_tickets(Ticket, TicketActivityLog, TicketAssignment, TicketComment, Payment, customers, engineers, staff_user)
        finally:
            # Always reconnect — even if seeding fails midway.
            pre_save.connect(app_signals.log_ticket_changes, sender=Ticket)
            post_save.connect(app_signals.log_ticket_created, sender=Ticket)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Demo environment ready.\n"))
        self.stdout.write("Customers : 10   (email suffix: .demo)")
        self.stdout.write("Engineers : 8    (email suffix: @engineers.demo)")
        self.stdout.write("Tickets   : 15   (external_ticket_id: DEMO_01 … DEMO_15)")
        self.stdout.write("")
        self.stdout.write("Run 'python manage.py seed_demo_users' to also create staff login accounts.\n")

    # ── Helpers ───────────────────────────────────────────────────────

    def _get_staff_actor(self):
        """Return the first Super Admin as the actor for seeded ops actions, or None."""
        try:
            return User.objects.filter(is_staff=True, role="admin").first()
        except Exception:
            return None

    def _dt(self, days_ago: float, hours_offset: float = 0) -> "datetime":
        return timezone.now() - timedelta(days=days_ago, hours=hours_offset)

    def _backdate(self, Model, pk, dt):
        Model.objects.filter(pk=pk).update(created_at=dt)

    # ── Customers ─────────────────────────────────────────────────────

    def _seed_customers(self, Customer):
        self.stdout.write(self.style.MIGRATE_HEADING("Seeding customers…"))
        customers = []
        for spec in DEMO_CUSTOMERS:
            user, u_created = User.objects.get_or_create(
                email=spec["email"],
                defaults={
                    "first_name": spec["first_name"],
                    "last_name":  spec["last_name"],
                    "role":       "customer",
                    "is_active":  True,
                    "is_staff":   False,
                },
            )
            if u_created:
                user.set_password("DemoCustomer1!")
                user.save()

            profile, p_created = Customer.objects.get_or_create(
                user=user,
                defaults={
                    "company": spec["company"],
                    "phone":   spec["phone"],
                    "plan":    spec["plan"],
                },
            )
            customers.append(profile)
            status = self.style.SUCCESS("CREATED") if u_created else "EXISTS  "
            self.stdout.write(f"  {status}  {spec['first_name']:<10} {spec['last_name']:<10} — {spec['company']}")

        return customers

    # ── Engineers ─────────────────────────────────────────────────────

    def _seed_engineers(self, Freelancer):
        self.stdout.write(self.style.MIGRATE_HEADING("\nSeeding engineers…"))
        engineers = []
        for spec in DEMO_ENGINEERS:
            user, u_created = User.objects.get_or_create(
                email=spec["email"],
                defaults={
                    "first_name": spec["first_name"],
                    "last_name":  spec["last_name"],
                    "role":       "freelancer",
                    "is_active":  True,
                    "is_staff":   False,
                },
            )
            if u_created:
                user.set_password("DemoEngineer1!")
                user.save()

            profile, p_created = Freelancer.objects.get_or_create(
                user=user,
                defaults={
                    "skills":            spec["skills"],
                    "availability":      spec["availability"],
                    "rating":            Decimal(spec["rating"]),
                    "onboarding_status": "approved",
                    "active":            True,
                },
            )
            engineers.append(profile)
            status = self.style.SUCCESS("CREATED") if u_created else "EXISTS  "
            self.stdout.write(f"  {status}  {spec['first_name']:<10} {spec['last_name']:<10} — {spec['skills'][:40]}")

        return engineers

    # ── Tickets ───────────────────────────────────────────────────────

    def _seed_tickets(self, Ticket, TicketActivityLog, TicketAssignment, TicketComment, Payment, customers, engineers, staff_user):
        self.stdout.write(self.style.MIGRATE_HEADING("\nSeeding tickets…"))

        # Build a lookup from demo_id → ticket for comments pass
        ticket_map = {}

        for spec in DEMO_TICKETS:
            (demo_id, title, service_type, severity,
             final_status, cust_idx, eng_idx, days_ago, base_amount, description) = spec

            customer  = customers[cust_idx]
            engineer  = engineers[eng_idx] if eng_idx is not None else None

            # Idempotency: skip if already exists
            existing = Ticket.objects.filter(external_ticket_id=demo_id).first()
            if existing:
                self.stdout.write(f"  EXISTS   [{demo_id}] {title[:55]}")
                ticket_map[demo_id] = existing
                continue

            # Create the ticket in its final state directly (signals disconnected above)
            ticket = Ticket.objects.create(
                customer=customer,
                title=title,
                description=description,
                service_type=service_type,
                severity=severity,
                status=final_status,
                assigned_to=engineer,
                external_ticket_id=demo_id,
                resolved_at=self._dt(days_ago - 1) if final_status == "resolved" else None,
            )
            # Backdate ticket creation
            Ticket.objects.filter(pk=ticket.pk).update(created_at=self._dt(days_ago))
            ticket_map[demo_id] = ticket

            # Create payment record (all tickets are past pending_payment)
            self._create_payment(Payment, customer, ticket, base_amount, demo_id, days_ago)

            # Build the activity timeline
            self._build_activity_log(TicketActivityLog, TicketAssignment, ticket, engineer, staff_user, final_status, days_ago)

            self.stdout.write(f"  {self.style.SUCCESS('CREATED')}  [{demo_id}] {title[:55]}")

        # Second pass: add comments (ticket_map is now fully populated)
        self._seed_comments(TicketComment, ticket_map, customers, engineers)

    # ── Payment ───────────────────────────────────────────────────────

    def _create_payment(self, Payment, customer, ticket, base_amount, demo_id, days_ago):
        invoice_number = f"INV-{demo_id}"
        if Payment.objects.filter(invoice_number=invoice_number).exists():
            return
        amount     = Decimal(str(base_amount))
        gst_amount = (amount * GST_RATE).quantize(Decimal("0.01"))
        Payment.objects.create(
            customer=customer,
            ticket=ticket,
            amount=amount,
            gst_amount=gst_amount,
            currency="INR",
            invoice_number=invoice_number,
            payment_type="consulting_fee",
            gateway="razorpay",
            gateway_payment_id=f"pay_demo{demo_id[-2:]}{'x' * 12}",
            gateway_order_id=f"order_demo{demo_id[-2:]}{'x' * 10}",
            status="completed",
        )
        # Backdate payment ~2 hours after ticket creation
        from support_app.models import Payment as PaymentModel
        payment = PaymentModel.objects.filter(invoice_number=invoice_number).first()
        if payment:
            PaymentModel.objects.filter(pk=payment.pk).update(created_at=self._dt(days_ago, hours_offset=-2))

    # ── Activity log ──────────────────────────────────────────────────

    def _build_activity_log(self, TicketActivityLog, TicketAssignment, ticket, engineer, staff_user, final_status, days_ago):
        logs = []  # list of (log_obj, dt) for backdating

        def log(action, from_v, to_v, actor, dt, note=""):
            entry = TicketActivityLog.objects.create(
                ticket=ticket, actor=actor, action=action,
                from_value=from_v, to_value=to_v, note=note,
            )
            logs.append((entry, dt))
            return entry

        t0 = self._dt(days_ago)                        # ticket created
        t1 = self._dt(days_ago, hours_offset=-2)       # payment confirmed → open
        t2 = self._dt(days_ago, hours_offset=-4)       # assigned
        t3 = self._dt(days_ago, hours_offset=-6)       # in_progress
        t5 = self._dt(days_ago - 1, hours_offset=4)   # resolved

        # Every ticket: created
        log("created", "", "pending_payment", ticket.customer.user, t0)
        # Payment → open
        log("status_changed", "pending_payment", "open", None, t1, "Payment confirmed via Razorpay.")

        if final_status in ("assigned", "in_progress", "resolved"):
            eng_email = engineer.user.email if engineer else ""
            log("assigned", "", eng_email, staff_user, t2)

            if final_status in ("in_progress", "resolved"):
                log("status_changed", "assigned", "in_progress", engineer.user if engineer else staff_user, t3)

            if final_status == "resolved":
                log("resolved", "in_progress", "resolved",
                    engineer.user if engineer else staff_user, t5,
                    "Issue identified and resolved. Customer confirmed fix.")

            # TicketAssignment record
            if engineer and not TicketAssignment.objects.filter(ticket=ticket).exists():
                assignment = TicketAssignment.objects.create(
                    ticket=ticket,
                    freelancer=engineer,
                    assigned_by=staff_user,
                    reason="initial",
                )
                TicketAssignment.objects.filter(pk=assignment.pk).update(assigned_at=t2)
                if final_status == "resolved":
                    TicketAssignment.objects.filter(pk=assignment.pk).update(unassigned_at=t5)

        # Backdate all log entries
        for entry, dt in logs:
            TicketActivityLog.objects.filter(pk=entry.pk).update(created_at=dt)

    # ── Comments ──────────────────────────────────────────────────────

    def _seed_comments(self, TicketComment, ticket_map, customers, engineers):
        # Build quick-lookup maps
        customer_user_map = {c.user.email.split("@")[0].replace(".", "_"): c.user for c in customers}
        engineer_user_map = {e.user.email: e.user for e in engineers}

        # Find a staff user for "staff" author_type
        staff_user = self._get_staff_actor()

        for (demo_id, author_type, body, is_internal, hours_offset) in DEMO_COMMENTS:
            ticket = ticket_map.get(demo_id)
            if not ticket:
                continue

            # Determine author
            if author_type == "customer":
                author = ticket.customer.user
            elif author_type == "engineer":
                author = ticket.assigned_to.user if ticket.assigned_to else staff_user
            else:
                author = staff_user

            if not author:
                continue

            # Idempotency: skip if an identical comment already exists
            if TicketComment.objects.filter(ticket=ticket, author=author, body=body[:50]).exists():
                continue

            # Determine the base time for this comment from ticket's backdated created_at
            try:
                ticket_created = Ticket.objects.values_list("created_at", flat=True).get(pk=ticket.pk)
            except Exception:
                ticket_created = timezone.now()

            comment_dt = ticket_created + timedelta(hours=hours_offset)

            comment = TicketComment.objects.create(
                ticket=ticket,
                author=author,
                body=body,
                is_internal=is_internal,
            )
            TicketComment.objects.filter(pk=comment.pk).update(created_at=comment_dt)

    # ── Flush ─────────────────────────────────────────────────────────

    def _flush(self):
        from support_app.models import Ticket, Payment, Customer, Freelancer

        self.stdout.write(self.style.WARNING("Flushing all demo data…"))

        # Delete demo tickets (cascades to logs, comments, assignments, attachments)
        t_count = Ticket.objects.filter(external_ticket_id__startswith="DEMO_").count()
        Ticket.objects.filter(external_ticket_id__startswith="DEMO_").delete()
        self.stdout.write(f"  Deleted {t_count} demo tickets (+ cascaded logs/comments/assignments)")

        # Delete demo payments orphaned after ticket deletion
        p_count = Payment.objects.filter(invoice_number__startswith="INV-DEMO_").count()
        Payment.objects.filter(invoice_number__startswith="INV-DEMO_").delete()
        self.stdout.write(f"  Deleted {p_count} orphaned demo payments")

        # Delete demo users and their profiles (cascade deletes Customer + Freelancer)
        demo_users = User.objects.filter(email__endswith=".demo")
        u_count = demo_users.count()
        demo_users.delete()
        self.stdout.write(f"  Deleted {u_count} demo user accounts\n")
