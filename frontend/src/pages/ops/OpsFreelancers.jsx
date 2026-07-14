import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getOpsFreelancers } from "../../api/ops";
import { usePageTitle } from "../../hooks/usePageTitle";
import Alert from "../../components/ui/Alert";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

const AVAIL_OPTIONS = [
  { value: "", label: "All Availability" },
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

const AVAIL_COLORS = {
  available: { dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  busy:      { dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700" },
  offline:   { dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500" },
};

function StarRating({ rating }) {
  const r = Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-3.5 h-3.5 ${s <= r ? "text-amber-400" : "text-slate-200"}`}
             viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {rating != null && (
        <span className="text-xs text-slate-500 ml-1">{Number(rating).toFixed(1)}</span>
      )}
    </div>
  );
}

function SkillTag({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
      {label}
    </span>
  );
}

function AvailabilityBadge({ status }) {
  const s = status?.toLowerCase() ?? "offline";
  const c = AVAIL_COLORS[s] ?? AVAIL_COLORS.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${c.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {s}
    </span>
  );
}

function FreelancerCard({ f, index }) {
  const skills = Array.isArray(f.skills)
    ? f.skills
    : typeof f.skills === "string"
      ? f.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const displaySkills = skills.slice(0, 4);
  const extra = skills.length - displaySkills.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.24 }}
      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4"
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>

      {/* Top row: avatar + name + availability */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center
                          text-white text-sm font-bold shrink-0">
            {(f.name ?? f.user?.email ?? "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{f.name ?? f.user?.email ?? "Engineer"}</p>
            <p className="text-[11px] text-slate-500 truncate">{f.user?.email ?? "—"}</p>
          </div>
        </div>
        <div className="shrink-0">
          <AvailabilityBadge status={f.availability} />
        </div>
      </div>

      {/* Skills */}
      {displaySkills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {displaySkills.map((sk) => <SkillTag key={sk} label={sk} />)}
          {extra > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
              +{extra} more
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">No skills listed</p>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
        <div className="text-center">
          <p className="text-xl font-black text-indigo-600">{f.active_ticket_count ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Active</p>
        </div>
        <div className="text-center border-x border-slate-100">
          <p className="text-xl font-black text-emerald-600">{f.resolved_count ?? f.total_resolved ?? 0}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Resolved</p>
        </div>
        <div className="text-center">
          <div className="flex flex-col items-center">
            <StarRating rating={f.avg_rating ?? f.rating} />
            <p className="text-[10px] text-slate-500 font-medium mt-1">Rating</p>
          </div>
        </div>
      </div>

      {/* Experience level */}
      {f.experience_level && (
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
          </svg>
          <span className="text-[11px] text-slate-500 capitalize">{f.experience_level.replace(/_/g, " ")}</span>
        </div>
      )}
    </motion.div>
  );
}

export default function OpsFreelancers() {
  usePageTitle("Engineers — ResolveHQ Ops");

  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avail, setAvail] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOpsFreelancers({
        availability: params.avail ?? avail,
        skill: params.skillSearch ?? skillSearch,
      });
      setFreelancers(res.data?.results ?? res.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load engineers.");
    } finally {
      setLoading(false);
    }
  }, [avail, skillSearch]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyAvail(val) {
    setAvail(val);
    load({ avail: val, skillSearch });
  }

  function applySkill(val) {
    setSkillSearch(val);
    clearTimeout(window._skillDebounce);
    window._skillDebounce = setTimeout(() => load({ avail, skillSearch: val }), 350);
  }

  const totalActive = freelancers.reduce((s, f) => s + (f.active_ticket_count ?? 0), 0);
  const availCount  = freelancers.filter((f) => (f.availability ?? "").toLowerCase() === "available").length;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <PageHeader title="Engineer Roster" description="Skills, availability, active ticket load, and ratings." />
          {!loading && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-black text-indigo-600">{availCount}</p>
                <p className="text-[11px] text-slate-500 font-medium">Available</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-right">
                <p className="text-2xl font-black text-amber-600">{totalActive}</p>
                <p className="text-[11px] text-slate-500 font-medium">Active Tickets</p>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3"
             style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
          {/* Skill search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={skillSearch}
              onChange={(e) => applySkill(e.target.value)}
              placeholder="Search by skill (e.g. AWS, Kubernetes)…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition" />
          </div>

          {/* Availability filter */}
          <select
            value={avail}
            onChange={(e) => applyAvail(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700
                       focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition min-w-[160px]">
            {AVAIL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {(avail || skillSearch) && (
            <button onClick={() => { setAvail(""); setSkillSearch(""); load({ avail: "", skillSearch: "" }); }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-2 py-1">
              Clear ×
            </button>
          )}
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 h-56 animate-pulse" />
            ))}
          </div>
        ) : freelancers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl"
               style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
            <EmptyState
              size="compact"
              icon={
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
              title="No engineers found"
              description="Try adjusting your filters."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {freelancers.map((f, i) => (
              <FreelancerCard key={f.id} f={f} index={i} />
            ))}
          </div>
        )}

        {!loading && freelancers.length > 0 && (
          <p className="text-xs text-slate-500 text-center">{freelancers.length} engineer{freelancers.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>
    </AppShell>
  );
}
