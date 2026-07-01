// Mirrors backend/support_app/services/service_catalog.py
// Update this file whenever backend pricing constants change.

export const CONSULTING_FEE = 299;
export const GST_RATE       = 0.18;

// consultationResponse = how quickly a Support Agent contacts the customer for the initial consultation.
// Severity does NOT guarantee resolution speed — completion time depends on issue complexity.
export const SEVERITY_TIERS = [
  { key: "low",      label: "Low",      surcharge:    0, consultationResponse: "4h",   desc: "Non-urgent — can wait" },
  { key: "medium",   label: "Medium",   surcharge:  200, consultationResponse: "2h",   desc: "Work affected" },
  { key: "high",     label: "High",     surcharge:  500, consultationResponse: "1h",   desc: "System down, blocking work" },
  { key: "critical", label: "Critical", surcharge: 1000, consultationResponse: "30m",  desc: "Complete outage" },
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
