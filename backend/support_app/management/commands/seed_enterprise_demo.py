"""
Management command: seed_enterprise_demo

Populates the database with enterprise-scale, randomized demo data so
dashboards, analytics, notifications, and reports look investor-demo-ready
instead of the small curated seed_demo_data.py set (15 tickets).

This command is ADDITIVE, not a replacement — seed_demo_data.py stays
exactly as-is for fast, deterministic dev sanity checks. This command
generates volume: dozens of customers/engineers, hundreds-to-thousands of
tickets spread realistically over the last 6 months, plus proportional
comments, activity logs, payments, payouts, notifications, and a Knowledge
Base seeded with articles per category (with a few linked to tickets so
the "Related Articles" ticket-page card has real hits).

All synthetic users use the @entdemo.local email domain — distinct from
seed_demo_data.py's .demo suffix and the @resolvehq.dev system accounts —
so --flush can target exactly (and only) what this command created.

Usage:
    python manage.py seed_enterprise_demo                  # medium scale
    python manage.py seed_enterprise_demo --scale small     # fast, for local iteration
    python manage.py seed_enterprise_demo --scale large     # heavier dataset
    python manage.py seed_enterprise_demo --flush           # wipe entdemo.local data first
    python manage.py seed_enterprise_demo --tickets 300      # override just the ticket count
"""

import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models.signals import post_save, pre_save
from django.utils import timezone

User = get_user_model()

ENT_EMAIL_DOMAIN = "entdemo.local"

# Fixed seed → the generated dataset is reproducible across runs (useful
# for demo rehearsal: the same "story" shows up every time).
RANDOM_SEED = 42

SCALE_PRESETS = {
    "small":  {"customers": 20,  "engineers": 10, "tickets": 150,  "kb_per_category": 3},
    "medium": {"customers": 75,  "engineers": 25, "tickets": 900,  "kb_per_category": 5},
    "large":  {"customers": 150, "engineers": 50, "tickets": 2500, "kb_per_category": 7},
}

# Weighted distributions — tuned to look like a mature support operation:
# mostly resolved/closed history, a believable live queue, a thin pending slice.
STATUS_WEIGHTS = [
    ("pending_payment", 4),
    ("open",             8),
    ("assigned",         8),
    ("in_progress",     14),
    ("resolved",        28),
    ("closed",          38),
]
SEVERITY_WEIGHTS = [("low", 30), ("medium", 40), ("high", 22), ("critical", 8)]

# Recency weighting for created_at: most tickets are recent, a declining tail
# reaching back 6 months — gives trend charts a realistic growth curve.
AGE_BUCKET_WEIGHTS = [
    ((0, 30), 60),
    ((30, 90), 30),
    ((90, 180), 10),
]

# WHY generate skills/titles/KB templates from SERVICE_CATALOG at runtime
# instead of a hardcoded per-key dict (like seed_demo_data.py's DEMO_TICKETS)?
# service_catalog.py is the single source of truth for service categories
# and its key set changes over time (it already has, mid-development, from
# desktop/linux/windows/... to a different set) — a hardcoded dict here
# would silently go stale (KeyError at runtime) every time that file is
# edited. Templating off each service's `name` field is robust to any
# catalog composition.

GENERIC_TITLE_TEMPLATES = [
    "{name} issue reported by {dept} — {count} users affected",
    "{name} service disruption — investigating root cause",
    "Unexpected behavior in {name} after a recent change",
    "{name} performance degraded, affecting the {dept} team",
    "{name} outage impacting {count} users in {dept}",
    "Intermittent {name} failures since {n} days ago",
    "{name} configuration issue blocking {dept} workflows",
]

DEPARTMENTS = ["Finance", "HR", "Sales", "Operations", "IT", "Support", "Engineering", "Procurement"]

GENERIC_KB_TITLE_TEMPLATES = [
    "Troubleshooting guide: {name}",
    "Getting started with {name}",
    "{name} best practices",
    "Common {name} issues and fixes",
    "{name} maintenance checklist",
]

GENERAL_KB_TITLES = [
    "Getting started with ResolveHQ support",
    "How SLA timers work",
    "Understanding ticket severity levels",
]

COMMENT_TEMPLATES = {
    "customer": [
        "Thanks for looking into this — let me know what else you need from our side.",
        "We can provide remote access if that speeds things up.",
        "This is affecting {dept} directly, please prioritize if possible.",
        "Update: the issue is still occurring as of this morning.",
        "Appreciate the quick turnaround on this.",
    ],
    "engineer": [
        "Investigating now — will update shortly with findings.",
        "Root cause identified, applying the fix in a maintenance window.",
        "Fix applied, monitoring for stability over the next few hours.",
        "Confirmed resolved on our end — please verify and let us know.",
        "Escalating internally to get a second opinion on this one.",
    ],
    "staff": [
        "Reassigning to a specialist for faster turnaround.",
        "Confirmed SLA is on track for this ticket.",
        "Following up with the customer for additional diagnostic detail.",
    ],
}

def _weighted_choice(rng, weighted_pairs):
    items = [item for item, _ in weighted_pairs]
    weights = [w for _, w in weighted_pairs]
    return rng.choices(items, weights=weights, k=1)[0]


class Command(BaseCommand):
    help = "Seed enterprise-scale randomized demo data (customers, engineers, tickets, KB, payments, notifications)."

    def add_arguments(self, parser):
        parser.add_argument("--scale", choices=list(SCALE_PRESETS.keys()), default="medium")
        parser.add_argument("--flush", action="store_true", default=False,
                             help="Delete all existing @entdemo.local data before re-seeding.")
        parser.add_argument("--customers", type=int, default=None)
        parser.add_argument("--engineers", type=int, default=None)
        parser.add_argument("--tickets", type=int, default=None)

    def handle(self, *args, **options):
        from support_app import signals as app_signals
        from support_app.models import Ticket
        from support_app.services.service_catalog import SERVICE_CATALOG

        self.rng = random.Random(RANDOM_SEED)
        # Read live from service_catalog.py (the single source of truth for
        # service categories) rather than hardcoding keys here — see the
        # module docstring on GENERIC_TITLE_TEMPLATES for why.
        self.service_catalog = SERVICE_CATALOG

        try:
            from faker import Faker
        except ImportError:
            self.stderr.write(self.style.ERROR(
                "Faker is not installed. Run `pip install -r requirements.txt` first."
            ))
            return
        self.fake = Faker("en_IN")
        Faker.seed(RANDOM_SEED)

        preset = dict(SCALE_PRESETS[options["scale"]])
        if options["customers"]:
            preset["customers"] = options["customers"]
        if options["engineers"]:
            preset["engineers"] = options["engineers"]
        if options["tickets"]:
            preset["tickets"] = options["tickets"]

        if options["flush"]:
            self._flush()

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n=== ResolveHQ Enterprise Demo Seeder (scale={options['scale']}) ===\n"
        ))

        pre_save.disconnect(app_signals.log_ticket_changes, sender=Ticket)
        post_save.disconnect(app_signals.log_ticket_created, sender=Ticket)

        counts = {}
        try:
            customers = self._seed_customers(preset["customers"])
            engineers = self._seed_engineers(preset["engineers"])
            staff_user = self._get_staff_actor()
            kb_articles = self._seed_kb_articles(preset["kb_per_category"], staff_user)
            counts = self._seed_tickets(preset["tickets"], customers, engineers, staff_user, kb_articles)
        finally:
            pre_save.connect(app_signals.log_ticket_changes, sender=Ticket)
            post_save.connect(app_signals.log_ticket_created, sender=Ticket)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Enterprise demo environment ready.\n"))
        self.stdout.write(f"Customers      : {len(customers)}")
        self.stdout.write(f"Engineers      : {len(engineers)}")
        self.stdout.write(f"KB articles    : {len(kb_articles)}")
        self.stdout.write(f"Tickets        : {counts.get('tickets', 0)}")
        self.stdout.write(f"Comments       : {counts.get('comments', 0)}")
        self.stdout.write(f"Activity logs  : {counts.get('activity_logs', 0)}")
        self.stdout.write(f"Payments       : {counts.get('payments', 0)}")
        self.stdout.write(f"Payouts        : {counts.get('payouts', 0)}")
        self.stdout.write(f"Notifications  : {counts.get('notifications', 0)}")
        self.stdout.write(f"KB links       : {counts.get('kb_links', 0)}\n")

    # ── Helpers ───────────────────────────────────────────────────

    def _get_staff_actor(self):
        return User.objects.filter(is_staff=True, role="admin").first()

    def _dt(self, days_ago: float):
        return timezone.now() - timedelta(days=days_ago)

    def _weighted_age_days(self):
        bucket = _weighted_choice(self.rng, AGE_BUCKET_WEIGHTS)
        return self.rng.uniform(*bucket)

    # ── Customers / Engineers ───────────────────────────────────────

    def _seed_customers(self, n):
        from support_app.models import Customer

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding customers…"))
        customers = []
        plans = ["free", "silver", "gold", "platinum"]
        for i in range(n):
            first = self.fake.first_name()
            last = self.fake.last_name()
            email = f"{first.lower()}.{last.lower()}{i}@{ENT_EMAIL_DOMAIN}"
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first, "last_name": last,
                    "role": "customer", "is_active": True, "is_staff": False,
                },
            )
            if created:
                user.set_password("EnterpriseDemo1!")
                user.save()

            profile, _ = Customer.objects.get_or_create(
                user=user,
                defaults={
                    "company": self.fake.company(),
                    "phone": self.fake.phone_number()[:32],
                    "plan": self.rng.choice(plans),
                },
            )
            customers.append(profile)
        self.stdout.write(f"  {self.style.SUCCESS('DONE')}  {len(customers)} customers")
        return customers

    def _seed_engineers(self, n):
        from support_app.models import Freelancer

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding engineers…"))
        engineers = []
        categories = [s["key"] for s in self.service_catalog]
        for i in range(n):
            first = self.fake.first_name()
            last = self.fake.last_name()
            email = f"{first.lower()}.{last.lower()}{i}@engineers.{ENT_EMAIL_DOMAIN}"
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first, "last_name": last,
                    "role": "freelancer", "is_active": True, "is_staff": False,
                },
            )
            if created:
                user.set_password("EnterpriseDemo1!")
                user.save()

            primary_category = self.rng.choice(categories)
            category_name = next(s["name"] for s in self.service_catalog if s["key"] == primary_category)
            skill_tags = [primary_category] + [
                w.strip(",/").lower() for w in category_name.split() if len(w) > 2
            ]
            profile, _ = Freelancer.objects.get_or_create(
                user=user,
                defaults={
                    "skills": ",".join(dict.fromkeys(skill_tags)),  # dedupe, preserve order
                    "availability": self.rng.choice(["full_time", "full_time", "part_time", "ad_hoc"]),
                    "rating": Decimal(str(round(self.rng.uniform(4.2, 5.0), 2))),
                    "onboarding_status": "approved",
                    "active": True,
                },
            )
            profile._primary_category = primary_category  # in-memory only, for assignment matching
            engineers.append(profile)
        self.stdout.write(f"  {self.style.SUCCESS('DONE')}  {len(engineers)} engineers")
        return engineers

    # ── Knowledge Base ───────────────────────────────────────────────

    def _seed_kb_articles(self, per_category, staff_user):
        from support_app.models import KBArticle

        self.stdout.write(self.style.MIGRATE_HEADING("\nSeeding Knowledge Base articles…"))
        articles = []

        categories = [(s["key"], s["name"]) for s in self.service_catalog] + [("general", None)]
        for category, category_name in categories:
            titles = (
                [t.format(name=category_name) for t in GENERIC_KB_TITLE_TEMPLATES]
                if category_name else GENERAL_KB_TITLES
            )
            for i in range(per_category):
                title = titles[i % len(titles)]
                if i >= len(titles):
                    title = f"{title} (Part {i // len(titles) + 1})"
                if KBArticle.objects.filter(title=title, category=category).exists():
                    articles.append(KBArticle.objects.get(title=title, category=category))
                    continue

                status = "draft" if self.rng.random() < 0.1 else "published"
                body = "\n\n".join([
                    f"## Overview\n\n{self.fake.paragraph(nb_sentences=4)}",
                    f"## Steps\n\n" + "\n".join(f"{n}. {self.fake.sentence()}" for n in range(1, 5)),
                    f"## Notes\n\n{self.fake.paragraph(nb_sentences=2)}",
                ])
                article = KBArticle.objects.create(
                    title=title,
                    body=body,
                    category=category,
                    tags=category,
                    status=status,
                    author=staff_user,
                    view_count=self.rng.randint(0, 500),
                )
                articles.append(article)
        self.stdout.write(f"  {self.style.SUCCESS('DONE')}  {len(articles)} articles")
        return articles

    # ── Tickets ───────────────────────────────────────────────────────

    def _seed_tickets(self, n, customers, engineers, staff_user, kb_articles):
        from django.db import transaction
        from support_app.models import (
            KBArticleTicketLink, Notification, Payment, Payout, Ticket,
            TicketActivityLog, TicketAssignment, TicketComment,
        )
        from support_app.services.service_catalog import (
            CONSULTING_FEE, ENGINEER_SHARE, GST_RATE, PLATFORM_SHARE, get_resolution_fee,
        )

        self.stdout.write(self.style.MIGRATE_HEADING("\nSeeding tickets (this may take a minute)…"))

        counts = {"tickets": 0, "comments": 0, "activity_logs": 0,
                  "payments": 0, "payouts": 0, "notifications": 0, "kb_links": 0}
        categories = [s["key"] for s in self.service_catalog]
        category_names = {s["key"]: s["name"] for s in self.service_catalog}
        engineers_by_category = {}
        for eng in engineers:
            engineers_by_category.setdefault(getattr(eng, "_primary_category", None), []).append(eng)

        for i in range(n):
            with transaction.atomic():
                customer = self.rng.choice(customers)
                category = self.rng.choice(categories)
                severity = _weighted_choice(self.rng, SEVERITY_WEIGHTS)
                target_status = _weighted_choice(self.rng, STATUS_WEIGHTS)
                days_ago = self._weighted_age_days()
                created_at = self._dt(days_ago)

                candidate_engineers = engineers_by_category.get(category) or engineers
                engineer = self.rng.choice(candidate_engineers) if target_status not in (
                    "pending_payment", "open") else None

                template = self.rng.choice(GENERIC_TITLE_TEMPLATES)
                title = template.format(
                    name=category_names[category],
                    n=self.rng.randint(1, 20),
                    dept=self.rng.choice(DEPARTMENTS),
                    count=self.rng.randint(2, 40),
                    pct=self.rng.randint(80, 99),
                )
                description = self.fake.paragraph(nb_sentences=self.rng.randint(3, 6))

                resolved_at = None
                if target_status in ("resolved", "closed"):
                    resolved_at = created_at + timedelta(hours=self.rng.uniform(2, 72))

                ticket = Ticket.objects.create(
                    customer=customer,
                    title=title,
                    description=description,
                    service_type=category,
                    severity=severity,
                    status=target_status,
                    assigned_to=engineer,
                    resolved_at=resolved_at,
                )
                Ticket.objects.filter(pk=ticket.pk).update(
                    created_at=created_at,
                    updated_at=resolved_at or created_at,
                )
                counts["tickets"] += 1

                self._seed_ticket_activity(ticket, engineer, staff_user, target_status,
                                            created_at, resolved_at, counts,
                                            TicketActivityLog, TicketAssignment)
                self._seed_ticket_comments(ticket, engineer, staff_user, target_status,
                                            created_at, resolved_at, counts, TicketComment)
                self._seed_ticket_payments(ticket, customer, engineer, target_status, category,
                                            severity, created_at, resolved_at, counts,
                                            Payment, Payout, CONSULTING_FEE, GST_RATE,
                                            ENGINEER_SHARE, PLATFORM_SHARE, get_resolution_fee)
                self._seed_ticket_notifications(ticket, customer, engineer, target_status,
                                                 created_at, counts, Notification)
                self._maybe_link_kb_article(ticket, category, kb_articles, staff_user,
                                             counts, KBArticleTicketLink)

            if (i + 1) % 100 == 0:
                self.stdout.write(f"  … {i + 1}/{n} tickets")

        self.stdout.write(f"  {self.style.SUCCESS('DONE')}  {counts['tickets']} tickets")
        return counts

    def _seed_ticket_activity(self, ticket, engineer, staff_user, target_status,
                               created_at, resolved_at, counts, TicketActivityLog, TicketAssignment):
        entries = []

        def log(action, from_v, to_v, actor, dt, note=""):
            entries.append((TicketActivityLog.objects.create(
                ticket=ticket, actor=actor, action=action,
                from_value=from_v, to_value=to_v, note=note,
            ), dt))

        log("created", "", "pending_payment", ticket.customer.user, created_at)

        if target_status == "pending_payment":
            self._backdate(entries)
            counts["activity_logs"] += len(entries)
            return

        t_open = created_at + timedelta(minutes=self.rng.randint(5, 90))
        log("status_changed", "pending_payment", "open", None, t_open, "Payment confirmed via Razorpay.")

        if target_status == "open":
            self._backdate(entries)
            counts["activity_logs"] += len(entries)
            return

        t_assigned = t_open + timedelta(hours=self.rng.uniform(0.5, 6))
        log("assigned", "", engineer.user.email if engineer else "", staff_user, t_assigned)
        if engineer:
            assignment = TicketAssignment.objects.create(
                ticket=ticket, freelancer=engineer, assigned_by=staff_user, reason="initial",
            )
            TicketAssignment.objects.filter(pk=assignment.pk).update(assigned_at=t_assigned)

        if target_status == "assigned":
            self._backdate(entries)
            counts["activity_logs"] += len(entries)
            return

        t_progress = t_assigned + timedelta(hours=self.rng.uniform(0.25, 4))
        log("status_changed", "assigned", "in_progress",
            engineer.user if engineer else staff_user, t_progress)

        if target_status == "in_progress":
            self._backdate(entries)
            counts["activity_logs"] += len(entries)
            return

        t_resolved = resolved_at or (t_progress + timedelta(hours=self.rng.uniform(1, 24)))
        log("resolved", "in_progress", "resolved",
            engineer.user if engineer else staff_user, t_resolved,
            "Issue identified and resolved.")

        if target_status == "closed":
            t_closed = t_resolved + timedelta(hours=self.rng.uniform(1, 48))
            log("closed", "resolved", "closed", ticket.customer.user, t_closed,
                "Customer confirmed resolution.")

        self._backdate(entries)
        counts["activity_logs"] += len(entries)

    def _backdate(self, entries):
        for entry, dt in entries:
            entry.__class__.objects.filter(pk=entry.pk).update(created_at=dt)

    def _seed_ticket_comments(self, ticket, engineer, staff_user, target_status,
                               created_at, resolved_at, counts, TicketComment):
        if target_status == "pending_payment":
            return

        n_comments = self.rng.randint(1, 4) if target_status != "open" else self.rng.randint(0, 1)
        end_time = resolved_at or timezone.now()
        span_hours = max((end_time - created_at).total_seconds() / 3600, 1)

        for _ in range(n_comments):
            author_type = self.rng.choices(
                ["customer", "engineer", "staff"], weights=[45, 45, 10], k=1
            )[0]
            if author_type == "customer":
                author = ticket.customer.user
                is_internal = False
            elif author_type == "engineer" and engineer:
                author = engineer.user
                is_internal = False
            else:
                if not staff_user:
                    continue
                author = staff_user
                is_internal = self.rng.random() < 0.4

            body = self.rng.choice(COMMENT_TEMPLATES[author_type]).format(
                dept=self.rng.choice(DEPARTMENTS)
            )
            dt = created_at + timedelta(hours=self.rng.uniform(0.1, span_hours))
            comment = TicketComment.objects.create(
                ticket=ticket, author=author, body=body, is_internal=is_internal,
            )
            TicketComment.objects.filter(pk=comment.pk).update(created_at=dt, updated_at=dt)
            counts["comments"] += 1

    def _seed_ticket_payments(self, ticket, customer, engineer, target_status, category, severity,
                               created_at, resolved_at, counts, Payment, Payout,
                               CONSULTING_FEE, GST_RATE, ENGINEER_SHARE, PLATFORM_SHARE, get_resolution_fee):
        if target_status == "pending_payment":
            return

        consulting_amount = Decimal(str(CONSULTING_FEE))
        consulting_gst = (consulting_amount * GST_RATE).quantize(Decimal("0.01"))
        pay_dt = created_at + timedelta(minutes=self.rng.randint(2, 20))
        payment = Payment.objects.create(
            customer=customer, ticket=ticket,
            amount=consulting_amount, gst_amount=consulting_gst, currency="INR",
            invoice_number=f"INV-ENT-{ticket.ticket_number}",
            payment_type="consulting_fee", gateway="razorpay",
            gateway_payment_id=f"pay_ent{ticket.ticket_number[-8:]}",
            gateway_order_id=f"order_ent{ticket.ticket_number[-8:]}",
            status="completed",
        )
        Payment.objects.filter(pk=payment.pk).update(created_at=pay_dt, updated_at=pay_dt)
        counts["payments"] += 1

        if engineer and target_status in ("resolved", "closed"):
            fee = get_resolution_fee(category, severity)
            res_amount = Decimal(str(fee["subtotal"]))
            res_gst = Decimal(str(fee["gst_amount"]))
            res_dt = (resolved_at or created_at) + timedelta(minutes=self.rng.randint(5, 60))
            res_payment = Payment.objects.create(
                customer=customer, ticket=ticket,
                amount=res_amount, gst_amount=res_gst, currency="INR",
                invoice_number=f"INV-ENT-{ticket.ticket_number}-RES",
                payment_type="resolution_fee", gateway="razorpay",
                gateway_payment_id=f"pay_entres{ticket.ticket_number[-8:]}",
                gateway_order_id=f"order_entres{ticket.ticket_number[-8:]}",
                status="completed",
            )
            Payment.objects.filter(pk=res_payment.pk).update(created_at=res_dt, updated_at=res_dt)
            counts["payments"] += 1

            engineer_share = (res_amount * ENGINEER_SHARE).quantize(Decimal("0.01"))
            platform_share = (res_amount * PLATFORM_SHARE).quantize(Decimal("0.01"))
            payout = Payout.objects.create(
                ticket=ticket, freelancer=engineer, payment=res_payment,
                resolution_fee=res_amount,
                severity_surcharge=Decimal(str(fee["severity_surcharge"])),
                engineer_share=engineer_share, platform_share=platform_share,
                status="processed" if target_status == "closed" else "pending",
            )
            Payout.objects.filter(pk=payout.pk).update(created_at=res_dt)
            counts["payouts"] += 1

    def _seed_ticket_notifications(self, ticket, customer, engineer, target_status,
                                    created_at, counts, Notification):
        events = []
        if target_status != "pending_payment":
            events.append((customer.user, "payment_confirmed", "Payment received",
                            f"Your payment for {ticket.ticket_number} was confirmed.",
                            created_at + timedelta(minutes=10)))
        if engineer:
            events.append((engineer.user, "ticket_assigned", "New ticket assigned",
                            f"You've been assigned {ticket.ticket_number}: {ticket.title}",
                            created_at + timedelta(hours=1)))
            events.append((customer.user, "status_changed", "Engineer assigned",
                            f"An engineer has been assigned to {ticket.ticket_number}.",
                            created_at + timedelta(hours=1)))
        if target_status in ("resolved", "closed"):
            events.append((customer.user, "ticket_resolved", "Ticket resolved",
                            f"{ticket.ticket_number} has been marked resolved.",
                            created_at + timedelta(hours=self.rng.uniform(2, 48))))

        for recipient, category, title, body, dt in events:
            notif = Notification.objects.create(
                recipient=recipient, category=category, title=title, body=body, ticket=ticket,
                is_read=self.rng.random() < 0.6,
            )
            Notification.objects.filter(pk=notif.pk).update(created_at=dt)
            counts["notifications"] += 1

    def _maybe_link_kb_article(self, ticket, category, kb_articles, staff_user, counts, KBArticleTicketLink):
        if self.rng.random() > 0.3:
            return
        matches = [a for a in kb_articles if a.category == category and a.status == "published"]
        if not matches:
            return
        article = self.rng.choice(matches)
        _, created = KBArticleTicketLink.objects.get_or_create(
            ticket=ticket, article=article, defaults={"linked_by": staff_user},
        )
        if created:
            counts["kb_links"] += 1

    # ── Flush ─────────────────────────────────────────────────────────

    def _flush(self):
        from support_app.models import Payment, Payout, Ticket

        self.stdout.write(self.style.WARNING("Flushing enterprise demo data…"))

        demo_tickets = Ticket.objects.filter(customer__user__email__endswith=f"@{ENT_EMAIL_DOMAIN}")
        t_count = demo_tickets.count()

        # Deletion order matters here — neither Payout.ticket nor
        # Payment.customer CASCADE (both PROTECT), and Payment.ticket is
        # SET_NULL rather than CASCADE (a Payment must survive its ticket
        # being deleted in the real flow, for invoicing/audit reasons), so
        # Payment rows do NOT disappear when their ticket is deleted. Delete
        # Payout, then Payment, then Ticket, then Users — each step clears
        # the PROTECT reference the next step needs to remove.
        Payout.objects.filter(ticket__in=demo_tickets).delete()
        Payment.objects.filter(customer__user__email__endswith=f"@{ENT_EMAIL_DOMAIN}").delete()
        demo_tickets.delete()
        self.stdout.write(f"  Deleted {t_count} enterprise-demo tickets (+ cascaded logs/comments/assignments)")

        demo_users = User.objects.filter(email__endswith=f"@{ENT_EMAIL_DOMAIN}") | \
            User.objects.filter(email__endswith=f".{ENT_EMAIL_DOMAIN}")
        u_count = demo_users.count()
        demo_users.delete()
        self.stdout.write(f"  Deleted {u_count} enterprise-demo user accounts\n")
