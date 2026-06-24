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
    {"email": "arjun.verma@engineers.demo",   "first_name": "Arjun",   "last_name": "Verma",   "skills": "microsoft365,exchange,email,dns,outlook",        "availability": "full_time",  "rating": "4.80"},
    {"email": "kavita.rao@engineers.demo",    "first_name": "Kavita",  "last_name": "Rao",     "skills": "linux,server_admin,bash,nginx,ubuntu,centos",     "availability": "full_time",  "rating": "4.90"},
    {"email": "nitin.chawla@engineers.demo",  "first_name": "Nitin",   "last_name": "Chawla",  "skills": "vpn,cybersecurity,firewall,palo_alto,cisco_asa",   "availability": "full_time",  "rating": "4.75"},
    {"email": "pooja.desai@engineers.demo",   "first_name": "Pooja",   "last_name": "Desai",   "skills": "cloud,aws,azure,windows_server,vmware",           "availability": "full_time",  "rating": "4.85"},
    {"email": "sanjay.kumar@engineers.demo",  "first_name": "Sanjay",  "last_name": "Kumar",   "skills": "sap,sap_basis,sap_erp,server_admin,oracle",       "availability": "part_time",  "rating": "4.70"},
    {"email": "ritika.sharma@engineers.demo", "first_name": "Ritika",  "last_name": "Sharma",  "skills": "microsoft365,sharepoint,teams,cloud,onedrive",    "availability": "full_time",  "rating": "4.95"},
    {"email": "dev.malhotra@engineers.demo",  "first_name": "Dev",     "last_name": "Malhotra","skills": "cybersecurity,linux,siem,endpoint_security,soc",  "availability": "full_time",  "rating": "4.88"},
    {"email": "anita.pillai@engineers.demo",  "first_name": "Anita",   "last_name": "Pillai",  "skills": "email,dns,vpn,networking,bind9,postfix",          "availability": "ad_hoc",     "rating": "4.65"},
]


# ── Demo ticket definitions ───────────────────────────────────────
#
# Each tuple:
#   (demo_id, title, service_type, severity, priority, final_status,
#    customer_idx, engineer_idx_or_None, days_ago, base_amount_inr, description)

DEMO_TICKETS = [
    # ── Open — 3 tickets (paid, waiting for assignment) ──────────────
    (
        "DEMO_01",
        "Emails bouncing for company domain after DNS migration",
        "linux", "high", "high", "open",
        0, None, 2, 2000,
        "Since yesterday evening, all outbound emails from our company domain are bouncing "
        "with 'Relay access denied' errors. Multiple staff have received NDR messages. "
        "MX records appear to have changed after migrating to a new domain registrar last week. "
        "Inbound mail is also affected — external senders get delivery failures.",
    ),
    (
        "DEMO_02",
        "VPN connection dropping for all remote staff",
        "security", "high", "urgent", "open",
        1, None, 1, 2500,
        "Our Cisco AnyConnect VPN has been dropping connections for all 25 remote staff "
        "since this morning. Users authenticate successfully but sessions drop within 2-3 minutes. "
        "The issue started after the network team patched the ASA firewall last night. "
        "Business-critical ERP access is blocked. Need urgent resolution.",
    ),
    (
        "DEMO_03",
        "Microsoft 365 MFA login failure blocking 15 users",
        "desktop", "medium", "high", "open",
        2, None, 3, 1500,
        "15 out of 40 staff cannot log into Microsoft 365. They receive "
        "'AADSTS50076: Due to a configuration change, Multi-Factor Authentication is required' "
        "but the MFA setup screen never loads. This started after an Azure AD Conditional Access "
        "policy was applied this morning. Affected users are locked out of email and Teams.",
    ),

    # ── Assigned — 3 tickets (engineer assigned, not yet in progress) ─
    (
        "DEMO_04",
        "Windows Server 2019 CPU pegged at 100% under normal load",
        "windows", "high", "high", "assigned",
        3, 3, 5, 3000,
        "Our primary Windows Server 2019 file server has been running at 95-100% CPU "
        "for 3 days. Normal load averages 30-40%. Performance Monitor shows "
        "'System' and 'svchost.exe (WaasMedicSvc)' consuming most cycles. "
        "Server is sluggish and file access is impacting 60 users. "
        "No recent software changes were made before the degradation began.",
    ),
    (
        "DEMO_05",
        "SSL certificate expired on customer portal — HTTPS broken",
        "security", "critical", "urgent", "assigned",
        4, 2, 4, 2500,
        "The SSL/TLS certificate for our customer-facing portal (portal.kratosfintech.com) "
        "expired 6 hours ago. Customers are seeing 'Your connection is not private' warnings. "
        "This is directly impacting customer onboarding and payment flows. "
        "The cert was issued via Let's Encrypt but the auto-renewal cron appears to have failed. "
        "We need immediate certificate renewal and monitoring setup.",
    ),
    (
        "DEMO_06",
        "SAP system log full — users getting login errors after policy change",
        "sap", "high", "high", "assigned",
        5, 4, 3, 4000,
        "Following our IT security team's password policy enforcement in SAP, "
        "users are seeing SM21 log entries indicating the system log (dev_w0) is full. "
        "Approximately 30 SAP users cannot log in, receiving 'System is currently not available'. "
        "The SM21 system log reached 100% capacity and is blocking new sessions. "
        "This may be related to the recent BASIS team changes to security audit logging.",
    ),

    # ── In Progress — 3 tickets (engineer actively working) ──────────
    (
        "DEMO_07",
        "Linux server disk at 97% — automated backup cron alerts firing",
        "linux", "high", "urgent", "in_progress",
        6, 1, 7, 2000,
        "Our Ubuntu 22.04 application server has disk usage at 97% on the / partition. "
        "Automated monitoring alerts have been firing since last night. "
        "Preliminary check shows /var/log has grown to 45GB due to verbose application logging. "
        "Backup cron jobs are also failing to write because of the space constraint. "
        "Need immediate disk cleanup and log rotation policy implementation.",
    ),
    (
        "DEMO_08",
        "VMware ESXi host purple screen (PSOD) after patch update",
        "vmware", "critical", "urgent", "in_progress",
        7, 3, 8, 5000,
        "Our VMware ESXi 7.0 U3 host experienced a Purple Screen of Death (PSOD) "
        "after applying patch ESXi700-202310001. The host crashed at 2:15 AM and restarted. "
        "The crash dump indicates a memory heap corruption in the storage driver. "
        "Three production VMs were affected — two restarted automatically on a secondary host "
        "but one SAP VM is still offline. Business continuity is impacted.",
    ),
    (
        "DEMO_09",
        "SharePoint Online permissions broken — department folders inaccessible",
        "desktop", "medium", "medium", "in_progress",
        8, 5, 6, 1500,
        "The Finance and HR departments cannot access their SharePoint document libraries "
        "after our M365 administrator restructured the team site. "
        "Users see 'Sorry, you don't have access to this page' on folders they previously owned. "
        "The site collection admin can access everything fine. "
        "This is blocking budget approval workflows and HR document processing.",
    ),

    # ── Waiting on Customer — 2 tickets ──────────────────────────────
    (
        "DEMO_10",
        "Remote desktop access lost after firewall rule change",
        "windows", "medium", "medium", "waiting_customer",
        9, 6, 10, 2000,
        "Remote Desktop Protocol (RDP) access to our on-premise servers has been blocked "
        "since the network team modified the perimeter firewall rules on Wednesday. "
        "Internal RDP still works but all remote access via VPN + RDP is failing. "
        "Netstat shows port 3389 is listening but connections timeout from outside. "
        "We need the firewall rules reviewed and RDP access restored for 10 remote admins.",
    ),
    (
        "DEMO_11",
        "DNS records pointing to wrong IP after domain registrar migration",
        "linux", "high", "high", "waiting_customer",
        0, 7, 9, 2000,
        "After migrating our domain from GoDaddy to Cloudflare, several DNS records "
        "are pointing to the old server IP (203.0.113.45) instead of our new server (198.51.100.22). "
        "The www and mail subdomains are affected. Website loads the old server content "
        "for approximately 40% of users depending on their DNS cache. "
        "Our IT team can see both IPs in Cloudflare but the propagation seems stuck.",
    ),

    # ── Resolved — 4 tickets ─────────────────────────────────────────
    (
        "DEMO_12",
        "Ransomware indicators found on 3 employee workstations",
        "security", "critical", "urgent", "resolved",
        1, 2, 20, 5000,
        "Our endpoint detection tool flagged suspicious file encryption activity on "
        "3 workstations in the sales department. Files in shared network drives show "
        "unusual .encrypted extensions. The affected machines have been isolated from "
        "the network. We need immediate malware analysis, containment, and recovery. "
        "Backups are available from 48 hours ago. Please treat this as top priority.",
    ),
    (
        "DEMO_13",
        "Company domain blacklisted — outbound emails flagged as spam",
        "linux", "high", "urgent", "resolved",
        2, 0, 18, 2500,
        "Clients are reporting our emails land in spam or get bounced entirely. "
        "MXToolbox shows cloudbridge.in is listed on Spamhaus ZEN and Barracuda BRBL. "
        "This appears to be caused by a compromised email account that sent bulk messages "
        "last weekend. We need the blacklisting removed, SPF/DKIM/DMARC policies strengthened, "
        "and the compromised account secured.",
    ),
    (
        "DEMO_14",
        "Network drive mappings lost after Windows Update KB5034441",
        "windows", "low", "low", "resolved",
        3, 1, 15, 1500,
        "After Windows Update KB5034441 was applied on 15 workstations last Tuesday, "
        "all users lost their mapped network drives (Z:, Y:). "
        "Manually re-mapping works temporarily but drives disappear after reboot. "
        "The group policy for drive mapping shows the correct configuration. "
        "This appears to be a known issue with the SMB client in the KB update.",
    ),
    (
        "DEMO_15",
        "Cloud backup silently failing for 3 days — recovery risk",
        "security", "high", "high", "resolved",
        4, 3, 12, 3000,
        "Our AWS S3 backup job has been returning exit code 0 (success) but no files "
        "are being transferred. The backup agent logs show successful API authentication "
        "but 0 bytes uploaded. This has been silently failing for 72 hours. "
        "S3 bucket policy was recently updated by a new DevOps team member. "
        "We currently have no valid offsite backup. Please investigate immediately.",
    ),
]


# ── Realistic comments per ticket ────────────────────────────────
# Each entry: (demo_id, author_type, body, is_internal, hours_after_creation)
# author_type: "customer" | "engineer" | "staff"

DEMO_COMMENTS = [
    # DEMO_01 — Open: emails bouncing
    ("DEMO_01", "customer", "Adding more context: our domain registrar is Bigrock. The migration happened 6 days ago. SPF record looks correct in Bigrock but something in the MX chain is wrong.", False, 1),
    ("DEMO_01", "staff", "Checked MXToolbox. MX records are present but TTL still propagating from old nameserver. Will verify once ticket is assigned.", True, 2),

    # DEMO_02 — Open: VPN dropping
    ("DEMO_02", "customer", "Update: we collected the AnyConnect log. The disconnect reason code is 'Keepalive timer expired'. Attaching the DART bundle from one affected user.", False, 0.5),

    # DEMO_03 — Open: M365 MFA
    ("DEMO_03", "customer", "Our IT admin accidentally applied the MFA policy to all users instead of just the pilot group. Is there a way to temporarily roll back while you investigate?", False, 1),
    ("DEMO_03", "staff", "Checked Azure AD portal. Conditional Access policy ID CA-003 is set to 'All users'. Will need to scope it down. Waiting for assignment.", True, 1.5),

    # DEMO_04 — Assigned: Windows Server CPU
    ("DEMO_04", "customer", "The server is our primary file server FS01. It runs DFS-N, DFSR, and Backup Exec. We can schedule a maintenance window from 11 PM to 5 AM if needed.", False, 1),
    ("DEMO_04", "engineer", "Reviewing the task list. WaasMedicSvc (Windows Update Medic Service) is consuming 45% CPU. This is a known issue with Windows Update stuck in a loop. Will disable and run sfc /scannow first.", False, 5),
    ("DEMO_04", "staff", "Assigned to Pooja Desai. Estimated resolution: 4 hours from start.", True, 4),

    # DEMO_05 — Assigned: SSL expired
    ("DEMO_05", "customer", "The cert renewal cron was set up 8 months ago. It's running as the www-data user. We can provide SSH access immediately.", False, 0.5),
    ("DEMO_05", "engineer", "Connecting via SSH. I can see certbot is installed. Running 'certbot renew --dry-run' to check the issue. Will report back in 10 minutes.", False, 4),
    ("DEMO_05", "staff", "CRITICAL ticket — cert expired. Nitin assigned. Monitor resolution closely.", True, 3),

    # DEMO_06 — Assigned: SAP log full
    ("DEMO_06", "customer", "The BASIS admin who made the changes is on leave today. We can provide Emergency access credentials (S_A.SYSLOG authorisation) for direct system log management.", False, 1),
    ("DEMO_06", "engineer", "Logging into SAP via SAP GUI. SM21 confirms dev_w0 is 100% full. Will use SM50/SM66 to check active work processes and then clear log via SM21 > Reorganise.", False, 3),

    # DEMO_07 — In Progress: Linux disk
    ("DEMO_07", "customer", "Happy to give sudo access. Please let me know what you need. We can also create a new EBS volume if the cleanup isn't enough.", False, 0.5),
    ("DEMO_07", "engineer", "Connected to server. Running 'du -sh /var/log/* | sort -rh | head -20'. Found /var/log/nginx/access.log at 38GB — no rotation configured. Also found 7GB of old .gz backup staging files in /tmp.", False, 7),
    ("DEMO_07", "engineer", "Cleared /tmp backup staging (7GB recovered). Set up logrotate for nginx (daily, 7-day retention, compress). Disk now at 61%. Implementing log rotation across all app logs next.", False, 8),
    ("DEMO_07", "staff", "Good progress. Ask customer if they want us to also review the application logging level — looks like DEBUG is on in production.", True, 8.5),

    # DEMO_08 — In Progress: VMware PSOD
    ("DEMO_08", "customer", "The crash dump is available at /scratch/log/vmkernel.log on the host. We can provide root SSH access. Secondary host (ESXI-02) has capacity to run all VMs if needed.", False, 1),
    ("DEMO_08", "engineer", "Reviewing the PSOD dump. Error points to a null pointer dereference in vmw_pvscsi driver (version 1.0.8.0). This is a known issue fixed in VMware KB 87697. Need to patch to ESXi 7.0 U3d or apply the driver workaround.", False, 9),
    ("DEMO_08", "engineer", "Applied the pvscsi driver workaround from KB 87697 on ESXI-01 without requiring a reboot. SAP VM successfully vMotion'd back to ESXI-01. Monitoring stability — no further PSODs in 2 hours.", False, 10),
    ("DEMO_08", "staff", "ESXI-01 stable after workaround. Schedule patching to 7.0 U3d during the next maintenance window. Documenting the workaround steps for the customer KB.", True, 11),

    # DEMO_09 — In Progress: SharePoint permissions
    ("DEMO_09", "customer", "The M365 admin who restructured the site is available to join a Teams call if helpful. We can screen-share the SharePoint admin centre.", False, 1),
    ("DEMO_09", "engineer", "In the SharePoint admin centre I can see the Finance library inheritance was broken — it's now pointing to a different permission level. The 'Finance Members' security group was removed from site collection permissions. Restoring now.", False, 6),
    ("DEMO_09", "engineer", "Finance library permissions restored. Testing HR library access now. HR has a more complex structure with nested sub-sites. May take another 30 minutes.", False, 6.5),

    # DEMO_10 — Waiting on Customer: RDP blocked
    ("DEMO_10", "customer", "The firewall is a Fortinet FortiGate 100F. Our network admin can provide read-only access to the firewall audit logs if needed.", False, 1),
    ("DEMO_10", "engineer", "I've reviewed the FortiGate logs you shared. The RDP traffic is hitting policy ID 47 which was changed from ALLOW to DENY on Wednesday. I need the following to proceed: (1) Confirm the source IPs for your remote admins, (2) Confirm if split-tunnelling is enabled on your VPN. This will determine the correct fix — either a new firewall rule or a VPN policy change.", False, 10),
    ("DEMO_10", "engineer", "Waiting on customer to provide the remote admin IP list and VPN configuration details. Ticket placed in 'Waiting on Customer' status.", False, 10.5),

    # DEMO_11 — Waiting on Customer: DNS wrong IP
    ("DEMO_11", "customer", "We can see in Cloudflare that both the old and new A records exist. But only Cloudflare's nameservers are authoritative now. Our old GoDaddy DNS still shows for some resolvers.", False, 1),
    ("DEMO_11", "engineer", "I've run dig queries from 5 global DNS resolvers. 3 of 5 now return the correct IP. The issue is at the old GoDaddy authoritative NS — it's still serving the old IP and some resolvers are caching it (TTL 3600). Two things I need from you: (1) Confirm GoDaddy delegation was updated to Cloudflare nameservers at the registrar level (not just DNS settings), (2) Share a screenshot of your Cloudflare DNS page so I can confirm no conflicting records exist.", False, 9),
    ("DEMO_11", "staff", "Customer needs to check their GoDaddy registrar NS records. The Cloudflare DNS is correct but if GoDaddy is still authoritative, that's the root cause.", True, 9.5),

    # DEMO_12 — Resolved: Ransomware
    ("DEMO_12", "customer", "The 3 affected machines are in the sales bay — SALES-PC-01, SALES-PC-02, SALES-PC-03. They share a mapped drive to \\\\FILESERVER\\Sales. We've physically disconnected them from the network.", False, 0.5),
    ("DEMO_12", "engineer", "Confirmed ransomware strain: Rhysida variant. Encryption limited to the mapped \\Sales share — local drives are clean. Containment is complete. Identified patient-zero: SALES-PC-01, initial infection via phishing email with macro-enabled DOCX. Beginning recovery from clean backup (48h ago). ETA 2 hours.", False, 4),
    ("DEMO_12", "engineer", "File recovery from backup complete. 847 files restored to the \\Sales share. Running full AV sweep with CrowdStrike on all 3 workstations before reconnecting to network. Also hardening macro policy in M365 to block auto-execution.", False, 6),
    ("DEMO_12", "engineer", "All 3 workstations clean. Network restored. Delivered incident report with IOCs (Indicators of Compromise) and hardening recommendations. Macro policy updated in Intune MDM. Ticket resolved.", False, 8),
    ("DEMO_12", "customer", "Thank you! The incident report is very thorough. We are scheduling security awareness training for the team based on your recommendations.", False, 10),

    # DEMO_13 — Resolved: Domain blacklisted
    ("DEMO_13", "customer", "Confirmed the compromised account was accounts@cloudbridge.in — it sent 4,200 emails between Saturday 11 PM and Sunday 3 AM. We've reset the password and enabled MFA.", False, 1),
    ("DEMO_13", "engineer", "SPF record updated to use -all (hard fail) instead of ~all. DKIM selector 'dkim2024' created and published. DMARC policy set to p=quarantine. Submitted delisting request to Spamhaus and Barracuda with proof of remediation.", False, 6),
    ("DEMO_13", "engineer", "Spamhaus ZEN delisting confirmed (4-6 hours after submission). Barracuda BRBL delisting confirmed. Test emails from cloudbridge.in now land in inbox. DMARC report monitoring configured via Postmaster Tools.", False, 14),
    ("DEMO_13", "customer", "Excellent work! We can confirm emails are being delivered normally. Please also invoice us for the DMARC monitoring setup — happy to pay for that additional work.", False, 16),

    # DEMO_14 — Resolved: Network drive lost
    ("DEMO_14", "customer", "The affected workstations are all running Windows 11 22H2. Group policy for drive mapping is in the 'User Configuration > Preferences > Drive Maps' section.", False, 1),
    ("DEMO_14", "engineer", "KB5034441 breaks SMBv1 NTLM authentication in certain domain configurations. Confirmed the GPO drive maps are using UNC paths with NTLM. Fix: applied 'SMB client require secure negotiate = off' via GPO for the specific OU. Drive maps now persist after reboot on all 15 machines. Tested on 3 workstations, deploying to all 15 via GPO now.", False, 8),
    ("DEMO_14", "customer", "Confirmed — all 15 workstations have their network drives back after reboot. Thank you for the fast turnaround!", False, 10),

    # DEMO_15 — Resolved: Cloud backup failing
    ("DEMO_15", "customer", "The S3 bucket policy change was made by our junior DevOps engineer. The bucket is 'vertex-prod-backups-ap-south-1'. I can share the current bucket policy via secure link.", False, 1),
    ("DEMO_15", "engineer", "Found the issue: the new bucket policy added a condition block 'StringNotEquals: aws:RequestedRegion: ap-south-1' but the backup agent authenticates from us-east-1 (hardcoded in config). The policy is blocking cross-region PutObject calls while returning HTTP 200 (a quirk of S3 conditions + IAM role passthrough). Fixed: updated bucket policy condition to allow the backup agent's IAM role explicitly. Running test backup now.", False, 5),
    ("DEMO_15", "engineer", "Test backup successful: 2.3GB transferred, hash verified. Scheduled backup ran at 2 AM — completed successfully with 47GB transferred. Configured CloudWatch alarm for backup job failures. Delivered root-cause analysis document.", False, 18),
    ("DEMO_15", "customer", "All good — backups are running normally. The CloudWatch alarm is a great addition. We'll implement this across all our backup jobs.", False, 20),
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
            (demo_id, title, service_type, severity, priority,
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
                priority=priority,
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
        t4 = self._dt(days_ago, hours_offset=-24)      # waiting / escalated
        t5 = self._dt(days_ago - 1, hours_offset=4)   # resolved

        # Every ticket: created
        log("created", "", "pending_payment", ticket.customer.user, t0)
        # Payment → open
        log("status_changed", "pending_payment", "open", None, t1, "Payment confirmed via Razorpay.")

        if final_status in ("assigned", "in_progress", "waiting_customer", "resolved"):
            eng_email = engineer.user.email if engineer else ""
            log("assigned", "", eng_email, staff_user, t2)

            if final_status in ("in_progress", "waiting_customer", "resolved"):
                log("status_changed", "assigned", "in_progress", engineer.user if engineer else staff_user, t3)

            if final_status == "waiting_customer":
                log("status_changed", "in_progress", "waiting_customer",
                    engineer.user if engineer else staff_user, t4,
                    "Waiting for customer to provide firewall/config details.")

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
