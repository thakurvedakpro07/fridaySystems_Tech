import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Select from "../ui/Select";
import Skeleton from "../ui/Skeleton";
import { getAIAssistant, logAIDraftInsert } from "../../api/aiAssistant";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
];

// Internal agent-assist tool — mock-provider today (support_app/services/
// ai_assistant_service.py), swappable for a real LLM later with no
// frontend changes. Only rendered for ticket-management staff (see
// TicketSummarySidebar) — customers and freelancers never see this.
export default function AIAssistantPanel({ ticketId, onDraftChange, composerId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tone, setTone] = useState("professional");
  const [inserted, setInserted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAIAssistant(ticketId, tone)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setError("Couldn't load AI suggestions right now."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticketId, tone]);

  const handleInsert = () => {
    if (!data?.draft_reply) return;
    onDraftChange?.(data.draft_reply);
    setInserted(true);
    requestAnimationFrame(() => {
      document.getElementById(composerId)?.focus();
      document.getElementById(composerId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    logAIDraftInsert(ticketId, tone).catch(() => {});
    setTimeout(() => setInserted(false), 2500);
  };

  return (
    <Card title="AI ASSISTANT">
      <div className="flex items-center gap-1.5 mb-3 -mt-1">
        <Badge label="Mock provider" tone="violet" size="sm" />
        <span className="text-[11px] text-slate-400">Suggestions, not certainty — verify before use</span>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-4 w-1/3 rounded" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {!loading && error && <p className="text-xs text-rose-600">{error}</p>}

      {!loading && data && (
        <div className="space-y-4">
          <AISection label="Suggested Root Cause">
            <p className="text-xs text-slate-700 leading-relaxed">{data.root_cause}</p>
          </AISection>

          <AISection label="Suggested Resolution">
            <p className="text-xs text-slate-700 leading-relaxed">{data.resolution}</p>
          </AISection>

          {data.related_articles?.length > 0 && (
            <AISection label="Related Articles">
              <div className="space-y-1.5">
                {data.related_articles.map((a) => (
                  <Link
                    key={a.id}
                    to={`/knowledge-base/${a.id}`}
                    className="block text-xs text-indigo-600 hover:text-indigo-800 hover:underline truncate"
                  >
                    {a.title}
                  </Link>
                ))}
              </div>
            </AISection>
          )}

          {data.similar_tickets?.length > 0 && (
            <AISection label="Similar Tickets">
              <div className="space-y-1.5">
                {data.similar_tickets.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="flex items-center justify-between gap-2 text-xs group"
                  >
                    <span className="text-slate-600 group-hover:text-slate-900 truncate">{t.title}</span>
                    <Badge label={t.status} domain="ticketStatus" size="sm" />
                  </Link>
                ))}
              </div>
            </AISection>
          )}

          <AISection label="Draft Customer Reply">
            <div className="space-y-2">
              <Select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full text-xs">
                {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{data.draft_reply}</p>
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={handleInsert}>
                {inserted ? "Inserted ✓" : "Insert into reply"}
              </Button>
            </div>
          </AISection>
        </div>
      )}
    </Card>
  );
}

function AISection({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  );
}
