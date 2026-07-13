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
  { key: "laptop_desktop",  name: "Laptop / Desktop Support",                    baseFee:  499 },
  { key: "server_admin",    name: "Server Administration Support",               baseFee:  999 },
  { key: "aws",             name: "AWS Support",                                 baseFee: 1499 },
  { key: "azure",           name: "Azure Support",                               baseFee: 1499 },
  { key: "kubernetes",      name: "Kubernetes Support",                          baseFee: 1799 },
  { key: "database",        name: "Database Support",                           baseFee: 1299 },
  { key: "devops_cicd",     name: "DevOps CI/CD Support",                        baseFee: 1499 },
  { key: "infra_automation", name: "Infrastructure Platform Automation Support", baseFee: 1799 },
];

export function calcResolutionFee(baseFee, surcharge) {
  const subtotal = baseFee + surcharge;
  const gst      = Math.round(subtotal * GST_RATE);
  return { subtotal, gst, total: subtotal + gst };
}

export function fmtINR(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}
