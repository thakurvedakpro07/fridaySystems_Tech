// Mirrors backend/support_app/services/service_catalog.py
// Update this file whenever backend pricing constants change.

export const CONSULTING_FEE = 299;
export const GST_RATE       = 0.18;

export const SEVERITY_TIERS = [
  { key: "low",      label: "Low",      surcharge:    0, slaResponse: "8h",  slaResolution: "48h", desc: "Minor issue, no urgency" },
  { key: "medium",   label: "Medium",   surcharge:  200, slaResponse: "4h",  slaResolution: "24h", desc: "Service degraded" },
  { key: "high",     label: "High",     surcharge:  500, slaResponse: "2h",  slaResolution: "8h",  desc: "Service down" },
  { key: "critical", label: "Critical", surcharge: 1000, slaResponse: "1h",  slaResolution: "4h",  desc: "Production outage" },
];

export const SERVICE_FEES = [
  { key: "desktop",  name: "Desktop / Laptop Support", baseFee:  499 },
  { key: "linux",    name: "Linux Provisioning",        baseFee:  999 },
  { key: "windows",  name: "Windows Provisioning",      baseFee:  999 },
  { key: "patching", name: "OS Patching",               baseFee:  799 },
  { key: "security", name: "Security Hardening",        baseFee: 1499 },
  { key: "vmware",   name: "VMware / Hypervisor",       baseFee: 1299 },
  { key: "sap",      name: "SAP Basis Lite",            baseFee: 1999 },
];

export function calcResolutionFee(baseFee, surcharge) {
  const subtotal = baseFee + surcharge;
  const gst      = Math.round(subtotal * GST_RATE);
  return { subtotal, gst, total: subtotal + gst };
}

export function fmtINR(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}
