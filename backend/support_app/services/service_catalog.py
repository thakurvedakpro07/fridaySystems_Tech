"""
ResolveHQ Service Catalog — single source of truth.

Import SERVICE_CHOICES into models.py (Ticket.service_type).
Import RESOLUTION_FEES into payment_service.py.
Import SERVICE_CATALOG into views.py (services_list endpoint).
Import get_resolution_fee() wherever a per-ticket fee breakdown is needed.

Adding or removing a service: edit this file only.
Changing severity surcharges: edit SEVERITY_CONFIG only.
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
    """
    base       = Decimal(str(RESOLUTION_FEES[service_key]))
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
