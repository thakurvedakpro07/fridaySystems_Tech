"""
ResolveHQ Service Catalog — severity/pricing constants, plus a LEGACY
service list.

As of the Admin Portal audit's Phase 3 (Service Catalog Management), the
customer-facing catalog — what services exist, their price, and whether
they're currently orderable — is no longer this hardcoded SERVICE_CATALOG
list. It's the `Service` Django model (support_app/models.py), managed via
Operations → Services or the /api/ops/services/ REST API, so admins can
add/edit/archive/mark-unavailable services without a code change or deploy.

SERVICE_CATALOG/SERVICE_CHOICES/RESOLUTION_FEES below are kept ONLY as a
static fallback for two things that are intentionally out of this phase's
scope and still expect a fixed, code-defined taxonomy:
  - KBArticle.category choices (models.py) and GET /api/kb/categories/
  - Executive Analytics / Operations Command Center label lookups
    (services/executive_analytics_service.py, ops_command_center_service.py)
Do NOT add a new entry here expecting it to appear as an orderable service —
use the Service model for that. This list only needs to change if you want
a new Knowledge Base category or analytics label.

get_resolution_fee() now reads the base fee from the live `Service` row
(see below) — SEVERITY_CONFIG/GST_RATE/CONSULTING_FEE are unchanged.
"""
from decimal import Decimal, ROUND_HALF_UP

# ── Flat upfront fee ──────────────────────────────────────────────
CONSULTING_FEE = 299  # ₹299, always applied regardless of service or severity

# ── Platform split ────────────────────────────────────────────────
ENGINEER_SHARE = Decimal("0.65")   # 65% of pre-GST resolution fee
PLATFORM_SHARE = Decimal("0.35")   # 35% of pre-GST resolution fee

# ── GST ───────────────────────────────────────────────────────────
GST_RATE = Decimal("0.18")          # 18%

# ── Severity configuration ────────────────────────────────────────
# surcharge: added to base resolution fee (₹) for faster SLAs
# response_sla_hours: target for first engineer response
# resolution_sla_hours: target for full resolution
SEVERITY_CONFIG = {
    "low": {
        "surcharge":              0,
        "response_sla_hours":     8,
        "resolution_sla_hours":  48,
        "label":                 "Low",
    },
    "medium": {
        "surcharge":            200,
        "response_sla_hours":    4,
        "resolution_sla_hours": 24,
        "label":               "Medium",
    },
    "high": {
        "surcharge":            500,
        "response_sla_hours":    2,
        "resolution_sla_hours":  8,
        "label":               "High",
    },
    "critical": {
        "surcharge":           1000,
        "response_sla_hours":    1,
        "resolution_sla_hours":  4,
        "label":              "Critical",
    },
}

# ── Service catalog ───────────────────────────────────────────────
SERVICE_CATALOG = [
    {
        "key":            "laptop_desktop",
        "name":           "Laptop / Desktop Support",
        "resolution_fee": 499,
        "scope":          "Business endpoint support including Windows, macOS, Linux desktops, laptops, software installation, troubleshooting, hardware diagnostics and end-user support",
    },
    {
        "key":            "server_admin",
        "name":           "Server Administration Support",
        "resolution_fee": 999,
        "scope":          "Windows Server and Linux Server administration including Active Directory, patching, monitoring, storage, virtualization and server maintenance",
    },
    {
        "key":            "aws",
        "name":           "AWS Support",
        "resolution_fee": 1499,
        "scope":          "Amazon Web Services administration including EC2, VPC, IAM, S3, RDS, CloudWatch, Load Balancers and related cloud services",
    },
    {
        "key":            "azure",
        "name":           "Azure Support",
        "resolution_fee": 1499,
        "scope":          "Microsoft Azure administration including Virtual Machines, Azure AD, Networking, Storage, Resource Groups, Monitoring and Identity",
    },
    {
        "key":            "kubernetes",
        "name":           "Kubernetes Support",
        "resolution_fee": 1799,
        "scope":          "Container orchestration, cluster management, deployments, scaling, ingress, troubleshooting and Kubernetes platform operations",
    },
    {
        "key":            "database",
        "name":           "Database Support",
        "resolution_fee": 1299,
        "scope":          "Administration, monitoring, backup, tuning and troubleshooting for PostgreSQL, MySQL, SQL Server, MongoDB and similar databases",
    },
    {
        "key":            "devops_cicd",
        "name":           "DevOps CI/CD Support",
        "resolution_fee": 1499,
        "scope":          "GitHub Actions, GitLab CI, Jenkins, Docker pipelines, deployments, release automation, infrastructure delivery and CI/CD troubleshooting",
    },
    {
        "key":            "infra_automation",
        "name":           "Infrastructure Platform Automation Support",
        "resolution_fee": 1799,
        "scope":          "Infrastructure as Code, automation and configuration management including Terraform, Ansible, scripting, provisioning and platform automation",
    },
]

SERVICE_CHOICES = [(s["key"], s["name"]) for s in SERVICE_CATALOG]
RESOLUTION_FEES = {s["key"]: s["resolution_fee"] for s in SERVICE_CATALOG}


def get_resolution_fee(service_key: str, severity: str) -> dict:
    """
    Calculate the complete resolution fee breakdown for a ticket.

    Returns a dict ready for the frontend invoice panel:
      base_fee          — base resolution fee for this service
      severity_surcharge — additional charge for the chosen severity tier
      subtotal          — base_fee + severity_surcharge (pre-GST)
      gst_amount        — 18% of subtotal, rounded to nearest rupee
      total             — subtotal + gst_amount (what customer pays)

    Example:
      Server Administration Support (₹999) + High (₹500) = subtotal ₹1499
      GST 18% = ₹270  →  total ₹1769

    base_fee is read from the live Service row (Service.resolution_fee) —
    falls back to the legacy RESOLUTION_FEES dict if no Service with this
    key exists, OR if the DB can't be reached at all (this function was
    historically pure/DB-free, and some callers — e.g. invoice PDF
    generation's tests — still call it in contexts with no database access;
    falling back keeps that contract rather than raising a DB-access error
    from what looks like a simple pricing calculation).
    Raises KeyError if the key is unknown to the fallback dict too, matching
    this function's pre-existing behavior of raising on an invalid
    service_key rather than silently returning a zero fee.
    """
    from ..models import Service
    try:
        base = Decimal(str(Service.objects.get(key=service_key).resolution_fee))
    except Exception:
        base = Decimal(str(RESOLUTION_FEES[service_key]))
    surcharge  = Decimal(str(SEVERITY_CONFIG[severity]["surcharge"]))
    subtotal   = base + surcharge
    gst        = (subtotal * GST_RATE).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    total      = subtotal + gst
    return {
        "base_fee":           int(base),
        "severity_surcharge": int(surcharge),
        "subtotal":           int(subtotal),
        "gst_amount":         int(gst),
        "total":              int(total),
    }
