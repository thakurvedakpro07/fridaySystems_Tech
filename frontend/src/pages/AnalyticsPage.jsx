import { useEffect, useState } from "react";
import { getAnalytics } from "../api/analytics";
import MainLayout from "../components/layouts/MainLayout";
import { SkeletonCard } from "../components/ui/Spinner";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuthStore } from "../store/authStore";

// ── Mini chart components (no external library) ───────────────────

function BarChart({ data, color = "#4f46e5" }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <span className="text-[10px] text-slate-400 font-medium">{d.count || ""}</span>
          <div
            className="w-full rounded-t-sm transition-all duration-500"
            style={{
              height: `${Math.max((d.count / max) * 96, d.count ? 4 : 2)}px`,
              backgroundColor: d.count ? color : "#e2e8f0",
            }}
          />
          <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p className="text-sm text-slate-400 text-center py-6">No data yet</p>;

  let offset = 0;
  const r = 40;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
        {segments.map((seg, i) => {
          const pct    = seg.value / total;
          const dash   = pct * circ;
          const gap    = circ - dash;
          const stroke = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-stroke}
            />
          );
        })}
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-600">{seg.label}</span>
            <span className="font-semibold text-slate-900 ml-auto pl-4">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = "indigo", icon }) {
  const colors = {
    indigo:  { text: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100"  },
    emerald: { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    amber:   { text: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100"   },
    violet:  { text: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-100"  },
    rose:    { text: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100"    },
  };
  const { text, bg, border } = colors[color] ?? colors.indigo;
  return (
    <div
      className={`bg-white border ${border} rounded-2xl px-5 py-4 flex items-start justify-between gap-3
                 hover:-translate-y-0.5 transition-all duration-200`}
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
    >
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        <p className={`text-3xl font-bold animate-fade-in leading-none ${text}`}>{value ?? "—"}</p>
        {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
      </div>
      {icon && (
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${bg}`}>
          {icon}
        </span>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-5"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
    >
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

const SERVICE_LABELS = {
  desktop:      "Desktop",
  linux:        "Linux",
  windows:      "Windows",
  patching:     "Patching",
  security:     "Security",
  vmware:       "VMware",
  sap:          "SAP",
};

const SEVERITY_COLORS = {
  low:      "#10b981",
  medium:   "#f59e0b",
  high:     "#f97316",
  critical: "#ef4444",
};

const SEVERITY_LABELS = {
  low:      "Low",
  medium:   "Medium",
  high:     "High",
  critical: "Critical",
};

export default function AnalyticsPage() {
  usePageTitle("Analytics");
  const user = useAuthStore((s) => s.user);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    getAnalytics()
      .then(({ data: d }) => setData(d))
      .catch(() => setError("Could not load analytics. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = user?.is_staff;
  const pageTitle = isAdmin ? "Analytics Overview" : "My Ticket Analytics";

  if (loading) {
    return (
      <MainLayout maxWidth="max-w-5xl">
        <div className="mb-6">
          <div className="h-6 w-48 shimmer rounded-full mb-2" />
          <div className="h-4 w-64 shimmer rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map((n) => <SkeletonCard key={n} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1,2].map((n) => <SkeletonCard key={n} />)}
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout maxWidth="max-w-5xl">
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700
                        text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      </MainLayout>
    );
  }

  const donutSegments = [
    { label: "Open",        value: data.open,        color: "#f59e0b" },
    { label: "In Progress", value: data.in_progress, color: "#8b5cf6" },
    { label: "Resolved",    value: data.resolved,    color: "#10b981" },
    { label: "Pending",     value: data.pending_payment, color: "#94a3b8" },
  ].filter((s) => s.value > 0);

  const serviceMax = Math.max(...(data.service_breakdown?.map((s) => s.n) ?? [1]), 1);

  return (
    <MainLayout maxWidth="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Last updated just now · {data.total} total ticket{data.total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Tickets"    value={data.total}       color="indigo"  icon="🎫" />
        <StatCard label="Open"             value={data.open}        color="amber"   icon="📬" />
        <StatCard label="In Progress"      value={data.in_progress} color="violet"  icon="⚡" />
        <StatCard label="Resolved"         value={data.resolved}    color="emerald" icon="✅" />
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Avg Resolution"
          value={data.avg_resolution_hours != null ? `${data.avg_resolution_hours}h` : "—"}
          color="violet"
          icon="⏱️"
          sub="average hours to resolve"
        />
        {data.csat_avg != null && (
          <StatCard
            label="CSAT Score"
            value={`${data.csat_avg}/5`}
            color="emerald"
            icon="⭐"
            sub={`${data.csat_count} rating${data.csat_count !== 1 ? "s" : ""} received`}
          />
        )}
        <StatCard
          label="Pending Payment"
          value={data.pending_payment}
          color="amber"
          icon="💳"
          sub="awaiting payment confirmation"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Tickets over time */}
        <Card title="Tickets Created — Last 30 Days">
          {data.timeline && data.timeline.some((t) => t.count > 0) ? (
            <BarChart data={data.timeline} color="#4f46e5" />
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No tickets in the last 30 days</p>
          )}
        </Card>

        {/* Status donut */}
        <Card title="Ticket Status Breakdown">
          <DonutChart segments={donutSegments} />
        </Card>
      </div>

      {/* Service + Severity breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {data.service_breakdown?.length > 0 && (
          <Card title="Top Services">
            <div className="space-y-3">
              {data.service_breakdown.map((s) => (
                <div key={s.service_type} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 shrink-0">
                    {SERVICE_LABELS[s.service_type] ?? s.service_type}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${(s.n / serviceMax) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-6 text-right">{s.n}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.severity_breakdown?.length > 0 && (
          <Card title="Tickets by Severity">
            <DonutChart
              segments={data.severity_breakdown.map((s) => ({
                label: SEVERITY_LABELS[s.severity] ?? s.severity,
                value: s.n,
                color: SEVERITY_COLORS[s.severity] ?? "#94a3b8",
              }))}
            />
          </Card>
        )}
      </div>

      {/* Revenue by severity (admin only) */}
      {isAdmin && data.severity_revenue?.length > 0 && (
        <div className="mb-5">
          <Card title="Revenue by Severity (Resolution Fees)">
            <div className="space-y-3">
              {data.severity_revenue.map((s) => {
                const maxRev = Math.max(...data.severity_revenue.map((x) => x.revenue), 1);
                return (
                  <div key={s.severity} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-16 shrink-0"
                          style={{ color: SEVERITY_COLORS[s.severity] ?? "#64748b" }}>
                      {SEVERITY_LABELS[s.severity] ?? s.severity}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(s.revenue / maxRev) * 100}%`,
                          backgroundColor: SEVERITY_COLORS[s.severity] ?? "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-20 text-right">
                      ₹{Math.round(s.revenue).toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Admin-only freelancer performance */}
      {isAdmin && data.freelancer_stats?.length > 0 && (
        <div className="mt-5">
          <Card title="Engineer Performance (Top 5)">
            <div className="divide-y divide-slate-100">
              {data.freelancer_stats.map((fl, i) => {
                const first = (fl.first_name ?? "").trim();
                const last  = (fl.last_name  ?? "").trim();
                const displayName = first && last ? `${first} ${last}` : first || fl.email;
                return (
                  <div key={fl.email} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{displayName}</p>
                      <p className="text-xs text-slate-400">{fl.assigned} assigned · {fl.resolved} resolved</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-amber-500">★ {fl.rating}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}
