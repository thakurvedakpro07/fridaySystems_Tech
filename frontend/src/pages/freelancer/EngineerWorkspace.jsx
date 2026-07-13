import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { freelancerListActiveTickets, freelancerListTickets } from "../../api/tickets";
import { getAnalytics } from "../../api/analytics";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import Alert from "../../components/ui/Alert";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import KpiRow from "../../components/dashboard/KpiRow";
import { SkeletonCard } from "../../components/ui/Spinner";
import SearchInput from "../../components/filters/SearchInput";
import QuickViews from "../../components/filters/QuickViews";
import Pagination from "../../components/table/Pagination";
import TicketSectionList from "../../components/tickets/queue/TicketSectionList";
import EngineerBulkStatusModal from "../../components/tickets/queue/EngineerBulkStatusModal";
import AIDailyBriefCard from "../../components/dashboard/AIDailyBriefCard";
import WorkloadSummaryPanel from "../../components/dashboard/WorkloadSummaryPanel";
import { useAuthStore } from "../../store/authStore";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useSelection } from "../../hooks/useSelection";
import { useToast } from "../../context/ToastContext";
import { getDisplayName } from "../../utils/displayName";
import { CONTACT } from "../../config/contact";
import { bucketAndSortTickets, QUICK_VIEWS } from "../../utils/ticketPriority";
import { buildDailyBrief } from "../../utils/dailyBrief";

const CLOSED_PAGE_SIZE = 20;

function salutation(name) {
  const h = new Date().getHours();
  const base = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}` : base;
}

const SECTION_DEFS = [
  {
    key: "requiresImmediateAttention",
    header: "Requires Immediate Attention",
    description: "Overdue, at SLA risk, or critical tickets waiting on you.",
    emptyMessage: "Nothing urgent right now.",
  },
  {
    key: "waitingOnInternal",
    header: "Waiting on Internal Team",
    description: "Escalated tickets with no activity since.",
    emptyMessage: "No tickets waiting on the internal team.",
  },
  {
    key: "todaysWork",
    header: "Today's Work",
    description: "Everything else that needs active attention.",
    emptyMessage: "No tickets in today's work queue.",
  },
  {
    key: "waitingOnCustomer",
    header: "Waiting on Customer",
    description: "You replied last — the ball is in the customer's court.",
    emptyMessage: "No tickets waiting on a customer reply.",
  },
  {
    key: "readyToResolve",
    header: "Ready to Resolve",
    description: "You replied, nothing's blocking, and it's been quiet.",
    emptyMessage: "No tickets look ready to resolve yet.",
  },
  {
    key: "recentlyUpdated",
    header: "Recently Updated",
    description: "Freshest activity across all your active tickets.",
    emptyMessage: "No recent activity.",
    selectable: false,
  },
];

const REASON_BY_SECTION = {
  requiresImmediateAttention: (t) => (t.sla_status === "overdue" ? "SLA overdue" : t.sla_status === "due_soon" ? "SLA due soon" : "Critical + awaiting your reply"),
  waitingOnInternal: () => "Escalated",
  waitingOnCustomer: () => "Awaiting customer reply",
  readyToResolve: () => "Quiet since your last reply",
};

export default function EngineerWorkspace() {
  usePageTitle("Engineer Workspace");
  const user = useAuthStore((s) => s.user);
  const addToast = useToast();

  // ── Active tickets (fetched once, bucketed/sorted client-side) ──────
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [quickView, setQuickView] = useState("all");
  const [newAssignmentBanner, setNewAssignmentBanner] = useState(false);
  const prevCountRef = useRef(null);

  // ── Stats (Productivity KPIs) ────────────────────────────────────────
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0, csatAvg: null, avgHours: null });
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Recently Closed (separate, server-paginated) ─────────────────────
  const [closedTickets, setClosedTickets] = useState([]);
  const [closedLoading, setClosedLoading] = useState(true);
  const [closedPage, setClosedPage] = useState(1);
  const [closedPageSize, setClosedPageSize] = useState(CLOSED_PAGE_SIZE);
  const [closedCount, setClosedCount] = useState(0);
  const [closedNext, setClosedNext] = useState(null);
  const [closedPrevious, setClosedPrevious] = useState(null);

  // ── Bulk actions ──────────────────────────────────────────────────────
  const selection = useSelection();
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  useEffect(() => {
    getAnalytics()
      .then(({ data }) => setStats({
        total: data.total,
        active: data.in_progress,
        resolved: data.resolved,
        csatAvg: data.csat_avg,
        avgHours: data.avg_resolution_hours,
      }))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const loadActiveTickets = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    return freelancerListActiveTickets()
      .then(({ data }) => {
        const list = data.results ?? data;
        const currentCount = data.count ?? list.length;
        if (prevCountRef.current !== null && currentCount > prevCountRef.current) {
          setNewAssignmentBanner(true);
        }
        prevCountRef.current = currentCount;
        setTickets(list);
        setCount(currentCount);
      })
      .catch(() => { if (!silent) setError("Could not load tickets. Please refresh."); })
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => { loadActiveTickets(); }, [loadActiveTickets]);

  // Poll every 30s for new assignments, matching the prior dashboard's behavior.
  useEffect(() => {
    const id = setInterval(() => loadActiveTickets(true), 30_000);
    return () => clearInterval(id);
  }, [loadActiveTickets]);

  const loadClosedTickets = useCallback((page, pageSize) => {
    setClosedLoading(true);
    return freelancerListTickets({ status: "closed", page, page_size: pageSize })
      .then(({ data }) => {
        setClosedTickets(data.results ?? data);
        setClosedCount(data.count ?? 0);
        setClosedNext(data.next ?? null);
        setClosedPrevious(data.previous ?? null);
      })
      .catch(() => {})
      .finally(() => setClosedLoading(false));
  }, []);

  useEffect(() => { loadClosedTickets(closedPage, closedPageSize); }, [closedPage, closedPageSize, loadClosedTickets]);

  // ── Search + Quick Filters (client-side, no new requests) ────────────
  const activeQuickView = QUICK_VIEWS.find((v) => v.key === quickView) ?? QUICK_VIEWS[0];
  const filteredTickets = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return tickets.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.ticket_number.toLowerCase().includes(q)) return false;
      return activeQuickView.predicate(t);
    });
  }, [tickets, searchInput, activeQuickView]);

  const buckets = useMemo(() => bucketAndSortTickets(filteredTickets), [filteredTickets]);
  const brief = useMemo(() => buildDailyBrief(buckets), [buckets]);

  const name = getDisplayName(user);

  const visibleIds = useMemo(() => filteredTickets.map((t) => t.id), [filteredTickets]);

  function afterBulkAction({ succeeded, failed }) {
    setBulkStatusOpen(false);
    selection.clear();
    if (failed === 0) {
      addToast(`Updated status for ${succeeded} ticket${succeeded !== 1 ? "s" : ""}.`, "success");
    } else if (succeeded === 0) {
      addToast(`Failed to update ${failed} ticket${failed !== 1 ? "s" : ""}. Please try again.`, "error");
    } else {
      addToast(`Updated ${succeeded} ticket${succeeded !== 1 ? "s" : ""}; ${failed} failed.`, "warning");
    }
    loadActiveTickets();
  }

  return (
    <AppShell>
      {/* ── New assignment banner ─────────────────────────────── */}
      {newAssignmentBanner && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-indigo-600 text-white text-sm font-medium
                        rounded-2xl px-5 py-3.5 shadow-md animate-fade-in">
          <div className="flex items-center gap-2.5">New ticket assigned to you!</div>
          <button
            onClick={() => setNewAssignmentBanner(false)}
            className="shrink-0 hover:opacity-75 transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Greeting ─────────────────────────────────────────── */}
      <div className="mb-8">
        <PageHeader
          title={salutation(name)}
          description={!loading ? `You have ${count} active ticket${count !== 1 ? "s" : ""}.` : "Loading your workspace…"}
        />
      </div>

      {/* ── Productivity KPIs ──────────────────────────────────── */}
      <KpiRow
        className="mb-6"
        items={[
          { label: "Total Assigned", value: stats.total, sub: "all time", color: "indigo", loading: statsLoading },
          { label: "Work Started", value: stats.active, sub: "actively working", color: "violet", loading: statsLoading },
          { label: "Resolved", value: stats.resolved, sub: "successfully closed", color: "emerald", loading: statsLoading },
          {
            label: "Avg Resolution",
            value: stats.avgHours != null ? `${stats.avgHours}h` : null,
            sub: "hours to close",
            color: "amber",
            loading: statsLoading,
          },
        ]}
      />

      {/* ── Search + Quick Filters ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search tickets…" />
        <QuickViews views={QUICK_VIEWS} activeKey={quickView} onSelect={(v) => setQuickView(v.key)} />
      </div>

      {error && <Alert severity="error" className="mb-6">{error}</Alert>}

      {/* ── Bulk action bar ────────────────────────────────────── */}
      {selection.count > 0 && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 mb-6">
          <p className="text-sm font-semibold text-indigo-900">
            Selected: {selection.count} ticket{selection.count !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={() => setBulkStatusOpen(true)} size="sm">Update Status</Button>
            <button
              onClick={() => selection.clear()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 transition-colors"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
        {/* ── Left: triage sections ──────────────────────────── */}
        <div className="min-w-0 space-y-6">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
            </div>
          ) : (
            <>
              {SECTION_DEFS.map((section) => {
                const sectionTickets = buckets[section.key];
                if (section.key === "recentlyUpdated" && sectionTickets.length === 0) return null;
                return (
                  <Card key={section.key} header={section.header} description={section.description}>
                    <TicketSectionList
                      tickets={sectionTickets}
                      emptyMessage={section.emptyMessage}
                      selectable={section.selectable !== false}
                      selectedIds={selection.selected}
                      onToggle={selection.toggle}
                      reasonFor={REASON_BY_SECTION[section.key]}
                    />
                  </Card>
                );
              })}

              {/* ── Recently Closed (separately paginated) ─────── */}
              <Card header="Recently Closed" description="Closed tickets, most recent first.">
                {closedLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2].map((n) => <SkeletonCard key={n} />)}
                  </div>
                ) : (
                  <>
                    <TicketSectionList tickets={closedTickets} emptyMessage="No closed tickets yet." selectable={false} />
                    <div className="mt-4">
                      <Pagination
                        page={closedPage}
                        pageSize={closedPageSize}
                        count={closedCount}
                        hasPrevious={Boolean(closedPrevious)}
                        hasNext={Boolean(closedNext)}
                        loading={closedLoading}
                        onPageChange={setClosedPage}
                        onPageSizeChange={(e) => { setClosedPageSize(Number(e.target.value)); setClosedPage(1); }}
                      />
                    </div>
                  </>
                )}
              </Card>
            </>
          )}
        </div>

        {/* ── Right: AI brief + workload + CSAT + support ───────── */}
        <div className="shrink-0 space-y-4">
          {!loading && <AIDailyBriefCard brief={brief} />}
          {!loading && <WorkloadSummaryPanel tickets={filteredTickets} />}

          <Card title="Your CSAT Score">
            {statsLoading ? (
              <div className="h-8 w-24 shimmer rounded-lg" />
            ) : stats.csatAvg != null ? (
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-amber-500 leading-none">{stats.csatAvg}</span>
                <span className="text-sm text-slate-500 mb-1 font-medium">/ 5.0</span>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No ratings yet</p>
            )}
          </Card>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-3">Support</p>
            <a
              href={CONTACT.supportMailto}
              className="flex items-center gap-2 text-xs font-medium text-slate-700 hover:text-indigo-600 transition-colors"
            >
              {CONTACT.supportEmail}
            </a>
            <p className="text-[11px] text-slate-500 mt-1">{CONTACT.businessHours}</p>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {bulkStatusOpen && (
          <EngineerBulkStatusModal
            ticketIds={Array.from(selection.selected).filter((id) => visibleIds.includes(id))}
            onClose={() => setBulkStatusOpen(false)}
            onDone={afterBulkAction}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
