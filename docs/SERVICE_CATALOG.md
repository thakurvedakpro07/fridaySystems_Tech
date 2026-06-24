# Service Catalog

Single source of truth for all approved ResolveHQ service types.
Backend definition: `backend/support_app/services/service_catalog.py`

## Approved Services

| Key        | Name                      | Resolution Fee (₹) | Scope |
|------------|---------------------------|-------------------|-------|
| `desktop`  | Desktop / Laptop Support  | ₹499              | Remote troubleshooting, driver issues, antivirus, connectivity |
| `linux`    | Linux Provisioning        | ₹999              | Server setup, package management, systemd, automation |
| `windows`  | Windows Provisioning      | ₹999              | Windows Server, Active Directory, DNS, DHCP, GPO |
| `patching` | OS Patching               | ₹799              | Managed patching for Windows and Linux nodes |
| `security` | Security Hardening        | ₹1,499            | Baseline CIS hardening, access control, vulnerability remediation |
| `vmware`   | VMware / Hypervisor       | ₹1,299            | ESXi host management, VM provisioning, storage troubleshooting |
| `sap`      | SAP Basis Lite            | ₹1,999            | Transport management, system health checks, user administration, basis tasks |

## Fee Structure

| Fee Type       | Amount  | Notes |
|----------------|---------|-------|
| Consulting Fee | ₹299    | Mandatory upfront; non-refundable; covers review, diagnosis, and engineer assignment |
| Resolution Fee | Variable | Per-service fee above; 65% to engineer, 35% to platform; subject to 18% GST |

## Adding or Modifying Services

Edit only `backend/support_app/services/service_catalog.py`. All other files import from there — do not hardcode service keys or fees elsewhere.

After changing the catalog:
1. Create a Django migration with `RunPython` to remap any affected tickets before altering choices.
2. Update seed data in `backend/support_app/management/commands/seed_demo_data.py`.
3. Update this document.

## Removed Services

| Key            | Removed In  | Remapped To | Reason |
|----------------|-------------|-------------|--------|
| `microsoft365` | 0014        | `desktop`   | Not a core IT infrastructure service; remapped to Desktop support |
