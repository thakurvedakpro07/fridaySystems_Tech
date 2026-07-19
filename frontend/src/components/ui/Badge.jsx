import LiveDot from "./LiveDot";

// ── Tone → class lookups ───────────────────────────────────────────
// "soft" = bordered bg-*-50 chip (the look TicketDetail.jsx — the reference
// enterprise redesign — already uses). "pill" = solid bg-*-100 rounded-full
// chip (the look most ops/* list pages already use). Both map the same tone
// names to a color, so a domain can pick whichever shape fits its context
// without re-deriving colors.
const TONE_SOFT = {
  slate:   "bg-slate-100 text-slate-600 border-slate-200",
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  indigo:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  violet:  "bg-violet-50 text-violet-700 border-violet-200",
  amber:   "bg-amber-50 text-amber-700 border-amber-200",
  orange:  "bg-orange-50 text-orange-700 border-orange-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose:    "bg-rose-50 text-rose-700 border-rose-200",
  teal:    "bg-teal-50 text-teal-700 border-teal-200",
};

const TONE_PILL = {
  slate:   "bg-slate-100 text-slate-600",
  blue:    "bg-blue-100 text-blue-700",
  indigo:  "bg-indigo-100 text-indigo-700",
  violet:  "bg-violet-100 text-violet-700",
  amber:   "bg-amber-100 text-amber-700",
  orange:  "bg-orange-100 text-orange-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose:    "bg-rose-100 text-rose-700",
  teal:    "bg-teal-100 text-teal-700",
};

const TONE_DOT = {
  slate: "bg-slate-400", blue: "bg-blue-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", amber: "bg-amber-500", orange: "bg-orange-500",
  emerald: "bg-emerald-500", rose: "bg-rose-500", teal: "bg-teal-500",
};

// ── Domains ─────────────────────────────────────────────────────────
// Each domain is a self-contained enum → {tone, label} map so unrelated
// enums (ticket status vs payment status vs role) never fight over the
// same color meaning. `shape`/`dot` are the domain's default presentation,
// overridable per-call via explicit props.
//
// ticketStatus/severity/onboarding preserve the exact colors this component
// already used (the ones the Ticket Detail reference redesign consumes).
// paymentStatus/role/active are newly added here, consolidating what used
// to be 7+ separate local StatusBadge/RolePill implementations — see
// each domain's inline note for which files it replaces and how conflicting
// color choices across those files were resolved.
const DOMAINS = {
  ticketStatus: {
    shape: "soft",
    entries: {
      pending_payment: { tone: "amber",   label: "Pending Payment" },
      open:             { tone: "blue",    label: "Open" },
      assigned:         { tone: "violet",  label: "Ready to Start" },
      in_progress:      { tone: "indigo",  label: "Work Started" },
      resolved:         { tone: "emerald", label: "Resolved" },
      closed:           { tone: "slate",   label: "Closed" },
    },
  },
  severity: {
    shape: "soft",
    entries: {
      low:      { tone: "slate",  label: "Low" },
      medium:   { tone: "amber",  label: "Medium" },
      high:     { tone: "orange", label: "High" },
      critical: { tone: "rose",   label: "Critical" },
    },
  },
  onboarding: {
    shape: "soft",
    entries: {
      pending:   { tone: "amber",   label: "Pending" },
      approved:  { tone: "emerald", label: "Approved" },
      suspended: { tone: "rose",    label: "Suspended" },
    },
  },
  // Replaces: pages/admin/PaymentsDashboard.jsx, pages/ops/OpsPayments.jsx,
  // pages/BillingPage.jsx's local StatusBadge/STATUS_STYLES/STATUS_COLORS.
  // "failed" standardized on rose (2 of 3 sources already agreed; OpsPayments'
  // red-100 was the outlier). "refunded" standardized on violet (majority:
  // PaymentsDashboard + BillingPage agreed; OpsPayments' slate was the outlier).
  paymentStatus: {
    shape: "pill",
    entries: {
      pending:   { tone: "amber",   label: "Pending" },
      completed: { tone: "emerald", label: "Completed" },
      failed:    { tone: "rose",    label: "Failed" },
      refunded:  { tone: "violet",  label: "Refunded" },
    },
  },
  // Replaces: pages/ops/OpsRoles.jsx and pages/ops/OpsUsers.jsx's identical
  // ROLE_COLORS/ROLE_DISPLAY maps (previously duplicated verbatim).
  role: {
    shape: "pill",
    entries: {
      customer:           { tone: "slate",  label: "Customer" },
      freelancer:          { tone: "indigo", label: "Engineer" },
      admin:               { tone: "violet", label: "Super Admin" },
      operations_manager:  { tone: "amber",  label: "Operations Manager" },
      finance_manager:     { tone: "teal",   label: "Finance Manager" },
      support_agent:       { tone: "orange", label: "Support Agent" },
    },
  },
  // Replaces: pages/ops/OpsServices.jsx's active/inactive StatusBadge and
  // pages/ops/OpsUsers.jsx's isActive StatusBadge (inverted prop, same shape).
  // "inactive" standardized on rose (OpsUsers' convention) rather than
  // OpsServices' slate, matching the common enterprise pattern of rose for
  // "disabled/off" toggles.
  active: {
    shape: "pill",
    dot: true,
    entries: {
      active:   { tone: "emerald", label: "Active" },
      inactive: { tone: "rose",    label: "Inactive" },
    },
  },
  // System Audit Log (pages/ops/OpsAuditLog.jsx) — one entry per AuditLog.action
  // value written by services/audit_service.py::log_action(). Destructive/negative
  // actions (deactivated, disabled, refunded) get rose; positive/neutral ones
  // get emerald/indigo/amber, mirroring the tone conventions above.
  auditAction: {
    shape: "soft",
    entries: {
      user_deactivated:  { tone: "rose",    label: "User Deactivated" },
      user_reactivated:  { tone: "emerald", label: "User Reactivated" },
      service_created:   { tone: "indigo",  label: "Service Created" },
      service_updated:   { tone: "amber",   label: "Service Updated" },
      service_enabled:   { tone: "emerald", label: "Service Enabled" },
      service_disabled:  { tone: "rose",    label: "Service Disabled" },
      payment_confirmed: { tone: "emerald", label: "Payment Confirmed" },
      payment_refunded:  { tone: "violet",  label: "Payment Refunded" },
      sla_policy_created: { tone: "indigo", label: "SLA Policy Created" },
      sla_policy_updated: { tone: "amber",  label: "SLA Policy Updated" },
      sla_policy_deleted: { tone: "rose",   label: "SLA Policy Deleted" },
    },
  },
  // System Audit Log's "Entity" column — matches the `entity` value passed to log_action().
  auditEntity: {
    shape: "pill",
    entries: {
      user:    { tone: "slate",  label: "User" },
      service: { tone: "indigo", label: "Service" },
      payment: { tone: "teal",   label: "Payment" },
      sla_policy: { tone: "violet", label: "SLA Policy" },
    },
  },
};

const SIZES = {
  soft: { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-sm" },
  pill: { sm: "px-2.5 py-0.5 text-[11px]", md: "px-3 py-1 text-xs" },
};

export default function Badge({
  label,
  domain,
  tone,
  shape,
  dot = false,
  pulse = false,
  size = "sm",
  capitalize = false,
  className = "",
}) {
  if (!label) return null;

  const domainConfig = domain ? DOMAINS[domain] : null;
  const entry = domainConfig?.entries?.[label];

  const resolvedTone = tone ?? entry?.tone ?? "slate";
  const resolvedShape = shape ?? domainConfig?.shape ?? "soft";
  const resolvedDot = dot || (domainConfig?.dot ?? false);
  const display = entry?.label ?? (domainConfig ? String(label).replaceAll("_", " ") : label);

  const toneClasses = (resolvedShape === "pill" ? TONE_PILL : TONE_SOFT)[resolvedTone] ?? TONE_SOFT.slate;
  const sizeClasses = SIZES[resolvedShape][size] ?? SIZES[resolvedShape].sm;
  const shapeClasses = resolvedShape === "pill" ? "rounded-full" : "rounded-md border";
  const capitalizeClass = capitalize ? "capitalize" : "";

  return (
    <span
      data-ds="badge"
      className={`inline-flex items-center gap-1.5 font-semibold shrink-0 ${shapeClasses} ${toneClasses} ${sizeClasses} ${capitalizeClass} ${className}`}
    >
      {pulse ? (
        <LiveDot tone={resolvedTone} size="xs" />
      ) : (
        resolvedDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[resolvedTone] ?? TONE_DOT.slate}`} />
      )}
      {display}
    </span>
  );
}
