import { Link } from "react-router-dom";
import Card from "../ui/Card";
import Badge from "../ui/Badge";

// Visually modeled on tickets/AIAssistantPanel.jsx (Card + small badge +
// bullet content), but computed entirely client-side from the already-
// fetched, already-bucketed ticket set (utils/dailyBrief.js) — no network
// call, no LLM. Badge copy deliberately avoids "Mock provider": that phrase
// belongs to ai_assistant_service.py's swappable-AI abstraction, which this
// feature doesn't use.
export default function AIDailyBriefCard({ brief }) {
  const { bullets, focusTicket } = brief;

  return (
    <Card title="DAILY BRIEF">
      <div className="flex items-center gap-1.5 mb-3 -mt-1">
        <Badge label="Auto-generated summary" tone="indigo" size="sm" />
      </div>

      {bullets.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing urgent — your queue is in good shape.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {bullets.map((b) => (
            <li key={b.text} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-indigo-600 shrink-0">{b.count}</span>
              <span>ticket{b.count !== 1 ? "s" : ""} {b.text}</span>
            </li>
          ))}
        </ul>
      )}

      {focusTicket && (
        <Link
          to={`/tickets/${focusTicket.id}`}
          className="block bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 hover:border-indigo-300 transition-colors"
        >
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-1">Suggested focus</p>
          <p className="text-xs font-semibold text-slate-900 truncate">{focusTicket.title}</p>
          <p className="text-[11px] text-slate-500 font-mono">{focusTicket.ticket_number}</p>
        </Link>
      )}
    </Card>
  );
}
